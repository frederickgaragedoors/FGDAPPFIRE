
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, '../icons/icon.png'), // Use PNG for Windows compatibility
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // In development, load from the local server
  // In production, load the built index.html
  const isDev = !app.isPackaged; 

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    // Open DevTools in dev mode
    // mainWindow.webContents.openDevTools();
  } else {
    // In production, load the index.html from the dist folder
    // We use path.join to resolve the correct absolute path
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Optional: Remove the default menu bar for a cleaner "App" look
  mainWindow.setMenuBarVisibility(false);
};

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
