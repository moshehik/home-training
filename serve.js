// Local static server for the site root:  node serve.js   ->  http://localhost:8765
// /api/<name> runs api/<name>.js like Vercel does (reads .env.local first), so the coach works locally with ANTHROPIC_API_KEY.
const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname;
try { fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/).forEach(l => { const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(l); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }); } catch (e) {}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.otf': 'font/otf', '.woff2': 'font/woff2' };
http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  const api = /^\/api\/([a-z0-9-]+)$/.exec(p);
  if (api && !api[1].startsWith('_') && fs.existsSync(path.join(root, 'api', api[1] + '.js'))) {
    let raw = '';
    q.on('data', c => { raw += c; if (raw.length > 1e5) q.destroy(); });
    q.on('end', async () => {
      try { q.body = raw ? JSON.parse(raw) : {}; } catch (e) { q.body = {}; }
      r.status = c => { r.statusCode = c; return r; };
      r.json = o => { r.setHeader('Content-Type', 'application/json; charset=utf-8'); r.end(JSON.stringify(o)); };
      try { await require(path.join(root, 'api', api[1] + '.js'))(q, r); } catch (e) { console.error(e); if (!r.writableEnded) r.status(500).json({ error: 'server' }); }
    });
    return;
  }
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root)) { r.writeHead(403); r.end('forbidden'); return; }
  fs.readFile(f, (e, d) => {
    if (e) { r.writeHead(404); r.end('not found'); return; }
    r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    r.end(d);
  });
}).listen(8765, () => console.log('http://localhost:8765'));
