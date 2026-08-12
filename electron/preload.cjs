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
  onBrowserOpenUrl: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, url) => callback(url);
    ipcRenderer.on("browser:open-url", listener);
    return () => ipcRenderer.removeListener("browser:open-url", listener);
  },
});
