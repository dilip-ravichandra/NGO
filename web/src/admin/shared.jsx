/** Pieces used by several admin screens: tables, editor popup, AI calls, pictures, voice typing. */
import { useRef, useState } from 'react';
import { G, CFG, tr } from '../lib/gigf.js';
import { csvText } from '../lib/adminLogic.js';
import { openModal, toast } from '../ui/feedback.jsx';
import { Empty } from '../ui/common.jsx';

export const LANGS = [['en', 'English'], ['kn', 'ಕನ್ನಡ'], ['hi', 'हिन्दी'], ['ta', 'தமிழ்'], ['te', 'తెలుగు'], ['ml', 'മലയാളം']];
export const OTHER_LANGS = ['kn', 'hi', 'ta', 'te', 'ml'];
export const CATEGORIES = [['tree', 'Tree Plantation'], ['cow', 'Cow Protection'], ['health', 'Yoga & Health'], ['skill', 'Women Empowerment'], ['community', 'Community Events']];
export const eventOptions = () => [['', '— no particular event —']].concat(G.DB.all('events').map((e) => [e.id, tr(e.title) + ' (' + e.date + ')']));
export const programOptions = () => G.DB.all('programs').map((p) => [p.id, tr(p.title)]);

/* values that survive switching between admin sections */
const memory = new Map();
export function useSticky(key, initial) {
  const [value, setValue] = useState(() => (memory.has(key) ? memory.get(key) : initial));
  const set = (next) => setValue((old) => { const v = typeof next === 'function' ? next(old) : next; memory.set(key, v); return v; });
  return [value, set];
}
export const setSticky = (key, value) => memory.set(key, value);

export const Chip = ({ s }) => <span className={'chip ' + (/CAPTURED|APPROVED|RESOLVED|PUBLISHED|UPCOMING|DONE/.test(s) ? '' : /FAILED|REJECTED|OPEN|CANCEL/.test(s) ? 'red' : /DRAFT|COMPLETED/.test(s) ? 'gray' : 'warn')}>{s}</span>;

/** cols: [key | (row) => content, heading] */
export function Table({ cols, rows, actions }) {
  if (!rows.length) return <Empty icon="📭">Nothing here yet.</Empty>;
  return (
    <div className="tbl-wrap"><table className="t"><tbody>
      <tr>{cols.map((c, i) => <th key={i}>{c[1]}</th>)}{actions && <th />}</tr>
      {rows.map((r, n) => <tr key={r.id || r.key || n}>{cols.map((c, i) => <td key={i}>{typeof c[0] === 'function' ? c[0](r) : r[c[0]]}</td>)}{actions && <td style={{ whiteSpace: 'nowrap' }}>{actions(r)}</td>}</tr>)}
    </tbody></table></div>
  );
}

export function Btn({ onClick, children, kind = 'btn-ghost', ...rest }) {
  return <><button type="button" className={'btn ' + kind + ' btn-sm'} onClick={onClick} {...rest}>{children}</button>{' '}</>;
}

export function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
export const downloadCsv = (name, cols, rows) => download(name, csvText(cols, rows), 'text/csv');

/* ---------- AI helpers (server-side keys; the browser only talks to /api/*) ---------- */
const adminToken = () => { try { return sessionStorage.getItem('gigf_admin_token') || ''; } catch { return ''; } };
export async function aiPost(path, body) {
  const token = adminToken();
  try {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'x-admin-token': token } : {}) }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    return { status: r.status, ...j };
  } catch { return { status: 0, error: 'network' }; }
}
export const aiMsg = (r) => ({ 0: 'Could not reach the AI server. Start the site with "node dev-server.js".', 401: 'The AI is admin-only. Enter the admin AI token in Settings → AI access.', 413: 'That picture is too large.', 429: 'The AI is busy right now (free limits). Wait a minute and try again.', 503: r && r.error === 'no_vision_model' ? 'No AI model that can read pictures is configured.' : 'AI is not configured on this server (add an API key to .env.local).' }[r && r.status] || 'The AI could not read this. Try a clearer picture, or paste the text instead.');

/** downscale + re-encode a picture so it is small enough to send / store; returns a data URL */
export const compressImage = (file, maxEdge, quality, maxChars) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('read'));
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => reject(new Error('decode'));
    img.onload = () => {
      const k = Math.min(1, maxEdge / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      let q = quality, out = c.toDataURL('image/jpeg', q);
      while (out.length > maxChars && q > 0.3) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
      resolve(out);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

export const toBlob = (dataUrl) => {
  const [head, body] = dataUrl.split(','), bin = atob(body), arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: head.slice(5, head.indexOf(';')) });
};

/** AUTOMATION: fill every empty Kannada/Hindi/Tamil/Telugu/Malayalam box from the English text when saving */
export async function ensureTranslations(out, keys) {
  if (!G.auto().autoTranslate || !G.autoTranslateAvailable || !G.autoTranslateAvailable()) return 0;
  let n = 0;
  for (const to of OTHER_LANGS) {
    const jobs = keys.filter((k) => out[k] && out[k].en && !out[k][to]);
    if (!jobs.length) continue;
    const res = await G.translate(jobs.map((k) => out[k].en), to);
    jobs.forEach((k, i) => { if (res && res[i]) { out[k][to] = res[i]; n++; } });
  }
  if (n) G.audit('AUTO_TRANSLATE', 'content', '', n + ' field(s)');
  return n;
}

/* ---------- voice typing (Chrome / Edge / Safari). Speak -> text appears in the field. ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const VOICES = [['en-IN', 'English'], ['kn-IN', 'ಕನ್ನಡ'], ['hi-IN', 'हिन्दी'], ['ta-IN', 'தமிழ்'], ['te-IN', 'తెలుగు'], ['ml-IN', 'മലയാളം']];
const voiceLang = () => { try { const v = sessionStorage.getItem('gigf_voice_lang'); return VOICES.some((x) => x[0] === v) ? v : 'en-IN'; } catch { return 'en-IN'; } };
const setValue = (el, value) => {   // so that React-controlled fields notice too
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

export function Mic({ target, onDone }) {
  const [on, setOn] = useState(false);
  const rec = useRef(null);
  if (!SR) return null;
  const click = () => {
    if (rec.current) { rec.current.stop(); return; }
    const field = target.current;
    if (!field) return;
    const r = new SR(); r.lang = voiceLang(); r.interimResults = true; r.continuous = true;
    const base = field.value ? field.value.replace(/\s+$/, '') + ' ' : '';
    let final = '';
    r.onresult = (e) => { let tmp = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const s = e.results[i][0].transcript; if (e.results[i].isFinal) final += s; else tmp += s; } setValue(field, (base + final + tmp).trimStart()); };
    r.onerror = (e) => toast(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'The microphone is blocked. Click the 🔒 icon in the address bar and allow it.' : e.error === 'no-speech' ? 'I did not hear anything. Try again.' : 'Voice typing stopped (' + e.error + ').', '🎤');
    r.onend = () => { rec.current = null; setOn(false); setValue(field, field.value.trim()); if (onDone) onDone(field.value); };
    rec.current = r; setOn(true);
    try { r.start(); } catch { rec.current = null; setOn(false); }
  };
  return <button type="button" className={'mic-btn' + (on ? ' on' : '')} title="Speak instead of typing" aria-label="Speak instead of typing" onClick={click}>{on ? '⏹ Stop' : '🎤'}</button>;
}

export function VoicePicker() {
  if (!SR) return <small className="voice-lang">🎤 Voice typing works in Chrome, Edge or Safari.</small>;
  return <label className="voice-lang">🎤 Speak in <select defaultValue={voiceLang()} onChange={(e) => { try { sessionStorage.setItem('gigf_voice_lang', e.target.value); } catch { /* private mode */ } }}>{VOICES.map((x) => <option key={x[0]} value={x[0]}>{x[1]}</option>)}</select></label>;
}

/* ---------- generic editor popup. fields: {k, label, type, opts, full, req, rows} ---------- */
const isI18n = (f) => f.type === 'i18n' || f.type === 'i18nArea';

function Editor({ fields, item, onSave, close }) {
  const form = useRef(null);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState('');
  const keys = fields.filter(isI18n).map((f) => f.k);

  const autoTranslate = async (which, label) => {
    const el = (name) => form.current.querySelector(`[name="${name}"]`);
    const jobs = [];
    which.forEach((k) => { const en = (el(k + '.en') || {}).value; if (!en || !en.trim()) return; OTHER_LANGS.forEach((to) => { const input = el(k + '.' + to); if (input && !input.value.trim()) jobs.push([input, en.trim(), to]); }); });
    if (!jobs.length) { toast('Nothing to translate: write the English text first (only empty Kannada/Hindi boxes are filled).', 'ℹ️'); return; }
    setTranslating(label);
    let done = 0;
    for (const to of OTHER_LANGS) {
      const js = jobs.filter((j) => j[2] === to);
      if (!js.length) continue;
      const res = await G.translate(js.map((j) => j[1]), to);
      js.forEach((j, i) => { if (res && res[i]) { j[0].value = res[i]; done++; } });
    }
    setTranslating('');
    toast(done ? `Translated ${done} field(s) — please review before saving.` : 'Auto-translate is not reachable. Start the site with "node dev-server.js" (needs GROQ_API_KEY) or deploy the /api folder.', done ? '✨' : '⚠️');
  };

  const submit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target), out = {};
    fields.forEach((fl) => {
      if (isI18n(fl)) out[fl.k] = Object.fromEntries(LANGS.map(([l]) => [l, f.get(fl.k + '.' + l) || '']));
      else if (fl.type === 'checkbox') out[fl.k] = !!f.get(fl.k);
      else if (fl.type === 'number') out[fl.k] = Number(f.get(fl.k));
      else out[fl.k] = f.get(fl.k);
    });
    setSaving(true);
    await ensureTranslations(out, keys);
    onSave(out); close();
  };

  const control = (f) => {
    const v = item[f.k];
    if (isI18n(f)) {
      const value = v || {};
      return (
        <div key={f.k} className="field f-full"><label>{f.label}</label>
          {LANGS.map(([l, name]) => (
            <div key={l} style={{ display: 'flex', gap: 6, alignItems: 'start', marginBottom: 6 }}><span className="chip gray" style={{ minWidth: 64, textAlign: 'center' }}>{name}</span><div style={{ flex: 1 }}>
              {f.type === 'i18nArea' ? <textarea name={f.k + '.' + l} rows="3" defaultValue={value[l] || ''} /> : <input name={f.k + '.' + l} defaultValue={value[l] || ''} />}
            </div></div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" disabled={!!translating} onClick={() => autoTranslate([f.k], f.k)}>{translating === f.k ? '⏳ Translating…' : '✨ Auto-translate'}</button>
        </div>
      );
    }
    if (f.type === 'checkbox') return <div key={f.k} className="field"><label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" name={f.k} style={{ width: 'auto' }} defaultChecked={!!v} /> {f.label}</label></div>;
    const cls = 'field ' + (f.full ? 'f-full' : '');
    if (f.type === 'textarea') return <div key={f.k} className={cls}><label>{f.label}</label><textarea name={f.k} rows={f.rows || 5} defaultValue={v || ''} /></div>;
    if (f.type === 'select') return <div key={f.k} className={cls}><label>{f.label}</label><select name={f.k} defaultValue={v == null ? undefined : String(v)}>{f.opts.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select></div>;
    return <div key={f.k} className={cls}><label>{f.label}</label><input name={f.k} type={f.type || 'text'} defaultValue={v == null ? '' : v} required={!!f.req} /></div>;
  };

  return (
    <form id="edForm" className="f-grid" ref={form} onSubmit={submit}>
      {fields.map(control)}
      <div className="f-full" style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? '⏳ Saving…' : 'Save'}</button>
        {keys.length > 0 && <button className="btn btn-ghost" type="button" disabled={!!translating} onClick={() => autoTranslate(keys, '*')}>{translating === '*' ? '⏳ Translating…' : '✨ Translate all empty languages'}</button>}
        <button className="btn btn-ghost" type="button" onClick={close}>Cancel</button>
      </div>
    </form>
  );
}

export const openEditor = ({ title, fields, item, onSave }) => openModal({ wide: true, title, render: (close) => <Editor fields={fields} item={item || {}} onSave={onSave} close={close} /> });
