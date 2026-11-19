const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const DIST = path.join(__dirname, '..', 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.onnx': 'application/octet-stream',
  '.wav': 'audio/wav',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let pathname;
      try {
        pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      } catch {
        res.writeHead(400).end();
        return;
      }
      const safe = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
      let file = path.join(DIST, safe);
      if (!file.startsWith(DIST)) {
        res.writeHead(403).end();
        return;
      }
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        file = path.join(DIST, 'index.html');
      }
      fs.readFile(file, (err, data) => {
        if (err) {
          res.writeHead(404).end('Not found');
          return;
        }
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-cache',
        });
        res.end(data);
      });
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function createWindow(url) {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 860,
    minHeight: 600,
    title: 'AudioText Studio',
    backgroundColor: '#0c1312',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (url) await win.loadURL(url);
}

ipcMain.handle('save-audio', async (_event, bytes, filename) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Guardar audio',
    defaultPath: filename,
    filters: [{ name: 'Audio WAV', extensions: ['wav'] }],
  });
  if (canceled || !filePath) return false;
  await fs.promises.writeFile(filePath, Buffer.from(bytes));
  return true;
});

ipcMain.handle('open-external', async (_event, url) => {
  await shell.openExternal(url);
});

async function bootstrap() {
  let url = process.env.VITE_DEV_SERVER_URL;
  if (!url && !app.isPackaged) url = 'http://127.0.0.1:5173';
  if (!url) {
    const server = await startStaticServer();
    const { port } = server.address();
    url = `http://127.0.0.1:${port}`;
  }
  await createWindow(url);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(url);
  });
}

app.whenReady().then(bootstrap);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
