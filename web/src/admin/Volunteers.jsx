/** Volunteers: approve, roles, tasks, attendance, ID proof, certificate, report. */
import { useRef, useState } from 'react';
import { G, CFG, tr } from '../lib/gigf.js';
import { V } from '../lib/validate.js';
import { openModal, toast } from '../ui/feedback.jsx';
import { Table, Btn, Chip, Mic, VoicePicker, useSticky, aiPost, aiMsg, downloadCsv } from './shared.jsx';

const DUTIES = ['', 'Volunteer', 'Field volunteer', 'Team lead', 'Event coordinator', 'Trainer', 'Digital & media'];
const Options = ({ list }) => list.map((x) => <option key={x} value={x}>{x || '— none —'}</option>);

function certificate(id) {
  const v = G.DB.get('volunteers', id);
  if (v.status !== 'APPROVED') return toast('Approve the volunteer first', 'ℹ️');
  if (G.Volunteers.downloadPDF(v)) G.audit('CERTIFICATE_ISSUED', 'volunteer', id);
}

function VolunteerForm({ id, close }) {
  const [v] = useState(() => (id ? G.DB.get('volunteers', id) : { status: 'APPROVED', tasks: [], attendance: [] }));
  const [tasks, setTasks] = useState(() => (v.tasks || []).map((t) => ({ ...t })));
  const [days, setDays] = useState(() => {
    const list = (v.attendance || []).map((a) => ({ ...a }));
    const logged = list.reduce((n, a) => n + (Number(a.hours) || 0), 0);
    if ((Number(v.hours) || 0) > logged) list.unshift({ date: G.today(), hours: v.hours - logged, note: 'Earlier hours' });
    return list;
  });
  const [bad, setBad] = useState({});
  const [status, setStatus] = useState('');
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const form = useRef(null), say = useRef(null), task = useRef(null), file = useRef(null);
  const areas = G.DB.all('programs').map((p) => tr(p.title)).concat('Digital outreach, photography & design');
  if (v.domain && !areas.includes(v.domain)) areas.push(v.domain);
  const real = !!(G.cloud && G.cloud.canWrite());
  const wa = String(v.phone || '').replace(/\D/g, '').slice(-10);
  const total = days.reduce((n, a) => n + (Number(a.hours) || 0), 0);
  const patch = (list, set, i, change) => set(list.map((x, k) => (k === i ? { ...x, ...change } : x)));
  const addTask = (title) => { if (title) setTasks((list) => (list.some((x) => x.title === title) ? list : list.concat({ title: title.slice(0, 120), done: false }))); };
  const addFromBox = () => { addTask(task.current.value.trim()); task.current.value = ''; };

  const read = async () => {
    const text = say.current.value.trim();
    if (!text) return toast('Say or type the details first.', 'ℹ️');
    setReading(true); setStatus('✨ Reading…');
    const r = await aiPost(CFG.extractVolunteerApi || '/api/extract-volunteer', { text, areas });
    setReading(false);
    if (r.status !== 200 || !r.draft) return setStatus('⚠️ ' + aiMsg(r) + ' You can still fill the form yourself.');
    const d = r.draft;
    ['name', 'phone', 'email', 'city'].forEach((k) => { if (d[k]) form.current.elements[k].value = d[k]; });
    if (d.area) form.current.elements.domain.value = d.area;
    (d.tasks || []).forEach(addTask);
    setStatus('✔ Filled in. Please check, then Save.' + ((r.warnings || []).length ? ' ⚠️ ' + r.warnings.join(' ') : ''));
  };
  const seeId = async () => {
    const w = window.open('', '_blank');
    try { const link = await G.cloud.idLink(v.idPath); if (w) { w.opener = null; w.location = link; } G.audit('ID_VIEWED', 'volunteer', v.id); } catch (e) { if (w) w.close(); toast('Could not open the ID: ' + e.message, '⚠️'); }
  };
  const remove = () => {
    if (!confirm('Delete this volunteer and their ID proof? This cannot be undone.')) return;
    G.DB.remove('volunteers', id); G.audit('VOLUNTEER_DELETE', 'volunteer', id); close();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const f = e.target.elements, val = (n) => String((f[n] || {}).value || '').trim();
    const phone = val('phone').replace(/\D/g, '').slice(-10);
    const wrong = { name: val('name').length < 2, phone: !!val('phone') && !V.phone(phone), email: !!val('email') && !V.email(val('email')) };
    setBad(wrong);
    if (Object.values(wrong).some(Boolean)) return toast('Please check the highlighted fields.', '⚠️');
    const email = val('email').toLowerCase();
    if (G.DB.all('volunteers').some((x) => x.id !== id && ((email && String(x.email).toLowerCase() === email) || (phone && String(x.phone).replace(/\D/g, '').slice(-10) === phone)))) return toast('A volunteer with this email or mobile already exists.', '⚠️');
    setSaving(true);
    const kept = days.filter((a) => a.date);
    const item = { name: val('name'), phone, email, city: val('city'), domain: val('domain'), duty: val('duty'), status: val('status'), reason: val('status') === 'REJECTED' ? val('reason') : '', tasks: tasks.filter((t) => t.title.trim()), attendance: kept, hours: kept.reduce((n, a) => n + (Number(a.hours) || 0), 0) };
    const upload = real && file.current && file.current.files[0];
    if (real) item.idType = val('idType');
    if (upload) { try { item.idPath = await G.cloud.uploadId(upload, 'staff'); item.idFile = 'uploaded'; } catch (x) { setSaving(false); return toast(x.message, '⚠️'); } }
    if (id) G.DB.update('volunteers', id, item);
    else G.DB.add('volunteers', Object.assign(item, { badge: 'GIGF-VOL-' + String(G.DB.nextSeq('volSeq')).padStart(4, '0'), idType: item.idType || '', idFile: item.idFile || '' }));
    G.audit(id ? 'VOLUNTEER_UPDATE' : 'VOLUNTEER_ADD', 'volunteer', id || item.name); toast('Saved', '✅'); close();
  };

  const field = (name, label, input, error) => <div className={'field' + (bad[name] ? ' bad' : '')}><label>{label}</label>{input}{error && <span className="err">{error}</span>}</div>;
  return (
    <>
      {!id && (
        <div className="pg-ai"><b>Fill by speaking or typing</b><p style={{ fontSize: '.82rem', color: '#4b5563' }}>Say the details in any language. Do not include Aadhaar or PAN numbers.</p>
          <textarea id="vSay" ref={say} rows="2" maxLength={2000} placeholder="e.g. Add Kavya Rao, mobile 98765 43210, from Hebbal, wants to help with tree plantation. Ask her to bring gloves." /><Mic target={say} onDone={(t) => { if (t.length >= 10 && !reading) read(); }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}><VoicePicker /><button type="button" className="btn btn-primary btn-sm" id="vRead" disabled={reading} onClick={read}>✨ Fill the form</button><span id="vStatus" className="ai-status">{status}</span></div></div>
      )}
      <form id="vForm2" className="f-grid" noValidate ref={form} onSubmit={submit}>
        {field('name', 'Name *', <input name="name" maxLength={80} defaultValue={v.name || ''} />, 'Please enter the name')}
        {field('phone', 'Mobile', <input name="phone" inputMode="tel" maxLength={20} defaultValue={v.phone || ''} />, '10-digit mobile')}
        {field('email', 'Email', <input name="email" type="email" maxLength={254} defaultValue={v.email || ''} />, 'Check the email')}
        {field('city', 'City / area', <input name="city" maxLength={80} defaultValue={v.city || ''} />)}
        {field('domain', 'Area of interest', <select name="domain" defaultValue={v.domain || areas[0]}><Options list={areas} /></select>)}
        {field('duty', 'Role', <select name="duty" defaultValue={v.duty || ''}><Options list={DUTIES.includes(v.duty || '') ? DUTIES : DUTIES.concat(v.duty)} /></select>)}
        {field('status', 'Status', <select name="status" defaultValue={v.status}><Options list={['PENDING', 'APPROVED', 'REJECTED']} /></select>)}
        {field('reason', 'Reason (if not approved)', <input name="reason" maxLength={300} defaultValue={v.reason || ''} />)}
        <div className="field f-full"><label>ID proof</label>
          {v.idPath ? <><button type="button" className="btn btn-ghost btn-sm" id="vSeeId" onClick={seeId}>🔒 View ID (private link, 1 minute)</button> <span>{v.idType || ''}</span></>
            : <p style={{ fontSize: '.82rem', color: '#6b7280' }}>{v.idFile ? `Only the file name (${v.idFile}) is kept on this device.` : 'No ID uploaded.'}</p>}
          {real ? <div style={{ display: 'flex', gap: 8, marginTop: 6 }}><select name="idType" defaultValue={v.idType || 'Aadhaar (masked)'}><Options list={['Aadhaar (masked)', 'Voter ID', 'Driving licence', 'Passport', 'Student ID']} /></select><input type="file" id="vId2" ref={file} accept="image/jpeg,image/png,application/pdf" /></div>
            : <p style={{ fontSize: '.78rem', color: '#9ca3af' }}>ID files are stored only in the private database, with your real admin login.</p>}
        </div>
        <div className="f-full"><label><b>Tasks</b></label>
          <div id="vTasks">{tasks.length ? tasks.map((t, i) => (
            <div key={i} className="v-row"><input type="checkbox" checked={!!t.done} title="Done" onChange={(e) => patch(tasks, setTasks, i, { done: e.target.checked })} /><input maxLength={120} value={t.title} style={{ flex: 1 }} onChange={(e) => patch(tasks, setTasks, i, { title: e.target.value })} /><button type="button" className="btn btn-ghost btn-sm" onClick={() => setTasks(tasks.filter((_, k) => k !== i))}>✕</button></div>
          )) : <p style={{ color: '#9ca3af', fontSize: '.82rem' }}>No tasks.</p>}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}><input id="vNewTask" ref={task} maxLength={120} placeholder="New task" style={{ flex: 1 }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFromBox(); } }} /><Mic target={task} /><button type="button" className="btn btn-ghost btn-sm" id="vAddTask" onClick={addFromBox}>＋ Add</button></div></div>
        <div className="f-full"><label><b>Attendance</b> — total <span id="vTotal">{total}</span> hours</label>
          <div id="vAtt">{days.length ? days.map((a, i) => (
            <div key={i} className="v-row"><input type="date" value={a.date || ''} onChange={(e) => patch(days, setDays, i, { date: e.target.value })} /><input type="number" min="0" max="24" step="0.5" value={Number(a.hours) || 0} style={{ width: 80 }} title="Hours" onChange={(e) => patch(days, setDays, i, { hours: Math.max(0, Math.min(24, Number(e.target.value) || 0)) })} /><input maxLength={80} value={a.note || ''} placeholder="Note" style={{ flex: 1 }} onChange={(e) => patch(days, setDays, i, { note: e.target.value })} /><button type="button" className="btn btn-ghost btn-sm" onClick={() => setDays(days.filter((_, k) => k !== i))}>✕</button></div>
          )) : <p style={{ color: '#9ca3af', fontSize: '.82rem' }}>No days recorded.</p>}</div>
          <button type="button" className="btn btn-ghost btn-sm" id="vAddDay" style={{ marginTop: 6 }} onClick={() => setDays(days.concat({ date: G.today(), hours: 4, note: 'Present' }))}>＋ Add a day</button></div>
        <div className="f-full" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" type="submit" disabled={saving}>Save</button>
          {id && <>
            <button type="button" className="btn btn-ghost" id="vCert" onClick={() => certificate(id)}>🏅 Certificate</button>
            {v.email && <a className="btn btn-ghost" href={`mailto:${v.email}?subject=${encodeURIComponent('Your volunteer application')}&body=${encodeURIComponent('Namaste ' + v.name + ',\n\n')}`}>✉️ Email</a>}
            {wa.length === 10 && <a className="btn btn-ghost" target="_blank" rel="noopener" href={'https://wa.me/91' + wa}>💬 WhatsApp</a>}
            <button type="button" className="btn btn-danger" id="vDel" onClick={remove}>Delete</button>
          </>}
        </div>
      </form>
    </>
  );
}

export function openVolunteer(id) {
  const v = id && G.DB.get('volunteers', id);
  openModal({ wide: true, title: v ? '👤 ' + v.name + ' · ' + (v.badge || '') : '✨ Add volunteer', render: (close) => <VolunteerForm id={id} close={close} /> });
}

export const volunteerCsvColumns = [['badge', 'Badge'], ['name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['city', 'City'], ['domain', 'Area'], ['duty', 'Role'], ['status', 'Status'], ['reason', 'Reason'], ['hours', 'Hours'], [(r) => (r.tasks || []).filter((t) => t.done).length, 'Tasks done'], [(r) => (r.tasks || []).filter((t) => !t.done).length, 'Tasks open'], [(r) => (r.attendance || []).length, 'Days attended']];

export default function Volunteers() {
  const [f, setF] = useSticky('vol', { q: '', st: 'ALL' });
  const q = f.q.toLowerCase();
  const rows = G.DB.all('volunteers').filter((v) => (f.st === 'ALL' || v.status === f.st) && (!q || [v.name, v.email, v.phone, v.city, v.domain, v.duty, v.badge].join(' ').toLowerCase().includes(q)));
  const approve = (id) => { G.DB.update('volunteers', id, { status: 'APPROVED' }); G.audit('VOLUNTEER_APPROVE', 'volunteer', id); toast('Approved', '✅'); };
  const reject = (id) => {
    const why = prompt('Reason for not approving (the volunteer will see it):', '');
    if (why === null) return;
    G.DB.update('volunteers', id, { status: 'REJECTED', reason: why.slice(0, 300) }); G.audit('VOLUNTEER_REJECT', 'volunteer', id, why);
  };
  return (
    <>
      <div className="toolbar"><h3 style={{ flex: 1 }}>Volunteers</h3><Btn kind="btn-orange" onClick={() => openVolunteer(null)}>✨ Add volunteer</Btn><Btn onClick={() => { downloadCsv('volunteers.csv', volunteerCsvColumns, rows); G.audit('VOLUNTEER_REPORT', 'volunteer', ''); }}>⬇ Report (CSV)</Btn></div>
      <div className="toolbar"><input className="search" id="volQ" placeholder="Search name, phone, city, role, badge" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <select id="volSt" className="search" style={{ flex: '0 1 180px' }} value={f.st} onChange={(e) => setF({ ...f, st: e.target.value })}>{['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((x) => <option key={x}>{x}</option>)}</select></div>
      <div id="volList">
        <Table
          cols={[['badge', 'Badge'], ['name', 'Name'], [(r) => <>{r.email}<br />{r.phone}</>, 'Contact'], [(r) => r.duty || '—', 'Role'], [(r) => <>{r.domain}<br />{r.city}</>, 'Area'], [(r) => <Chip s={r.status} />, 'Status'], [(r) => Number(r.hours) || 0, 'Hrs'], [(r) => (r.tasks || []).filter((t) => !t.done).length + ' open', 'Tasks']]}
          rows={rows}
          actions={(r) => <>{r.status === 'PENDING' && <><Btn kind="btn-primary" onClick={() => approve(r.id)}>✔ Approve</Btn><Btn onClick={() => reject(r.id)}>✖ Reject</Btn></>}<Btn onClick={() => openVolunteer(r.id)}>👤 Open</Btn><Btn onClick={() => certificate(r.id)}>🏅</Btn></>}
        />
      </div>
    </>
  );
}
