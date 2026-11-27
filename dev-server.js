'use strict';
/**
 * Local dev server: serves the website AND the /api/* routes (chat, translate, AI event reader, ticket triage).
 *   1. Put your keys in .env.local (git-ignored). See .env.example.
 *   2. node dev-server.js        ->  http://localhost:8081
 * Requires Node 18+. No npm packages.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleChat, handleTranslate } = require('./api/_chat-core');
const { handleExtractEvent, handleTriage, handleExtractProgram, handleExtractVolunteer, handleExtractDonation, handleCaption, handleDraftArticle } = require('./api/_admin-ai');
const { handleAuth } = require('./api/_auth-core');
const { providers } = require('./api/_llm');
const { SECURITY_HEADERS } = require('./api/_headers');

const ROOT = __dirname;
['.env.local', '.env'].forEach((f) => {   // .env.local wins over .env
  try {
    fs.readFileSync(path.join(ROOT, f), 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && m[2] !== '' && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
  } catch (e) { /* file not present */ }
});

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.ico': 'image/x-icon', '.webp': 'image/webp', '.pdf': 'application/pdf' };
const ROUTES = {   // path -> handler + max request body (bytes)
  '/api/chat': { h: handleChat, max: 20000 },
  '/api/translate': { h: handleTranslate, max: 60000 },
  '/api/extract-event': { h: handleExtractEvent, max: 4500000 },
  '/api/triage': { h: handleTriage, max: 40000 },
  '/api/extract-program': { h: handleExtractProgram, max: 4500000 },
  '/api/extract-volunteer': { h: handleExtractVolunteer, max: 20000 },
  '/api/extract-donation': { h: handleExtractDonation, max: 20000 },
  '/api/caption-photo': { h: handleCaption, max: 1600000 },
  '/api/draft-article': { h: handleDraftArticle, max: 30000 },
  '/api/auth': { h: handleAuth, max: 8000 }
};
const isLoopback = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) && !req.headers['x-forwarded-for'];   // a reverse proxy sets x-forwarded-for -> not "local"

const send = (res, status, headers, body) => { res.writeHead(status, Object.assign({}, SECURITY_HEADERS, headers)); res.end(body); };

const server = http.createServer((req, res) => {
  try { handle(req, res); } catch (e) {            // one bad request must never take the whole server down
    console.error('[server] request error:', e && e.code || e && e.name);
    if (!res.headersSent) send(res, 400, {}, 'Bad request'); else res.end();
  }
});
process.on('uncaughtException', (e) => console.error('[server] uncaught:', e && e.code || e && e.name));
process.on('unhandledRejection', (e) => console.error('[server] unhandled rejection:', e && e.code || e && e.name));

// This computer only, unless you deliberately set HOST=0.0.0.0 (that exposes the dev server to your whole network).
const HOST = process.env.HOST || '127.0.0.1';
const LOCAL_NAMES = ['localhost', '127.0.0.1', '[::1]'];
const hostName = (h) => String(h || '').toLowerCase().replace(/:\d+$/, '');
const PUBLIC_DIRS = ['css', 'js', 'assets', 'gallery'];   // plus *.html in the root. Everything else is never served.

// Behind a trusted proxy (Kubernetes ingress) set TRUST_PROXY=1: the visitor's address is the LAST x-forwarded-for entry, the one the proxy added.
const clientIp = (req) => (process.env.TRUST_PROXY === '1' && String(req.headers['x-forwarded-for'] || '').split(',').pop().trim()) || req.socket.remoteAddress;

function handle(req, res) {
  if (req.url === '/healthz') return send(res, 200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }, 'ok');   // container health check
  const localName = LOCAL_NAMES.includes(hostName(req.headers.host));
  if (LOCAL_NAMES.includes(HOST) && !localName) return send(res, 421, {}, 'Wrong host');   // blocks DNS-rebinding web pages
  let url; try { url = new URL(req.url, 'http://localhost'); } catch (e) { return send(res, 400, {}, 'Bad request'); }
  const route = ROUTES[url.pathname];
  if (route) {
    if (req.method !== 'POST') return send(res, 405, { Allow: 'POST' }, '');
    // another website must not be able to drive this API from the visitor's browser
    if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) return send(res, 415, {}, 'JSON only');
    const origin = req.headers.origin, allowed = String(process.env.ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);
    if (origin) { let same = false; try { same = new URL(origin).host === req.headers.host; } catch (e) { } if (!same && !allowed.includes(origin)) return send(res, 403, {}, 'Cross-site request refused'); }
    let raw = '', size = 0, dead = false;
    req.on('data', (c) => { size += c.length; if (size > route.max) { dead = true; send(res, 413, { 'Content-Type': 'application/json' }, '{"error":"too_large"}'); req.destroy(); } else raw += c; });
    req.on('end', async () => {
      if (dead) return;
      let body = null; try { body = JSON.parse(raw); } catch (e) { }
      const out = await route.h({ body, ip: clientIp(req), origin: req.headers.origin, env: process.env, headers: req.headers, loopback: isLoopback(req) && localName });
      send(res, out.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, JSON.stringify(out.json));
    });
    return;
  }
  // static files — never serve dotfiles (.env / .env.local!), the api/ folder, or this server file
  let rel; try { rel = decodeURIComponent(url.pathname); } catch (e) { return send(res, 400, {}, 'Bad request'); }
  if (rel.includes('\0') || rel.includes('\\') || rel.includes(':')) return send(res, 400, {}, 'Bad request');   // null bytes and backslashes are never valid in our paths
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(ROOT, rel));
  const parts = path.relative(ROOT, file).split(path.sep);
  const isPublic = parts.length === 1 ? /^([\w-]+\.html|sitemap\.xml|robots\.txt)$/.test(parts[0]) : PUBLIC_DIRS.includes(parts[0]);   // allow-list, case-exact
  if (!file.startsWith(ROOT + path.sep) || parts.some((p) => p.startsWith('.') || /[. ]$/.test(p)) || !isPublic) return send(res, 404, {}, 'Not found');
  fs.stat(file, (e, st) => {
    if (e || !st.isFile()) return send(res, 404, {}, 'Not found');
    res.writeHead(200, Object.assign({}, SECURITY_HEADERS, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' }));
    fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
  });
}
const PORT = Number(process.env.PORT) || 8081;
server.listen(PORT, HOST, () => console.log(`Green India Gokul Foundation  →  http://localhost:${PORT}\nChatbot LLM — providers: ${providers(process.env).join(' → ') || 'NONE configured: chat/translation fall back to built-in answers / English'}`));
// stop cleanly when the container is told to
['SIGTERM', 'SIGINT'].forEach((sig) => process.on(sig, () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 8000).unref(); }));
