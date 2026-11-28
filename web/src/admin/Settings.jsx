/** Appearance (festival looks), settings, automation, UPI details, data tools and the audit log. */
import { useRef, useState } from 'react';
import { G, CFG, tr } from '../lib/gigf.js';
import { parseImpact } from '../lib/adminLogic.js';
import { UPI_ID } from '../lib/upi.js';
import { toast } from '../ui/feedback.jsx';
import { Table, Btn, useSticky, aiPost, aiMsg, compressImage, openEditor, download, downloadCsv } from './shared.jsx';
import { loadSample, removeSample } from './sample.js';
import { exportDonations } from './Donations.jsx';
import { volunteerCsvColumns } from './Volunteers.jsx';

/* ---------- Appearance ---------- */
const LOOK_DEFAULTS = { on: false, from: '', to: '', primary: '#156637', accent: '#ea580c', deco: '', greeting: '', title: '', subtitle: '', link: '', linkText: '', keepSlides: false, logo: '', banner: '' };

/** shrink a chosen picture; the logo stays PNG so a clear background survives */
function shrink(file, kind) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return reject(new Error('Please use a PNG, JPG or WebP picture.'));
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const max = kind === 'logo' ? 256 : 1600, s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      let out = kind === 'logo' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.8);
      if (kind !== 'logo') for (let q = 0.65; out.length > 400000 && q > 0.3; q -= 0.15) out = c.toDataURL('image/jpeg', q);
      URL.revokeObjectURL(url);
      if (out.length > 600000) reject(new Error('That picture is too large. Try a smaller one.')); else resolve(out);
    };
    img.onerror = () => reject(new Error('Could not read that picture.'));
    img.src = url;
  });
}

async function saveLook(look) {
  G.DB.saveSettings({ look }); G.audit('LOOK_CHANGE', 'settings', '', look.on ? 'festival look on' : 'normal look');
  const stored = (JSON.parse(localStorage.getItem('gigf_db_v2') || '{}').settings || {}).look;
  if (JSON.stringify(stored) !== JSON.stringify(look)) return toast('This browser is out of space: use smaller pictures.', '⚠️');
  if (G.cloud && G.cloud.canWrite()) { try { await G.cloud.patchPublic({ look }); toast('Saved for all visitors', '☁️'); } catch (e) { toast('Not saved to the database: ' + e.message, '⚠️'); } }
  else toast('Saved on this computer only. Sign in with your real admin account to change it for everyone.', 'ℹ️');
}

export function Look() {
  const [look, setLook] = useState(() => ({ ...LOOK_DEFAULTS, ...(G.DB.settings().look || {}) }));
  const set = (patch) => setLook((l) => ({ ...l, ...patch }));
  const presets = G.look.PRESETS;
  const preset = (key) => { const p = presets[key]; if (p) set({ primary: p.primary || '#156637', accent: p.accent || '#ea580c', deco: p.deco, greeting: p.greeting, on: key !== 'normal' }); };
  const picture = async (kind, file) => { if (!file) return; try { set({ [kind]: await shrink(file, kind), on: true }); } catch (err) { toast(err.message, '⚠️'); } };
  const submit = (e) => {
    e.preventDefault();
    const trimmed = Object.fromEntries(Object.entries(look).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
    if (trimmed.from && trimmed.to && trimmed.to < trimmed.from) return toast('The end date is before the start date.', '⚠️');
    if (trimmed.link && !G.safeUrl(trimmed.link, '')) return toast('Use a page like donate.html or an https:// address for the button.', '⚠️');
    saveLook(trimmed);
  };
  const reset = () => { if (confirm('Remove the festival look, including the uploaded logo and banner?')) { setLook({ ...LOOK_DEFAULTS }); saveLook({ on: false }); } };
  const text = (name, label, max, extra) => <div className={'field ' + (extra && extra.full ? 'f-full' : '')}><label>{label}</label><input name={name} maxLength={max} placeholder={extra && extra.placeholder} value={look[name]} onChange={(e) => set({ [name]: e.target.value })} /></div>;
  const typed = (name, label, type) => <div className="field"><label>{label}</label><input type={type} name={name} value={look[name] || (type === 'color' ? LOOK_DEFAULTS[name] : '')} onChange={(e) => set({ [name]: e.target.value })} /></div>;
  const check = (name, label) => <div className="field f-full"><label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" name={name} style={{ width: 'auto' }} checked={!!look[name]} onChange={(e) => set({ [name]: e.target.checked })} /> {label}</label></div>;
  const pic = (kind, label, hint) => (
    <div className="field f-full"><label>{label}</label><input type="file" accept="image/png,image/jpeg,image/webp" data-pic={kind} onChange={(e) => picture(kind, e.target.files[0])} /><small style={{ color: '#6b7280', display: 'block' }}>{hint}</small>
      <div className="look-prev" id={'prev-' + kind}>{G.look.IMG.test(look[kind] || '') ? <><img src={look[kind]} alt="" /> <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ [kind]: '' })}>Remove</button></> : <span style={{ color: '#9ca3af' }}>Using the normal one</span>}</div></div>
  );
  return (
    <>
      <h3 style={{ marginBottom: 6 }}>Appearance</h3>
      <p style={{ color: '#4b5563', marginBottom: 14 }}>Dress the website up for a festival. Set dates and it switches back by itself. <b>{G.look.active() ? 'A festival look is showing today.' : 'The normal look is showing today.'}</b></p>
      <form id="lookForm" className="card card-body f-grid" style={{ maxWidth: 760 }} onSubmit={submit}>
        <div className="field f-full"><label>Start from a ready-made look</label><select id="lookPreset" value="" onChange={(e) => preset(e.target.value)}><option value="">— choose —</option>{Object.keys(presets).map((k) => <option key={k} value={k}>{presets[k].deco + ' ' + presets[k].name}</option>)}</select></div>
        {check('on', 'Turn the festival look on')}
        {typed('from', 'Show from (optional)', 'date')}{typed('to', 'Until (optional)', 'date')}
        {pic('logo', 'Logo', 'Square picture, best as a PNG with a clear background.')}
        {pic('banner', 'Home banner', 'Wide picture, about 1600 × 600.')}
        {text('title', 'Banner heading', 80)}{text('subtitle', 'Banner line', 140)}
        {text('linkText', 'Button text', 30, { placeholder: 'Donate now' })}{text('link', 'Button opens', 200, { placeholder: 'donate.html' })}
        {check('keepSlides', 'Keep the usual slideshow below my banner')}
        {text('greeting', 'Greeting strip (under the menu, all pages)', 140, { full: true })}
        {typed('primary', 'Main colour', 'color')}{typed('accent', 'Button colour', 'color')}
        {text('deco', 'Falling decoration (one emoji, optional)', 8, { placeholder: '🪔' })}
        <div className="f-full" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="btn btn-primary" type="submit">Save</button><a className="btn btn-ghost" href="index.html" target="_blank" rel="noopener">Open website</a><button type="button" className="btn btn-danger" id="lookReset" onClick={reset}>Back to normal</button></div>
      </form>
    </>
  );
}

/* ---------- Settings ---------- */
const publishReport = () => openEditor({
  title: 'Publish an annual report', item: { year: String(new Date().getFullYear()) },
  fields: [{ k: 'title', label: 'Title', req: true }, { k: 'year', label: 'Year', req: true }, { k: 'url', label: 'PDF address (assets/reports/name.pdf or https://…)', full: true, req: true }],
  onSave: (o) => {
    if (!G.safeUrl(o.url, '')) return toast('That address is not allowed.', '⚠️');
    G.DB.saveSettings({ reports: [{ title: o.title, year: o.year, url: o.url }].concat(G.DB.settings().reports || []) }); G.audit('REPORT_PUBLISH', 'report', o.year);
  }
});

function Automation() {
  const au = G.auto();
  const row = (k, label, hint) => <label className="auto-row"><input type="checkbox" name={k} defaultChecked={!!au[k]} /><span><b>{label}</b><small>{hint}</small></span></label>;
  const token = () => { try { return sessionStorage.getItem('gigf_admin_token') || ''; } catch { return ''; } };
  const save = (e) => {
    e.preventDefault();
    const x = new FormData(e.target), minutes = Math.max(2, Math.min(1440, Number(x.get('stuckMinutes')) || 15));
    G.DB.saveSettings({ automation: { autoTranslate: !!x.get('autoTranslate'), flagStuckPayments: !!x.get('flagStuckPayments'), autoReplyRoutine: !!x.get('autoReplyRoutine'), autoApproveVolunteers: !!x.get('autoApproveVolunteers'), stuckMinutes: minutes } });
    try { sessionStorage.setItem('gigf_admin_token', String(x.get('token') || '').trim()); } catch { /* private mode */ }
    G.audit('AUTOMATION_SETTINGS', 'settings', '', JSON.stringify(G.auto())); toast('Automation settings saved', '✅');
  };
  const test = async () => {
    const r = await aiPost(CFG.extractApi || '/api/extract-event', { text: 'Test: tree walk on 1 Jan 2099 at 10:00 in Lalbagh', today: G.today(), programs: [] });
    toast(r.status === 200 ? `AI is working (${r.provider} · ${r.model})` : aiMsg(r), r.status === 200 ? '✅' : '⚠️');
  };
  return (
    <form id="autoForm" className="card card-body" style={{ marginTop: 16 }} onSubmit={save}>
      <h4>🤖 Automation — let the website do the routine work</h4>
      {row('autoTranslate', 'Translate automatically when I save', 'Empty Kannada / Hindi / Tamil / Telugu boxes are filled from the English text (uses the AI).')}
      {row('flagStuckPayments', 'Watch for stuck payments', 'A payment still PENDING after the time below opens a payment-issue ticket by itself. Receipts for captured payments are always issued automatically.')}
      {row('autoReplyRoutine', 'Answer simple questions automatically', 'Only when the AI is ≥85% sure it is a plain FAQ (how to donate/volunteer, contact details…). Payments, refunds, complaints are NEVER auto-answered.')}
      {row('autoApproveVolunteers', 'Approve volunteers automatically', 'Approves every application that has an ID file. Off by default because nobody checks the ID. Turn on only if you accept that.')}
      <div className="field" style={{ maxWidth: 260 }}><label>Treat a payment as stuck after (minutes)</label><input type="number" name="stuckMinutes" min="2" max="1440" defaultValue={au.stuckMinutes} /></div>
      <h4 style={{ marginTop: 18 }}>🔑 AI access</h4>
      <p style={{ fontSize: '.82rem', color: '#4b5563', margin: '4px 0 8px' }}>The poster reader and message triage are admin-only. On your own computer they work without a token. On a public server enter the same value as <code>ADMIN_API_TOKEN</code> (kept only for this browser session).</p>
      <div className="field" style={{ maxWidth: 360 }}><label>Admin AI token</label><input type="password" name="token" autoComplete="off" placeholder="(not needed on localhost)" defaultValue={token()} /></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}><button className="btn btn-primary" type="submit">Save automation settings</button><button className="btn btn-ghost" type="button" onClick={test}>🔌 Test the AI connection</button></div>
    </form>
  );
}

function UpiSettings() {
  const u = G.DB.settings().upi || {};
  const qr = useRef(null);
  const [version, setVersion] = useState(0);
  const store = async (upi) => {
    G.DB.saveSettings({ upi }); G.audit('UPI_DETAILS_CHANGED', 'settings', '', upi ? upi.id : 'dummy'); qr.current = null; setVersion(version + 1);
    if (G.cloud && G.cloud.canWrite()) { try { await G.cloud.patchPublic({ upi }); toast('Saved for all visitors', '☁️'); } catch (e) { toast('Not saved to the database: ' + e.message, '⚠️'); } } else toast('Saved on this computer only', 'ℹ️');
  };
  const save = (e) => {
    e.preventDefault();
    const id = e.target.elements.id.value.trim();
    if (!UPI_ID.test(id)) return toast('That does not look like a UPI ID (name@bank).', '⚠️');
    if (!confirm(`Donors will be told to pay ${id}. Check it carefully: money sent to a wrong ID is hard to recover. Save?`)) return;
    store({ id, name: e.target.elements.name.value.trim(), qr: qr.current || (G.DB.settings().upi || {}).qr || '' });
  };
  const pick = async (e) => { try { qr.current = await compressImage(e.target.files[0], 600, 0.92, 250000); toast('Picture ready. Press Save.', '🖼️'); } catch { toast('Could not open that picture.', '⚠️'); } };
  return (
    <div className="card card-body" style={{ marginTop: 14 }}>
      <h4>📲 Direct UPI details</h4>
      <p style={{ fontSize: '.84rem', color: '#4b5563' }}>Shown on the Donate page. {!u.id && <b>Sample details are showing. </b>}Use the Foundation's own account, never a personal one.</p>
      <form id="upiForm" key={version} className="f-grid" onSubmit={save}>
        <div className="field"><label>UPI ID</label><input name="id" defaultValue={u.id || ''} placeholder="foundation@bank" /></div>
        <div className="field"><label>Payee name</label><input name="name" maxLength={80} defaultValue={u.name || ''} /></div>
        <div className="field f-full"><label>QR picture from your bank or UPI app</label><input type="file" id="upiFile" accept="image/png,image/jpeg,image/webp" onChange={pick} /><small style={{ color: '#6b7280' }}>{u.qr ? 'A QR picture is saved.' : 'None yet.'}</small></div>
        <div className="f-full" style={{ display: 'flex', gap: 8 }}><button className="btn btn-primary btn-sm" type="submit">Save</button><button type="button" className="btn btn-ghost btn-sm" id="upiClear" onClick={() => store(null)}>Reset</button></div>
      </form>
    </div>
  );
}

export function Settings() {
  const s = G.DB.settings();
  const save = (e) => {
    e.preventDefault();
    const x = new FormData(e.target);
    G.DB.saveSettings({ reg80G: x.get('reg80G').trim(), reg12A: x.get('reg12A').trim(), pan: x.get('pan').trim(), impact: parseImpact(x.get('impact')) });
    G.audit('SETTINGS_UPDATE', 'settings'); toast('Settings saved', '✅');
  };
  const registrations = () => downloadCsv('registrations.csv', [[(r) => tr((G.DB.get('events', r.eventId) || {}).title), 'Event'], ['name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['guests', 'Guests'], [(r) => (r.asVolunteer ? 'Yes' : 'No'), 'Volunteer'], [(r) => (r.attended ? 'Yes' : 'No'), 'Attended']], G.DB.all('registrations'));
  const resetAll = () => { if (confirm('Delete ALL demo data in this browser (donations, volunteers, tickets, edits)?')) { G.DB.reset(); G.Auth.logout(); location.reload(); } };
  const field = (name, label) => <div className="field f-full"><label>{label}</label><input name={name} defaultValue={s[name]} /></div>;
  return (
    <>
      <h3 style={{ marginBottom: 12 }}>Settings</h3>
      <div className="grid g2">
        <form id="setForm" className="card card-body f-grid" onSubmit={save}>
          {field('reg80G', '80G registration number')}{field('reg12A', '12A registration number')}{field('pan', 'Foundation PAN')}
          <div className="field f-full"><label>Homepage impact figures (one per line: <code>value | label</code>) — publish only verified numbers</label><textarea name="impact" rows="4" defaultValue={(s.impact || []).map((m) => m.value + ' | ' + m.label).join('\n')} /></div>
          <button className="btn btn-primary f-full" type="submit">Save settings</button>
        </form>
        <div className="card card-body">
          <h4>Data tools</h4><p style={{ fontSize: '.84rem', color: '#4b5563', margin: '8px 0' }}>Export everything as JSON or reset the data in this browser.</p>
          {G.demoAdminAllowed() && <><Btn kind="btn-orange" onClick={() => { loadSample(); toast('Sample data loaded: 10 people, 10 payments', '🧪'); }}>🧪 Load sample data (10 fake people)</Btn><Btn onClick={() => { removeSample(); toast('Sample data removed', '🧹'); }}>Remove sample data</Btn><br /><br /></>}
          <Btn onClick={publishReport}>📄 Publish annual report</Btn><br /><br />
          <button type="button" className="btn btn-ghost" onClick={() => download('gigf-demo-data.json', G.DB.export(), 'application/json')}>⬇ Export JSON</button> <button type="button" className="btn btn-danger" onClick={resetAll} style={{ marginTop: 8 }}>Reset data</button>
          <hr style={{ margin: '16px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
          <h4>Reports</h4>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            <Btn onClick={() => exportDonations(G.DB.all('donations'))}>Donations CSV</Btn>
            <Btn onClick={() => { downloadCsv('volunteers.csv', volunteerCsvColumns, G.DB.all('volunteers')); G.audit('VOLUNTEER_REPORT', 'volunteer', ''); }}>Volunteers CSV</Btn>
            <Btn onClick={registrations}>Event registrations CSV</Btn>
          </div>
        </div>
      </div>
      <Automation />
      <UpiSettings />
    </>
  );
}

/* ---------- Audit log ---------- */
const AUDIT = { PAY: /^(PAYMENT|RECEIPT|MANUAL_CAPTURE|SYNC_STATUS|REFUND|AUTO_FLAG|AUTO_RECEIPT)/, AI: /^(AI_|AUTO_)/ };
export function Audit() {
  const [f, setF] = useSticky('audit', 'ALL');
  const rows = G.DB.all('audit').filter((r) => (f === 'ALL' ? true : f === 'ADMIN' ? !AUDIT.PAY.test(r.action) && !AUDIT.AI.test(r.action) : AUDIT[f].test(r.action))).slice(0, 400);
  const tone = (a) => (/FAILED|FLAG|ISSUE/.test(a) ? 'red' : /CAPTURED|RECEIPT_ISSUED|APPROVE|POSTED/.test(a) ? '' : /PENDING/.test(a) ? 'warn' : 'gray');
  return (
    <>
      <h3 style={{ marginBottom: 12 }}>Security & audit log</h3>
      <div className="filters">{[['ALL', 'All'], ['PAY', '💳 Payments'], ['AI', '🤖 Automation & AI'], ['ADMIN', '🛠️ Admin & users']].map(([key, label]) => <button type="button" key={key} className={'pill ' + (f === key ? 'on' : '')} onClick={() => setF(key)}>{label}</button>)}</div>
      <Table cols={[[(r) => new Date(r.at).toLocaleString('en-IN'), 'When'], ['actor', 'Who'], ['role', 'Role'], [(r) => <span className={'chip ' + tone(r.action)}>{r.action}</span>, 'Action'], [(r) => r.entity + ' ' + String(r.entityId).slice(-8), 'Entity'], ['meta', 'Details']]} rows={rows} />
      <p style={{ fontSize: '.76rem', color: '#6b7280', marginTop: 8 }}>Demo log is stored locally; production log is immutable server-side with IP address.</p>
    </>
  );
}
