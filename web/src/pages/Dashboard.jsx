/** A signed-in person's own records: profile, donations and receipts, events, volunteering, support tickets. */
import { useEffect, useState } from 'react';
import { G, t, tr } from '../lib/gigf.js';
import { openModal, toast } from '../ui/feedback.jsx';
import { A } from '../ui/nav.jsx';
import { Empty } from '../ui/common.jsx';
import { IdBadge } from './Volunteer.jsx';

const TABS = [['overview', '🏠 Overview'], ['donations', '💚 Donations'], ['events', '📅 My events'], ['volunteer', '🤝 Volunteer'], ['support', '🎫 Support']];
const ROLES = { REGISTERED_USER: 'Registered User', VOLUNTEER: 'Volunteer', DONOR: 'Donor', ADMIN: 'Admin', SUPER_ADMIN: 'Admin' };
const Status = ({ s }) => <span className={'chip ' + (s === 'CAPTURED' || s === 'APPROVED' || s === 'RESOLVED' ? '' : s === 'FAILED' || s === 'REJECTED' ? 'red' : 'warn')}>{s}</span>;
const myRegistrations = (u) => G.DB.all('registrations').filter((r) => r.email.toLowerCase() === u.email.toLowerCase());
const grey = { color: '#6b7280', marginTop: 8 };

function Overview({ u, goTab }) {
  const done = G.Donations.mine().filter((d) => d.status === 'CAPTURED'), total = done.reduce((a, d) => a + d.amount, 0);
  const v = G.Volunteers.mine();
  const save = (e) => {
    e.preventDefault();
    const f = new FormData(e.target), name = f.get('name'), phone = f.get('phone');
    G.DB.update('users', u.id, { name, phone });
    localStorage.setItem('gigf_session', JSON.stringify({ ...G.Auth.current(), name, phone }));
    G.DB.saveSettings({});
    toast('Profile saved', '✅');
  };
  const stats = [[G.inr(total), 'Total donated'], [done.length, 'Donations'], [myRegistrations(u).length, 'Event registrations'], [v ? v.hours || 0 : '—', 'Volunteer hours']];
  return (
    <>
      <div className="stats" style={{ marginBottom: 22 }}>{stats.map(([value, label]) => <div key={label} className="stat"><b>{value}</b><span>{label}</span></div>)}</div>
      <div className="grid g2">
        <div className="card card-body"><h4>Profile</h4>
          <form id="profForm" className="f-grid" style={{ marginTop: 10 }} onSubmit={save}>
            <div className="field"><label>{t('f.name')}</label><input name="name" defaultValue={u.name} /></div>
            <div className="field"><label>{t('f.phone')}</label><input name="phone" defaultValue={u.phone || ''} /></div>
            <div className="field f-full"><label>{t('f.email')}</label><input value={u.email} disabled /></div>
            <button className="btn btn-primary f-full" type="submit">Save profile</button>
          </form></div>
        <div className="card card-body"><h4>Quick actions</h4><div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          <A className="btn btn-orange" to="donate.html">💚 Make a donation</A>
          <A className="btn btn-primary" to="events.html">📅 Browse events</A>
          {!v && <A className="btn btn-ghost" to="volunteer.html">🤝 Become a volunteer</A>}
          <button type="button" className="btn btn-ghost" onClick={() => goTab('support')}>🎫 Contact support</button>
        </div></div>
      </div>
    </>
  );
}

function IssueForm({ u, donation, close, done }) {
  const submit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const ticket = G.Tickets.create({ category: 'PAYMENT_ISSUE', name: u.name, email: u.email, phone: u.phone, subject: f.get('why'), message: f.get('d') || f.get('why'), donationId: donation.id });
    close(); toast(`Ticket ${ticket.no} created. Our finance team will respond.`, '🎫'); done();
  };
  return (
    <>
      <p style={{ fontSize: '.84rem', marginBottom: 10 }}>{G.inr(donation.amount) + ' · ' + donation.program + ' · ' + donation.status}</p>
      <form id="issForm" onSubmit={submit}>
        <div className="field"><label>What went wrong?</label><select name="why">{['Money debited but donation not shown', 'Receipt missing', 'Wrong name / PAN on receipt', 'Payment failed or stuck pending', 'Other'].map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="field" style={{ marginTop: 10 }}><label>Details (optional)</label><textarea name="d" rows="3" /></div>
        <button className="btn btn-primary" style={{ marginTop: 12 }} type="submit">Submit ticket</button>
      </form>
    </>
  );
}

function Donations({ u, goTab }) {
  const rows = G.Donations.mine();
  if (!rows.length) return <Empty icon="💚">No donations yet. <A to="donate.html">Make your first donation</A>.</Empty>;
  const stop = (d) => {
    if (!confirm('Stop this monthly donation?')) return;
    G.DB.update('donations', d.id, { cancelled: true });
    if (G.cloud && d.cloud) G.cloud.stopMonthly(d.id).catch((x) => toast('Not saved: ' + x.message, '⚠️'));
    G.audit('MONTHLY_STOPPED', 'donation', d.id, 'stopped by donor'); toast('Monthly donation stopped', '🛑');
  };
  const issue = (d) => openModal({ title: '🎫 Report a payment / receipt issue', render: (close) => <IssueForm u={u} donation={d} close={close} done={() => goTab('support')} /> });
  return (
    <>
      <div className="tbl-wrap"><table className="t"><tbody>
        <tr><th>Date</th><th>Programme</th><th>Amount</th><th>Type</th><th>Status</th><th>Receipt</th><th /></tr>
        {rows.map((d) => (
          <tr key={d.id}>
            <td>{G.fmtDate(d.createdAt)}</td><td>{d.program}</td><td><b>{G.inr(d.amount)}</b></td>
            <td>{d.frequency === 'MONTHLY' ? '🔁 Monthly' : 'One-time'}{d.cancelled && <> <span className="chip gray">stopped</span></>}</td>
            <td><Status s={d.status} /></td>
            <td>{d.receiptNo ? <a href="#" data-rcpt={d.id} onClick={(e) => { e.preventDefault(); if (!G.Donations.openReceipt(d.id)) toast('Allow pop-ups to view the receipt', '⚠️'); }}>{d.receiptNo}</a> : '—'}</td>
            <td style={{ whiteSpace: 'nowrap' }}>
              {d.frequency === 'MONTHLY' && d.status === 'CAPTURED' && !d.cancelled && <><button type="button" className="btn btn-ghost btn-sm" onClick={() => stop(d)}>Stop monthly</button> </>}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => issue(d)}>Report issue</button>
            </td>
          </tr>
        ))}
      </tbody></table></div>
      <p style={{ fontSize: '.76rem', color: '#6b7280', marginTop: 8 }}>Receipts download as a PDF.</p>
    </>
  );
}

function MyEvents({ u }) {
  const regs = myRegistrations(u);
  if (!regs.length) return <Empty icon="📅">You have not registered for any event. <A to="events.html">See upcoming events</A>.</Empty>;
  return (
    <div className="grid g2">{regs.map((r) => {
      const e = G.DB.get('events', r.eventId) || {};
      return (
        <div key={r.id} className="card card-body">
          <h4>{tr(e.title) || 'Event'}</h4><p style={{ fontSize: '.84rem', color: '#4b5563' }}>{(e.date ? G.fmtDate(e.date) : '') + ' · ' + (e.location || '')}</p>
          <p style={{ margin: '8px 0' }}>{r.guests + ' guest(s) '}{r.asVolunteer && <span className="chip blue">Volunteer slot</span>} {r.attended && <span className="chip">Attended</span>}</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { if (confirm('Cancel this registration?')) G.DB.remove('registrations', r.id); }}>Cancel registration</button>
        </div>
      );
    })}</div>
  );
}

function MyVolunteering() {
  const v = G.Volunteers.mine();
  if (!v) return <Empty icon="🤝">You are not a volunteer yet. <A to="volunteer.html">Apply now</A>.</Empty>;
  const tasks = v.tasks || [];
  const markDone = (i) => {
    tasks[i].done = true;
    G.DB.update('volunteers', v.id, { tasks });
    if (v.cloud && G.cloud) G.cloud.taskDone(i).catch((x) => toast('Not saved: ' + x.message, '⚠️'));
  };
  return (
    <div className="grid g2">
      <div className="card card-body"><h4>Digital ID</h4><div style={{ marginTop: 10 }}><IdBadge v={v} /></div>
        <p style={{ marginTop: 10 }}>Status: <Status s={v.status} /></p>
        {v.duty && <p><b>Role:</b> {v.duty}</p>}
        {v.status === 'REJECTED' && v.reason && <p style={{ color: '#991b1b' }}>Reason: {v.reason}</p>}
        {v.status === 'APPROVED' && <button type="button" className="btn btn-primary btn-sm" id="certBtn" style={{ marginTop: 8 }} onClick={() => { if (!G.Volunteers.downloadPDF(v)) toast('Allow pop-ups', '⚠️'); }}>🏅 Certificate</button>}
      </div>
      <div className="card card-body"><h4>Tasks assigned</h4>
        {tasks.length ? <ul style={{ margin: '10px 0 0 18px' }}>{tasks.map((k, i) => <li key={i} style={{ marginBottom: 6 }}>{k.title + ' '}<span className={'chip ' + (k.done ? '' : 'warn')}>{k.done ? 'Done' : 'To do'}</span> {!k.done && <button type="button" className="btn btn-ghost btn-sm" onClick={() => markDone(i)}>Mark done</button>}</li>)}</ul> : <p style={grey}>No tasks yet.</p>}
        <h4 style={{ marginTop: 16 }}>Attendance</h4>
        {(v.attendance || []).length ? <ul style={{ margin: '8px 0 0 18px' }}>{v.attendance.map((a, i) => <li key={i}>{`${G.fmtDate(a.date)} — ${a.note || 'Present'} (${Number(a.hours) || 0}h)`}</li>)}</ul> : <p style={grey}>No attendance recorded yet.</p>}
        <p style={{ marginTop: 8 }}><b>Total hours:</b> {v.hours || 0}</p>
      </div>
    </div>
  );
}

function Support({ u }) {
  const mine = G.DB.all('tickets').filter((x) => (x.email || '').toLowerCase() === u.email.toLowerCase());
  const send = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const ticket = G.Tickets.create({ category: 'CONTACT', name: u.name, email: u.email, phone: u.phone, subject: f.get('subject'), message: f.get('message') });
    e.target.reset(); toast('Sent — ' + ticket.no, '✉️');
  };
  return (
    <div className="grid g2">
      <div className="card card-body"><h4>Message the Foundation</h4>
        <form id="supForm" className="f-grid" style={{ marginTop: 10 }} onSubmit={send}>
          <div className="field f-full"><label>{t('f.subject')}</label><input name="subject" required /></div>
          <div className="field f-full"><label>{t('f.message')}</label><textarea name="message" rows="4" required /></div>
          <button className="btn btn-primary f-full" type="submit">{t('btn.send')}</button>
        </form></div>
      <div><h4 style={{ marginBottom: 8 }}>My tickets</h4>
        {mine.map((x) => (
          <div key={x.id} className="card card-body" style={{ marginBottom: 10 }}><b>{x.no}</b> <Status s={x.status} />
            <div style={{ fontSize: '.84rem', margin: '4px 0' }}>{x.subject}</div>
            {(x.replies || []).map((r, i) => <div key={i} className="note green" style={{ marginTop: 6 }}><b>Foundation:</b> {r.text}</div>)}
          </div>
        ))}
        {!mine.length && <Empty icon="🎫">No tickets yet.</Empty>}
      </div>
    </div>
  );
}

export default function Dashboard({ route }) {
  const u = G.Auth.current();
  const fromRoute = TABS.some((x) => x[0] === route.anchor) ? route.anchor : 'overview';
  const [tab, setTab] = useState(fromRoute);
  useEffect(() => { setTab(fromRoute); }, [route]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!G.Auth.current()) location.replace('#login?next=dashboard.html'); else { try { G.Donations.reconcile(); } catch { /* nothing to tidy */ } } }, []);
  if (!u) return null;
  const goTab = (key) => { setTab(key); history.replaceState(null, '', '#dashboard/' + key); };
  const View = { overview: Overview, donations: Donations, events: MyEvents, volunteer: MyVolunteering, support: Support }[tab];
  return (
    <section className="section"><div className="wrap">
      {/ADMIN/.test(u.role) && <div className="note" style={{ marginBottom: 12 }}>You are signed in with the admin account. This page shows only your own records. <a href="admin.html"><b>Open the admin portal</b></a></div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}><div>
        <h2 id="dashHello" style={{ fontFamily: 'var(--font-serif)', color: 'var(--primary-dark)' }}>{`Namaste, ${u.name.split(' ')[0]} 🙏`}</h2><span className="chip" id="dashRole">{ROLES[u.role] || u.role}</span>
      </div></div>
      <div className="tabs" id="dashTabs">{TABS.map(([key, label]) => <button type="button" key={key} className={'tab ' + (key === tab ? 'on' : '')} data-tab={key} onClick={() => goTab(key)}>{label}</button>)}</div>
      <div id="dashBody"><View u={u} goTab={goTab} /></div>
    </div></section>
  );
}
