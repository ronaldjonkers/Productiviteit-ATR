const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  uploadRapportage: (filePath) => ipcRenderer.invoke('upload-rapportage', filePath),
  uploadProductiviteit: (filePath) => ipcRenderer.invoke('upload-productiviteit', filePath),
  downloadExcel: (jaar) => ipcRenderer.invoke('download-excel', jaar),
  getStatus: () => ipcRenderer.invoke('get-status'),
  getAvailableYears: () => ipcRenderer.invoke('get-available-years'),
  getUploadHistory: () => ipcRenderer.invoke('get-upload-history'),
  selectFile: () => ipcRenderer.invoke('select-file'),
  showSaveDialog: (jaar) => ipcRenderer.invoke('show-save-dialog', jaar),
  onDropFile: (filePaths) => ipcRenderer.invoke('drop-file', filePaths),
});
