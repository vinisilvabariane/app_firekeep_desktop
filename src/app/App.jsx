import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import CssBaseline from "@mui/material/CssBaseline";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
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
import { theme } from "./theme";
import { useStartupSync } from "./useStartupSync";
import packageInfo from "../../package.json";
import "./App.css";

const LazyCodeEditor = lazy(() => import("../features/editor/CodeEditor").then(({ CodeEditor }) => ({ default: CodeEditor })));
const LazyFileExplorer = lazy(() => import("../features/explorer/FileExplorer").then(({ FileExplorer }) => ({ default: FileExplorer })));
const LazySearchBrowser = lazy(() => import("../features/browser/SearchBrowser").then(({ SearchBrowser }) => ({ default: SearchBrowser })));
const LazyTerminalWorkspace = lazy(() => import("../features/terminal/TerminalWorkspace").then(({ TerminalWorkspace }) => ({ default: TerminalWorkspace })));

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
  const [openFile, setOpenFile] = useState(null);
  const [sessionVisual, setSessionVisual] = useState(null);
  const [videoCurtainVisible, setVideoCurtainVisible] = useState(true);
  const [startupSettled, setStartupSettled] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [workspaceGrid, setWorkspaceGrid] = useState(false);
  const [explorerMounted, setExplorerMounted] = useState(false);
  const [terminalMounted, setTerminalMounted] = useState(false);
  const [browserMounted, setBrowserMounted] = useState(false);
  const terminalOpen = startupSettled ? settings.terminalOpen : false;
  const explorerOpen = startupSettled ? settings.explorerOpen : false;

  useStartupSync(setStoredSettings);

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
  const appClassName = [
    "app",
    explorerOpen ? "" : "explorerClosed",
    openFile && terminalOpen ? "codeTerminalSplit" : "",
    workspaceGrid ? "workspaceGrid" : "",
    browserOpen ? "browserOpen" : "",
    terminalOpen ? "terminalOpen" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Box className={appClassName}>
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
      <WindowChrome />
      <WorkspaceDock
        explorerOpen={explorerOpen}
        terminalOpen={terminalOpen}
        browserOpen={browserOpen}
        gridOpen={workspaceGrid}
        onToggleExplorer={toggleExplorer}
        onToggleTerminal={toggleTerminal}
        onToggleBrowser={toggleBrowser}
        onToggleGrid={() => setWorkspaceGrid((current) => !current)}
        onToggleFullscreen={() => globalThis.window?.firekeepWindow?.toggleFullscreen?.()}
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
        <PomodoroWidget />
        <DateTimeWidget />
        <MusicDock
          musicMode={settings.musicMode}
          youtubeLinks={settings.youtubeLinks}
          activeYoutubeUrl={settings.activeYoutubeUrl}
          spotifyClientId={settings.spotifyClientId}
          spotifyTrackUri={settings.spotifyTrackUri}
          onUpdateSettings={updateSettings}
        />
        <VisualDock
          backgrounds={settings.backgrounds}
          visualUrl={settings.visualUrl}
          visualName={settings.visualName}
          visualBrightness={settings.visualBrightness}
          sessionVisual={sessionVisual}
          onSessionVisualChange={setSessionVisual}
          onUpdateSettings={updateSettings}
        />
      </Stack>

      {terminalMounted ? (
        <Suspense fallback={null}>
          <LazyTerminalWorkspace open={terminalOpen} onToggleOpen={toggleTerminal} />
        </Suspense>
      ) : null}
      {browserMounted ? (
        <Suspense fallback={null}>
          <LazySearchBrowser open={browserOpen} onOpenChange={setBrowserOpen} />
        </Suspense>
      ) : null}
      {openFile ? (
        <EditorErrorBoundary key={openFile.path} onClose={closeEditor}>
          <Suspense fallback={null}>
            <LazyCodeEditor file={openFile} onClose={closeEditor} />
          </Suspense>
        </EditorErrorBoundary>
      ) : null}
      <Box className="appVersionBadge">v{packageInfo.version}</Box>
    </Box>
  );
}

function WorkspaceDock({
  explorerOpen,
  terminalOpen,
  browserOpen,
  gridOpen,
  onToggleExplorer,
  onToggleTerminal,
  onToggleBrowser,
  onToggleGrid,
  onToggleFullscreen,
}) {
  return (
    <Box className="workspaceDock" aria-label="Ferramentas do workspace">
      <WorkspaceDockButton
        active={explorerOpen}
        icon="folder"
        label={explorerOpen ? "Fechar explorador" : "Abrir explorador"}
        onClick={onToggleExplorer}
      />
      <WorkspaceDockButton
        active={browserOpen}
        icon="search"
        label={browserOpen ? "Fechar navegador" : "Abrir navegador"}
        onClick={onToggleBrowser}
      />
      <WorkspaceDockButton
        active={terminalOpen}
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
      <WorkspaceDockButton active={false} icon="fullscreen" label="Tela cheia" onClick={onToggleFullscreen} />
    </Box>
  );
}

function WorkspaceDockButton({ active, icon, label, onClick }) {
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
