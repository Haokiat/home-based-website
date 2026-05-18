import { createServer } from 'http';
import { createReadStream, statSync } from 'fs';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { networkInterfaces } from 'os';

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
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type':   contentType,
      'Accept-Ranges':  'bytes',
    });
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
