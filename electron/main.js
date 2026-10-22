import { app, BrowserWindow, clipboard, ipcMain, nativeImage, nativeTheme, screen, session, shell } from "electron";
import electronUpdater from "electron-updater";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

// electron-updater e CommonJS. Em um processo principal ESM, o export nomeado
// nao e garantido pelo loader do Electron; extraimos a API do export default.
const { autoUpdater } = electronUpdater;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const appIcon = path.join(
  appRoot,
  "src",
  "assets",
  process.platform === "win32" ? "firekeep-taskbar.ico" : "logo-sem-fundo.png",
);
const isDev = !app.isPackaged;
const SPLASH_SIZE = { width: 640, height: 340 };
const SPLASH_MIN_MS = 3000;
// Miniplayer do pomodoro: proporcao fixa, o conteudo escala com a janela.
const MINI_RATIO = 2;
const MINI_SIZE = { width: 320, height: 160, minWidth: 240, minHeight: 120, maxWidth: 720, maxHeight: 360 };
const MINI_COMMANDS = new Set(["toggle", "skip", "reset", "sound"]);
let firekeepServer;
let mainWindow;
let miniWindow;
let lastPomodoroState = null;
let mainUrl;
let recoveryPending = false;
let autoUpdateConfigured = false;

// Monaco, xterm, GIFs e superficies translucidas dependem da composicao da GPU.
// O fallback por software continua disponivel para drivers problematicos.
const shouldDisableGpu = process.env.FIREKEEP_DISABLE_GPU === "1";
if (shouldDisableGpu) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-gpu-compositing");
}
app.setAppUserModelId("com.firekeep.desktop");
app.setName("Firekeep");

app.on("web-contents-created", (_event, contents) => {
  contents.on("before-input-event", (inputEvent, input) => {
    if (!isZoomShortcut(input)) return;
    inputEvent.preventDefault();
  });

  if (contents.getType() !== "webview") return;

  // Links target=_blank viram abas do navegador interno em vez de criarem
  // BrowserWindows soltas e processos extras sem controle.
  contents.setWindowOpenHandler(({ url }) => {
    if (isWebUrl(url)) {
      contents.hostWebContents?.send("browser:open-url", url);
    }
    return { action: "deny" };
  });

  contents.on("render-process-gone", (_goneEvent, details) => {
    console.error(`[firekeep] pagina do navegador encerrada (${details.reason}, ${details.exitCode}).`);
  });
});

function isZoomShortcut(input) {
  if (!input.control && !input.meta) return false;
  return ["+", "-", "0", "Add", "Subtract"].includes(input.key);
}

function createSplashWindow() {
  const splash = new BrowserWindow({
    width: SPLASH_SIZE.width,
    height: SPLASH_SIZE.height,
    transparent: true,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    center: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    title: "Firekeep",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  splash.once("ready-to-show", () => splash.show());
  splash
    .loadFile(path.join(__dirname, "splash.html"), { query: { v: app.getVersion() } })
    .catch(() => {});
  return splash;
}

function setSplashStage(splash, text) {
  if (!splash || splash.isDestroyed()) return;
  splash.webContents.executeJavaScript(`window.setStage?.(${JSON.stringify(text)})`).catch(() => {});
}

async function dismissSplash(splash) {
  if (!splash || splash.isDestroyed()) return;
  await splash.webContents.executeJavaScript("window.leave?.()").catch(() => {});
  await delay(340);
  if (!splash.isDestroyed()) splash.close();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createWindow() {
  nativeTheme.themeSource = "dark";
  const splashShownAt = Date.now();
  const splash = createSplashWindow();

  try {
    await openMainWindow(splash);
  } catch (error) {
    if (!splash.isDestroyed()) splash.close();
    throw error;
  }

  // O splash fica o tempo minimo para a animacao terminar, mesmo que o app
  // suba mais rapido; se o app demorar mais, ele so sai quando estiver pronto.
  setSplashStage(splash, "Pronto");
  await delay(Math.max(0, SPLASH_MIN_MS - (Date.now() - splashShownAt)));
  mainWindow?.show();
  await dismissSplash(splash);
}

async function openMainWindow(splash) {
  await configureBrowserSession();
  const windowIcon = nativeImage.createFromPath(appIcon);

  firekeepServer = await createFirekeepServerWorker({
    root: appRoot,
    storageRoot: isDev ? appRoot : app.getPath("userData"),
    production: !isDev,
    port: Number(process.env.PORT ?? 41873),
  });

  mainUrl = firekeepServer.url;
  setSplashStage(splash, "Carregando a interface");

  mainWindow = new BrowserWindow({
    show: false,
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: "#07090d",
    title: "Firekeep",
    autoHideMenuBar: true,
    frame: false,
    icon: windowIcon.isEmpty() ? appIcon : windowIcon,
    titleBarStyle: "hidden",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true,
      webviewTag: true,
    },
  });

  if (!windowIcon.isEmpty() && typeof mainWindow.setIcon === "function") {
    mainWindow.setIcon(windowIcon);
  }

  mainWindow.webContents.on("will-attach-webview", (event, webPreferences, params) => {
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;

    if (!isWebUrl(params.src) || params.partition !== "persist:firekeep-search") {
      event.preventDefault();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (isWebUrl(targetUrl)) {
      shell.openExternal(targetUrl).catch(() => {});
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    if (details.reason === "clean-exit") return;
    console.error(`[firekeep] interface encerrada (${details.reason}, ${details.exitCode}); recuperando.`);
    scheduleWindowRecovery();
  });
  mainWindow.webContents.on("did-finish-load", () => {
    recoveryPending = false;
    configureAutoUpdates();
  });

  mainWindow.on("closed", () => {
    mainWindow = undefined;
    if (miniWindow && !miniWindow.isDestroyed()) miniWindow.close();
  });

  await mainWindow.loadURL(mainUrl);

  if (isDev && process.env.FIREKEEP_DEVTOOLS === "1") {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

function miniBoundsFile() {
  return path.join(app.getPath("userData"), "mini-player.json");
}

function loadMiniBounds() {
  try {
    const bounds = JSON.parse(fs.readFileSync(miniBoundsFile(), "utf8"));
    const numbers = ["x", "y", "width", "height"].every((key) => Number.isFinite(bounds[key]));
    if (!numbers) return null;
    // Ignora a posicao salva se o monitor onde ela estava nao existe mais.
    const visible = screen.getAllDisplays().some(({ workArea }) => {
      return (
        bounds.x + bounds.width > workArea.x + 40 &&
        bounds.x < workArea.x + workArea.width - 40 &&
        bounds.y + bounds.height > workArea.y + 40 &&
        bounds.y < workArea.y + workArea.height - 40
      );
    });
    return visible ? bounds : null;
  } catch {
    return null;
  }
}

function saveMiniBounds(window) {
  if (window.isDestroyed()) return;
  try {
    fs.writeFileSync(miniBoundsFile(), JSON.stringify(window.getBounds()));
  } catch {
    // Sem permissao de escrita: o miniplayer so abre na posicao padrao da proxima vez.
  }
}

function notifyMiniVisibility() {
  const open = Boolean(miniWindow && !miniWindow.isDestroyed());
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("mini:visibility", open);
}

function openMiniPlayer() {
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.show();
    return;
  }
  if (!mainUrl) return;

  const saved = loadMiniBounds();
  const windowIcon = nativeImage.createFromPath(appIcon);
  miniWindow = new BrowserWindow({
    width: saved?.width ?? MINI_SIZE.width,
    height: saved?.height ?? MINI_SIZE.height,
    x: saved?.x,
    y: saved?.y,
    minWidth: MINI_SIZE.minWidth,
    minHeight: MINI_SIZE.minHeight,
    maxWidth: MINI_SIZE.maxWidth,
    maxHeight: MINI_SIZE.maxHeight,
    frame: false,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    backgroundColor: "#0a0b10",
    title: "Firekeep Pomodoro",
    icon: windowIcon.isEmpty() ? appIcon : windowIcon,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  const mini = miniWindow;

  mini.setAspectRatio(MINI_RATIO);
  // "screen-saver" mantem o miniplayer acima de apps em tela cheia.
  mini.setAlwaysOnTop(true, "screen-saver");
  mini.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
  mini.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mini.once("ready-to-show", () => mini.show());

  let saveTimer;
  const scheduleSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveMiniBounds(mini), 400);
  };
  mini.on("move", scheduleSave);
  mini.on("resize", scheduleSave);
  mini.on("close", () => {
    clearTimeout(saveTimer);
    saveMiniBounds(mini);
  });
  mini.on("closed", () => {
    if (miniWindow === mini) miniWindow = undefined;
    notifyMiniVisibility();
  });

  mini.loadURL(`${mainUrl}?view=mini`).catch(() => {});
  notifyMiniVisibility();
}

function closeMiniPlayer() {
  if (miniWindow && !miniWindow.isDestroyed()) miniWindow.close();
}

function configureAutoUpdates() {
  if (isDev || autoUpdateConfigured) return;
  autoUpdateConfigured = true;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("update-downloaded", (release) => {
    mainWindow?.webContents.send("app:update-ready", { version: release.version });
  });
  autoUpdater.on("error", (error) => {
    console.warn("[firekeep] atualizacao automatica:", error.message);
  });
  autoUpdater.checkForUpdates().catch((error) => {
    console.warn("[firekeep] nao foi possivel procurar atualizacoes:", error.message);
  });
}

async function configureBrowserSession() {
  const browserSession = session.fromPartition("persist:firekeep-search");
  await browserSession.cookies
    .set({
      url: "https://www.google.com",
      name: "PREF",
      value: "f6=40000000",
      secure: true,
      sameSite: "lax",
    })
    .catch(() => {});
}

function createFirekeepServerWorker(options) {
  const worker = new Worker(path.join(__dirname, "server-worker.js"), {
    workerData: options,
  });

  return new Promise((resolve, reject) => {
    let settled = false;

    function fail(error) {
      if (settled) {
        console.error("[firekeep] servidor local:", error);
        return;
      }
      settled = true;
      reject(error);
    }

    worker.on("message", (message) => {
      if (message?.type === "ready") {
        settled = true;
        resolve({
          port: message.port,
          url: message.url,
          close: () => closeFirekeepServerWorker(worker),
        });
        return;
      }

      if (message?.type === "error") {
        fail(new Error(message.stack || message.message || "Falha no servidor local."));
      }
    });

    worker.on("error", fail);
    worker.on("exit", (code) => {
      if (code === 0) return;
      fail(new Error(`Servidor local encerrado inesperadamente (${code}).`));
    });
  });
}

function closeFirekeepServerWorker(worker) {
  return new Promise((resolve) => {
    let done = false;

    function finish() {
      if (done) return;
      done = true;
      clearTimeout(timer);
      worker.off("message", onMessage);
      worker.off("exit", finish);
      resolve();
    }

    function onMessage(message) {
      if (message?.type === "closed") finish();
    }

    const timer = setTimeout(() => {
      worker.terminate().finally(finish);
    }, 1800);

    worker.on("message", onMessage);
    worker.on("exit", finish);
    worker.postMessage({ type: "close" });
  });
}

function scheduleWindowRecovery() {
  if (recoveryPending) return;
  recoveryPending = true;
  setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed() || !mainUrl) {
      recoveryPending = false;
      return;
    }
    mainWindow.loadURL(mainUrl).catch(() => {
      recoveryPending = false;
    });
  }, 500);
}

function isWebUrl(value) {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

ipcMain.handle("window:minimize", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.handle("window:toggle-maximize", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return;

  if (window.isMaximized()) {
    window.unmaximize();
    return;
  }

  window.maximize();
});

ipcMain.handle("window:toggle-fullscreen", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return;

  window.setFullScreen(!window.isFullScreen());
});

ipcMain.handle("window:close", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

ipcMain.handle("clipboard:write-text", (_event, value) => {
  if (typeof value !== "string") throw new Error("Texto invalido para a area de transferencia.");
  clipboard.writeText(value);
});

ipcMain.handle("app:install-update", () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle("mini:toggle", () => {
  if (miniWindow && !miniWindow.isDestroyed()) {
    closeMiniPlayer();
    return false;
  }
  openMiniPlayer();
  return true;
});

ipcMain.handle("mini:is-open", () => Boolean(miniWindow && !miniWindow.isDestroyed()));

ipcMain.handle("mini:focus-main", () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

// O renderer principal e a fonte do estado do pomodoro; o miniplayer so exibe
// o que recebe e devolve comandos.
ipcMain.on("pomodoro:publish", (event, snapshot) => {
  if (event.sender !== mainWindow?.webContents) return;
  lastPomodoroState = snapshot;
  if (miniWindow && !miniWindow.isDestroyed()) miniWindow.webContents.send("pomodoro:state", snapshot);
});

ipcMain.handle("pomodoro:get-state", () => lastPomodoroState);

ipcMain.on("pomodoro:command", (event, command) => {
  if (event.sender !== miniWindow?.webContents) return;
  if (!MINI_COMMANDS.has(command)) return;
  mainWindow?.webContents.send("pomodoro:command", command);
});

app.whenReady().then(createWindow);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("child-process-gone", (_event, details) => {
  if (details.type !== "GPU" || details.reason === "clean-exit") return;
  // O Chromium recria o processo GPU sozinho. Recarregar a janela principal
  // aqui tambem derruba todos os webviews e costuma resultar em tela preta.
  console.error(`[firekeep] processo grafico encerrado (${details.reason}, ${details.exitCode}).`);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  if (firekeepServer) {
    await firekeepServer.close().catch(() => {});
  }
});
