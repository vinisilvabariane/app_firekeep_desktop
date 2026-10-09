import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pty from "node-pty";
import { WebSocket, WebSocketServer } from "ws";
import { assertDirectory } from "./fs-service.js";
import { clampNumber, toMessage } from "./utils.js";

// Limites generosos: o tamanho real vem do xterm (fit) no cliente. Se o pty
// ficar com um tamanho diferente do xterm, apps de tela cheia desenham para
// uma grade errada e o texto sai cortado/desalinhado.
const MIN_COLS = 2;
const MAX_COLS = 1000;
const MIN_ROWS = 2;
const MAX_ROWS = 500;

// Controle de fluxo: o cliente confirma (ack) cada bloco que o xterm terminou
// de processar. Quando o acumulado sem confirmacao passa do limite alto,
// pausamos o pty; voltamos quando cair abaixo do limite baixo. Isso evita que
// apps com redesenho intenso (Claude Code, Codex, opencode) encham a fila do
// xterm, o que atrasa a renderizacao e trava a digitacao.
const FLOW_HIGH_WATER = 256 * 1024;
const FLOW_LOW_WATER = 64 * 1024;

// Agrupa a saida por alguns ms para nao mandar centenas de frames minusculos,
// mas sem fatiar o conteudo: cada flush envia tudo o que acumulou.
const OUTPUT_COALESCE_MS = 4;

const IS_WINDOWS = process.platform === "win32";

export function createTerminalGateway({ httpServer, root }) {
  const terminalServer = new WebSocketServer({ noServer: true });
  const terminals = new Set();
  const cleanupTimers = new Set();

  // node-pty on Windows throws if the process already exited; never let that
  // bubble up, or the unhandled error takes down the whole app.
  const safePty = (action) => {
    try {
      action();
    } catch {
      // terminal already gone — nothing to clean up
    }
  };

  httpServer.on("upgrade", (request, socket, head) => {
    const requestUrl = new URL(request.url ?? "", "http://127.0.0.1");
    if (requestUrl.pathname !== "/api/terminal") return;

    terminalServer.handleUpgrade(request, socket, head, (webSocket) => {
      terminalServer.emit("connection", webSocket, request, requestUrl);
    });
  });

  terminalServer.on("connection", async (webSocket, _request, requestUrl) => {
    const cwd = path.resolve(requestUrl.searchParams.get("cwd") || root);
    const cols = clampNumber(Number(requestUrl.searchParams.get("cols")), MIN_COLS, MAX_COLS, 100);
    const rows = clampNumber(Number(requestUrl.searchParams.get("rows")), MIN_ROWS, MAX_ROWS, 28);

    const send = (payload) => {
      if (webSocket.readyState === WebSocket.OPEN) webSocket.send(JSON.stringify(payload));
    };

    try {
      await assertDirectory(cwd);
    } catch (error) {
      send({ type: "error", data: toMessage(error, "Pasta invalida.") });
      webSocket.close();
      return;
    }

    let spawned;
    try {
      spawned = spawnShell({ cwd, cols, rows });
    } catch (error) {
      send({ type: "error", data: toMessage(error, "Nao foi possivel iniciar o shell.") });
      webSocket.close();
      return;
    }

    const { terminal, shell, conpty } = spawned;
    terminals.add(terminal);

    // Diz ao xterm como o backend se comporta (ConPTY tem heuristicas proprias
    // de quebra de linha) e qual shell esta rodando.
    send({
      type: "hello",
      shell: shell.label,
      windowsPty: conpty ? { backend: "conpty", buildNumber: windowsBuildNumber() } : null,
    });

    let terminalExited = false;
    let outputBuffer = "";
    let outputTimer = null;
    let unackedChars = 0;
    let paused = false;

    function flushOutput() {
      outputTimer = null;
      if (!outputBuffer) return;
      if (webSocket.readyState !== WebSocket.OPEN) {
        outputBuffer = "";
        return;
      }
      const data = outputBuffer;
      outputBuffer = "";
      unackedChars += data.length;
      webSocket.send(JSON.stringify({ type: "output", data }));
      if (!paused && unackedChars > FLOW_HIGH_WATER) {
        paused = true;
        safePty(() => terminal.pause());
      }
    }

    function acknowledge(chars) {
      if (!Number.isFinite(chars) || chars <= 0) return;
      unackedChars = Math.max(0, unackedChars - Math.floor(chars));
      if (paused && unackedChars < FLOW_LOW_WATER) {
        paused = false;
        safePty(() => terminal.resume());
      }
    }

    terminal.onData((data) => {
      if (webSocket.readyState !== WebSocket.OPEN) return;
      outputBuffer += data;
      if (outputTimer === null) outputTimer = setTimeout(flushOutput, OUTPUT_COALESCE_MS);
    });

    terminal.onExit(({ exitCode }) => {
      terminalExited = true;
      if (outputTimer !== null) clearTimeout(outputTimer);
      outputTimer = null;
      flushOutput();
      terminals.delete(terminal);
      if (webSocket.readyState === WebSocket.OPEN) {
        send({ type: "exit", exitCode });
        webSocket.close();
      }
    });

    webSocket.on("message", (rawMessage) => {
      let message;
      try {
        message = JSON.parse(rawMessage.toString());
      } catch {
        return;
      }

      if (message.type === "input" && typeof message.data === "string") {
        safePty(() => terminal.write(message.data));
        return;
      }

      if (message.type === "ack") {
        acknowledge(Number(message.chars));
        return;
      }

      if (message.type === "resize") {
        const nextCols = clampNumber(Number(message.cols), MIN_COLS, MAX_COLS, cols);
        const nextRows = clampNumber(Number(message.rows), MIN_ROWS, MAX_ROWS, rows);
        safePty(() => terminal.resize(nextCols, nextRows));
      }
    });

    webSocket.on("close", () => {
      if (outputTimer !== null) clearTimeout(outputTimer);
      outputTimer = null;
      outputBuffer = "";
      terminals.delete(terminal);
      if (!terminalExited) {
        // Um pty pausado nunca encerra; libera antes de pedir para sair.
        if (paused) safePty(() => terminal.resume());
        safePty(() => terminal.write("exit\r"));
        const cleanupTimer = setTimeout(() => {
          cleanupTimers.delete(cleanupTimer);
          if (!terminalExited) {
            safePty(() => terminal.kill());
          }
        }, 800);
        cleanupTimers.add(cleanupTimer);
      }
    });
  });

  return {
    close() {
      for (const terminal of terminals) {
        safePty(() => terminal.kill());
      }
      for (const cleanupTimer of cleanupTimers) {
        clearTimeout(cleanupTimer);
      }
      terminals.clear();
      cleanupTimers.clear();
      terminalServer.close();
    },
  };
}

function spawnShell({ cwd, cols, rows }) {
  const shell = getDefaultShell();
  const env = {
    ...process.env,
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    TERM_PROGRAM: "firekeep",
  };
  const baseOptions = { name: "xterm-256color", cols, rows, cwd, env };

  if (!IS_WINDOWS) {
    return { terminal: pty.spawn(shell.command, shell.args, baseOptions), shell, conpty: false };
  }

  // O conpty.dll empacotado com o node-pty (o mesmo do Windows Terminal) corrige
  // varios bugs de cursor e de texto cortado do ConPTY nativo. E experimental,
  // entao se falhar caimos para o ConPTY do sistema. FIREKEEP_CONPTY_DLL=0 desliga.
  const useConptyDll = process.env.FIREKEEP_CONPTY_DLL !== "0";
  if (useConptyDll) {
    try {
      const terminal = pty.spawn(shell.command, shell.args, { ...baseOptions, useConpty: true, useConptyDll: true });
      return { terminal, shell, conpty: true };
    } catch (error) {
      console.warn("[firekeep] conpty.dll empacotado falhou, usando o ConPTY do sistema:", toMessage(error, error));
    }
  }

  return { terminal: pty.spawn(shell.command, shell.args, { ...baseOptions, useConpty: true }), shell, conpty: true };
}

function getDefaultShell() {
  if (process.env.FIREKEEP_SHELL) {
    return { command: process.env.FIREKEEP_SHELL, args: [], label: path.basename(process.env.FIREKEEP_SHELL) };
  }

  if (IS_WINDOWS) {
    // PowerShell 7 (pwsh) lida muito melhor com VT/ConPTY e tem PSReadLine novo;
    // o Windows PowerShell 5.1 fica como fallback.
    const pwsh = findOnPath("pwsh.exe");
    if (pwsh) {
      return { command: pwsh, args: ["-NoLogo"], label: "pwsh" };
    }
    return { command: "powershell.exe", args: ["-NoLogo"], label: "powershell" };
  }

  const command = process.env.SHELL || "/bin/bash";
  return { command, args: [], label: path.basename(command) };
}

function findOnPath(executable) {
  const dirs = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    const candidate = path.join(dir, executable);
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      // not here
    }
  }
  return null;
}

function windowsBuildNumber() {
  const build = Number(os.release().split(".")[2]);
  return Number.isFinite(build) ? build : undefined;
}
