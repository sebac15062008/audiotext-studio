const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  saveAudio: (bytes, filename) => ipcRenderer.invoke('save-audio', bytes, filename),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
});
