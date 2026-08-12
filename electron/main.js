import { app, BrowserWindow, clipboard, ipcMain, nativeImage, nativeTheme, session, shell } from "electron";
import { autoUpdater } from "electron-updater";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const appIcon = path.join(
  appRoot,
  "src",
  "assets",
  process.platform === "win32" ? "firekeep-taskbar.ico" : "logo-sem-fundo.png",
);
const isDev = !app.isPackaged;
let firekeepServer;
let mainWindow;
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

async function createWindow() {
  nativeTheme.themeSource = "dark";
  await configureBrowserSession();
  const windowIcon = nativeImage.createFromPath(appIcon);

  firekeepServer = await createFirekeepServerWorker({
    root: appRoot,
    storageRoot: isDev ? appRoot : app.getPath("userData"),
    production: !isDev,
    port: Number(process.env.PORT ?? 41873),
  });

  mainUrl = firekeepServer.url;

  mainWindow = new BrowserWindow({
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

  await mainWindow.loadURL(mainUrl);

  if (isDev && process.env.FIREKEEP_DEVTOOLS === "1") {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
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
