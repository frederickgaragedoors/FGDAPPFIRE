import { app, BrowserWindow, dialog, net, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import nodeNet from 'net';
import { Buffer } from 'buffer';
import process from 'process';
import { GoogleGenAI } from '@google/genai';

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

// Module-level variable to hold the API key received from the renderer process.
// It falls back to the environment variable, which is useful for development or build-time injection.
let geminiApiKey = process.env.GEMINI_API_KEY;

// Listen for the 'set-gemini-key' event from the renderer process.
ipcMain.on('set-gemini-key', (event, key) => {
  console.log('Received Gemini API Key from renderer.');
  geminiApiKey = key;
});


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
 * Creates a local HTTP server to serve the dist folder.
 * @returns {Promise<{port: number}>} A promise that resolves with the port number the server is listening on.
 */
const createLocalServer = async () => {
  const distPath = path.join(__dirname, '../dist');

  const server = http.createServer(async (req, res) => {
    // Gemini API Proxy for Electron App
    if (req.url === '/api/generate' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                const { model, contents, config } = JSON.parse(body);
                if (!geminiApiKey) {
                    throw new Error("Gemini API Key has not been set. Please add it in Settings > AI Services.");
                }
                const ai = new GoogleGenAI({ apiKey: geminiApiKey });
                const geminiResponse = await ai.models.generateContent({ model, contents, config });
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(geminiResponse));
            } catch (e) {
                console.error("Electron proxy error:", e);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: { message: e.message } }));
            }
        });
        return; // Stop further processing
    }

    // Map the request URL to a file path.
    const urlPath = req.url === '/' ? '/index.html' : req.url;
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
      let contentType = 'application/octet-stream';
      const ext = path.extname(urlPath || '').toLowerCase();

      switch(ext) {
        case '.js': contentType = 'text/javascript'; break;
        case '.css': contentType = 'text/css'; break;
        case '.json': contentType = 'application/json'; break;
        case '.png': contentType = 'image/png'; break;
        case '.jpg': case '.jpeg': contentType = 'image/jpeg'; break;
        case '.gif': contentType = 'image/gif'; break;
        case '.svg': contentType = 'image/svg+xml'; break;
        case '.woff': contentType = 'font/woff'; break;
        case '.woff2': contentType = 'font/woff2'; break;
        case '.ttf': contentType = 'font/ttf'; break;
        case '.eot': contentType = 'application/vnd.ms-fontobject'; break;
        case '.otf': contentType = 'font/otf'; break;
        case '.html': contentType = 'text/html'; break;
        case '': contentType = 'text/html'; break; // For SPA routes
      }

      res.writeHead(response.status, { 'Content-Type': contentType });
      res.end(Buffer.from(buffer));
      
    } catch (e) {
      console.error("Local server error fetching resource: ", e);
      res.writeHead(500);
      res.end("Server error");
    }
  });

  const port = await findFreePort(3001);

  await new Promise((resolve, reject) => {
    server.on('error', (e) => reject(e));
    server.listen(Number(port), '127.0.0.1', () => {
      console.log(`Local server running at http://localhost:${port}`);
      resolve(undefined);
    });
  });

  return { port: Number(port) };
};


const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, '../icons/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // FIX: The sandboxed renderer in Electron has issues with ES Modules in preload scripts.
      // Disabling the sandbox is a workaround to resolve the "Cannot use import statement outside a module" error.
      // The most robust solution is to convert Electron scripts to CommonJS (.cjs), but this is a minimal-change fix.
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