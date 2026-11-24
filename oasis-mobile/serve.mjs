import { createServer } from 'node:http';
import { access, readFile } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const staticRoot = fileURLToPath(new URL('./dist/', import.meta.url));
const port = Number(process.env.PORT || 8080);
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function handleRequest(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end('Invalid URL');
    return;
  }

  const requestedPath = pathname === '/' ? 'index.html' : pathname.replace(/^[/\\]+/, '');
  let filePath = resolve(staticRoot, requestedPath);
  const relativePath = relative(staticRoot, filePath);
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  const hasExtension = extname(requestedPath) !== '';
  if (!hasExtension && await fileExists(`${filePath}.html`)) {
    filePath = `${filePath}.html`;
  } else if (!await fileExists(filePath)) {
    if (hasExtension) {
      response.writeHead(404).end('Not found');
      return;
    }
    filePath = resolve(staticRoot, 'index.html');
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    console.error('Failed to serve static file:', error);
    response.writeHead(500).end('Internal server error');
  }
}

const server = createServer((request, response) => {
  void handleRequest(request, response);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`LabSpace berjalan pada port ${port}.`);
});
