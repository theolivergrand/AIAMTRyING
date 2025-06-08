const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  generateQuestion: (history, settings) => ipcRenderer.invoke('generate-question', history, settings),
  suggestTags: (question, allTags, settings) => ipcRenderer.invoke('suggest-tags', question, allTags, settings),
  generateDocument: (history, settings) => ipcRenderer.invoke('generate-document', history, settings),
  saveDocument: (markdownContent, history, settings) => ipcRenderer.invoke('save-document', markdownContent, history, settings),
  exportStatistics: (history, settings) => ipcRenderer.invoke('export-statistics', history, settings),
  collectFeedback: (feedbackData, settings) => ipcRenderer.invoke('collect-feedback', feedbackData, settings)
});
