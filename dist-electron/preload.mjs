"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electron", {
  selectFile: () => electron.ipcRenderer.invoke("select-file"),
  saveState: (state) => electron.ipcRenderer.invoke("save-state", state),
  loadState: () => electron.ipcRenderer.invoke("load-state"),
  googleAuthStart: () => electron.ipcRenderer.invoke("google-auth-start"),
  googleRevoke: (tokens) => electron.ipcRenderer.invoke("google-revoke", tokens),
  googleExportBook: (payload) => electron.ipcRenderer.invoke("google-export-book", payload),
  windowControl: {
    minimize: () => electron.ipcRenderer.send("window-minimize"),
    close: () => electron.ipcRenderer.send("window-close")
  }
});
