import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png'
};

const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let filePath = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!filePath.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    if ((await stat(filePath)).isDirectory()) filePath = path.join(filePath, 'index.html');
    const body = await readFile(filePath);
    response.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

server.listen(4173, '127.0.0.1');
process.on('SIGTERM', () => server.close());
