const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  processAudio: (audioFilePath, language) => ipcRenderer.invoke('process-audio', audioFilePath, language),
  processAudioBlob: (base64Data, language, segmentIndex) => ipcRenderer.invoke('process-audio-blob', base64Data, language, segmentIndex),
  saveFile: (content) => ipcRenderer.invoke('save-file', content)
});