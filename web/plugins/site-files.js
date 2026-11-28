/**
 * Things around the React app that a static host needs:
 *  - the site's pictures and videos (kept once, in the repository root)
 *  - the old addresses (donate.html, events.html ...) still working: each is a real page of the app
 *  - the strict Content-Security-Policy in the built pages (dev mode needs inline scripts, so not there)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES } from '../src/lib/routes.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FOLDERS = ['assets', 'gallery'];
const FILES = ['robots.txt', 'sitemap.xml'];
const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.mp4': 'video/mp4', '.pdf': 'application/pdf', '.xml': 'application/xml', '.txt': 'text/plain' };
const LEGACY = PAGES.filter((p) => p !== 'home');

const CSP = "default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style; font-src https://fonts.gstatic.com; img-src 'self' data: blob: https://*.googleusercontent.com https://hbnwugmdivvjoebevbgv.supabase.co; media-src 'self' blob: https://hbnwugmdivvjoebevbgv.supabase.co; connect-src 'self' https://accounts.google.com/gsi/ https://hbnwugmdivvjoebevbgv.supabase.co; frame-src https://www.google.com https://accounts.google.com/gsi/; object-src 'none'; base-uri 'self'; form-action 'self'";

/** each old page is a real copy of the app, with that page's own title and description (search engines read them) */
function legacyPage(app, name) {
  const old = fs.readFileSync(path.join(ROOT, name + '.html'), 'utf8');
  const title = (old.match(/<title>[^<]*<\/title>/) || [])[0];
  const description = (old.match(/<meta name="description" content="[^"]*">/) || [])[0];
  let html = app;
  if (title) html = html.replace(/<title>[^<]*<\/title>/, () => title);
  if (description) html = html.replace(/<meta name="description" content="[^"]*">/, () => description);
  return html;
}

export default function siteFiles() {
  let outDir = '';
  return {
    name: 'gigf-site-files',
    configResolved(c) { outDir = path.resolve(c.root, c.build.outDir); },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        let rel;
        try { rel = decodeURIComponent(url.pathname).slice(1); } catch { return next(); }
        const legacy = rel.match(/^([a-z]+)\.html$/);
        if (legacy && LEGACY.includes(legacy[1])) { res.writeHead(302, { Location: '/#' + legacy[1] + url.search }); return res.end(); }
        if (!FOLDERS.includes(rel.split('/')[0]) && !FILES.includes(rel)) return next();
        const file = path.normalize(path.join(ROOT, rel));
        if (!file.startsWith(ROOT + path.sep) || rel.includes('..') || !fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
        res.setHeader('Content-Type', TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
        fs.createReadStream(file).pipe(res);
      });
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (ctx.server) return html;
        return html.replace('<meta charset="UTF-8">', `<meta charset="UTF-8">\n  <meta http-equiv="Content-Security-Policy" content="${CSP}">`);
      }
    },
    closeBundle() {
      if (!outDir || !fs.existsSync(outDir)) return;
      FOLDERS.forEach((d) => fs.cpSync(path.join(ROOT, d), path.join(outDir, d), { recursive: true }));
      FILES.forEach((f) => fs.copyFileSync(path.join(ROOT, f), path.join(outDir, f)));
      const app = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
      LEGACY.forEach((p) => fs.writeFileSync(path.join(outDir, p + '.html'), legacyPage(app, p)));
    }
  };
}
