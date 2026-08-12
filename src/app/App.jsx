import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CssBaseline from "@mui/material/CssBaseline";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { ThemeProvider } from "@mui/material/styles";
import { EditorErrorBoundary } from "../features/editor/EditorErrorBoundary";
import { VisualDock } from "../features/background/VisualDock";
import { WindowChrome } from "../features/desktop/WindowChrome";
import { DateTimeWidget } from "../features/clock/DateTimeWidget";
import { PomodoroWidget } from "../features/pomodoro/PomodoroWidget";
import { DEFAULT_SETTINGS, normalizeSettings } from "../features/video/defaultVideos";
import { MusicDock } from "../features/video/MusicDock";
import { Icon } from "../shared/Icon";
import { useStoredState } from "../shared/storage";
import { createFirekeepTheme, theme } from "./theme";
import { useStartupSync } from "./useStartupSync";
import packageInfo from "../../package.json";
import "./App.css";

const LazyCodeEditor = lazy(() => import("../features/editor/CodeEditor").then(({ CodeEditor }) => ({ default: CodeEditor })));
const LazyFileExplorer = lazy(() => import("../features/explorer/FileExplorer").then(({ FileExplorer }) => ({ default: FileExplorer })));
const LazySearchBrowser = lazy(() => import("../features/browser/SearchBrowser").then(({ SearchBrowser }) => ({ default: SearchBrowser })));
const LazyTerminalWorkspace = lazy(() => import("../features/terminal/TerminalWorkspace").then(({ TerminalWorkspace }) => ({ default: TerminalWorkspace })));
const LazyGitWorkspace = lazy(() => import("../features/git/GitWorkspace").then(({ GitWorkspace }) => ({ default: GitWorkspace })));

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Firekeep />
    </ThemeProvider>
  );
}

// O App so compoe as features e guarda o que e realmente global (settings,
// arquivo aberto, visual ativo). Estados que mudam com frequencia — tick do
// pomodoro, progresso da musica, campos de digitacao — vivem dentro de cada
// feature para nao re-renderizar a arvore inteira.
function Firekeep() {
  const [storedSettings, setStoredSettings] = useStoredState("firekeep:settings:clean-v1", DEFAULT_SETTINGS);
  const settings = useMemo(() => normalizeSettings(storedSettings), [storedSettings]);
  const activeTheme = useMemo(() => createFirekeepTheme(settings.dominantColor), [settings.dominantColor]);
  const [openFile, setOpenFile] = useState(null);
  const [sessionVisual, setSessionVisual] = useState(null);
  const [videoCurtainVisible, setVideoCurtainVisible] = useState(true);
  const [startupSettled, setStartupSettled] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [gitOpen, setGitOpen] = useState(false);
  const [workspaceGrid, setWorkspaceGrid] = useState(false);
  const [gridOrder, setGridOrder] = useState(() => (Array.isArray(storedSettings.gridOrder) ? storedSettings.gridOrder : []));
  const [draggedGridPanel, setDraggedGridPanel] = useState(null);
  const [explorerMounted, setExplorerMounted] = useState(false);
  const [terminalMounted, setTerminalMounted] = useState(false);
  const [browserMounted, setBrowserMounted] = useState(false);
  const [downloadedUpdate, setDownloadedUpdate] = useState(null);
  const terminalOpen = startupSettled ? settings.terminalOpen : false;
  const explorerOpen = startupSettled ? settings.explorerOpen : false;

  useStartupSync(setStoredSettings);

  useEffect(() => globalThis.window?.firekeepWindow?.onUpdateReady?.(setDownloadedUpdate), []);

  const updateSettings = useCallback(
    (patch) => {
      setStoredSettings((current) => ({ ...normalizeSettings(current), ...patch }));
    },
    [setStoredSettings],
  );

  const toggleExplorer = useCallback(() => {
    setStoredSettings((current) => {
      const normalized = normalizeSettings(current);
      return { ...normalized, explorerOpen: !normalized.explorerOpen };
    });
  }, [setStoredSettings]);

  const toggleTerminal = useCallback(() => {
    setStoredSettings((current) => {
      const normalized = normalizeSettings(current);
      return { ...normalized, terminalOpen: !normalized.terminalOpen };
    });
  }, [setStoredSettings]);

  const closeEditor = useCallback(() => setOpenFile(null), []);
  const toggleBrowser = useCallback(() => setBrowserOpen((current) => !current), []);
  const closeBrowser = useCallback(() => {
    setBrowserOpen(false);
    setBrowserMounted(false);
  }, []);
  // Terminais e explorador sempre comecam fechados ao iniciar o app.
  useEffect(() => {
    setStoredSettings((current) => ({ ...normalizeSettings(current), terminalOpen: false, explorerOpen: false }));
    setStartupSettled(true);
  }, [setStoredSettings]);

  useEffect(() => {
    if (explorerOpen) setExplorerMounted(true);
    if (terminalOpen) setTerminalMounted(true);
    if (browserOpen) setBrowserMounted(true);
  }, [browserOpen, explorerOpen, terminalOpen]);

  const activeVisual = sessionVisual ?? {
    name: settings.visualName,
    url: settings.visualUrl,
  };

  useEffect(() => {
    setVideoCurtainVisible(true);
    const curtainTimer = window.setTimeout(() => {
      setVideoCurtainVisible(false);
    }, 2800);

    return () => window.clearTimeout(curtainTimer);
  }, [activeVisual.url]);

  const shadeStrength = Math.max(0, Math.min(1, (100 - settings.visualBrightness) / 80));
  const deepShadeStrength = Math.max(0, Math.min(1, (20 - settings.visualBrightness) / 20));
  const widgetsVisible = settings.pomodoroOpen || settings.clockOpen || settings.musicOpen || settings.visualOpen;
  const visibleGridPanelIds = useMemo(
    () => [
      openFile ? "editor" : null,
      browserOpen ? "browser" : null,
      terminalOpen ? "terminal" : null,
      gitOpen ? "git" : null,
    ].filter(Boolean),
    [browserOpen, gitOpen, openFile, terminalOpen],
  );
  const gridPanelIds = useMemo(
    () => [
      ...gridOrder.filter((id) => visibleGridPanelIds.includes(id)),
      ...visibleGridPanelIds.filter((id) => !gridOrder.includes(id)),
    ],
    [gridOrder, visibleGridPanelIds],
  );
  const moveGridPanel = useCallback(
    (id, targetIndex) => {
      setGridOrder((current) => {
        const currentOrder = [
          ...current.filter((item) => visibleGridPanelIds.includes(item)),
          ...visibleGridPanelIds.filter((item) => !current.includes(item)),
        ];
        const next = currentOrder.filter((item) => item !== id);
        next.splice(targetIndex, 0, id);
        updateSettings({ gridOrder: next });
        return next;
      });
    },
    [updateSettings, visibleGridPanelIds],
  );
  const startGridDrag = useCallback((id, event) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
    setDraggedGridPanel(id);
  }, []);
  const allowGridDrop = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);
  const dropGridPanel = useCallback(
    (targetId, event) => {
      event.preventDefault();
      const sourceId = event.dataTransfer.getData("text/plain") || draggedGridPanel;
      setDraggedGridPanel(null);
      if (!sourceId || sourceId === targetId) return;
      const targetIndex = gridPanelIds.indexOf(targetId);
      if (targetIndex >= 0) moveGridPanel(sourceId, targetIndex);
    },
    [draggedGridPanel, gridPanelIds, moveGridPanel],
  );
  const gridClassFor = (id) => {
    if (!workspaceGrid) return "";
    const index = gridPanelIds.indexOf(id);
    return index < 0 ? "" : `workspaceGridPane gridPane${index} gridCount${gridPanelIds.length}`;
  };
  const appClassName = [
    "app",
    explorerOpen ? "" : "explorerClosed",
    openFile ? "editorOpen" : "",
    openFile && terminalOpen ? "codeTerminalSplit" : "",
    workspaceGrid ? "workspaceGrid" : "",
    browserOpen ? "browserOpen" : "",
    gitOpen ? "gitOpen" : "",
    terminalOpen ? "terminalOpen" : "",
    widgetsVisible ? "" : "widgetsClosed",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <ThemeProvider theme={activeTheme}>
    <Box
      className={appClassName}
      style={{
        "--ember": settings.dominantColor,
        "--ember-deep": darken(settings.dominantColor, 0.16),
        "--ember-rgb": hexToRgb(settings.dominantColor),
      }}
    >
      <Box className="videoLayer">
        {activeVisual.url ? (
          <Box component="img" className="videoStill" src={activeVisual.url} alt="" />
        ) : (
          <Box className="defaultScene" aria-hidden="true">
            <Box className="defaultSceneGrid" />
            <Box className="defaultSceneHorizon" />
            <Box className="defaultSceneSignal" />
            <Box className="defaultSceneNoise" />
          </Box>
        )}
      </Box>
      <Box
        className="shade"
        style={{
          "--shade-side-alpha": 0.08 + shadeStrength * 0.32,
          "--shade-bottom-alpha": 0.18 + shadeStrength * 0.38,
          "--shade-radial-alpha": 0.12 + shadeStrength * 0.28,
          "--shade-uniform-alpha": deepShadeStrength * 0.48,
        }}
      />
      <Box className={videoCurtainVisible ? "videoCurtain isVisible" : "videoCurtain"} />
      <WindowChrome version={packageInfo.version} />
      <WorkspaceDock
        explorerOpen={explorerOpen}
        terminalOpen={terminalOpen}
        browserOpen={browserOpen}
        gitOpen={gitOpen}
        gridOpen={workspaceGrid}
        onToggleExplorer={toggleExplorer}
        onToggleTerminal={toggleTerminal}
        onToggleBrowser={toggleBrowser}
        onToggleGit={() => setGitOpen((current) => !current)}
        onToggleGrid={() => setWorkspaceGrid((current) => !current)}
        onToggleFullscreen={() => globalThis.window?.firekeepWindow?.toggleFullscreen?.()}
        pomodoroOpen={settings.pomodoroOpen}
        clockOpen={settings.clockOpen}
        musicOpen={settings.musicOpen}
        visualOpen={settings.visualOpen}
        onTogglePomodoro={() => updateSettings({ pomodoroOpen: !settings.pomodoroOpen })}
        onToggleClock={() => updateSettings({ clockOpen: !settings.clockOpen })}
        onToggleMusic={() => updateSettings({ musicOpen: !settings.musicOpen })}
        onToggleVisual={() => updateSettings({ visualOpen: !settings.visualOpen })}
      />

      {explorerMounted ? (
        <Suspense fallback={null}>
          <LazyFileExplorer
            open={explorerOpen}
            activePath={openFile?.path ?? null}
            onToggleOpen={toggleExplorer}
            onOpenFile={setOpenFile}
          />
        </Suspense>
      ) : null}

      <Stack className="rightWidgets" sx={{ gap: 1 }}>
        {settings.pomodoroOpen ? <PomodoroWidget /> : null}
        {settings.clockOpen ? <DateTimeWidget /> : null}
        {settings.musicOpen ? (
          <MusicDock
            youtubeLinks={settings.youtubeLinks}
            activeYoutubeUrl={settings.activeYoutubeUrl}
            onUpdateSettings={updateSettings}
          />
        ) : null}
        {settings.visualOpen ? (
          <VisualDock
            backgrounds={settings.backgrounds}
            visualUrl={settings.visualUrl}
            visualName={settings.visualName}
            visualBrightness={settings.visualBrightness}
            dominantColor={settings.dominantColor}
            sessionVisual={sessionVisual}
            onSessionVisualChange={setSessionVisual}
            onUpdateSettings={updateSettings}
          />
        ) : null}
      </Stack>

      {terminalMounted ? (
        <Suspense fallback={null}>
          <LazyTerminalWorkspace
            open={terminalOpen}
            onToggleOpen={toggleTerminal}
            gridClassName={gridClassFor("terminal")}
            gridDraggable={workspaceGrid}
            onGridDragStart={(event) => startGridDrag("terminal", event)}
            onGridDragOver={allowGridDrop}
            onGridDrop={(event) => dropGridPanel("terminal", event)}
          />
        </Suspense>
      ) : null}
      {browserMounted ? (
        <Suspense fallback={null}>
          <LazySearchBrowser
            open={browserOpen}
            onOpenChange={setBrowserOpen}
            onClose={closeBrowser}
            gridClassName={gridClassFor("browser")}
            gridDraggable={workspaceGrid}
            onGridDragStart={(event) => startGridDrag("browser", event)}
            onGridDragOver={allowGridDrop}
            onGridDrop={(event) => dropGridPanel("browser", event)}
          />
        </Suspense>
      ) : null}
      {gitOpen ? <Suspense fallback={null}><LazyGitWorkspace open={gitOpen} onClose={() => setGitOpen(false)} gridClassName={gridClassFor("git")} gridDraggable={workspaceGrid} onGridDragStart={(event) => startGridDrag("git", event)} onGridDragOver={allowGridDrop} onGridDrop={(event) => dropGridPanel("git", event)} /></Suspense> : null}
      {openFile ? (
        <EditorErrorBoundary key={openFile.path} onClose={closeEditor} gridClassName={gridClassFor("editor")}>
          <Suspense fallback={null}>
            <LazyCodeEditor
              file={openFile}
              onClose={closeEditor}
              gridClassName={gridClassFor("editor")}
              gridDraggable={workspaceGrid}
              onGridDragStart={(event) => startGridDrag("editor", event)}
              onGridDragOver={allowGridDrop}
              onGridDrop={(event) => dropGridPanel("editor", event)}
            />
          </Suspense>
        </EditorErrorBoundary>
      ) : null}
      <Dialog open={Boolean(downloadedUpdate)} onClose={() => setDownloadedUpdate(null)} PaperProps={{ className: "updateDialog" }}>
        <DialogContent><Typography variant="subtitle1" fontWeight={900}>Atualização pronta</Typography><Typography variant="body2">A versão {downloadedUpdate?.version} já foi baixada. Reinicie o Firekeep para concluir a atualização.</Typography></DialogContent>
        <DialogActions><Button onClick={() => setDownloadedUpdate(null)}>Mais tarde</Button><Button variant="contained" onClick={() => globalThis.window?.firekeepWindow?.installUpdate?.()}>Reiniciar agora</Button></DialogActions>
      </Dialog>
    </Box>
    </ThemeProvider>
  );
}

function hexToRgb(hex) {
  return hex.slice(1).match(/.{2}/g).map((value) => parseInt(value, 16)).join(", ");
}

function darken(hex, amount) {
  return `#${hex
    .slice(1)
    .match(/.{2}/g)
    .map((value) => Math.round(parseInt(value, 16) * (1 - amount)).toString(16).padStart(2, "0"))
    .join("")}`;
}

function WorkspaceDock({
  explorerOpen,
  terminalOpen,
  browserOpen,
  gitOpen,
  gridOpen,
  onToggleExplorer,
  onToggleTerminal,
  onToggleBrowser,
  onToggleGit,
  onToggleGrid,
  onToggleFullscreen,
  pomodoroOpen,
  clockOpen,
  musicOpen,
  visualOpen,
  onTogglePomodoro,
  onToggleClock,
  onToggleMusic,
  onToggleVisual,
}) {
  return (
    <Box className="workspaceDock" aria-label="Ferramentas do workspace">
      <WorkspaceDockButton
        icon="folder"
        label={explorerOpen ? "Fechar explorador" : "Abrir explorador"}
        onClick={onToggleExplorer}
      />
      <WorkspaceDockButton icon="git" label={gitOpen ? "Fechar Git" : "Abrir Git"} onClick={onToggleGit} />
      <WorkspaceDockButton
        icon="search"
        label={browserOpen ? "Fechar navegador" : "Abrir navegador"}
        onClick={onToggleBrowser}
      />
      <WorkspaceDockButton
        icon="terminal"
        label={terminalOpen ? "Fechar terminal" : "Abrir terminal"}
        onClick={onToggleTerminal}
      />
      <span className="workspaceDockDivider" />
      <WorkspaceDockButton
        active={gridOpen}
        icon="grid"
        label={gridOpen ? "Sair do grid" : "Organizar em grid"}
        onClick={onToggleGrid}
      />
      <WorkspaceDockButton icon="fullscreen" label="Tela cheia" onClick={onToggleFullscreen} />
      <span className="workspaceDockDivider" />
      <WorkspaceDockButton
        icon="timer"
        label={pomodoroOpen ? "Ocultar pomodoro" : "Mostrar pomodoro"}
        onClick={onTogglePomodoro}
      />
      <WorkspaceDockButton
        icon="calendar"
        label={clockOpen ? "Ocultar relógio" : "Mostrar relógio"}
        onClick={onToggleClock}
      />
      <WorkspaceDockButton
        icon="music"
        label={musicOpen ? "Ocultar música" : "Mostrar música"}
        onClick={onToggleMusic}
      />
      <WorkspaceDockButton
        icon="image"
        label={visualOpen ? "Ocultar configurações do fundo" : "Mostrar configurações do fundo"}
        onClick={onToggleVisual}
      />
    </Box>
  );
}

function WorkspaceDockButton({ active = false, icon, label, onClick }) {
  return (
    <Tooltip title={label}>
      <IconButton
        className={active ? "workspaceDockButton isActive" : "workspaceDockButton"}
        size="small"
        onClick={onClick}
        aria-label={label}
      >
        <Icon name={icon} fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
