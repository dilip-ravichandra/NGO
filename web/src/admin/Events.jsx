/** Events (with attendance and the AI "create from a poster" intake), news, testimonials and users. */
import { useRef, useState } from 'react';
import { G, CFG, tr } from '../lib/gigf.js';
import { slugBase } from '../lib/adminLogic.js';
import { openModal, toast } from '../ui/feedback.jsx';
import { Table, Btn, Chip, Mic, VoicePicker, aiPost, aiMsg, compressImage, ensureTranslations, openEditor, programOptions } from './shared.jsx';

function editEvent(id) {
  const item = id ? G.DB.get('events', id) : { status: 'UPCOMING', time: '08:00', capacity: 30, volSlots: 10, program: 'tree', date: G.today() };
  openEditor({
    title: id ? 'Edit event' : 'New event', item,
    fields: [{ k: 'title', label: 'Title', type: 'i18n' }, { k: 'desc', label: 'Description', type: 'i18nArea' }, { k: 'program', label: 'Programme', type: 'select', opts: programOptions() }, { k: 'date', label: 'Date', type: 'date' }, { k: 'time', label: 'Time', type: 'time' }, { k: 'location', label: 'Location', full: true }, { k: 'capacity', label: 'Max attendees', type: 'number' }, { k: 'volSlots', label: 'Volunteer slots', type: 'number' }, { k: 'status', label: 'Status', type: 'select', opts: [['UPCOMING', 'Upcoming'], ['DRAFT', 'Draft (not public)'], ['COMPLETED', 'Completed'], ['CANCELLED', 'Cancelled']] }],
    onSave: (o) => {
      o.tentative = false;
      if (id) G.DB.update('events', id, o);
      else { o.slug = (o.title.en || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36).slice(-4); G.DB.add('events', o); }
      G.audit(id ? 'EVENT_UPDATE' : 'EVENT_CREATE', 'event', id || '');
    }
  });
}

function attendance(id) {
  const e = G.DB.get('events', id);
  openModal({
    wide: true, title: '👥 ' + tr(e.title),
    render: () => (
      <Table
        cols={[['name', 'Name'], [(r) => <>{r.phone}<br />{r.email}</>, 'Contact'], ['guests', 'Guests'], [(r) => (r.asVolunteer ? '🤝' : ''), 'Vol'],
          [(r) => <label><input type="checkbox" data-att={r.id} defaultChecked={!!r.attended} onChange={(ev) => { G.DB.update('registrations', r.id, { attended: ev.target.checked }); G.audit('ATTENDANCE', 'event', id); }} /> present</label>, 'Attendance']]}
        rows={G.DB.all('registrations').filter((r) => r.eventId === id)}
      />
    )
  });
}

/* ---------- AI: create an event from a poster picture and/or pasted text ---------- */
function Draft({ result, poster, close }) {
  const d = result.draft, pct = Math.round(result.confidence * 100), unsure = result.uncertain || [], missing = result.missing || [];
  const [bad, setBad] = useState({});
  const [saving, setSaving] = useState('');
  const mode = useRef('post');
  const refs = { title: useRef(null), location: useRef(null), desc: useRef(null) };
  const flag = (k, v) => (!v || missing.includes(k) ? <span className="ai-flag miss">✖ not found</span> : unsure.includes(k) ? <span className="ai-flag chk">⚠ please check</span> : <span className="ai-flag ok">✔ read</span>);
  const fallback = <span className="ai-flag chk">default — change if needed</span>;
  const duplicate = G.DB.all('events').find((e) => e.date === d.date && d.title && tr(e.title).toLowerCase().includes(d.title.toLowerCase().slice(0, 12)));

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;   // a double-click must never post the event twice
    const f = new FormData(e.target), val = (k) => String(f.get(k) || '').trim();
    const wrong = { title: val('title').length < 3, date: !/^\d{4}-\d{2}-\d{2}$/.test(val('date')), time: !/^\d{2}:\d{2}$/.test(val('time')), location: val('location').length < 2 };
    setBad(wrong);
    if (Object.values(wrong).some(Boolean)) return toast('Please fill the highlighted fields.', '⚠️');
    if (val('date') < G.today() && !confirm('This date is in the past. Post it anyway?')) return;
    if (duplicate && !confirm('A similar event already exists on that date. Post anyway?')) return;
    const m = mode.current;
    setSaving(m);
    const event = { slug: slugBase(val('title'), 'event') + '-' + Date.now().toString(36).slice(-4), title: { en: val('title'), kn: '', hi: '', ta: '', te: '', ml: '' }, desc: { en: val('desc'), kn: '', hi: '', ta: '', te: '' }, program: val('program'), date: val('date'), time: val('time'), location: val('location'), capacity: Math.max(1, Number(val('capacity')) || 50), volSlots: Math.max(0, Number(val('volSlots')) || 0), status: m === 'draft' ? 'DRAFT' : 'UPCOMING', tentative: false, source: 'AI', aiConfidence: result.confidence, poster: poster && f.get('usePoster') ? poster : '' };
    const n = await ensureTranslations(event, ['title', 'desc']);
    const rec = G.DB.add('events', event);
    G.audit(m === 'draft' ? 'AI_EVENT_DRAFT' : 'AI_EVENT_POSTED', 'event', rec.id, `confidence ${Math.round(result.confidence * 100)}% · ${result.provider}/${result.model} · ${n} translation(s)`);
    close();
    toast(m === 'draft' ? 'Saved as a draft (not public yet).' : 'Event is live on the website!', m === 'draft' ? '💾' : '🎉');
  };
  const field = (name, label, children, extra) => <div className={'field' + (extra ? ' ' + extra : '') + (bad[name] ? ' bad' : '')}><label>{label}</label>{children}</div>;
  const button = (key, text, cls) => <button className={'btn ' + cls} type="submit" data-mode={key} disabled={!!saving} onClick={() => { mode.current = key; }}>{saving === key ? <><span className="spinner" /> Translating…</> : text}</button>;
  return (
    <div className="ai-draft">
      <div className="ai-conf"><b>AI confidence</b><div className="bar"><i style={{ width: pct + '%', background: pct >= 80 ? '#16a34a' : pct >= 55 ? '#f59e0b' : '#dc2626' }} /></div><b>{pct + '%'}</b></div>
      {(result.warnings || []).map((w, i) => <div key={i} className="note" style={{ margin: '6px 0' }}>{'⚠️ ' + w}</div>)}
      {duplicate && <div className="note" style={{ margin: '6px 0' }}>{`🔁 An event with a similar name already exists on ${duplicate.date}. Make sure this is not a duplicate.`}</div>}
      <form id="aiForm" className="f-grid" noValidate onSubmit={submit}>
        {field('title', <>Title {flag('title', d.title)}</>, <><input name="title" ref={refs.title} defaultValue={d.title || ''} /><Mic target={refs.title} /></>, 'f-full')}
        {field('date', <>Date {flag('date', d.date)}</>, <input name="date" type="date" defaultValue={d.date || ''} />)}
        {field('time', <>Start time {flag('time', d.time)}</>, <input name="time" type="time" defaultValue={d.time || ''} />)}
        {field('location', <>Location {flag('location', d.location)}</>, <><input name="location" ref={refs.location} defaultValue={d.location || ''} /><Mic target={refs.location} /></>, 'f-full')}
        {field('program', <>Programme {flag('program', d.program)}</>, <select name="program" defaultValue={d.program || 'community'}>{programOptions().map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select>)}
        {field('capacity', <>Max attendees {d.capacity ? flag('capacity', d.capacity) : fallback}</>, <input name="capacity" type="number" min="1" defaultValue={d.capacity || 50} />)}
        {field('volSlots', <>Volunteer slots {d.volunteerSlots ? flag('volunteerSlots', d.volunteerSlots) : fallback}</>, <input name="volSlots" type="number" min="0" defaultValue={d.volunteerSlots || 10} />)}
        {field('desc', <>Description {flag('description', d.description)}</>, <><textarea name="desc" ref={refs.desc} rows="3" defaultValue={d.description || ''} /><Mic target={refs.desc} /></>, 'f-full')}
        {poster && <div className="field f-full"><label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" name="usePoster" defaultChecked style={{ width: 'auto' }} /> Show the poster on the event card</label></div>}
        <div className="f-full ai-actions">{button('post', '✅ Post event', 'btn-primary')}{button('draft', '💾 Save as draft', 'btn-ghost')}<small>Kannada, Hindi, Tamil and Telugu are added automatically when you post.</small></div>
      </form>
    </div>
  );
}

function Intake({ close }) {
  const [poster, setPoster] = useState('');
  const [status, setStatus] = useState('');
  const [over, setOver] = useState(false);
  const [reading, setReading] = useState(false);
  const [result, setResult] = useState(null);   // { n, ...response }
  const big = useRef(''), text = useRef(null), count = useRef(0);

  const take = async (f) => {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return toast('Please use a JPG, PNG or WebP picture.', '⚠️');
    if (f.size > 15 * 1024 * 1024) return toast('That picture is over 15 MB.', '⚠️');
    try { big.current = await compressImage(f, 1500, 0.82, 2600000); setPoster(await compressImage(f, 800, 0.72, 240000)); setStatus('📎 ' + f.name); } catch { toast('Could not open that picture.', '⚠️'); }
  };
  const read = async () => {
    const value = text.current.value.trim();
    if (!big.current && !value) return toast('Add a poster picture or some text first.', 'ℹ️');
    setReading(true); setResult(null);
    const r = await aiPost(CFG.extractApi || '/api/extract-event', { image: big.current || undefined, text: value, today: G.today(), programs: G.DB.all('programs').map((p) => ({ id: p.id, title: tr(p.title) })) });
    setReading(false);
    count.current += 1;
    setResult({ ...r, n: count.current });
  };
  return (
    <div className="ai-intake" onPaste={(e) => { const it = Array.from(e.clipboardData.items || []).find((i) => /^image\//.test(i.type)); if (it) take(it.getAsFile()); }}>
      <p className="ai-help">Drop the poster, or paste the message you received (WhatsApp, e-mail…). The AI reads it and fills the form. <b>You only check it and press Post.</b> Nothing goes public until you do.</p>
      <div className="ai-grid">
        <div>
          <div className={'ai-drop' + (over ? ' over' : '')} id="aiDrop" tabIndex={0} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]); }}>
            📷 <b>Drop the poster here</b><br /><small>JPG, PNG or WebP</small><br />
            <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', marginTop: 8 }}>Choose picture<input type="file" id="aiFile" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => take(e.target.files[0])} /></label>
            {poster && <img id="aiPrev" alt="Poster preview" src={poster} />}
          </div>
        </div>
        <div>
          <div className="field"><label>…or paste the text / summary</label><textarea id="aiText" ref={text} rows="7" maxLength={6000} placeholder="e.g. Join us this Sunday at 7:30 AM at Cubbon Park for a mass tree plantation drive. Saplings and gloves provided." /><Mic target={text} onDone={(v) => { if (v.length >= 15 && !reading) { setStatus('🎤 Got it — reading what you said…'); read(); } }} /><VoicePicker /></div>
          <button className="btn btn-primary" id="aiRead" type="button" disabled={reading} onClick={read}>{reading ? <><span className="spinner" /> Reading…</> : result ? '↻ Read again' : '✨ Read it'}</button> <span id="aiStatus" className="ai-status">{status}</span>
        </div>
      </div>
      <div id="aiOut">
        {result && result.status !== 200 && <div className="note">{'⚠️ ' + aiMsg(result)}</div>}
        {result && result.status === 200 && <Draft key={result.n} result={result} poster={poster} close={close} />}
      </div>
    </div>
  );
}

export function Events() {
  const rows = G.DB.all('events').slice().sort((a, b) => a.date.localeCompare(b.date));
  const publish = (id) => { G.DB.update('events', id, { status: 'UPCOMING' }); G.audit('EVENT_PUBLISH', 'event', id); toast('Published on the website', '🚀'); };
  const remove = (id) => { if (confirm('Delete this event?')) { G.DB.remove('events', id); G.audit('EVENT_DELETE', 'event', id); } };
  return (
    <>
      <div className="toolbar"><h3 style={{ flex: 1 }}>Events</h3>
        <Btn kind="btn-orange" onClick={() => openModal({ wide: true, title: '✨ Create an event from a poster or text', render: (close) => <Intake close={close} /> })}>✨ Create from poster / text</Btn>
        <Btn kind="btn-primary" onClick={() => editEvent(null)}>＋ New event</Btn></div>
      <Table
        cols={[
          [(r) => <>{tr(r.title)}{r.tentative && <> <span className="chip warn">sample</span></>}{r.source === 'AI' && <> <span className="chip blue">AI</span></>}{r.poster ? ' 🖼️' : ''}</>, 'Event'],
          [(r) => G.fmtDate(r.date) + ' ' + r.time, 'When'], ['location', 'Where'],
          [(r) => G.DB.all('registrations').filter((x) => x.eventId === r.id).length + ' / ' + r.capacity, 'Registered'],
          [(r) => <><Chip s={r.status} />{r.status === 'DRAFT' && <> <small>not public</small></>}</>, 'Status']
        ]}
        rows={rows}
        actions={(r) => <>{r.status === 'DRAFT' && <Btn kind="btn-primary" onClick={() => publish(r.id)}>🚀 Publish</Btn>}<Btn onClick={() => editEvent(r.id)}>✏️</Btn><Btn onClick={() => attendance(r.id)}>👥 Attendance</Btn><Btn onClick={() => remove(r.id)}>🗑️</Btn></>}
      />
    </>
  );
}

export function News() {
  const edit = (id) => openEditor({
    title: 'News / update', item: id ? G.DB.get('news', id) : { status: 'DRAFT', date: G.today() },
    fields: [{ k: 'title', label: 'Headline', type: 'i18n' }, { k: 'summary', label: 'Summary', type: 'i18nArea' }, { k: 'date', label: 'Date', type: 'date' }, { k: 'link', label: 'Link (optional: page name like events.html, or https://…)' }, { k: 'status', label: 'Status', type: 'select', opts: [['DRAFT', 'Draft'], ['SCHEDULED', 'Scheduled'], ['PUBLISHED', 'Published']] }, { k: 'publishAt', label: 'Publish at (if scheduled)', type: 'datetime-local' }, { k: 'pinned', label: 'Pin to top', type: 'checkbox' }],
    onSave: (o) => { if (id) G.DB.update('news', id, o); else G.DB.add('news', o); G.audit('NEWS_' + o.status, 'news', id || ''); }
  });
  return (
    <>
      <div className="toolbar"><h3 style={{ flex: 1 }}>News & updates</h3><Btn kind="btn-primary" onClick={() => edit(null)}>＋ New update</Btn></div>
      <Table cols={[[(r) => tr(r.title) + (r.pinned ? ' 📌' : ''), 'Title'], ['date', 'Date'], [(r) => <><Chip s={r.status} />{r.status === 'SCHEDULED' && ' ' + (r.publishAt || '')}</>, 'Status']]} rows={G.DB.all('news')}
        actions={(r) => <><Btn onClick={() => edit(r.id)}>✏️</Btn><Btn onClick={() => { if (confirm('Delete?')) G.DB.remove('news', r.id); }}>🗑️</Btn></>} />
    </>
  );
}

export function Testimonials() {
  const edit = (id) => openEditor({
    title: 'Testimonial', item: id ? G.DB.get('testimonials', id) : {},
    fields: [{ k: 'name', label: 'Name', req: true }, { k: 'role', label: 'Role (donor / volunteer / beneficiary)' }, { k: 'text', label: 'Quote', type: 'textarea', full: true, rows: 3 }],
    onSave: (o) => { if (id) G.DB.update('testimonials', id, o); else G.DB.add('testimonials', o); }
  });
  return (
    <>
      <div className="toolbar"><h3 style={{ flex: 1 }}>Testimonials</h3><Btn kind="btn-primary" onClick={() => edit(null)}>＋ Add</Btn></div>
      <Table cols={[['name', 'Name'], ['role', 'Role'], [(r) => String(r.text || '').slice(0, 100), 'Text']]} rows={G.DB.all('testimonials')}
        actions={(r) => <><Btn onClick={() => edit(r.id)}>✏️</Btn><Btn onClick={() => G.DB.remove('testimonials', r.id)}>🗑️</Btn></>} />
    </>
  );
}

export function Users() {
  const change = (id) => {
    const r = prompt('New role (REGISTERED_USER, VOLUNTEER, DONOR, CONTENT_ADMIN, FINANCE_SUPPORT_ADMIN, SUPER_ADMIN):');
    if (r && /^(REGISTERED_USER|VOLUNTEER|DONOR|CONTENT_ADMIN|FINANCE_SUPPORT_ADMIN|SUPER_ADMIN)$/.test(r)) { G.DB.update('users', id, { role: r }); G.audit('ROLE_CHANGE', 'user', id, r); }
  };
  return (
    <>
      <h3 style={{ marginBottom: 12 }}>Users & roles</h3>
      <Table cols={[['name', 'Name'], ['email', 'Email'], [(r) => <Chip s={r.role} />, 'Role']]} rows={G.DB.all('users')} actions={(r) => (r.id === 'u_admin' ? null : <Btn onClick={() => change(r.id)}>Change role</Btn>)} />
    </>
  );
}
