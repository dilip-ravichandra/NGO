/** Donations: ledger and filters, UPI verification, monthly donors, reports, offline gifts, receipts, export. */
import { useRef, useState } from 'react';
import { G, CFG, tr } from '../lib/gigf.js';
import { donationSummary, filterDonations } from '../lib/adminLogic.js';
import { openModal, toast } from '../ui/feedback.jsx';
import { Table, Btn, Chip, Mic, VoicePicker, useSticky, aiPost, aiMsg, downloadCsv } from './shared.jsx';

export const donationCsvColumns = [[(r) => r.createdAt.slice(0, 10), 'Date'], ['receiptNo', 'Receipt'], ['donorName', 'Donor'], ['donorEmail', 'Email'], ['donorPhone', 'Phone'], ['donorPan', 'PAN'], ['program', 'Programme'], ['amount', 'Amount INR'], ['frequency', 'Frequency'], ['method', 'Method'], ['status', 'Status'], ['paymentId', 'Payment ID']];
export const exportDonations = (rows) => { downloadCsv('donations.csv', donationCsvColumns, rows); G.audit('EXPORT', 'donations'); };
const toVerify = () => G.DB.all('donations').filter((d) => d.status === 'PENDING' && d.source === 'UPI_DIRECT');
const Donor = ({ r, phone }) => <>{r.donorName}<br /><small>{r.donorEmail + (phone ? ' · ' + r.donorPhone : '')}</small></>;

async function decide(id, ok) {
  const d = G.DB.get('donations', id);
  if (!d || d.status !== 'PENDING') return;
  if (!confirm(ok ? `Have you seen ${G.inr(d.amount)} with reference ${d.utr} in the bank statement? A receipt will be issued.` : 'Mark this payment as not received?')) return;
  try {
    if (d.cloud) await G.cloud.verifyDonation(id, ok);
    else { G.DB.update('donations', id, { status: ok ? 'CAPTURED' : 'FAILED', paymentId: 'UTR ' + d.utr }); if (ok) G.Donations.issueReceipt(id); }
    G.audit(ok ? 'UPI_VERIFIED' : 'UPI_REJECTED', 'donation', id, G.inr(d.amount) + ' · ref ' + d.utr);
    toast(ok ? 'Verified, receipt issued' : 'Marked as not received', ok ? '✅' : 'ℹ️');
  } catch (e) { toast('Not saved: ' + e.message, '⚠️'); }
}

function OfflineForm({ close, done }) {
  const programs = G.DB.all('programs').map((p) => tr(p.title)).concat('Where needed most');
  const [bad, setBad] = useState({});
  const [status, setStatus] = useState('');
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const form = useRef(null), say = useRef(null);
  const read = async () => {
    const text = say.current.value.trim();
    if (!text) return toast('Say or type the gift first.', 'ℹ️');
    setReading(true); setStatus('✨ Reading…');
    const r = await aiPost(CFG.extractDonationApi || '/api/extract-donation', { text, programs });
    setReading(false);
    if (r.status !== 200 || !r.draft) return setStatus('⚠️ ' + aiMsg(r) + ' You can still fill the form yourself.');
    const d = r.draft, put = (k, v) => { if (v) form.current.elements[k].value = v; };
    put('donorName', d.name); put('amount', d.amount); put('method', d.method); put('program', d.program); put('donorPhone', d.phone); put('donorEmail', d.email); put('note', d.note);
    setStatus('✔ Check the amount, then Save.' + ((r.warnings || []).length ? ' ⚠️ ' + r.warnings.join(' ') : ''));
  };
  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const f = e.target.elements, v = (n) => String(f[n].value || '').trim(), amount = Math.round(Number(v('amount')) * 100) / 100;
    const wrong = { donorName: v('donorName').length < 2, amount: !(amount > 0) };
    setBad(wrong);
    if (wrong.donorName || wrong.amount) return;
    if (!confirm(`Record ${G.inr(amount)} from ${v('donorName')} and create a receipt?`)) return;
    setSaving(true);
    const d = { donorName: v('donorName'), donorEmail: v('donorEmail').toLowerCase(), donorPhone: v('donorPhone'), program: v('program'), amount, method: v('method'), note: v('note') };
    try {
      let rec;
      if (G.cloud && G.cloud.canWrite()) rec = await G.cloud.addOffline(d);
      else { rec = G.DB.add('donations', { donorPan: '', frequency: 'ONE_TIME', status: 'CAPTURED', source: 'OFFLINE', userEmail: d.donorEmail, orderId: 'offline_' + Date.now().toString(36), paymentId: d.note, receiptNo: '', demo: true, ...d }); G.Donations.issueReceipt(rec.id); }
      G.audit('OFFLINE_DONATION', 'donation', rec.id, G.inr(amount) + ' · ' + d.method); toast('Recorded, receipt created', '✅'); done(); close();
    } catch (x) { setSaving(false); toast('Not saved: ' + x.message, '⚠️'); }
  };
  return (
    <>
      <div className="pg-ai"><b>Fill by speaking or typing</b><textarea id="oSay" ref={say} rows="2" maxLength={1500} placeholder="e.g. Received 2500 rupees cash from Suresh Gowda, mobile 98765 43210, for cow protection." /><Mic target={say} onDone={(t) => { if (t.length >= 10 && !reading) read(); }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}><VoicePicker /><button type="button" className="btn btn-primary btn-sm" id="oRead" disabled={reading} onClick={read}>✨ Fill the form</button><span id="oStatus" className="ai-status">{status}</span></div></div>
      <form id="oForm" className="f-grid" noValidate ref={form} onSubmit={submit}>
        <div className={'field' + (bad.donorName ? ' bad' : '')}><label>Donor name *</label><input name="donorName" maxLength={80} /><span className="err">Name needed</span></div>
        <div className={'field' + (bad.amount ? ' bad' : '')}><label>Amount (₹) *</label><input name="amount" type="number" min="1" step="0.01" /><span className="err">Amount needed</span></div>
        <div className="field"><label>Received by</label><select name="method">{['Cash', 'Cheque', 'Bank transfer', 'UPI'].map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="field"><label>Programme</label><select name="program">{programs.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="field"><label>Mobile</label><input name="donorPhone" inputMode="tel" maxLength={20} /></div>
        <div className="field"><label>Email</label><input name="donorEmail" type="email" maxLength={254} /></div>
        <div className="field f-full"><label>Note (cheque or reference number)</label><input name="note" maxLength={200} /></div>
        <button className="btn btn-primary f-full" type="submit" disabled={saving}>Save and create receipt</button>
      </form>
    </>
  );
}

function share(id) {   // downloads the PDF and opens a ready-written message; the admin attaches the file and sends it
  const d = G.DB.get('donations', id);
  if (!d || !G.Donations.openReceipt(id)) return;
  const msg = `Namaste ${d.donorName}, thank you for your donation of ${G.inr(d.amount)}. Receipt no. ${d.receiptNo} is attached.\n\n${G.ORG.name}`, wa = String(d.donorPhone || '').replace(/\D/g, '').slice(-10);
  openModal({
    title: '✉️ Send the receipt',
    render: () => <><p>The PDF has been downloaded. Open a message below, attach the file and send.</p><p style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {d.donorEmail && <a className="btn btn-primary" href={`mailto:${d.donorEmail}?subject=${encodeURIComponent('Donation receipt ' + d.receiptNo)}&body=${encodeURIComponent(msg)}`}>✉️ Email</a>}
      {wa.length === 10 && <a className="btn btn-ghost" target="_blank" rel="noopener" href={`https://wa.me/91${wa}?text=${encodeURIComponent(msg)}`}>💬 WhatsApp</a>}
    </p></>
  });
  G.audit('RECEIPT_SEND', 'donation', id, d.receiptNo);
}
async function stopMonthly(id) {
  if (!confirm('Mark this monthly donation as stopped?')) return;
  const d = G.DB.get('donations', id);
  if (d.cloud) { try { await G.cloud.stopMonthly(id); } catch (e) { return toast(e.message, '⚠️'); } }
  G.DB.update('donations', id, { cancelled: true }); G.audit('MONTHLY_STOPPED', 'donation', id, 'stopped by admin');
}
function sync(id) {
  const d = G.DB.get('donations', id);
  toast(d.demo ? (G.present ? `Current status: ${d.status}.` : `Demo record — live Razorpay sync is available once the backend is connected. Current status: ${d.status}.`) : 'Syncing with Razorpay…', '🔄');
  G.audit('SYNC_STATUS', 'donation', id);
}
function capture(id) {
  if (!confirm('Mark as captured and issue receipt? Only do this after confirming in the Razorpay dashboard.')) return;
  G.DB.update('donations', id, { status: 'CAPTURED', paymentId: G.DB.get('donations', id).paymentId || 'manual_' + Date.now().toString(36) });
  G.Donations.issueReceipt(id); G.audit('MANUAL_CAPTURE', 'donation', id, 'marked captured by admin after checking the gateway');
}

function Reports() {
  const block = (kind, title) => {
    const rows = donationSummary(G.DB.all('donations'), kind), max = Math.max(1, ...rows.map((r) => r.total));
    const csv = () => downloadCsv('donations-by-' + kind + '.csv', [['key', kind === 'month' ? 'Month' : kind === 'program' ? 'Programme' : 'Method'], ['count', 'Donations'], ['total', 'Amount INR']], rows);
    return (
      <div key={kind} className="card card-body" style={{ marginBottom: 12 }}>
        <div className="toolbar"><h4 style={{ flex: 1 }}>{title}</h4><Btn onClick={csv}>⬇ CSV</Btn></div>
        {rows.length ? rows.map((r) => <div key={r.key} className="rep-row"><span>{r.key}</span><div><i style={{ width: Math.round((r.total / max) * 100) + '%' }} /></div><b>{G.inr(r.total)}</b><small>{r.count}</small></div>) : <p style={{ color: '#9ca3af' }}>No confirmed donations yet.</p>}
      </div>
    );
  };
  return <>{block('month', 'By month')}{block('program', 'By programme')}{block('method', 'By payment method')}</>;
}

function Ledger({ f, change }) {
  const all = G.DB.all('donations');
  const rows = filterDonations(all, f);
  const select = (id, key, list) => <select id={id} className="search" style={{ flex: 0 }} value={f[key]} onChange={(e) => change({ [key]: e.target.value })}>{list.map((x) => <option key={x}>{x}</option>)}</select>;
  return (
    <>
      <div className="toolbar">
        <input className="search" id="dq" placeholder="Search name / email / receipt" value={f.q} onChange={(e) => change({ q: e.target.value })} />
        {select('dst', 'st', ['ALL', 'CAPTURED', 'PENDING', 'FAILED'])}
        {select('dpg', 'pg', ['ALL', ...new Set(all.map((d) => d.program))])}
        {select('dmd', 'md', ['ALL', ...new Set(all.map((d) => d.method))])}
        <input type="date" id="dfr" className="search" style={{ flex: 0 }} value={f.from} onChange={(e) => change({ from: e.target.value })} />
        <input type="date" id="dto" className="search" style={{ flex: 0 }} value={f.to} onChange={(e) => change({ to: e.target.value })} />
      </div>
      <p style={{ fontSize: '.84rem', marginBottom: 8 }}>{rows.length + ' records · '}<b>{G.inr(rows.filter((d) => d.status === 'CAPTURED').reduce((a, d) => a + d.amount, 0))}</b> captured</p>
      <Table
        cols={[[(r) => G.fmtDate(r.createdAt), 'Date'], [(r) => <Donor r={r} />, 'Donor'], ['program', 'Programme'], [(r) => <><b>{G.inr(r.amount)}</b>{r.frequency === 'MONTHLY' ? ' 🔁' : ''}</>, 'Amount'], ['method', 'Method'], [(r) => <><Chip s={r.status} />{r.demo && !G.present && <> <span className="chip warn">demo</span></>}</>, 'Status'], [(r) => r.receiptNo || '—', 'Receipt']]}
        rows={rows}
        actions={(r) => <>
          {r.source === 'UPI_DIRECT' && r.status === 'PENDING' ? <Btn kind="btn-primary" onClick={() => decide(r.id, true)}>✔ Verify</Btn> : r.source ? null : <Btn onClick={() => sync(r.id)}>🔄 Sync</Btn>}
          {r.status === 'CAPTURED' ? <><Btn onClick={() => { if (!G.Donations.openReceipt(r.id)) toast('Allow pop-ups', '⚠️'); }}>📄 PDF</Btn><Btn onClick={() => share(r.id)}>✉️ Send</Btn></> : r.source ? null : <Btn onClick={() => capture(r.id)}>Mark captured</Btn>}
        </>}
      />
    </>
  );
}

export default function Donations() {
  const [f, setF] = useSticky('don', { q: '', st: 'ALL', pg: 'ALL', md: 'ALL', from: '', to: '', tab: 'ledger' });
  const change = (patch) => setF((x) => ({ ...x, ...patch }));
  const monthly = G.DB.all('donations').filter((d) => d.frequency === 'MONTHLY' && d.status === 'CAPTURED'), live = monthly.filter((d) => !d.cancelled);
  return (
    <>
      <div className="toolbar"><h3 style={{ flex: 1 }}>Donations & receipts</h3>
        <Btn kind="btn-orange" onClick={() => openModal({ wide: true, title: '✨ Record an offline gift', render: (close) => <OfflineForm close={close} done={() => change({ tab: 'ledger' })} /> })}>✨ Record offline gift</Btn>
        <Btn kind="btn-primary" onClick={() => exportDonations(filterDonations(G.DB.all('donations'), f))}>⬇ Export Excel/CSV</Btn></div>
      <div className="toolbar">{[['ledger', '📒 All'], ['verify', '🔎 To verify (' + toVerify().length + ')'], ['monthly', '🔁 Monthly donors'], ['reports', '📊 Reports']].map(([key, label]) => <Btn key={key} kind={f.tab === key ? 'btn-primary' : 'btn-ghost'} onClick={() => change({ tab: key })}>{label}</Btn>)}</div>
      {f.tab === 'verify' && <>
        <p style={{ fontSize: '.84rem', marginBottom: 8 }}>Find each reference in the bank statement before pressing Verify. A receipt is created only then.</p>
        <Table cols={[[(r) => G.fmtDate(r.createdAt), 'Date'], [(r) => <Donor r={r} phone />, 'Donor'], ['program', 'Programme'], [(r) => <b>{G.inr(r.amount)}</b>, 'Amount'], [(r) => <code>{r.utr}</code>, 'UPI reference']]} rows={toVerify()}
          actions={(r) => <><Btn kind="btn-primary" onClick={() => decide(r.id, true)}>✔ Verify</Btn><Btn onClick={() => decide(r.id, false)}>✖ Not received</Btn></>} />
      </>}
      {f.tab === 'monthly' && <>
        <p style={{ fontSize: '.84rem', marginBottom: 8 }}><b>{live.length}</b> active · <b>{G.inr(live.reduce((a, d) => a + d.amount, 0))}</b>{` pledged per month · ${monthly.length - live.length} stopped. Automatic monthly debits start with the payment gateway.`}</p>
        <Table cols={[[(r) => G.fmtDate(r.createdAt), 'Since'], [(r) => <Donor r={r} />, 'Donor'], ['program', 'Programme'], [(r) => G.inr(r.amount), 'Per month'], [(r) => <Chip s={r.cancelled ? 'CANCEL' : 'ACTIVE'} />, 'State']]} rows={monthly}
          actions={(r) => (r.cancelled ? null : <Btn onClick={() => stopMonthly(r.id)}>Stop</Btn>)} />
      </>}
      {f.tab === 'reports' && <Reports />}
      {f.tab === 'ledger' && <Ledger f={f} change={change} />}
    </>
  );
}
