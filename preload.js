const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  generateQuestion: (history, settings) => ipcRenderer.invoke('generate-question', history, settings),
  suggestTags: (question, allTags) => ipcRenderer.invoke('suggest-tags', question, allTags),
  generateDocument: (history, settings) => ipcRenderer.invoke('generate-document', history, settings),
  saveDocument: (markdownContent, history, settings) => ipcRenderer.invoke('save-document', markdownContent, history, settings),
  exportStatistics: (history) => ipcRenderer.invoke('export-statistics', history)
});
