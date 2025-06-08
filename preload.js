const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  generateQuestion: (history, settings) => ipcRenderer.invoke('generate-question', history, settings),
  suggestTags: (question, allTags) => ipcRenderer.invoke('suggest-tags', question, allTags)
});
