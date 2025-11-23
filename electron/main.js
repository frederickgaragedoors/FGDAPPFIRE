
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import fs from 'fs';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let server;
const PORT = 9000; // Fixed port for consistent Auth Redirects

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
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

  // Optional: Remove the default menu bar for a cleaner "App" look
  mainWindow.setMenuBarVisibility(false);

  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    // Open DevTools in dev mode
    // mainWindow.webContents.openDevTools();
  } else {
    // In production, start a local static server to serve the app
    // This is necessary for Firebase Auth to work (it requires http/https origin, not file://)
    startLocalServer();
  }
};

const startLocalServer = () => {
  const distPath = path.join(__dirname, '../dist');

  server = http.createServer((req, res) => {
    // Basic static file serving
    let filePath = path.join(distPath, req.url === '/' ? 'index.html' : req.url);
    
    // Prevent directory traversal
    if (!filePath.startsWith(distPath)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    // Fallback to index.html for SPA routing if file doesn't exist
    if (!fs.existsSync(filePath)) {
        if (req.url.includes('.')) {
             // If it looks like a file (has extension) but misses, 404
             res.writeHead(404);
             res.end('Not Found');
             return;
        }
        // Otherwise, serve index.html for client-side routing
        filePath = path.join(distPath, 'index.html');
    }

    const extname = path.extname(filePath);
    let contentType = 'text/html';
    switch (extname) {
      case '.js': contentType = 'text/javascript'; break;
      case '.css': contentType = 'text/css'; break;
      case '.json': contentType = 'application/json'; break;
      case '.png': contentType = 'image/png'; break;
      case '.jpg': contentType = 'image/jpg'; break;
      case '.svg': contentType = 'image/svg+xml'; break;
      case '.ico': contentType = 'image/x-icon'; break;
      case '.woff': contentType = 'application/font-woff'; break;
      case '.woff2': contentType = 'application/font-woff2'; break;
      case '.ttf': contentType = 'application/font-ttf'; break;
    }

    fs.readFile(filePath, (error, content) => {
      if (error) {
        if(error.code == 'ENOENT'){
          res.writeHead(404);
          res.end('Not Found');
        } else {
          res.writeHead(500);
          res.end('Internal Server Error: '+error.code);
        }
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  });

  // Listen on the fixed port
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Server listening on port ${PORT}`);
    mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
  });
  
  // Handle EADDRINUSE if the app is opened multiple times or port is taken
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.log('Address in use, retrying with random port...');
      // Fallback to random port if 9000 is taken
      setTimeout(() => {
        server.close();
        server.listen(0, '127.0.0.1', () => {
            const randomPort = server.address().port;
            console.log(`Server listening on random port ${randomPort}`);
            mainWindow.loadURL(`http://127.0.0.1:${randomPort}`);
        });
      }, 1000);
    }
  });
};

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
  if (server) server.close();
});
