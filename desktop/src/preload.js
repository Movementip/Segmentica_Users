const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("segmenticaLauncher", {
  onStatus(callback) {
    ipcRenderer.on("launcher:status", (_event, payload) => callback(payload));
  },
  onReady(callback) {
    ipcRenderer.on("launcher:ready", (_event, payload) => callback(payload));
  },
  onTabsChanged(callback) {
    ipcRenderer.on("tabs:state", (_event, payload) => callback(payload));
  },
  onThemeChanged(callback) {
    ipcRenderer.on("theme:state", (_event, payload) => callback(payload));
  },
  getReadyState() {
    return ipcRenderer.invoke("launcher:get-ready-state");
  },
  getAppIcon() {
    return ipcRenderer.invoke("launcher:get-app-icon");
  },
  rendererReady() {
    return ipcRenderer.invoke("launcher:renderer-ready");
  },
  openDockerDownload() {
    return ipcRenderer.invoke("launcher:open-docker-download");
  },
  openRuntimeFolder() {
    return ipcRenderer.invoke("launcher:open-runtime-folder");
  },
  createTab(url) {
    return ipcRenderer.invoke("tabs:create", url);
  },
  activateTab(tabId) {
    return ipcRenderer.invoke("tabs:activate", tabId);
  },
  closeTab(tabId) {
    return ipcRenderer.invoke("tabs:close", tabId);
  },
  moveTab(tabId, targetIndex) {
    return ipcRenderer.invoke("tabs:move", tabId, targetIndex);
  },
  beginTabDrag(tabId) {
    return ipcRenderer.invoke("tabs:drag-start", tabId);
  },
  finishTabDrag(tabId, point, shouldDetach) {
    return ipcRenderer.invoke("tabs:finish-drag", tabId, point, shouldDetach);
  },
  updateTabBounds(bounds) {
    return ipcRenderer.invoke("tabs:update-bounds", bounds);
  }
});
