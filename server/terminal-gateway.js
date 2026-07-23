import path from "node:path";
import pty from "node-pty";
import { WebSocket, WebSocketServer } from "ws";
import { assertDirectory } from "./fs-service.js";
import { clampNumber, toMessage } from "./utils.js";

const MAX_OUTPUT_BATCH = 64 * 1024;
const MAX_QUEUED_OUTPUT = 1024 * 1024;
const OUTPUT_OMITTED_NOTICE = "\r\n[saida excessiva omitida]\r\n";

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
    const cols = clampNumber(Number(requestUrl.searchParams.get("cols")), 40, 220, 100);
    const rows = clampNumber(Number(requestUrl.searchParams.get("rows")), 10, 80, 28);

    try {
      await assertDirectory(cwd);
    } catch (error) {
      webSocket.send(JSON.stringify({ type: "error", data: toMessage(error, "Pasta invalida.") }));
      webSocket.close();
      return;
    }

    const shell = getDefaultShell();
    const terminal = pty.spawn(shell.command, shell.args, {
      name: "xterm-256color",
      cols,
      rows,
      cwd,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
      },
    });

    terminals.add(terminal);
    let terminalExited = false;
    let outputBuffer = "";
    let outputTimer = null;

    function flushOutput() {
      outputTimer = null;
      if (!outputBuffer || webSocket.readyState !== WebSocket.OPEN) {
        outputBuffer = "";
        return;
      }

      const data = outputBuffer.slice(0, MAX_OUTPUT_BATCH);
      outputBuffer = outputBuffer.slice(data.length);
      webSocket.send(JSON.stringify({ type: "output", data }));
      if (outputBuffer) outputTimer = setTimeout(flushOutput, 16);
    }

    function drainOutput() {
      if (outputTimer !== null) clearTimeout(outputTimer);
      outputTimer = null;
      while (outputBuffer && webSocket.readyState === WebSocket.OPEN) {
        const data = outputBuffer.slice(0, MAX_OUTPUT_BATCH);
        outputBuffer = outputBuffer.slice(data.length);
        webSocket.send(JSON.stringify({ type: "output", data }));
      }
      outputBuffer = "";
    }

    terminal.onData((data) => {
      if (webSocket.readyState !== WebSocket.OPEN) return;
      outputBuffer += data;
      if (outputBuffer.length > MAX_QUEUED_OUTPUT) {
        const keep = MAX_QUEUED_OUTPUT - OUTPUT_OMITTED_NOTICE.length;
        outputBuffer = `${OUTPUT_OMITTED_NOTICE}${outputBuffer.slice(-keep)}`;
      }
      if (outputTimer === null) outputTimer = setTimeout(flushOutput, 16);
    });

    terminal.onExit(({ exitCode }) => {
      terminalExited = true;
      drainOutput();
      terminals.delete(terminal);
      if (webSocket.readyState === WebSocket.OPEN) {
        webSocket.send(JSON.stringify({ type: "exit", exitCode }));
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
      }

      if (message.type === "resize") {
        const nextCols = clampNumber(Number(message.cols), 40, 220, cols);
        const nextRows = clampNumber(Number(message.rows), 10, 80, rows);
        safePty(() => terminal.resize(nextCols, nextRows));
      }
    });

    webSocket.on("close", () => {
      if (outputTimer !== null) clearTimeout(outputTimer);
      outputTimer = null;
      outputBuffer = "";
      terminals.delete(terminal);
      if (!terminalExited) {
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

function getDefaultShell() {
  if (process.env.FIREKEEP_SHELL) {
    return { command: process.env.FIREKEEP_SHELL, args: [] };
  }

  if (process.platform === "win32") {
    return {
      command: "powershell.exe",
      args: ["-NoLogo", "-NoExit", "-Command", "function prompt { 'PS ' + (Get-Location).Path + '> ' }"],
    };
  }

  return {
    command: process.env.SHELL || "/bin/bash",
    args: [],
  };
}
