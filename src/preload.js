const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,
  uploadRapportage: (filePath) => ipcRenderer.invoke('upload-rapportage', filePath),
  updateContractUren: (medewerkerId, uren) => ipcRenderer.invoke('update-contract-uren', medewerkerId, uren),
  downloadExcel: (jaar) => ipcRenderer.invoke('download-excel', jaar),
  getStatus: () => ipcRenderer.invoke('get-status'),
  getAvailableYears: () => ipcRenderer.invoke('get-available-years'),
  getUploadHistory: () => ipcRenderer.invoke('get-upload-history'),
  selectFile: () => ipcRenderer.invoke('select-file'),
  showSaveDialog: (jaar) => ipcRenderer.invoke('show-save-dialog', jaar),
  onDropFile: (filePaths) => ipcRenderer.invoke('drop-file', filePaths),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  restartApp: () => ipcRenderer.invoke('restart-app'),
});
