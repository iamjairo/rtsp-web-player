// Configuration for backend API URL
// This handles both Electron and browser environments

interface ElectronAPI {
  getBackendUrl: () => string;
  getBackendStatus: () => Promise<{ running: boolean; port: number }>;
  isElectron: boolean;
  platform: string;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export const isElectron = typeof window !== 'undefined' && window.electron?.isElectron === true;

export const API_BASE_URL = isElectron
  ? window.electron?.getBackendUrl() || 'http://localhost:3001'
  : import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const getBackendStatus = async () => {
  if (isElectron && window.electron) {
    return await window.electron.getBackendStatus();
  }
  return null;
};

console.log('Running in:', isElectron ? 'Electron' : 'Browser');
console.log('API Base URL:', API_BASE_URL);
