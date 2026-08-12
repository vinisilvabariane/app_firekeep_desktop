const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("firekeepWindow", {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
  toggleFullscreen: () => ipcRenderer.invoke("window:toggle-fullscreen"),
  close: () => ipcRenderer.invoke("window:close"),
  copyToClipboard: (value) => ipcRenderer.invoke("clipboard:write-text", value),
  onBrowserOpenUrl: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, url) => callback(url);
    ipcRenderer.on("browser:open-url", listener);
    return () => ipcRenderer.removeListener("browser:open-url", listener);
  },
});
