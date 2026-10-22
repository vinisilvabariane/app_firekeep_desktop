const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("firekeepWindow", {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
  toggleFullscreen: () => ipcRenderer.invoke("window:toggle-fullscreen"),
  close: () => ipcRenderer.invoke("window:close"),
  copyToClipboard: (value) => ipcRenderer.invoke("clipboard:write-text", value),
  installUpdate: () => ipcRenderer.invoke("app:install-update"),
  onUpdateReady: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, update) => callback(update);
    ipcRenderer.on("app:update-ready", listener);
    return () => ipcRenderer.removeListener("app:update-ready", listener);
  },
  publishPomodoro: (snapshot) => ipcRenderer.send("pomodoro:publish", snapshot),
  getPomodoroState: () => ipcRenderer.invoke("pomodoro:get-state"),
  sendPomodoroCommand: (command) => ipcRenderer.send("pomodoro:command", command),
  onPomodoroState: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on("pomodoro:state", listener);
    return () => ipcRenderer.removeListener("pomodoro:state", listener);
  },
  onPomodoroCommand: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, command) => callback(command);
    ipcRenderer.on("pomodoro:command", listener);
    return () => ipcRenderer.removeListener("pomodoro:command", listener);
  },
  toggleMiniPlayer: () => ipcRenderer.invoke("mini:toggle"),
  isMiniPlayerOpen: () => ipcRenderer.invoke("mini:is-open"),
  focusMainWindow: () => ipcRenderer.invoke("mini:focus-main"),
  onMiniPlayerVisibility: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, open) => callback(open);
    ipcRenderer.on("mini:visibility", listener);
    return () => ipcRenderer.removeListener("mini:visibility", listener);
  },
  onBrowserOpenUrl: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, url) => callback(url);
    ipcRenderer.on("browser:open-url", listener);
    return () => ipcRenderer.removeListener("browser:open-url", listener);
  },
});
