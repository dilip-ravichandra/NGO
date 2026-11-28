// Browser journeys against the production build: node tests/e2e.mjs   (after "npm run build"; "npm run test:e2e" does both)
// Optional: a word to run only matching tests, e.g.  node tests/e2e.mjs donate
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { preview } from 'vite';
import { launch } from './browser.mjs';

const root = path.resolve(import.meta.dirname, '..');
const server = await preview({ root, preview: { port: 4188, strictPort: true, host: '127.0.0.1' }, logLevel: 'silent' });
const BASE = 'http://localhost:4188';
const files = fs.mkdtempSync(path.join(os.tmpdir(), 'gigf-files-'));
const PNG = path.join(files, 'id-card.png');
fs.writeFileSync(PNG, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGNk+M/wnwEImBigAAAfEgIDGM4ZlgAAAABJRU5ErkJggg==', 'base64'));
const TXT = path.join(files, 'notes.txt');
fs.writeFileSync(TXT, 'not an id');

const only = process.argv[2];
const results = [];
let t;
async function test(name, fn) {
  if (only && !name.toLowerCase().includes(only.toLowerCase())) return;
  t.errors.length = 0; t.downloads.length = 0; t.dialogs.accept = true; t.dialogs.prompt = ''; t.dialogs.seen.length = 0;
  try {
    await fn();
    const real = t.errors.filter((e) => !/accounts\.google|frame-ancestors|ERR_BLOCKED_BY_CLIENT/.test(e));
    assert.deepEqual(real, [], 'errors in the browser console');
    results.push([true, name]); console.log('  ✔ ' + name);
  } catch (e) {
    results.push([false, name]); console.log('  ✖ ' + name + '\n      ' + String(e.message).split('\n').slice(0, 6).join('\n      '));
  }
}

/* ---------- helpers ---------- */
const text = (sel = 'body') => t.run((s) => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
const has = (words, sel = 'body') => t.until((w, s) => { const e = document.querySelector(s); return !!e && e.innerText.includes(w); }, [words, sel]);
const gone = (sel) => t.until((s) => !document.querySelector(s), [sel]);
const toastSays = (words) => t.until((w) => [...document.querySelectorAll('.toast')].some((e) => e.textContent.includes(w)), [words]);
const val = (sel) => t.run((s) => document.querySelector(s).value, sel);
const db = (collection) => t.run((c) => window.GIGF.DB.all(c), collection);
const reset = async () => { await t.load('#home'); await t.run(() => { localStorage.clear(); sessionStorage.clear(); }); await t.load('#home'); };
const PASSWORD = 'Test@12345';
async function fillSignup(email, name = 'Test Donor', phone = '9876543210') {
  await t.click('[data-t=signup]');
  await t.fill({ '#signupForm [name=name]': name, '#signupForm [name=email]': email, '#signupForm [name=phone]': phone, '#signupForm [name=password]': PASSWORD, '#signupForm [name=confirm]': PASSWORD, '#signupForm [name=terms]': true });
  await t.click('#signupForm button[type=submit]');
  await t.until(() => !!window.GIGF.Auth.current());
  await t.wait(900);   // the welcome toast, then it moves on
}
async function newDonor(email = 'donor@example.com') { await t.load('#signup'); await fillSignup(email); }
async function login(email, password = PASSWORD) {
  await t.load('#login');
  await t.fill({ '#loginPw [name=email]': email, '#loginPw [name=password]': password });
  await t.click('#loginPw button[type=submit]');
}
const logout = () => t.run(() => window.GIGF.Auth.logout());
async function asAdmin(section) {
  await logout();
  await login('admin@gigf.demo', 'Admin@12345');
  await t.until(() => location.pathname.endsWith('admin.html'));
  await t.wait(500);
  if (section) await openSection(section);
}
const openSection = async (key) => { await t.click(`[data-sec="${key}"]`); await t.wait(150); };
const rowButton = (rowText, label) => t.until((r, l) => { const row = [...document.querySelectorAll('.admin-main tr, .modal-body tr')].find((x) => x.textContent.includes(r)); const b = row && [...row.querySelectorAll('button')].find((x) => x.textContent.includes(l)); if (!b) return false; b.click(); return true; }, [rowText, label]);

/* ---------- the tests ---------- */
t = await launch({ base: BASE });
await t.size(1366, 800);
console.log('\nPages and addresses');

const PAGES = ['home', 'programs', 'events', 'gallery', 'awareness', 'article?a=only-one-earth', 'environment', 'contact', 'volunteer', 'donate', 'login', 'signup', 'reports', 'terms', 'privacy'];
for (const [label, w, h, mobile] of [['desktop', 1366, 800, false], ['phone', 390, 844, true]]) {
  await test(`every public page draws, without sideways scrolling or broken pictures (${label})`, async () => {
    await t.size(w, h, mobile);
    await reset();
    const problems = [];
    for (const p of PAGES) {
      await t.load('#' + p);
      const info = await t.run(() => ({ chars: document.querySelector('#main').innerText.length, over: document.documentElement.scrollWidth - innerWidth, broken: [...document.images].filter((i) => i.complete && !i.naturalWidth && i.getAttribute('src')).map((i) => i.getAttribute('src').slice(0, 60)) }));
      if (info.chars < 50 || info.over > 1 || info.broken.length) problems.push(p + ' ' + JSON.stringify(info));
    }
    assert.deepEqual(problems, []);
    await t.size(1366, 800);
  });
}

await test('old addresses (donate.html, programs.html#...) still open the right page', async () => {
  await reset();
  await t.load('donate.html?program=cow', 1200);
  await t.until(() => location.hash === '#donate?program=cow');
  assert.equal(await val('#dProgram'), 'cow');
  await t.load('programs.html#cow-protection', 1200);
  await t.until(() => document.querySelector('#cow-protection.open'));
  await t.load('index.html', 1200);
  await t.until(() => !!document.querySelector('#heroCarousel'));
});

await test('old page files keep their own title for search engines', async () => {
  const html = await (await fetch(BASE + '/donate.html')).text();
  assert.ok(html.includes('<title>Donate | Green India Gokul Foundation</title>'), 'own title');
  assert.match(html, /Content-Security-Policy/);
  await t.load('article.html?a=only-one-earth', 1500);
  await t.until(() => location.hash === '#article?a=only-one-earth');
  await has('There is only one Earth', '#detail');
});

await test('menu links move between pages without reloading, and the back button works', async () => {
  await reset();
  await t.run(() => { window.stayed = true; });
  await t.click('.nav-menu a', 'Events');
  await has('Events & Registration', '#main');
  await t.click('.nav-menu a', 'Gallery');
  await has('All media', '#main');
  await t.run(() => history.back());
  await has('Events & Registration', '#main');
  assert.equal(await t.run(() => window.stayed), true);
  assert.equal(await t.run(() => document.body.dataset.page), 'events');
});

await test('guest cannot open the admin portal or the dashboard', async () => {
  await reset();
  await t.load('admin.html', 1500);
  await t.until(() => !location.pathname.endsWith('admin.html'));
  await t.load('#dashboard');
  await t.until(() => location.hash.startsWith('#login'));
});

console.log('\nDonating');

await test('guest tapping Donate is asked to log in first', async () => {
  await reset();
  await t.click('.nav-menu a.donate-btn-header');
  await has('Please log in to donate', '.modal-box');
  assert.equal(await t.run(() => location.hash), '#home');
  await t.click('.gate-later');
  await gone('.modal-box');
});

await test('every donation choice survives signing up, and the PAN is not stored', async () => {
  await reset();
  await t.load('#donate');
  await t.click('.amt[data-a="5000"]');
  await t.click('[data-f=MONTHLY]');
  await t.click('[data-m=Card]');
  await t.fill({ '#dProgram': 'cow', '#dName': 'Test Donor', '#dPhone': '9876543210', '#dEmail': 'a@example.com', '#dPan': 'ABCDE1234F' });
  await t.click('#dSubmit');
  await has('Please log in to donate', '.modal-box');
  assert.ok(!(await t.run(() => sessionStorage.getItem('gigf_draft_donate'))).includes('ABCDE1234F'));
  await t.click('.gate-signup');
  await fillSignup('a@example.com');
  await t.until(() => location.hash.startsWith('#donate'));
  await t.wait(300);
  const state = await t.run(() => ({ amount: dAmount.value, program: dProgram.value, freq: document.querySelector('.seg .on').dataset.f, method: document.querySelector('.pay-opt.on').dataset.m, button: dSubmit.innerText, note: !upiMonthly.hidden, pan: dPan.value }));
  assert.equal(state.amount, '5000'); assert.equal(state.program, 'cow'); assert.equal(state.freq, 'MONTHLY'); assert.equal(state.method, 'Card'); assert.equal(state.pan, '');
  assert.match(state.button, /₹5,000 \/ month/);
  assert.ok(state.note, 'monthly note on the UPI box');
});

await test('donate: mistakes are highlighted and nothing is recorded', async () => {
  await reset(); await newDonor();
  await t.load('#donate');
  await t.fill({ '#dAmount': '5', '#dName': '', '#dPhone': '123', '#dPan': 'WRONG' });
  await t.click('#dSubmit');
  await toastSays('highlighted');
  assert.equal(await t.run(() => document.querySelectorAll('#donForm .field.bad').length), 4);
  assert.equal((await db('donations')).length, 0);
});

await test('donate: success gives a numbered receipt, a PDF and a dashboard entry', async () => {
  await reset(); await newDonor();
  await t.load('#donate');
  await t.click('.amt[data-a="2500"]');
  await t.click('#dSubmit');
  await has('Donation successful', '.modal-box');
  await has('GIGF/', '.modal-box');
  await t.click('#rView');
  await t.until(() => true); await t.wait(1200);
  assert.ok(t.downloads.some((f) => /^Receipt-.*\.pdf$/.test(f)), 'PDF downloaded: ' + t.downloads.join());
  await t.click('.modal-box a', 'My donations');
  await t.click('[data-tab=donations]');
  await has('₹2,500', '#dashBody');
  await has('CAPTURED', '#dashBody');
});

await test('donate monthly, then stop it from the dashboard', async () => {
  await reset(); await newDonor();
  await t.load('#donate');
  await t.click('[data-f=MONTHLY]');
  await t.click('#dSubmit');
  await has('(monthly)', '.modal-box');
  await t.load('#dashboard/donations');
  await t.click('#dashBody button', 'Stop monthly');
  await has('stopped', '#dashBody');
  assert.equal((await db('donations'))[0].cancelled, true);
});

await test('report a payment problem from the dashboard', async () => {
  await reset(); await newDonor();
  await t.load('#donate');
  await t.click('#dSubmit');
  await has('Donation successful', '.modal-box');
  await t.load('#dashboard/donations');
  await t.click('#dashBody button', 'Report issue');
  await t.fill({ '#issForm [name=d]': 'Money left my account' });
  await t.click('#issForm button[type=submit]');
  await has('TKT-', '#dashBody');
  assert.equal((await db('tickets'))[0].category, 'PAYMENT_ISSUE');
});

await test('UPI: a guest\'s reference survives signing up; the claim waits for checking', async () => {
  await reset();
  await t.load('#donate');
  await t.click('.amt[data-a="2500"]');
  await t.fill({ '#dName': 'Test Donor', '#dPhone': '9876543210', '#upiUtr': '123456789012' });
  await t.click('#upiDone');
  await t.click('.gate-signup');
  await fillSignup('b@example.com');
  await t.until(() => location.hash.startsWith('#donate'));
  await t.wait(300);
  assert.equal(await val('#upiUtr'), '123456789012');
  assert.equal(await val('#dAmount'), '2500');
  await t.click('#upiDone');
  await has('Waiting to be checked', '.modal-box');
  const [d] = await db('donations');
  assert.equal(d.status, 'PENDING'); assert.equal(d.receiptNo, ''); assert.equal(d.amount, 2500);
  assert.equal(await t.run(() => sessionStorage.getItem('gigf_draft_donate')), null);
  await t.click('.btn-close-modal');
  await t.fill({ '#upiUtr': '123456789012' });
  await t.click('#upiDone');
  await toastSays('already been submitted');
  await t.fill({ '#upiUtr': '123' });
  await t.click('#upiDone');
  await toastSays('exactly 12 digits');
});

console.log('\nAccounts, events, volunteering, contact');

await test('signup rules, duplicate email, wrong password, log out and in again', async () => {
  await reset();
  await t.load('#signup');
  await t.click('#signupForm button[type=submit]');
  await has('Please fix the highlighted fields', '#signupMsg');
  assert.ok(await t.run(() => document.querySelectorAll('#signupForm .a-field.bad').length >= 4));
  await t.fill({ '#signupForm [name=password]': 'weak' });
  await has('meet all 4 rules', '#pwLabel');
  await fillSignup('c@example.com');
  await t.until(() => location.hash.startsWith('#dashboard'));
  await t.click('#profileBtn');
  await t.click('.profile-menu a', 'Logout');
  await t.until(() => !window.GIGF || !window.GIGF.Auth.current());
  await t.wait(800);
  await t.load('#signup');
  await t.click('[data-t=signup]');
  await t.fill({ '#signupForm [name=name]': 'Again', '#signupForm [name=email]': 'c@example.com', '#signupForm [name=phone]': '9876500000', '#signupForm [name=password]': PASSWORD, '#signupForm [name=confirm]': PASSWORD, '#signupForm [name=terms]': true });
  await t.click('#signupForm button[type=submit]');
  await has('already registered', '#signupMsg');
  await login('c@example.com', 'Wrong@12345');
  await has('Incorrect email or password', '#loginMsg');
  await login('c@example.com');
  await t.until(() => location.hash.startsWith('#dashboard'));
});

await test('Terms and Privacy open from the signup form', async () => {
  await reset();
  await t.load('#signup');
  assert.deepEqual(await t.run(() => [...document.querySelectorAll('#signupForm label a')].map((a) => a.getAttribute('href') + ' ' + a.target)), ['#terms _blank', '#privacy _blank']);
});

await test('event: register once, see it on the dashboard, cancel it', async () => {
  await reset();
  await t.load('#events');
  await t.click('[data-reg]');
  await has('Please log in', '.modal-box');
  await t.click('.gate-signup');
  await fillSignup('e@example.com');
  await has('Guests (incl. you)', '.modal-box');   // comes straight back to the registration
  await t.click('#regForm button[type=submit]');
  await toastSays('Registered!');
  await t.click('[data-reg]');
  await t.click('#regForm button[type=submit]');
  await toastSays('already registered');
  await t.load('#dashboard/events');
  await has('1 guest(s)', '#dashBody');
  await t.click('#dashBody button', 'Cancel registration');
  await has('You have not registered', '#dashBody');
});

await test('events: programme filter, calendar view, event page', async () => {
  await reset();
  await t.load('#events');
  const all = await t.run(() => document.querySelectorAll('#evBody .ev-card').length);
  await t.click('#evFilters .pill', 'Cow');
  assert.ok(await t.run((n) => document.querySelectorAll('#evBody .ev-card').length < n, all));
  await t.click('#evFilters .pill', 'All');
  await t.click('[data-v=cal]');
  await t.until(() => document.querySelectorAll('.cal-ev').length > 0);
  await t.click('#calNext');
  await has('2027', '.cal-head');
  await t.click('[data-v=list]');
  await t.click('.ev-card h4 a');
  await has('Open in Google Maps', '#detail');
});

await test('volunteer: ID file is checked, application gets a badge and cannot be repeated', async () => {
  await reset(); await newDonor('v@example.com');
  await t.load('#volunteer');
  await t.click('#volForm button[type=submit]');
  await toastSays('highlighted');
  await t.setFile('#vFile', [TXT]);
  await has('Only JPG, PNG or PDF', '#volForm');
  await t.fill({ '#volForm [name=city]': 'Bengaluru' });
  await t.setFile('#vFile', [PNG]);
  await has('id-card.png', '#vFileName');
  await t.click('#volForm button[type=submit]');
  await has('GIGF-VOL-', '#volStatus');
  await t.load('#volunteer');
  await has('PENDING', '#volStatus');
  assert.equal(await t.run(() => !!document.querySelector('#volForm')), false);
  assert.equal((await db('volunteers')).length, 1);
});

await test('contact form logs a ticket; short messages are refused', async () => {
  await reset();
  await t.load('#contact');
  await t.fill({ '#contactForm [name=name]': 'Visitor', '#contactForm [name=email]': 'x@example.com', '#contactForm [name=message]': 'short' });
  await t.click('#contactForm button[type=submit]');
  await toastSays('highlighted');
  await t.fill({ '#contactForm [name=message]': 'When is the next plantation drive?' });
  await t.click('#contactForm button[type=submit]');
  await has('TKT-', '#contactResult');
});

await test('text typed by visitors is shown as text, never run as code', async () => {
  await reset();
  const evil = '<img src=x onerror="window.hacked=1">';
  await t.load('#contact');
  await t.fill({ '#contactForm [name=name]': evil, '#contactForm [name=email]': 'x@example.com', '#contactForm [name=message]': evil + ' please help me now' });
  await t.click('#contactForm button[type=submit]');
  await has('TKT-', '#contactResult');
  await asAdmin('issues');
  await has('onerror', '.admin-main');
  await rowButton('onerror', 'Open');
  await has('onerror', '.modal-box');
  assert.equal(await t.run(() => window.hacked || 0), 0);
  assert.equal(await t.run(() => document.querySelectorAll('.admin-main img[src=x], .modal-box img[src=x]').length), 0);
});

console.log('\nOther features');

await test('home: banner arrows, sample testimonials are labelled, newsletter', async () => {
  await reset();
  const active = () => t.run(() => [...document.querySelectorAll('.hero-slide')].findIndex((s) => s.classList.contains('active')));
  const first = await active();
  await t.click('.carousel-arrow.next');
  assert.notEqual(await active(), first);
  assert.equal(await t.run(() => document.querySelectorAll('#testi .chip').length), 3);
  await t.fill({ '#newsForm input': 'news@example.com' });
  await t.click('#newsForm button');
  await toastSays('Subscribed');
  assert.equal((await db('subscribers')).length, 1);
});

await test('programmes open; gallery filters and full-screen viewer work', async () => {
  await reset();
  await t.load('#programs');
  await t.click('[data-id=skill] [data-toggle]');
  await t.until(() => document.querySelector('[data-id=skill].open'));
  assert.match(await t.run(() => document.querySelector('[data-id=skill] .img').style.backgroundImage), /women_skills\.jpg/);
  await t.load('#gallery');
  await t.click('#galTypes .pill', 'Videos');
  await has('2 items', '#galCount');
  await t.click('#galTypes .pill', 'All');
  await t.click('.m-item');
  await has('1/5', '.lb-cap');
  await t.click('.lb-next');
  await has('2/5', '.lb-cap');
  await t.click('.lb-x');
  await gone('.lb');
});

await test('articles: search, open one, share the address', async () => {
  await reset();
  await t.load('#awareness');
  await t.fill({ '#artSearch': 'one earth' });
  await t.until(() => document.querySelectorAll('.art-card').length === 1);
  await t.click('.art-card');
  await has('There is only one Earth', '#detail');
  assert.match(await t.run(() => document.title), /only one Earth/i);
});

await test('environment pledges and health tabs', async () => {
  await reset();
  await t.load('#environment');
  for (let i = 0; i < 5; i++) await t.run((n) => document.querySelectorAll('[data-pick]')[n].click(), i);
  await has('Earth Guardian', '#envPledgeBar');
  await t.click('.env-tabs .tab', 'Long-term');
  await has('Cardiovascular', '#envHealthBody');
  await t.load('#environment');
  assert.equal(await t.run(() => document.querySelectorAll('[data-pick]:checked').length), 5);
});

await test('chat assistant: built-in answers and a handover to the team', async () => {
  await reset();
  await t.click('#chatLauncher');
  await t.click('.chip-btn[class="chip-btn"]', 'How to donate');
  await has('Donate page', '#chatMessages');
  await t.click('.chip-admin');
  await t.fill({ '.chat-form [name=name]': 'Visitor', '.chat-form [name=contact]': 'z@example.com', '.chat-form [name=msg]': 'Please call me' });
  await t.click('.chat-form button');
  await has('created', '#chatMessages');
  assert.equal((await db('tickets'))[0].category, 'CHAT_ESCALATION');
});

await test('Kannada: menus, banner and the UPI box change language', async () => {
  await reset();
  await t.click('.lang-switch .lang-btn', 'ಕನ್ನಡ');
  await t.wait(1500);
  await has('ದೇಣಿಗೆ', '.nav-menu');
  await has('ಗ್ರೀನ್ ಇಂಡಿಯಾ', '#heroCarousel');
  await t.load('#donate');
  await has('ಅಥವಾ ನಮ್ಮ UPI ID', '#upiCard h4');
  await t.run(() => localStorage.removeItem('gigf_lang'));
});

await test('phone: menu drawer opens, navigates and closes', async () => {
  await t.size(390, 844, true);
  await reset();
  await t.click('#mobileMenuBtn');
  await t.until(() => document.querySelector('#mobileNavDrawer.open'));
  await t.click('#mobileNavDrawer a', 'Contact');
  await has('Helpline', '#main');
  await t.until(() => !document.querySelector('#mobileNavDrawer.open'));
  await t.size(1366, 800);
});

console.log('\nAdmin portal');

await test('every admin screen opens, with sample data', async () => {
  await reset(); await asAdmin('settings');
  await t.click('.admin-main button', 'Load sample data');
  for (const s of ['dash', 'outbox', 'issues', 'donations', 'volunteers', 'events', 'news', 'articles', 'programs', 'gallery', 'look', 'testimonials', 'users', 'audit', 'settings']) {
    await openSection(s);
    assert.ok((await text('.admin-main')).length > 30, s);
  }
  await t.click('.admin-main button', 'Remove sample data');
  assert.equal((await db('donations')).length, 0);
});

await test('admin verifies a UPI payment: receipt issued, donor sees it', async () => {
  await reset(); await newDonor('u@example.com');
  await t.load('#donate');
  await t.fill({ '#dPhone': '9876543210', '#upiUtr': '222233334444' });
  await t.click('#upiDone');
  await has('Waiting to be checked', '.modal-box');
  await asAdmin('donations');
  await t.click('.admin-main button', 'To verify (1)');
  await rowButton('222233334444', 'Verify');
  await toastSays('receipt issued');
  const [d] = await db('donations');
  assert.equal(d.status, 'CAPTURED'); assert.match(d.receiptNo, /^GIGF\//);
  assert.match(t.dialogs.seen.join(' '), /222233334444/);
  await logout(); await login('u@example.com');
  await t.until(() => location.hash.startsWith('#dashboard'));
  await t.load('#dashboard/donations');
  await has(d.receiptNo, '#dashBody');
});

await test('admin saying "no" to the confirmation changes nothing', async () => {
  await reset(); await newDonor('n@example.com');
  await t.load('#donate');
  await t.fill({ '#dPhone': '9876543210', '#upiUtr': '555566667777' });
  await t.click('#upiDone');
  await asAdmin('donations');
  await t.click('.admin-main button', 'To verify (1)');
  t.dialogs.accept = false;
  await rowButton('555566667777', 'Verify');
  await t.wait(300);
  assert.equal((await db('donations'))[0].status, 'PENDING');
});

await test('admin records a cash gift, filters, exports and sends the receipt', async () => {
  await reset(); await asAdmin('donations');
  await t.click('.admin-main button', 'Record offline gift');
  await t.click('#oForm button[type=submit]');
  await t.fill({ '#oForm [name=donorName]': 'Cash Giver', '#oForm [name=amount]': '750', '#oForm [name=donorPhone]': '9000000001' });
  await t.click('#oForm button[type=submit]');
  await gone('.modal-box');
  await has('Cash Giver', '.admin-main');
  await t.fill({ '#dq': 'nobody' });
  await has('Nothing here yet', '.admin-main');
  await t.fill({ '#dq': 'cash' });
  await t.click('.admin-main button', 'Export Excel');
  await t.wait(600);
  assert.ok(t.downloads.includes('donations.csv'));
  assert.match(fs.readFileSync(path.join(t.downloadDir, 'donations.csv'), 'utf8'), /Cash Giver/);
  await rowButton('Cash Giver', 'Send');
  await has('The PDF has been downloaded', '.modal-box');
  await t.click('.btn-close-modal');
  await t.click('.admin-main button', 'Reports');
  await has('By payment method', '.admin-main');
});

await test('admin approves and rejects volunteers; certificate; manual add', async () => {
  await reset(); await newDonor('w@example.com');
  await t.load('#volunteer');
  await t.fill({ '#volForm [name=city]': 'Hebbal' });
  await t.setFile('#vFile', [PNG]);
  await t.click('#volForm button[type=submit]');
  await has('GIGF-VOL-', '#volStatus');
  await asAdmin('volunteers');
  await rowButton('Test Donor', 'Approve');
  await rowButton('Test Donor', '👤 Open');
  await t.fill({ '#vNewTask': 'Bring gloves' });
  await t.click('#vAddTask');
  await t.click('#vAddDay');
  await t.click('#vForm2 button[type=submit]');
  await gone('.modal-box');
  await rowButton('Test Donor', '🏅');
  await t.wait(1200);
  assert.ok(t.downloads.some((f) => /^Certificate-/.test(f)), 'certificate downloaded');
  await t.click('.admin-main button', 'Add volunteer');
  await t.fill({ '#vForm2 [name=name]': 'Kavya Rao', '#vForm2 [name=phone]': '9876511111', '#vForm2 [name=status]': 'PENDING' });
  await t.click('#vForm2 button[type=submit]');
  t.dialogs.prompt = 'Not in our area';
  await rowButton('Kavya Rao', 'Reject');
  await has('REJECTED', '.admin-main');
  await logout(); await login('w@example.com');
  await t.until(() => location.hash.startsWith('#dashboard'));
  await t.load('#dashboard/volunteer');
  await has('Bring gloves', '#dashBody');
  await has('APPROVED', '#dashBody');
  await t.click('#dashBody button', 'Mark done');
  await has('Done', '#dashBody');
});

await test('admin creates an event; visitors see it; attendance; delete', async () => {
  await reset(); await asAdmin('events');
  await t.click('.admin-main button', 'New event');
  await t.fill({ '#edForm [name="title.en"]': 'Lake Cleaning Day', '#edForm [name="desc.en"]': 'Bring gloves.', '#edForm [name=location]': 'Hebbal Lake', '#edForm [name=date]': '2027-02-14' });
  await t.click('#edForm button[type=submit]');
  await has('Lake Cleaning Day', '.admin-main');
  await logout();
  await t.load('#events');
  await has('Lake Cleaning Day', '#evBody');
  await newDonor('ev@example.com');
  await t.load('#events');
  await t.run(() => [...document.querySelectorAll('.ev-card')].find((c) => c.textContent.includes('Lake Cleaning')).querySelector('[data-reg]').click());
  await t.click('#regForm button[type=submit]');
  await toastSays('Registered');
  await asAdmin('events');
  await rowButton('Lake Cleaning Day', 'Attendance');
  await t.click('[data-att]');
  assert.equal((await db('registrations'))[0].attended, true);
  await t.click('.btn-close-modal');
  await rowButton('Lake Cleaning Day', '🗑️');
  assert.ok(!(await text('.admin-main')).includes('Lake Cleaning Day'));
});

await test('admin: AI poster intake says plainly when the AI is not available', async () => {
  await reset(); await asAdmin('events');
  await t.click('.admin-main button', 'Create from poster');
  await t.fill({ '#aiText': 'Tree walk on 1 January at Lalbagh at 10am' });
  await t.run(() => { window.realFetch = window.fetch; window.fetch = async () => new Response('{"error":"x"}', { status: 503 }); });
  await t.click('#aiRead');
  await has('AI is not configured', '#aiOut');
  await t.run(() => {
    window.fetch = async () => new Response(JSON.stringify({ draft: { title: 'Tree Walk', date: '2027-01-01', time: '10:00', location: 'Lalbagh', program: 'tree', description: 'A walk.' }, confidence: 0.9, provider: 'test', model: 'fake' }), { status: 200 });
  });
  await t.click('#aiRead');
  await has('90%', '#aiOut');
  await t.click('#aiForm [data-mode=draft]');
  await toastSays('draft');
  await has('not public', '.admin-main');
  await t.run(() => { window.fetch = window.realFetch; });
});

await test('admin edits programmes and publishes news and articles', async () => {
  await reset(); await asAdmin('programs');
  await t.click('.admin-main button', 'New programme');
  await t.click('#pgForm button[type=submit]');
  await toastSays('highlighted');
  await t.fill({ '#pgForm [name=title]': 'Computer Classes', '#pgForm [name=desc]': 'Free weekend computer classes.', '#pgForm [name=initiatives]': 'Typing\nOnline forms', '#pgForm [name=impact]': '40 | students' });
  await t.setFile('#pgCover', [PNG]);
  await t.click('#pgForm button[type=submit]');
  await toastSays('Programme saved');
  await openSection('news');
  await t.click('.admin-main button', 'New update');
  await t.fill({ '#edForm [name="title.en"]': 'We planted 100 trees', '#edForm [name="summary.en"]': 'A good day.', '#edForm [name=status]': 'PUBLISHED' });
  await t.click('#edForm button[type=submit]');
  await openSection('articles');
  await t.click('.admin-main button', 'New article');
  await t.fill({ '#aForm [name=title]': 'Composting at home', '#aForm [name=summary]': 'Turn waste into soil.', '#aForm [name=body]': 'Start with a small bin and dry leaves.\n\n## Steps\n- Collect\n- Turn', '#aForm [name=status]': 'PUBLISHED' });
  await t.click('#aPrevBtn');
  await has('Steps', '#aPrev');
  await t.click('#aForm button[type=submit]');
  await toastSays('Published');
  await logout();
  await t.load('#programs');
  await has('Computer Classes', '#progGrid');
  await t.load('#article?a=composting-at-home');
  await has('Collect', '.art-body');
  await t.load('#home');
  await has('Computer Classes', '#pillars');
});

await test('admin uploads and deletes gallery photos', async () => {
  await reset(); await asAdmin('gallery');
  const count = () => t.run(() => document.querySelectorAll('.gal-item').length);
  const before = await count();
  await t.setFile('#galUp', [PNG]);
  await toastSays('1 added');
  assert.equal(await count(), before + 1);
  await t.click('.gal-item input[type=checkbox]');
  await has('1 selected', '#galBulk');
  await t.click('#galBulk button', 'Delete selected');
  await t.until((n) => document.querySelectorAll('.gal-item').length === n, [before]);
});

await test('admin: testimonial replaces the samples; 80G, UPI ID and festival look reach the site', async () => {
  await reset(); await asAdmin('testimonials');
  await t.click('.admin-main button', 'Add');
  await t.fill({ '#edForm [name=name]': 'Real Person', '#edForm [name=text]': 'A real quote.' });
  await t.click('#edForm button[type=submit]');
  await openSection('settings');
  await t.fill({ '#setForm [name=reg80G]': 'TEST-80G-123', '#setForm [name=impact]': '500 | saplings' });
  await t.click('#setForm button[type=submit]');
  await toastSays('Settings saved');
  await t.fill({ '#upiForm [name=id]': 'not-an-id' });
  await t.click('#upiForm button[type=submit]');
  await toastSays('does not look like');
  await t.fill({ '#upiForm [name=id]': 'foundation@testbank' });
  await t.click('#upiForm button[type=submit]');
  await toastSays('Saved on this computer');
  await openSection('look');
  await t.fill({ '#lookPreset': 'diwali' });
  await t.click('#lookForm button[type=submit]');
  await toastSays('Saved on this computer');
  await logout();
  await t.load('#home');
  await has('Happy Deepavali', '.look-greeting');
  await has('A real quote', '#testi');
  assert.equal(await t.run(() => document.querySelectorAll('#testi .chip').length), 0);
  await has('saplings', '#impact');
  await has('TEST-80G-123', '.site-footer');
  await t.load('#donate');
  await has('foundation@testbank', '#upiId');
});

await test('admin answers a message and the visitor sees the reply; users and audit', async () => {
  await reset(); await newDonor('m@example.com');
  await t.load('#dashboard/support');
  await t.fill({ '#supForm [name=subject]': 'Visit', '#supForm [name=message]': 'Can I visit the goshala?' });
  await t.click('#supForm button[type=submit]');
  await asAdmin('issues');
  await rowButton('Visit', 'Open');
  await t.fill({ '#tkForm [name=reply]': 'Yes, on Sundays.', '#tkForm [name=st]': 'RESOLVED' });
  await t.click('#tkForm button[type=submit]');
  await toastSays('Ticket updated');
  await openSection('outbox');
  await t.until(() => document.querySelector('.admin-main').textContent.includes('Yes, on Sundays'));   // inside a closed "Read the message"
  await openSection('users');
  t.dialogs.prompt = 'VOLUNTEER';
  await rowButton('m@example.com', 'Change role');
  await has('VOLUNTEER', '.admin-main');
  await openSection('audit');
  await has('ROLE_CHANGE', '.admin-main');
  await logout(); await login('m@example.com');
  await t.until(() => location.hash.startsWith('#dashboard'));
  await t.load('#dashboard/support');
  await has('Yes, on Sundays', '#dashBody');
});

await t.close();

/* ---------- the real admin's e-mailed-code screen (the database is faked: no real sign-in happens) ---------- */
t = await launch({ base: BASE, init: "window.GIGF = { cloud: { pull: async () => {}, adminState: async () => 'code', gate(box) { box.innerHTML = '<p>CODE SCREEN</p><button id=\"bad\">Confirm</button>'; box.querySelector('#bad').onclick = () => window.GIGF.toast('That did not work: wrong code', '!'); } } };" });
await t.size(1366, 800);
await test('admin code screen shows its error messages', async () => {
  await t.load('admin.html', 800).catch(() => {});
  await has('CODE SCREEN');
  await t.wait(500);
  await t.click('#bad');
  await toastSays('That did not work');
  assert.equal(await t.run(() => !!document.querySelector('.admin-shell')), false);
});
await t.close();

/* ---------- as a public visitor (not "localhost"): the demo warnings must be there ---------- */
console.log('\nAs a public visitor');
t = await launch({ base: BASE, publicHost: 'gigf.test' });
await t.size(1366, 800);
await test('demo warnings, dummy UPI, and no practice admin', async () => {
  await reset();
  await t.load('#donate');
  await has('DEMO MODE', '#demoBanner');
  await has('dummy.gigf@invalid', '#upiId');
  await login('admin@gigf.demo', 'Admin@12345');
  await has('Incorrect email or password', '#loginMsg');
});
await test('failed and pending test payments: no receipt, and a ticket can be raised', async () => {
  await reset(); await newDonor('p@example.com');
  await t.load('#donate');
  await t.fill({ '#dOutcome': 'FAILED' });
  await t.click('#dSubmit');
  await has('Payment failed', '.modal-box');
  await t.click('#rIssue');
  await toastSays('TKT-');
  await t.fill({ '#dOutcome': 'PENDING' });
  await t.click('#dSubmit');
  await has('Payment pending', '.modal-box');
  assert.deepEqual((await db('donations')).map((d) => [d.status, d.receiptNo]).sort(), [['FAILED', ''], ['PENDING', '']]);
});
await t.close();

await new Promise((r) => server.httpServer.close(r));
fs.rmSync(files, { recursive: true, force: true });
const failed = results.filter((r) => !r[0]).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
