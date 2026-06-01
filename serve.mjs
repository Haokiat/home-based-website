import { createServer } from 'http';
import { createReadStream, statSync, readFileSync } from 'fs';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { networkInterfaces } from 'os';

// Load .env for local development (no dotenv dependency needed)
try {
  const env = readFileSync(new URL('.env', import.meta.url), 'utf8');
  for (const line of env.split('\n')) {
    const eq = line.indexOf('=');
    if (eq > 0) process.env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
} catch {}

const __dirname = dirname(fileURLToPath(import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
};

const PORT = 3000;

createServer((req, res) => {
  let urlPath = req.url.split('?')[0];

  // Route POST /api/tele-noti to the serverless handler
  if (req.method === 'POST' && urlPath === '/api/tele-noti') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body);
        const mockReq = { body: parsed };
        const mockRes = {
          _status: 200,
          status(code) { this._status = code; return this; },
          json(data) {
            res.writeHead(this._status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
          },
        };
        const { default: handler } = await import('./api/tele-noti.js');
        await handler(mockReq, mockRes);
      } catch (e) {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
    });
    return;
  }

  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  const filePath = join(__dirname, urlPath);

  let stat;
  try { stat = statSync(filePath); }
  catch {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext         = extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';
  const fileSize    = stat.size;

  // iOS Safari requires byte-range support to play video.
  // Without a 206 partial-content response the video silently fails on mobile.
  const rangeHeader = req.headers.range;
  if (rangeHeader && contentType.startsWith('video/')) {
    const [rawStart, rawEnd] = rangeHeader.replace(/bytes=/, '').split('-');
    const start     = parseInt(rawStart, 10);
    const end       = rawEnd ? parseInt(rawEnd, 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      'Content-Range':  `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges':  'bytes',
      'Content-Length': chunkSize,
      'Content-Type':   contentType,
    });
    createReadStream(filePath, { start, end }).pipe(res);
  } else {
    const headers = {
      'Content-Length': fileSize,
      'Content-Type':   contentType,
      'Accept-Ranges':  'bytes',
    };
    if (contentType.startsWith('text/html')) {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      headers['Pragma']        = 'no-cache';
      headers['Expires']       = '0';
    }
    res.writeHead(200, headers);
    createReadStream(filePath).pipe(res);
  }
}).listen(PORT, '0.0.0.0', () => {
  let localIP = 'localhost';
  for (const iface of Object.values(networkInterfaces()).flat()) {
    if (iface.family === 'IPv4' && !iface.internal) { localIP = iface.address; break; }
  }
  console.log(`Local:   http://localhost:${PORT}`);
  console.log(`Network: http://${localIP}:${PORT}  ← open this on your phone`);
});
