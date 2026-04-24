import { app, BrowserWindow, ipcMain } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const _require = createRequire(import.meta.url);

/**
 * Resolve the FFmpeg binary path.
 * In a packaged Electron build, ffmpeg-static lives in the server extraResources.
 * In development it comes from the server/node_modules directory.
 */
function resolveFfmpegBin() {
  // Packaged: extraResources/server/node_modules/ffmpeg-static/ffmpeg[.exe]
  const resourcesServer = path.join(process.resourcesPath || '', 'server');
  const packedBin = path.join(resourcesServer, 'node_modules', 'ffmpeg-static',
    process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  if (fs.existsSync(packedBin)) {
    return packedBin;
  }
  // Development: server/node_modules/ffmpeg-static
  try {
    const devBin = _require(
      path.join(__dirname, '../server/node_modules/ffmpeg-static')
    );
    if (devBin && fs.existsSync(devBin)) return devBin;
  } catch {
    // not installed
  }
  // System ffmpeg fallback
  return null;
}

let mainWindow;
let backendProcess;
const isDev = process.env.NODE_ENV === 'development';
const BACKEND_PORT = 3001;
const FRONTEND_PORT = 5173;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
    icon: path.join(__dirname, '../public/icon.png'),
    backgroundColor: '#0f172a',
    title: 'RTSP Web Player'
  });

  // Remove menu bar
  mainWindow.setMenuBarVisibility(false);

  const startURL = isDev
    ? `http://localhost:${FRONTEND_PORT}`
    : `file://${path.join(__dirname, '../dist/index.html')}`;

  mainWindow.loadURL(startURL);

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle window close to ensure backend cleanup
  mainWindow.on('close', () => {
    stopBackend();
  });
}

function startBackend() {
  return new Promise((resolve, reject) => {
    console.log('Starting backend server...');

    const serverPath = path.join(__dirname, '../server/index.js');

    if (!fs.existsSync(serverPath)) {
      console.error('Backend server not found at:', serverPath);
      reject(new Error('Backend server not found'));
      return;
    }

    const ffmpegBin = resolveFfmpegBin();
    const childEnv = { ...process.env, PORT: BACKEND_PORT.toString() };
    if (ffmpegBin) {
      childEnv.FFMPEG_PATH = ffmpegBin;
      console.log(`Using bundled FFmpeg: ${ffmpegBin}`);
    }

    backendProcess = spawn('node', [serverPath], {
      cwd: path.join(__dirname, '../server'),
      env: childEnv,
      stdio: 'pipe'
    });

    backendProcess.stdout.on('data', (data) => {
      console.log(`[Backend] ${data.toString().trim()}`);
      // Match the server's startup log lines (either Spanish or English variants).
      // Use specific phrases to avoid false positives from unrelated log output.
      if (
        data.toString().includes(`Servidor corriendo en: http://localhost:${BACKEND_PORT}`) ||
        data.toString().includes(`Server running on port ${BACKEND_PORT}`)
      ) {
        console.log('Backend server started successfully');
        resolve();
      }
    });

    backendProcess.stderr.on('data', (data) => {
      console.error(`[Backend Error] ${data.toString().trim()}`);
    });

    backendProcess.on('error', (error) => {
      console.error('Failed to start backend:', error);
      reject(error);
    });

    backendProcess.on('exit', (code, signal) => {
      console.log(`Backend process exited with code ${code} and signal ${signal}`);
      if (code !== 0 && code !== null) {
        reject(new Error(`Backend exited with code ${code}`));
      }
    });

    // Timeout in case the server doesn't log the expected message
    setTimeout(() => {
      if (backendProcess && backendProcess.exitCode === null) {
        console.log('Backend process started (timeout reached, assuming success)');
        resolve();
      }
    }, 5000);
  });
}

function stopBackend() {
  if (backendProcess) {
    console.log('Stopping backend server...');
    backendProcess.kill('SIGTERM');

    // Force kill after 5 seconds if still running
    setTimeout(() => {
      if (backendProcess && backendProcess.exitCode === null) {
        console.log('Force killing backend server...');
        backendProcess.kill('SIGKILL');
      }
    }, 5000);

    backendProcess = null;
  }
}

// Handle IPC messages
ipcMain.on('get-backend-url', (event) => {
  event.returnValue = `http://localhost:${BACKEND_PORT}`;
});

ipcMain.handle('get-backend-status', async () => {
  return {
    running: backendProcess !== null && backendProcess.exitCode === null,
    port: BACKEND_PORT
  };
});

// App lifecycle
app.whenReady().then(async () => {
  try {
    // Start backend before creating window
    await startBackend();

    // Wait a bit to ensure backend is fully ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error('Failed to start application:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackend();
});

app.on('will-quit', () => {
  stopBackend();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  stopBackend();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});
