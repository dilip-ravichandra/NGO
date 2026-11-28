import { useMemo, useState } from 'react';
import { G, CFG, t, tr } from '../lib/gigf.js';
import { V, check, isOk } from '../lib/validate.js';
import { loadDraft, saveDraft, clearDraft } from '../lib/draft.js';
import { upiDetails, placeholderQr } from '../lib/upi.js';
import { WORDS } from '../content/upiWords.js';
import { openModal, toast } from '../ui/feedback.jsx';
import { A, requireLogin } from '../ui/nav.jsx';
import { PageHero, Field } from '../ui/common.jsx';

const AMOUNTS = [500, 1000, 2500, 5000];
const METHODS = [['UPI', '📱 UPI / QR'], ['Card', '💳 Card'], ['Netbanking', '🏦 Net banking']];

/** Real Razorpay flow - only runs when the deployment provides {apiBase, razorpayKey}. */
async function realCheckout(d) {
  const post = (path, body) => fetch(CFG.apiBase + path, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const r = await post('/api/donations/create-order', d);
  if (!r.ok) throw new Error('Could not create order');
  const order = await r.json();
  await new Promise((res, rej) => { if (window.Razorpay) return res(); const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = res; s.onerror = () => rej(new Error('Razorpay failed to load')); document.head.appendChild(s); });
  return new Promise((res, rej) => {
    new window.Razorpay({
      key: CFG.razorpayKey, order_id: order.orderId, amount: order.amountPaise, currency: 'INR', name: G.ORG.name, prefill: { name: d.name, email: d.email, contact: d.phone },
      handler: async (resp) => { const v = await post('/api/donations/verify', resp); if (v.ok) res(await v.json()); else rej(new Error('Payment verification failed')); },   // the server checks the signature
      modal: { ondismiss: () => rej(new Error('Payment cancelled')) }
    }).open();
  });
}

function Result({ rec, close }) {
  const report = () => {
    const ticket = G.Tickets.create({ category: 'PAYMENT_ISSUE', name: rec.donorName, email: rec.donorEmail, phone: rec.donorPhone, subject: 'Payment ' + rec.status, message: `Order ${rec.orderId} for ${G.inr(rec.amount)} is ${rec.status}.`, donationId: rec.id });
    close(); toast('Ticket ' + ticket.no + ' created — our team will follow up.', '🎫');
  };
  if (rec.status !== 'CAPTURED') {
    return (
      <div className="success">
        <p style={{ marginBottom: 12, fontSize: '.9rem' }}>{rec.status === 'FAILED' ? 'Your payment did not go through. If money was debited it is normally refunded automatically by your bank in a few working days.' : 'Your payment is awaiting confirmation. We will update the status automatically.'}</p>
        <button type="button" className="btn btn-orange" id="rIssue" onClick={report}>Report this to our team</button>
      </div>
    );
  }
  return (
    <div className="success">
      <div className="tick">✓</div>
      <h3 style={{ color: 'var(--primary-dark)', margin: '10px 0 4px' }}>{'Thank you, ' + rec.donorName + '!'}</h3>
      <p style={{ fontSize: '.86rem', color: '#4b5563' }}>{G.inr(rec.amount) + ' to ' + rec.program + (rec.frequency === 'MONTHLY' ? ' (monthly)' : '') + '.'}</p>
      <div style={{ background: '#f6faf7', borderRadius: 10, padding: 10, margin: '14px 0', fontSize: '.84rem', textAlign: 'left' }}>
        Receipt no: <b>{rec.receiptNo}</b><br />Payment ID: <code>{rec.paymentId}</code>
        {rec.demo && !G.present && <><br /><span className="chip warn">DEMO — no money charged</span></>}
      </div>
      <button type="button" className="btn btn-primary" id="rView" onClick={() => { if (!G.Donations.openReceipt(rec.id)) toast('Allow pop-ups to view the receipt', '⚠️'); }}>📄 View / Print Receipt</button>{' '}
      <A className="btn btn-ghost" to="dashboard.html" onClick={close}>My donations</A>
    </div>
  );
}

function UpiCard({ s, programName, save, clearSaved, setUtr }) {
  const w = WORDS[G.lang()] || WORDS.en;
  const u = upiDetails();
  const qr = useMemo(() => u.qr || placeholderQr(), [u.qr]);
  const [busy, setBusy] = useState(false);
  const amount = Number(s.amount) || 0;

  const paid = async () => {
    const user = G.Auth.current();
    if (!user) { save(); requireLogin('donate', 'donate.html'); return; }
    const name = s.name.trim(), phone = s.phone.trim(), pan = s.pan.trim().toUpperCase(), utr = s.utr.replace(/\s/g, '');
    if (name.length < 2 || !V.phone(phone)) return toast('Please fill your name and mobile number above.', '⚠️');
    if (!V.pan(pan)) return toast('Please check the PAN above, or leave it empty.', '⚠️');
    if (amount < 10) return toast('Please choose an amount of at least ₹10.', '⚠️');
    if (!V.utr(utr)) return toast('The UPI reference has exactly 12 digits.', '⚠️');
    if (G.DB.all('donations').some((d) => d.utr === utr)) return toast('This reference has already been submitted.', 'ℹ️');
    setBusy(true);
    const claim = { program: programName, amount, utr, name, phone, pan, email: user.email };
    let shared = false;
    if (G.cloud && G.cloud.signedIn()) {
      try { await G.cloud.submitUpi(claim); shared = true; } catch (e) {
        if (/duplicate|unique/i.test(e.message)) { setBusy(false); return toast('This reference has already been submitted.', 'ℹ️'); }
        toast('Could not reach the Foundation, so this is saved on this device only. ' + e.message, '⚠️');
      }
    }
    if (!shared) {
      const d = G.DB.add('donations', { donorName: name, donorEmail: claim.email, donorPhone: phone, donorPan: pan, program: claim.program, amount, frequency: 'ONE_TIME', method: 'UPI direct', userEmail: claim.email, orderId: 'upi_' + utr, paymentId: '', utr, source: 'UPI_DIRECT', status: 'PENDING', receiptNo: '', demo: true, autoFlagged: true });
      G.audit('UPI_CLAIM', 'donation', d.id, G.inr(d.amount) + ' · ref ' + utr);
    }
    setUtr(''); setBusy(false); clearSaved();
    openModal({ title: '⏳ Waiting to be checked', render: (close) => <p>Thank you. We have noted your payment of <b>{G.inr(claim.amount)}</b> (reference {utr}). A receipt appears in <A to="dashboard.html" onClick={close}>your dashboard</A> after we confirm it in the bank statement.</p> });
  };

  const copy = () => navigator.clipboard.writeText(u.id).then(() => toast('UPI ID copied', '📋'));
  return (
    <div id="upiCard" className="card card-body upi-card" data-notr="">
      <h4>{'📲 ' + w.head}</h4><p className="upi-note">{w.note}</p>
      <div className="note" id="upiMonthly" style={{ marginBottom: 10 }} hidden={s.freq !== 'MONTHLY'}>{w.monthly}</div>
      {u.dummy && !G.present && <div className="note"><b>{w.dummy}</b></div>}
      <div className="upi-grid">
        <img alt="UPI QR code" src={qr} />
        <div>
          <div className="upi-id"><b id="upiId">{u.id}</b> <button type="button" className="btn btn-ghost btn-sm" id="upiCopy" onClick={copy}>{w.copy}</button></div>
          <div id="upiName" style={{ fontSize: '.84rem', color: '#6b7280' }}>{u.name}</div>
          <p>{w.amount + ': '}<b id="upiAmt">{G.inr(amount)}</b></p>
          {!u.dummy && <a className="btn btn-ghost btn-sm" id="upiOpen" href={`upi://pay?pa=${encodeURIComponent(u.id)}&pn=${encodeURIComponent(u.name)}&am=${amount}&cu=INR&tn=Donation`}>{w.open}</a>}
          <div className="field"><label>{w.ref}</label><input id="upiUtr" inputMode="numeric" maxLength={12} placeholder="e.g. 123456789012" value={s.utr} onChange={(e) => setUtr(e.target.value)} /></div>
          <button type="button" className="btn btn-primary" id="upiDone" disabled={busy} onClick={paid}>{w.done}</button>
        </div>
      </div>
    </div>
  );
}

export default function Donate({ route }) {
  const programs = G.DB.all('programs').filter((p) => p.active);
  const [s, setS] = useState(() => {
    const draft = loadDraft('donate'), u = G.Auth.current();
    const wanted = draft._program || new URLSearchParams(route.search).get('program') || 'general';
    return {
      freq: draft._freq === 'MONTHLY' ? 'MONTHLY' : 'ONE_TIME',
      method: METHODS.some((m) => m[0] === draft._method) ? draft._method : 'UPI',
      program: programs.some((p) => p.id === wanted) ? wanted : 'general',
      amount: String(draft._amount > 0 ? draft._amount : 1000),
      name: draft.name || (u ? u.name : ''), phone: draft.phone || (u ? u.phone || '' : ''), email: draft.email || (u ? u.email : ''), pan: '',
      utr: String(draft._utr || '').replace(/\D/g, '').slice(0, 12), outcome: 'CAPTURED'
    };
  });
  const [bad, setBad] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (patch) => setS((x) => ({ ...x, ...patch }));
  const input = (key) => ({ value: s[key], onChange: (e) => set({ [key]: e.target.value }) });

  const program = programs.find((p) => p.id === s.program);
  const label = program ? program.icon + ' ' + tr(program.title) : '🌱 Where needed most';
  const programName = label.replace(/^\S+\s/, '');
  const amount = Number(s.amount) || 0;
  const save = () => saveDraft('donate', { name: s.name, phone: s.phone, email: s.email, _amount: amount, _program: s.program, _freq: s.freq, _method: s.method, _utr: s.utr });

  const submit = async (e) => {
    e.preventDefault();
    if (!G.Auth.current()) { save(); requireLogin('donate', 'donate.html' + route.search); return; }
    clearDraft('donate');
    // while presenting on this computer: Shift or Alt on the button shows the failed / pending screens
    const key = e.nativeEvent.submitter && e.nativeEvent.submitter.dataset.outcome;
    const outcome = G.present ? key || 'CAPTURED' : s.outcome;
    const wrong = check(s, { name: V.req, email: V.email, phone: V.phone, pan: V.pan });
    if (amount < 10) wrong.amount = true;
    setBad(wrong);
    if (!isOk(wrong)) { toast('Please fix the highlighted fields.', '⚠️'); return; }
    const d = { name: s.name.trim(), email: s.email.trim(), phone: s.phone.trim(), pan: s.pan.trim(), program: programName, amount, frequency: s.freq, method: s.method };
    setBusy(true);
    try {
      let rec;
      if (CFG.razorpayKey && CFG.apiBase) rec = await realCheckout(d);
      else { await new Promise((r) => setTimeout(r, 900)); rec = G.Donations.create(d, outcome); }
      openModal({ title: rec.status === 'CAPTURED' ? '🎉 Donation successful' : rec.status === 'FAILED' ? '⚠️ Payment failed' : '⏳ Payment pending', render: (close) => <Result rec={rec} close={close} /> });
      set({ pan: '' });
    } catch (err) {
      if (err.message === 'LOGIN_REQUIRED') requireLogin('donate', 'donate.html' + route.search); else toast(err.message || 'Payment could not start', '⚠️');
    }
    setBusy(false);
  };
  const presentOutcome = (e) => { if (G.present) e.currentTarget.dataset.outcome = e.shiftKey ? 'FAILED' : e.altKey ? 'PENDING' : 'CAPTURED'; };
  const demoBanner = !((CFG.razorpayKey && CFG.apiBase) || G.present);

  return (
    <>
      <PageHero title={t('page.donate')} lead="Every contribution helps us plant, protect and empower." />
      <section className="section"><div className="wrap"><div className="don-layout">
        <form id="donForm" className="card card-body" noValidate onSubmit={submit}>
          {demoBanner && (
            <div id="demoBanner" className="note" style={{ marginBottom: 14 }}><b>DEMO MODE</b> — no real money is charged and receipts are marked “demo”. Live payments go through Razorpay once the Foundation’s merchant keys are configured.
              <div style={{ marginTop: 6 }}>Test outcome: <select id="dOutcome" {...input('outcome')}><option value="CAPTURED">Success</option><option value="FAILED">Failure</option><option value="PENDING">Pending</option></select></div>
            </div>
          )}
          <div className="seg">
            <button type="button" className={s.freq === 'ONE_TIME' ? 'on' : ''} data-f="ONE_TIME" onClick={() => set({ freq: 'ONE_TIME' })}>{t('f.once')}</button>
            <button type="button" className={s.freq === 'MONTHLY' ? 'on' : ''} data-f="MONTHLY" onClick={() => set({ freq: 'MONTHLY' })}>🔁 <span>{t('f.monthly')}</span></button>
          </div>
          <div className="field" style={{ marginBottom: 12 }}><label>{t('f.program')}</label>
            <select id="dProgram" {...input('program')}>{programs.map((p) => <option key={p.id} value={p.id}>{p.icon + ' ' + tr(p.title)}</option>)}<option value="general">🌱 Where needed most</option></select></div>
          <div className={'field' + (bad.amount ? ' bad' : '')} id="amtField"><label>{t('f.amount')}</label>
            <div className="amt-grid">{AMOUNTS.map((a) => <button type="button" key={a} className={'amt' + (amount === a ? ' on' : '')} data-a={a} onClick={() => set({ amount: String(a) })}>{G.inr(a)}</button>)}</div>
            <input id="dAmount" type="number" min="10" placeholder="Other amount (min ₹10)" {...input('amount')} /><span className="err">Minimum donation is ₹10</span></div>
          <div className="f-grid" style={{ marginTop: 12 }}>
            <Field label={<><span>{t('f.name')}</span> *</>} error="Please enter your name" bad={bad.name}><input name="name" id="dName" autoComplete="name" {...input('name')} /></Field>
            <Field label={<><span>{t('f.phone')}</span> *</>} error="Enter a valid 10-digit mobile" bad={bad.phone}><input name="phone" id="dPhone" inputMode="tel" autoComplete="tel" {...input('phone')} /></Field>
            <Field label={<><span>{t('f.email')}</span> *</>} error="Enter a valid email" bad={bad.email}><input name="email" id="dEmail" type="email" autoComplete="email" {...input('email')} /></Field>
            <Field label={t('f.pan')} error="PAN format: 5 letters, 4 digits, 1 letter" bad={bad.pan}><input name="pan" id="dPan" maxLength={10} placeholder="ABCDE1234F" style={{ textTransform: 'uppercase' }} {...input('pan')} /></Field>
          </div>
          <div style={{ margin: '14px 0 6px', fontWeight: 700, fontSize: '.82rem' }}>Payment method</div>
          <div className="pay-opts">{METHODS.map(([m, text]) => <div key={m} className={'pay-opt' + (s.method === m ? ' on' : '')} data-m={m} role="button" tabIndex={0} onClick={() => set({ method: m })} onKeyDown={(e) => { if (e.key === 'Enter') set({ method: m }); }}>{text}</div>)}</div>
          <button className="btn btn-orange" id="dSubmit" type="submit" disabled={busy} onClick={presentOutcome} style={{ width: '100%', marginTop: 18, padding: 15, fontSize: '1.05rem' }}>
            {busy ? <><span className="spinner" /> Processing…</> : `💚 ${t('btn.donate')} ${G.inr(amount)}${s.freq === 'MONTHLY' ? ' / month' : ''}`}</button>
          <p style={{ fontSize: '.74rem', color: '#6b7280', marginTop: 10, textAlign: 'center' }}>🔒 Card and UPI details are entered only in the Razorpay checkout — never on our servers.</p>
        </form>
        <UpiCard s={s} programName={programName} save={save} clearSaved={() => clearDraft('donate')} setUtr={(utr) => set({ utr })} />
        <aside className="sticky"><div className="card card-body">
          <h4 style={{ color: 'var(--primary-dark)' }}>Your contribution</h4>
          <p id="dSummary" style={{ margin: '10px 0', fontSize: '.95rem' }}><b>{G.inr(amount)}</b>{' ' + (s.freq === 'MONTHLY' ? 'every month' : 'one-time') + ' → ' + label}</p>
          <ul style={{ listStyle: 'none', display: 'grid', gap: 8, fontSize: '.84rem', color: '#4b5563' }}><li>✓ Instant receipt with sequential number</li><li>✓ Add PAN to have it printed for 80G claims</li><li>✓ Monthly giving can be stopped anytime from your dashboard</li><li>✓ Problem with a payment? Report it in one click</li></ul>
        </div></aside>
      </div></div></section>
    </>
  );
}
