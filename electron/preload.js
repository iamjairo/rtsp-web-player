import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  getBackendUrl: () => {
    return ipcRenderer.sendSync('get-backend-url');
  },
  getBackendStatus: async () => {
    return await ipcRenderer.invoke('get-backend-status');
  },
  isElectron: true,
  platform: process.platform
});

console.log('Preload script loaded successfully');
