// Page-by-page comparison with the old (plain HTML) site. Needs both running:
//   old: PORT=8099 node ../dev-server.js        new: npm run build && npm run preview
// Reports every word that is on one site's page but not the other's, and different counts of links, buttons, fields.
import { launch } from './browser.mjs';

const OLD = process.env.OLD_URL || 'http://localhost:8099';
const NEW = process.env.NEW_URL || 'http://localhost:4173';
const PUBLIC = ['home', 'programs', 'events', 'gallery', 'awareness', 'article?a=only-one-earth', 'environment', 'contact', 'donate', 'volunteer', 'login', 'signup', 'reports', 'terms', 'privacy', 'event?e=ev-slug'];
const SIGNED = ['dashboard', 'dashboard/donations', 'dashboard/events', 'dashboard/volunteer', 'dashboard/support', 'donate', 'volunteer', 'events'];
const ADMIN = ['dash', 'outbox', 'issues', 'donations', 'volunteers', 'events', 'news', 'articles', 'programs', 'gallery', 'look', 'testimonials', 'users', 'settings'];

const snapshot = () => {
  const text = document.body.innerText + ' ' + [...document.querySelectorAll('input[placeholder], textarea[placeholder]')].map((e) => e.placeholder).join(' ');
  const words = text.toLowerCase().split(/[\s·—|()]+/).filter((w) => w.length > 1 && !/\d/.test(w));
  const visible = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null).length;
  return { words: [...new Set(words)], counts: { links: visible('a[href]'), buttons: visible('button'), inputs: visible('input, select, textarea'), images: visible('img'), rows: visible('tr') } };
};

const slugOf = () => window.GIGF ? window.GIGF.DB.all('events')[0].slug : null;

async function open(base, isNew, kind) {
  const t = await launch({ base });
  await t.size(1366, 800);
  const at = (page) => {
    if (isNew) return '#' + page;
    const [name, rest] = page.split(/(?=[?/])/);
    const file = (name === 'home' ? 'index' : name) + '.html';
    return rest ? (rest.startsWith('/') ? file + '#' + rest.slice(1) : file + rest) : file;
  };
  await t.load(at('home'));
  if (kind !== 'public') {
    const [email, password] = kind === 'admin' ? ['admin@gigf.demo', 'Admin@12345'] : ['parity@example.com', 'Parity@12345'];
    await t.load(at('signup'));
    if (kind === 'admin') {
      await t.load(at('login'));
      await t.fill({ '#loginPw [name=email]': email, '#loginPw [name=password]': password });
      await t.click('#loginPw button[type=submit]');
    } else {
      await t.click('[data-t=signup]');
      await t.fill({ '#signupForm [name=name]': 'Parity Person', '#signupForm [name=email]': email, '#signupForm [name=phone]': '9876501234', '#signupForm [name=password]': password, '#signupForm [name=confirm]': password, '#signupForm [name=terms]': true });
      await t.click('#signupForm button[type=submit]');
    }
    await t.wait(2200);
  }
  return { t, at };
}

let differences = 0;
async function compare(kind, pages) {
  const a = await open(OLD, false, kind), b = await open(NEW, true, kind);
  if (kind === 'admin') {
    for (const s of [a, b]) {
      await s.t.load('admin.html#settings');
      await s.t.click('button', 'Load sample data');
      await s.t.wait(500);
    }
  }
  for (let page of pages) {
    const result = [];
    for (const s of [a, b]) {
      s.t.errors.length = 0;
      let p = page;
      if (p.includes('ev-slug')) p = p.replace('ev-slug', await s.t.run(slugOf) || 'x');
      if (kind === 'admin') { await s.t.click(`[data-sec="${p}"]`); await s.t.wait(500); } else await s.t.load(s.at(p), 1200);
      // scroll through so that animated numbers and reveal effects settle
      await s.t.run(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 40)); } window.scrollTo({ top: 0, behavior: 'instant' }); });
      await s.t.wait(600);
      result.push({ ...(await s.t.run(snapshot)), errors: [...new Set(s.t.errors)] });
    }
    const [o, n] = result;
    const missing = o.words.filter((w) => !n.words.includes(w)), added = n.words.filter((w) => !o.words.includes(w));
    const counts = Object.keys(o.counts).filter((k) => o.counts[k] !== n.counts[k]).map((k) => `${k} ${o.counts[k]}->${n.counts[k]}`);
    const same = !missing.length && !added.length && !counts.length && !n.errors.length;
    if (!same) differences++;
    console.log(`${same ? 'SAME ' : 'DIFF '} ${kind.padEnd(6)} ${page}` + (missing.length ? `\n        only old: ${missing.slice(0, 25).join(' ')}` : '') + (added.length ? `\n        only new: ${added.slice(0, 25).join(' ')}` : '') + (counts.length ? `\n        counts: ${counts.join(', ')}` : '') + (n.errors.length ? `\n        new errors: ${n.errors.slice(0, 3).join(' | ')}` : ''));
  }
  await a.t.close(); await b.t.close();
}

const only = process.argv[2];
if (!only || only === 'public') await compare('public', PUBLIC);
if (!only || only === 'signed') await compare('signed', SIGNED);
if (!only || only === 'admin') await compare('admin', ADMIN);
console.log(differences + ' page(s) differ');
process.exit(0);
