import { app, BrowserWindow, dialog, net } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import nodeNet from 'net';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Add this block to catch any unexpected errors
process.on('uncaughtException', (error) => {
  console.error('--- UNCAUGHT EXCEPTION ---');
  console.error(error);
  dialog.showErrorBox('An Uncaught Exception Occurred', error.stack || String(error));
  app.quit();
});

let mainWindow;

// Helper to find a free port to avoid conflicts
/**
 * @param {number} startPort
 * @returns {Promise<number>}
 */
function findFreePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = nodeNet.createServer();
    server.unref();
    server.on('error', () => {
      resolve(findFreePort(startPort + 1));
    });
    server.listen(startPort, '127.0.0.1', () => {
      // FIX: Safely get port from server address, which can be an object or string.
      const address = server.address();
      server.close(() => {
        if (address && typeof address === 'object') {
          resolve(address.port);
        } else {
          // Fallback in case of unexpected address type, try next port.
          resolve(findFreePort(startPort + 1));
        }
      });
    });
  });
}

/**
 * @returns {Promise<{port: number}>}
 */
const createLocalServer = () => {
  return new Promise((resolve, reject) => {
    // This path works both in dev and when packed inside an asar archive.
    const distPath = path.join(__dirname, '../dist');

    const server = http.createServer(async (req, res) => {
      // Map the request URL to a file path.
      const urlPath = req.url === '/' ? 'index.html' : req.url;
      const requestedPath = path.join(distPath, urlPath);
      const normalizedPath = path.normalize(requestedPath);
      
      try {
        // Security: Block any attempts to access files outside the dist folder.
        if (!normalizedPath.startsWith(distPath)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }

        // Use Electron's net.fetch, which can read files from inside an asar archive.
        let response = await net.fetch(`file://${normalizedPath}`);

        // If the file is not found, serve index.html for Single Page Application (SPA) routing.
        if (!response.ok) {
            response = await net.fetch(`file://${path.join(distPath, 'index.html')}`);
        }
        
        const buffer = await response.arrayBuffer();
        
        // Determine MIME type based on file extension.
        let contentType = 'text/html';
        const ext = path.extname(normalizedPath);
        if (ext === '.js') contentType = 'text/javascript';
        if (ext === '.css') contentType = 'text/css';
        if (ext === '.svg') contentType = 'image/svg+xml';

        res.writeHead(response.status, { 'Content-Type': contentType });
        res.end(Buffer.from(buffer));
        
      } catch (e) {
        console.error("Local server error fetching resource: ", e);
        res.writeHead(500);
        res.end("Server error");
      }
    });

    server.on('error', (e) => reject(e));

    // Find a free port starting from 3001
    findFreePort(3001).then(port => {
      // FIX: Explicitly cast port to a number to satisfy the listen method's signature.
      server.listen(Number(port), '127.0.0.1', () => {
        console.log(`Local server running at http://localhost:${port}`);
        resolve({ port: Number(port) });
      });
    }).catch(reject);
  });
};


const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, '../icons/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.mjs')
    }
  });

  mainWindow.setMenuBarVisibility(false);

  const isDev = !app.isPackaged;

  if (isDev) {
    // In development, load from the Vite dev server.
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, create and load from our robust local server.
    try {
      // FIX: JSDoc on createLocalServer helps TypeScript infer the correct return type here.
      const { port } = await createLocalServer();
      mainWindow.loadURL(`http://localhost:${port}`);
    } catch (error) {
      console.error('--- SERVER STARTUP FAILED ---', error);
      dialog.showErrorBox('Server Error', 'Could not start the local server needed to run the application.');
      app.quit();
    }
  }
};

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
