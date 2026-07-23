import { memo, useCallback, useEffect, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { Icon } from "../../shared/Icon";
import { completeFileSystemPath } from "../../shared/api";

const DEFAULT_TERMINAL_CWD = "C:\\";
const MAX_PENDING_OUTPUT = 256 * 1024;

export const TerminalWorkspace = memo(function TerminalWorkspace({ open, onToggleOpen }) {
  const [projectPath] = useState(DEFAULT_TERMINAL_CWD);
  const terminalSequenceRef = useRef(1);
  const [hasOpened, setHasOpened] = useState(open);
  const [terminalState, setTerminalState] = useState(() => {
    const initialTerminal = createTerminalDescriptor({ title: "Terminal 1", cwd: DEFAULT_TERMINAL_CWD });
    return {
      activeId: initialTerminal.id,
      items: [initialTerminal],
    };
  });
  const [statuses, setStatuses] = useState({});
  const terminals = terminalState.items;
  const activeTerminalId = terminalState.activeId;

  function addTerminal() {
    terminalSequenceRef.current += 1;
    const terminal = createTerminalDescriptor({
      title: `Terminal ${terminalSequenceRef.current}`,
      cwd: projectPath,
    });
    setTerminalState((current) => {
      return {
        activeId: terminal.id,
        items: [...current.items, terminal],
      };
    });
  }

  function closeTerminal(id) {
    if (terminals.length === 1) {
      terminalSequenceRef.current = 0;
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
    if (terminals.length) return;

    terminalSequenceRef.current += 1;
    const terminal = createTerminalDescriptor({
      title: `Terminal ${terminalSequenceRef.current}`,
      cwd: projectPath,
    });
    setTerminalState({ activeId: terminal.id, items: [terminal] });
  }, [open, projectPath, terminals.length]);

  if (!open && !hasOpened) return null;

  // Keep sessions mounted while minimized (just hide the panel). Unmounting
  // would close every pty at once, which can crash node-pty on Windows.
  return (
    <>
      <Paper elevation={10} className={open ? "terminalWorkspace" : "terminalWorkspace isMinimized"}>
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
                {terminal.title || `Terminal ${index + 1}`}
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
            onStatus={reportStatus}
          />
        ))}
        </Box>
      </Paper>
    </>
  );
});

function TerminalPane({ active, cwd, terminalId, onStatus }) {
  const terminalHostRef = useRef(null);
  const terminalRef = useRef(null);
  const fitAddonRef = useRef(null);
  const socketRef = useRef(null);
  const inputLineRef = useRef("");
  const currentCwdRef = useRef(cwd);
  const visibleRef = useRef(active);
  const pendingOutputRef = useRef("");
  const [status, setStatus] = useState("conectando");

  useEffect(() => {
    onStatus?.(terminalId, status);
  }, [onStatus, status, terminalId]);

  useEffect(() => {
    if (!terminalHostRef.current || !cwd) return undefined;

    const terminal = new Terminal({
      allowProposedApi: false,
      allowTransparency: false,
      convertEol: true,
      cursorBlink: true,
      cursorStyle: "bar",
      fontFamily: '"Cascadia Code", "SFMono-Regular", Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.18,
      theme: {
        background: "#07090d",
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
    terminal.open(terminalHostRef.current);
    fitAddon.fit();

    const socket = new WebSocket(createTerminalUrl(cwd, terminal.cols, terminal.rows));
    socketRef.current = socket;

    const inputDisposable = terminal.onData((data) => {
      if (data === "\t") {
        completePathInput();
        return;
      }
      trackInputLine(data);
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
        if (visibleRef.current) {
          terminal.write(message.data);
        } else {
          pendingOutputRef.current = appendPendingOutput(pendingOutputRef.current, message.data);
        }
        updateCwdFromOutput(message.data);
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
    const resizeObserver = new ResizeObserver((entries) => {
      // Skip while hidden (minimized) — fitting a 0-size element breaks xterm.
      const rect = entries[0]?.contentRect;
      if (rect && (rect.width === 0 || rect.height === 0)) return;

      if (fitFrame) window.cancelAnimationFrame(fitFrame);
      fitFrame = window.requestAnimationFrame(() => {
        fitFrame = null;
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
    });
    resizeObserver.observe(terminalHostRef.current);

    return () => {
      resizeObserver.disconnect();
      if (fitFrame) window.cancelAnimationFrame(fitFrame);
      inputDisposable.dispose();
      socket.close();
      terminal.dispose();
      pendingOutputRef.current = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwd]);

  useEffect(() => {
    visibleRef.current = active;
    if (!active) return;

    window.requestAnimationFrame(() => {
      const pending = pendingOutputRef.current;
      pendingOutputRef.current = "";
      if (pending) terminalRef.current?.write(pending);
      fitAddonRef.current?.fit();
      terminalRef.current?.focus();
    });
  }, [active]);

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
      />
    </Paper>
  );

  function writeToTerminal(data) {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "input", data }));
      trackInputLine(data);
    }
  }

  function trackInputLine(data) {
    for (const char of data) {
      if (char === "\r" || char === "\n") {
        inputLineRef.current = "";
      } else if (char === "\u007f" || char === "\b") {
        inputLineRef.current = inputLineRef.current.slice(0, -1);
      } else if (char >= " ") {
        inputLineRef.current += char;
      }
    }
  }

  async function completePathInput() {
    const token = readPathToken(inputLineRef.current);
    if (!token.value) return;

    try {
      const result = await completeFileSystemPath(currentCwdRef.current, token.value);
      if (!result.replacement || result.replacement === token.value) return;
      const insertion = result.replacement.slice(token.value.length);
      if (insertion) {
        writeToTerminal(insertion);
      }
    } catch {
      // Shell completion remains available if Firekeep cannot resolve a path.
    }
  }

  function updateCwdFromOutput(data) {
    const matches = [...data.matchAll(/PS ([A-Z]:\\[^>\r\n]*)> /gi)];
    const lastMatch = matches.at(-1);
    if (lastMatch?.[1]) {
      currentCwdRef.current = lastMatch[1];
    }
  }
}

function appendPendingOutput(current, incoming) {
  const next = `${current}${incoming}`;
  if (next.length <= MAX_PENDING_OUTPUT) return next;
  const notice = "\r\n[saida anterior omitida]\r\n";
  return `${notice}${next.slice(-(MAX_PENDING_OUTPUT - notice.length))}`;
}

function createTerminalDescriptor({ title, cwd } = {}) {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: title || "Terminal",
    cwd: cwd || "",
  };
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

function readPathToken(line) {
  const match = line.match(/(?:"[^"]*|'[^']*'|[^\s]+)$/);
  return {
    value: match?.[0] ?? "",
  };
}
