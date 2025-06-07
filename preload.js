const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  generateQuestion: (history, settings) => ipcRenderer.invoke('generate-question', history, settings),
  getModelsForRegion: (region) => ipcRenderer.invoke('get-models-for-region', region)
});
