import { useRef, useState } from 'react';
import { G, t, tr } from '../lib/gigf.js';
import { V, check, isOk, formValues } from '../lib/validate.js';
import { loadDraft, saveDraft, clearDraft } from '../lib/draft.js';
import { toast } from '../ui/feedback.jsx';
import { A, requireLogin } from '../ui/nav.jsx';
import { PageHero, Field } from '../ui/common.jsx';

const FILE_ERROR = 'Please upload a government ID proof';

export function IdBadge({ v, heading }) {
  return (
    <div className="id-badge">
      <div style={{ fontWeight: 800, color: '#fef08a', fontSize: '.85rem' }}>{G.ORG.nameCaps}</div>
      {heading && <div style={{ fontSize: '.7rem', opacity: 0.85 }}>{heading}</div>}
      <h3 style={{ margin: '10px 0 2px' }}>{v.name}</h3>
      <div style={{ fontSize: '.82rem' }}>{v.domain + ' · ' + v.city}</div>
      <div style={{ marginTop: 8, fontFamily: 'monospace', color: '#fef08a' }}>{v.badge}</div>
      {heading && v.status !== 'APPROVED' && <div style={{ marginTop: 8, fontSize: '.72rem', opacity: 0.9 }}>Valid after admin approval</div>}
    </div>
  );
}

function Status({ v }) {
  return (
    <div className="card card-body">
      <h4 style={{ color: 'var(--primary-dark)' }}>Your volunteer application</h4>
      <p style={{ margin: '6px 0' }}>Status: <span className={'chip ' + (v.status === 'APPROVED' ? '' : v.status === 'REJECTED' ? 'red' : 'warn')}>{v.status}</span></p>
      <IdBadge v={v} heading="Volunteer ID" />
      <p style={{ fontSize: '.82rem', color: '#6b7280', marginTop: 10 }}>{v.status === 'PENDING' ? 'Our team is reviewing your ID proof. You will be notified once approved.' : v.status === 'APPROVED' ? 'You are approved! Check your dashboard for tasks, attendance and your certificate.' : 'Unfortunately your application was not approved. Contact us for details.'}</p>
      <A className="btn btn-primary btn-sm" to="dashboard.html">Open dashboard</A>
    </div>
  );
}

export default function Volunteer({ route }) {
  const u = G.Auth.current(), mine = G.Volunteers.mine();
  const programs = G.DB.all('programs');
  const [saved] = useState(() => loadDraft('volunteer'));
  const [bad, setBad] = useState({});
  const [fileError, setFileError] = useState('');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(null);
  const file = useRef(null);
  const pre = new URLSearchParams(route.search).get('program');
  const preselected = programs.find((p) => p.id === pre);
  const status = applied || mine;

  const pickFile = (e) => {
    const f = e.target.files[0];
    setFileError('');
    if (!f) { setFileName(''); return; }
    const okType = /^(image\/(jpeg|png)|application\/pdf)$/.test(f.type), okSize = f.size <= 3 * 1024 * 1024;
    if (!okType || !okSize) { setFileError(!okType ? 'Only JPG, PNG or PDF allowed' : 'File must be under 3 MB'); e.target.value = ''; setFileName(''); return; }
    setFileName('📎 ' + f.name + ' (' + Math.round(f.size / 1024) + ' KB)');
  };

  const submit = async (e) => {
    e.preventDefault();
    const f = formValues(e.target);
    delete f.idFile;
    if (!G.Auth.current()) { saveDraft('volunteer', f); requireLogin('volunteer', 'volunteer.html' + route.search); return; }
    clearDraft('volunteer');
    const upload = file.current.files[0];
    setFileError(upload ? '' : FILE_ERROR);
    const wrong = check(f, { name: V.req, email: V.email, phone: V.phone, city: V.req });
    setBad(wrong);
    if (!isOk(wrong) || !upload) { toast('Please fix the highlighted fields.', '⚠️'); return; }
    if (G.DB.all('volunteers').some((v) => v.email.toLowerCase() === f.email.toLowerCase())) { toast('This email already has an application.', 'ℹ️'); return; }
    const data = { name: f.name, email: f.email, phone: f.phone, city: f.city, domain: f.domain, idType: f.idType };
    setBusy(true);
    let v = null;
    if (G.cloud && G.cloud.signedIn()) {   // real account: the application and the ID go to the private database
      try { v = await G.cloud.applyVolunteer(data, upload); toast('Application sent. Badge ' + v.badge, '🎖️'); } catch (err) {
        if (/duplicate|unique/i.test(err.message)) { setBusy(false); toast('You have already applied.', 'ℹ️'); return; }
        toast('Could not send it to the Foundation, so it is saved on this device only. ' + err.message, '⚠️');
      }
    }
    if (!v) { v = G.Volunteers.apply(Object.assign(data, { idFile: upload.name, idSize: upload.size })); toast('Application saved on this device. Badge ' + v.badge, '🎖️'); }
    setBusy(false); setApplied(v);
  };

  const value = (key, fallback) => saved[key] || fallback || '';
  return (
    <>
      <PageHero title={t('page.volunteer')} lead="Give your time. Grow with us." />
      <section className="section"><div className="wrap"><div className="grid g2" style={{ alignItems: 'start' }}>
        {!status && (
          <div className="card card-body">
            <h3 style={{ color: 'var(--primary-dark)', marginBottom: 12 }}>Volunteer registration</h3>
            <form id="volForm" className="f-grid" noValidate onSubmit={submit}>
              <Field label={<><span>{t('f.name')}</span> *</>} error="Please enter your name" bad={bad.name}><input name="name" defaultValue={value('name', u && u.name)} /></Field>
              <Field label={<><span>{t('f.phone')}</span> *</>} error="Enter a valid 10-digit mobile" bad={bad.phone}><input name="phone" inputMode="tel" defaultValue={value('phone', u && u.phone)} /></Field>
              <Field label={<><span>{t('f.email')}</span> *</>} error="Enter a valid email" bad={bad.email}><input name="email" type="email" defaultValue={value('email', u && u.email)} /></Field>
              <Field label="City / area *" error="Required" bad={bad.city}><input name="city" defaultValue={value('city')} /></Field>
              <Field label="Area of interest" full>
                <select name="domain" id="vDomain" defaultValue={value('domain', preselected && tr(preselected.title)) || undefined}>
                  {programs.map((p) => <option key={p.id} value={tr(p.title)}>{p.icon + ' ' + tr(p.title)}</option>)}
                  <option>📱 Digital outreach, photography & design</option>
                </select>
              </Field>
              <Field label="ID type"><select name="idType" defaultValue={value('idType') || undefined}>{['Aadhaar', 'Voter ID', 'Driving Licence', 'College / Employee ID'].map((x) => <option key={x}>{x}</option>)}</select></Field>
              <div className={'field' + (fileError ? ' bad' : '')}><label>Upload ID proof * (JPG/PNG/PDF, ≤3 MB). For Aadhaar, upload a masked copy.</label>
                <input type="file" id="vFile" name="idFile" ref={file} accept="image/jpeg,image/png,application/pdf" onChange={pickFile} />
                <span id="vFileName" style={{ fontSize: '.76rem', color: '#166534' }}>{fileName}</span><span className="err">{fileError || FILE_ERROR}</span></div>
              <button className="btn btn-primary f-full" type="submit" disabled={busy}>Submit application →</button>
            </form>
            <p style={{ fontSize: '.74rem', color: '#6b7280', marginTop: 10 }}>Your ID is used only for verification and is visible only to authorised admins.</p>
          </div>
        )}
        <div>
          <div id="volStatus">{status && <Status v={status} />}</div>
          <div className="card card-body" style={{ marginTop: 16 }}><h4 style={{ color: 'var(--primary-dark)' }}>What volunteers get</h4>
            <ul style={{ margin: '10px 0 0 18px', display: 'grid', gap: 6, fontSize: '.88rem', color: '#374151' }}><li>Digital volunteer ID badge</li><li>Event slots & task assignments</li><li>Attendance & hours tracking</li><li>Downloadable certificate</li><li>Direct line to the Foundation team</li></ul></div>
        </div>
      </div></div></section>
    </>
  );
}
