const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  generateQuestion: (history) => ipcRenderer.invoke('generate-question', history),
  initAI: (apiKey) => ipcRenderer.invoke('init-ai', apiKey)
});
