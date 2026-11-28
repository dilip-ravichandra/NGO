// A tiny Chrome DevTools driver (no extra packages). Needs Google Chrome; set CHROME=<path> if it is elsewhere.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CANDIDATES = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * base: site address. publicHost: browse as a public visitor (demo wording shown) instead of "localhost".
 * The live database and sign-in e-mails are always blocked, so tests never create records or send anything.
 */
export async function launch({ base, publicHost = null, init = null, port = 9400 + Math.floor(Math.random() * 400) }) {
  const exe = CANDIDATES.find((p) => p && fs.existsSync(p));
  if (!exe) throw new Error('Chrome not found. Set the CHROME environment variable.');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'gigf-test-'));
  const url = new URL(base);
  const origin = publicHost ? `http://${publicHost}:${url.port}` : url.origin;
  const args = ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--no-first-run', '--hide-scrollbars', '--autoplay-policy=user-gesture-required'];
  if (publicHost) args.push(`--host-resolver-rules=MAP ${publicHost} 127.0.0.1`, `--unsafely-treat-insecure-origin-as-secure=${origin}`);
  const proc = spawn(exe, [...args, 'about:blank']);

  let target;
  for (let i = 0; i < 60 && !target; i++) { await wait(200); try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch { /* not up yet */ } }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });

  let id = 0;
  const pending = new Map();
  const errors = [];
  const downloads = [];
  const dialogs = { accept: true, prompt: '', seen: [] };
  const send = (method, params) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id) { const p = pending.get(d.id); pending.delete(d.id); if (d.error) p.reject(new Error(d.error.message)); else p.resolve(d.result); return; }
    if (d.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).slice(0, 300));
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push('console: ' + d.params.args.map((a) => a.value || a.description || '').join(' ').slice(0, 300));
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') errors.push('log: ' + d.params.entry.text.slice(0, 200) + ' ' + (d.params.entry.url || '').slice(0, 120));
    if (d.method === 'Browser.downloadWillBegin') downloads.push(d.params.suggestedFilename);
    if (d.method === 'Page.javascriptDialogOpening') { dialogs.seen.push(d.params.message); send('Page.handleJavaScriptDialog', { accept: dialogs.accept, promptText: dialogs.prompt }); }
  };
  for (const m of ['Page.enable', 'Runtime.enable', 'Log.enable', 'Network.enable']) await send(m);
  await send('Network.setBlockedURLs', { urls: ['*supabase.co*', '*/api/auth*'] });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "window.GIGF_CONFIG = { supabaseUrl: '', supabaseKey: '', googleClientId: '', chatApi: '', translateApi: '' };" });
  if (init) await send('Page.addScriptToEvaluateOnNewDocument', { source: init });
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: profile, eventsEnabled: true });

  const t = {
    wait, errors, downloads, dialogs, downloadDir: profile,
    size: (width, height, mobile = false) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile }),
    /** runs a function (or expression) in the page and returns its value */
    async run(fn, ...args) {
      const expression = typeof fn === 'function' ? `(${fn})(...${JSON.stringify(args)})` : fn;
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error('in page: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      return r.result.value;
    },
    /** a full page load */
    async load(pathAndHash, pause = 700) {
      await send('Page.navigate', { url: 'about:blank' });
      await send('Page.navigate', { url: origin + '/' + pathAndHash });
      for (let i = 0; i < 80; i++) { await wait(100); try { if (await t.run('document.readyState === "complete" && !!document.querySelector("#main, #gigf-header, .main-header")')) break; } catch { /* navigating */ } }
      await wait(pause);
    },
    /** waits until the page function returns something truthy */
    async until(fn, args = [], timeout = 6000) {
      const end = Date.now() + timeout;
      let last;
      while (Date.now() < end) { try { last = await t.run(`(async (...a) => !!(await (${fn})(...a)))(...${JSON.stringify(args)})`); if (last) return last; } catch (e) { last = e.message; } await wait(100); }
      throw new Error('timed out waiting for ' + String(fn).slice(0, 160) + ' (last: ' + last + ')');
    },
    /** click the first visible element matching a selector (optionally containing a text) */
    async click(selector, text) {
      await t.until((sel, txt) => {
        const el = [...document.querySelectorAll(sel)].find((e) => (!txt || e.textContent.includes(txt)) && !e.disabled);
        if (!el) return false;
        el.click(); return true;
      }, [selector, text || null]);
      await wait(120);
    },
    /** type into form controls the way a person does (React notices the change) */
    async fill(values) {
      await t.run((vals) => {
        for (const [selector, value] of Object.entries(vals)) {
          const el = document.querySelector(selector);
          if (!el) throw new Error('no field ' + selector);
          if (el.type === 'checkbox') { if (el.checked !== value) el.click(); continue; }
          const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : el.tagName === 'SELECT' ? HTMLSelectElement : HTMLInputElement;
          Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, value);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, values);
      await wait(80);
    },
    async setFile(selector, files) {
      const { root } = await send('DOM.getDocument', {});
      const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector });
      await send('DOM.setFileInputFiles', { nodeId, files });
      await wait(200);
    },
    async screenshot(file, full = false) {
      let clip;
      if (full) {
        await t.run(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo({ top: 0, behavior: 'instant' }); });
        await wait(900);
        const m = await send('Page.getLayoutMetrics');
        clip = { x: 0, y: 0, width: m.cssContentSize.width, height: Math.min(m.cssContentSize.height, 9000), scale: 0.5 };
      }
      const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 55, captureBeyondViewport: full, ...(clip ? { clip } : {}) });
      fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    },
    async close() { ws.close(); proc.kill(); await wait(300); try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* still locked on Windows */ } }
  };
  return t;
}
