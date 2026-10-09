import { memo, useCallback, useEffect, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { Icon } from "../../shared/Icon";

const DEFAULT_TERMINAL_CWD = "C:\\";

export const TerminalWorkspace = memo(function TerminalWorkspace({
  open,
  onToggleOpen,
  gridClassName = "",
  gridDraggable = false,
  onGridDragStart,
  onGridDragOver,
  onGridDrop,
}) {
  const [projectPath] = useState(DEFAULT_TERMINAL_CWD);
  const [fontSize, setFontSize] = useState(13);
  const [hasOpened, setHasOpened] = useState(open);
  const [terminalState, setTerminalState] = useState(() => {
    const initialTerminal = createTerminalDescriptor({ number: 1, cwd: DEFAULT_TERMINAL_CWD });
    return {
      activeId: initialTerminal.id,
      items: [initialTerminal],
    };
  });
  const [statuses, setStatuses] = useState({});
  const terminals = terminalState.items;
  const activeTerminalId = terminalState.activeId;

  function addTerminal() {
    setTerminalState((current) => {
      const terminal = createTerminalDescriptor({
        number: firstAvailableTerminalNumber(current.items),
        cwd: projectPath,
      });
      return {
        activeId: terminal.id,
        items: [...current.items, terminal],
      };
    });
  }

  function closeTerminal(id) {
    if (terminals.length === 1) {
      setTerminalState({ activeId: null, items: [] });
      setStatuses({});
      onToggleOpen();
      return;
    }

    setTerminalState((current) => {
      const items = current.items.filter((terminal) => terminal.id !== id);
      const activeId = current.activeId === id ? items.at(-1)?.id ?? items[0].id : current.activeId;

      return { activeId, items };
    });
    setStatuses((current) => {
      const { [id]: _removed, ...rest } = current;
      return rest;
    });
  }

  function selectTerminal(id) {
    setTerminalState((current) => ({ ...current, activeId: id }));
  }

  function changeZoom(delta) {
    setFontSize((current) => Math.max(10, Math.min(22, current + delta)));
  }

  function renameTerminal(id) {
    const terminal = terminals.find((item) => item.id === id);
    const next = window.prompt("Nome da sessao", terminal?.title ?? "");
    if (next == null) return;
    const title = next.trim();
    if (!title) return;

    setTerminalState((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, title } : item)),
    }));
  }

  const reportStatus = useCallback((id, status) => {
    setStatuses((current) => (current[id] === status ? current : { ...current, [id]: status }));
  }, []);

  useEffect(() => {
    if (!open) return;
    setHasOpened(true);
    setTerminalState((current) => {
      if (current.items.length) return current;
      const terminal = createTerminalDescriptor({
        number: firstAvailableTerminalNumber(current.items),
        cwd: projectPath,
      });
      return { activeId: terminal.id, items: [terminal] };
    });
  }, [open, projectPath]);

  if (!open && !hasOpened) return null;

  // Keep sessions mounted while minimized (just hide the panel). Unmounting
  // would close every pty at once, which can crash node-pty on Windows.
  return (
    <>
      <Paper
        elevation={10}
        className={open ? `terminalWorkspace ${gridClassName}` : `terminalWorkspace isMinimized ${gridClassName}`}
        onDragOver={onGridDragOver}
        onDrop={onGridDrop}
      >
        {gridDraggable ? <GridDragHandle onDragStart={onGridDragStart} /> : null}
        <Stack className="terminalTabBar" direction="row" sx={{ alignItems: "center", gap: 0.6 }}>
        <Stack className="terminalTabs" direction="row" sx={{ gap: 0.6 }}>
          {terminals.map((terminal, index) => (
            <Box
              key={terminal.id}
              className={terminal.id === activeTerminalId ? "terminalTab isActive" : "terminalTab"}
              onClick={() => selectTerminal(terminal.id)}
              onDoubleClick={() => renameTerminal(terminal.id)}
              title="Clique para focar, duplo clique para renomear"
            >
              <span
                className={statuses[terminal.id] === "online" ? "terminalTabDot isOnline" : "terminalTabDot"}
              />
              <Typography component="span" className="terminalTabLabel">
                {terminal.title || `Terminal ${terminal.number ?? index + 1}`}
              </Typography>
              <IconButton
                className="terminalTabClose"
                size="small"
                onClick={(event) => {
                  event.stopPropagation();
                  closeTerminal(terminal.id);
                }}
                aria-label="Fechar sessao"
              >
                <Icon name="close" fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Stack>
        <Tooltip title="Nova sessao">
          <IconButton className="terminalTabAdd" onClick={addTerminal} aria-label="Nova sessao">
            <Icon name="add" fontSize="small" />
          </IconButton>
        </Tooltip>
        <Box className="terminalZoom" aria-label="Zoom do terminal">
          <Tooltip title="Diminuir zoom">
            <span>
              <IconButton size="small" disabled={fontSize <= 10} onClick={() => changeZoom(-1)} aria-label="Diminuir zoom do terminal">
                <Typography component="span" className="terminalZoomSymbol">A−</Typography>
              </IconButton>
            </span>
          </Tooltip>
          <Typography variant="caption" className="terminalZoomValue">{fontSize}px</Typography>
          <Tooltip title="Aumentar zoom">
            <span>
              <IconButton size="small" disabled={fontSize >= 22} onClick={() => changeZoom(1)} aria-label="Aumentar zoom do terminal">
                <Typography component="span" className="terminalZoomSymbol">A+</Typography>
              </IconButton>
            </span>
          </Tooltip>
        </Box>
        <Tooltip title="Minimizar terminal">
          <IconButton className="terminalMinimize" size="small" onClick={onToggleOpen} aria-label="Minimizar terminal">
            <Icon name="minimize" fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Box className="terminalStage">
        {terminals.map((terminal) => (
          <TerminalPane
            key={terminal.id}
            active={open && terminal.id === activeTerminalId}
            cwd={terminal.cwd || projectPath}
            terminalId={terminal.id}
            fontSize={fontSize}
            onStatus={reportStatus}
            onZoom={changeZoom}
          />
        ))}
        </Box>
      </Paper>
    </>
  );
});

function GridDragHandle({ onDragStart }) {
  return (
    <Box className="gridDragHandle" draggable onDragStart={onDragStart} aria-label="Arraste para trocar a posição desta tela">
      <Icon name="grid" fontSize="inherit" />
      Mover
    </Box>
  );
}

function TerminalPane({ active, cwd, terminalId, fontSize, onStatus, onZoom }) {
  const terminalHostRef = useRef(null);
  const terminalRef = useRef(null);
  const fitAddonRef = useRef(null);
  const socketRef = useRef(null);
  const zoomWheelDeltaRef = useRef(0);
  const [status, setStatus] = useState("conectando");

  useEffect(() => {
    onStatus?.(terminalId, status);
  }, [onStatus, status, terminalId]);

  // Usa captura nativa (não o onWheel do React) para parar o evento antes que
  // o xterm processe a roda e role o histórico junto com o zoom.
  useEffect(() => {
    const host = terminalHostRef.current;
    if (!host) return undefined;
    const handleWheel = (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      zoomWheelDeltaRef.current += event.deltaY;
      if (Math.abs(zoomWheelDeltaRef.current) < 40) return;
      onZoom(zoomWheelDeltaRef.current < 0 ? 1 : -1);
      zoomWheelDeltaRef.current = 0;
    };
    host.addEventListener("wheel", handleWheel, { capture: true, passive: false });
    return () => host.removeEventListener("wheel", handleWheel, { capture: true });
  }, [onZoom]);

  useEffect(() => {
    if (!terminalHostRef.current || !cwd) return undefined;

    const terminal = new Terminal({
      // O addon Unicode 11 usa terminal.unicode, que e API proposta.
      allowProposedApi: true,
      allowTransparency: true,
      cursorBlink: true,
      cursorStyle: "bar",
      fontFamily: '"Cascadia Code", "Cascadia Mono", "SFMono-Regular", Consolas, monospace',
      fontSize,
      lineHeight: 1.18,
      scrollback: 5000,
      theme: {
        background: "#00000000",
        foreground: "#f2ecdd",
        cursor: "#ff8c42",
        selectionBackground: "#40312a",
        black: "#07090d",
        blue: "#79a8ff",
        brightBlack: "#70695d",
        brightBlue: "#9bbcff",
        brightCyan: "#a6f2df",
        brightGreen: "#a8e6b1",
        brightMagenta: "#ffadc7",
        brightRed: "#ff8b75",
        brightWhite: "#fff8ec",
        brightYellow: "#ffd58c",
        cyan: "#79dac7",
        green: "#8bd99f",
        magenta: "#e696b1",
        red: "#e55d45",
        white: "#f2eadb",
        yellow: "#ffb35c",
      },
    });
    const fitAddon = new FitAddon();
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    terminal.loadAddon(fitAddon);

    // Unicode 11: emojis, simbolos e glifos largos passam a ocupar 2 colunas,
    // como os apps de tela cheia (Claude Code, Codex, opencode) assumem. Sem
    // isso a grade do xterm diverge da do app e o texto sai cortado/deslocado.
    terminal.loadAddon(new Unicode11Addon());
    terminal.unicode.activeVersion = "11";

    terminal.open(terminalHostRef.current);
    const webgl = loadWebglRenderer(terminal);
    fitAddon.fit();

    const socket = new WebSocket(createTerminalUrl(cwd, terminal.cols, terminal.rows));
    socketRef.current = socket;

    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown" || !event.ctrlKey || event.shiftKey || event.altKey) return true;
      if (event.key.toLowerCase() === "c" && terminal.hasSelection()) {
        navigator.clipboard?.writeText(terminal.getSelection()).catch(() => {});
        return false;
      }
      return true;
    });

    const inputDisposable = terminal.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "input", data }));
      }
    });

    socket.addEventListener("open", () => {
      setStatus("online");
      terminal.focus();
    });

    socket.addEventListener("message", (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.type === "output") {
        // Escreve sempre, mesmo com a aba oculta: o xterm processa em segundo
        // plano e nada e perdido/fatiado. Quando o xterm termina de consumir o
        // bloco, confirmamos ao servidor para liberar o controle de fluxo.
        const chars = message.data.length;
        terminal.write(message.data, () => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ack", chars }));
          }
        });
      }
      if (message.type === "hello") {
        // ConPTY precisa das heuristicas de quebra de linha do xterm para Windows.
        terminal.options.windowsPty = message.windowsPty ?? {};
      }
      if (message.type === "error") {
        terminal.writeln(`\r\n${message.data}`);
        setStatus("erro");
      }
      if (message.type === "exit") {
        terminal.writeln(`\r\nprocesso finalizado (${message.exitCode})`);
        setStatus("finalizado");
      }
    });

    socket.addEventListener("close", () => {
      setStatus((current) => (current === "finalizado" || current === "erro" ? current : "desconectado"));
    });

    // fit() e caro; durante um redimensionamento a callback dispara em rajada,
    // entao adiamos para um unico frame e so avisamos o pty se cols/rows mudaram.
    let fitFrame = null;
    let lastCols = terminal.cols;
    let lastRows = terminal.rows;
    const scheduleFit = () => {
      if (fitFrame) window.cancelAnimationFrame(fitFrame);
      fitFrame = window.requestAnimationFrame(() => {
        fitFrame = null;
        const host = terminalHostRef.current;
        // Skip while hidden (minimized) — fitting a 0-size element breaks xterm.
        if (!host || host.clientWidth === 0 || host.clientHeight === 0) return;
        fitAddon.fit();
        if (socket.readyState === WebSocket.OPEN && (terminal.cols !== lastCols || terminal.rows !== lastRows)) {
          lastCols = terminal.cols;
          lastRows = terminal.rows;
          socket.send(
            JSON.stringify({
              type: "resize",
              cols: terminal.cols,
              rows: terminal.rows,
            }),
          );
        }
      });
    };
    const resizeObserver = new ResizeObserver(scheduleFit);
    resizeObserver.observe(terminalHostRef.current);

    // A fonte do terminal (Cascadia) costuma carregar depois do primeiro fit():
    // a celula cresce, o numero de linhas calculado deixa de caber e a ultima
    // linha (a de status do Claude Code/Codex) fica cortada. Refaz o fit quando
    // as fontes terminam de carregar.
    const fonts = document.fonts;
    fonts?.ready.then(scheduleFit).catch(() => {});
    fonts?.addEventListener("loadingdone", scheduleFit);

    return () => {
      resizeObserver.disconnect();
      fonts?.removeEventListener("loadingdone", scheduleFit);
      if (fitFrame) window.cancelAnimationFrame(fitFrame);
      inputDisposable.dispose();
      socket.close();
      webgl?.dispose();
      terminal.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwd]);

  useEffect(() => {
    if (!active) return;

    window.requestAnimationFrame(() => {
      const terminal = terminalRef.current;
      if (!terminal) return;
      fitAddonRef.current?.fit();
      // A aba ficou oculta (visibility: hidden); forca o redesenho da tela.
      terminal.refresh(0, terminal.rows - 1);
      terminal.focus();
    });
  }, [active]);

  useEffect(() => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    if (!terminal || !fitAddon) return;
    terminal.options.fontSize = fontSize;
    window.requestAnimationFrame(() => {
      fitAddon.fit();
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "resize", cols: terminal.cols, rows: terminal.rows }));
      }
    });
  }, [fontSize]);

  return (
    <Paper elevation={4} className={active ? "terminalPane isActive" : "terminalPane isHidden"}>
      <Box
        ref={terminalHostRef}
        className="terminalHost"
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("application/firekeep-path")) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }
        }}
        onDrop={(event) => {
          const raw = event.dataTransfer.getData("application/firekeep-path");
          if (!raw) return;
          event.preventDefault();
          try {
            const item = JSON.parse(raw);
            const command = item.type === "dir" ? `cd ${quoteShellPath(item.path)}\r` : quoteShellPath(item.path);
            writeToTerminal(command);
          } catch {
            const path = event.dataTransfer.getData("text/plain");
            if (path) writeToTerminal(quoteShellPath(path));
          }
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          navigator.clipboard
            ?.readText()
            .then((text) => {
              // terminal.paste respeita o bracketed paste: o Claude Code e o
              // Codex recebem o texto como UMA colagem, em vez de linha a linha
              // (que disparava Enter a cada quebra e cortava o conteudo).
              if (text) terminalRef.current?.paste(text);
            })
            .catch(() => {});
        }}
      />
    </Paper>
  );

  function writeToTerminal(data) {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "input", data }));
    }
  }
}

// Renderer WebGL: muito mais rapido que o DOM e sem artefatos de cursor em apps
// com redesenho de tela inteira. Se a GPU nao estiver disponivel (ou o contexto
// for perdido), cai de volta para o renderer DOM sem quebrar o terminal.
function loadWebglRenderer(terminal) {
  try {
    const webgl = new WebglAddon();
    webgl.onContextLoss(() => webgl.dispose());
    terminal.loadAddon(webgl);
    return webgl;
  } catch (error) {
    console.warn("[firekeep] renderer WebGL indisponivel, usando DOM:", error);
    return null;
  }
}

function createTerminalDescriptor({ number, title, cwd } = {}) {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    number: Number.isInteger(number) && number > 0 ? number : 1,
    title: title || `Terminal ${number ?? 1}`,
    cwd: cwd || "",
  };
}

function firstAvailableTerminalNumber(items) {
  const usedNumbers = new Set(items.map((terminal) => terminal.number).filter(Number.isInteger));
  let number = 1;
  while (usedNumbers.has(number)) number += 1;
  return number;
}

function createTerminalUrl(cwd, cols, rows) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const params = new URLSearchParams({
    cwd,
    cols: String(cols),
    rows: String(rows),
  });
  return `${protocol}//${window.location.host}/api/terminal?${params.toString()}`;
}

function quoteShellPath(value) {
  return `"${String(value).replaceAll('"', '`"')}"`;
}
