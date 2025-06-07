const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  generateQuestion: (history, settings) => ipcRenderer.invoke('generate-question', history, settings)
});
