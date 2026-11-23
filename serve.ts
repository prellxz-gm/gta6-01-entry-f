// Costa Verde — serve.ts
// Tiny static server for local playtesting: serves game/ at / and
// screenshots/ at /screenshots. No dependencies, Node stdlib only.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';

const root = resolve(import.meta.dirname ?? '.');
const PORT = parseInt(process.env.PORT || '8931', 10);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.css': 'text/css; charset=utf-8',
};

const server = createServer((req, res) => {
  try {
    const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
    let p = decodeURIComponent(url.pathname);
    if (p === '/') p = '/game/index.html';
    else if (p.startsWith('/screenshots/')) p = p; // served from repo root
    else if (!p.startsWith('/game/')) p = '/game' + p;
    const file = join(root, p);
    if (!existsSync(file) || !file.startsWith(root)) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    const body = readFileSync(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end(String(e));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Costa Verde playtest server at http://127.0.0.1:${PORT}/`);
  console.log(`Shots: ?shot=start | ?shot=play | ?shot=chase | ?shot=end (add &seed=1)`);
});
