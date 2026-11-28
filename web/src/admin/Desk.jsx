/** Payment issues & inquiries (with AI triage), and the "messages to send" list with the newsletter. */
import { useRef } from 'react';
import { G, CFG, tr } from '../lib/gigf.js';
import { openModal, toast } from '../ui/feedback.jsx';
import { Empty, upcoming } from '../ui/common.jsx';
import { Table, Btn, Chip, useSticky, aiPost, aiMsg } from './shared.jsx';

const KINDS = { PAYMENT_ISSUE: '💳 Payment', CONTACT: '✉️ Contact', CHAT_ESCALATION: '🤖 Chat' };
const AiChip = ({ ai }) => <span className={'chip ' + (ai.needsHuman ? 'warn' : '')}>{ai.intent}</span>;
const chatContext = () => ({ programs: G.DB.all('programs').filter((p) => p.active).map((p) => tr(p.title) + ': ' + tr(p.tagline) + ' ' + tr(p.desc)), events: upcoming().slice(0, 6).map((e) => ({ title: tr(e.title), date: e.date, location: e.location })) });

export async function runTriage(force) {
  const open = G.DB.all('tickets').filter((t) => t.status !== 'RESOLVED' && t.category !== 'PAYMENT_ISSUE' && (force || !t.ai)).slice(0, 8);
  if (!open.length) { if (force) toast('No open messages to triage.', 'ℹ️'); return 0; }
  const r = await aiPost(CFG.triageApi || '/api/triage', { tickets: open.map((t) => ({ id: t.id, category: t.category, subject: t.subject, message: t.message })), context: chatContext() });
  if (r.status !== 200) { if (force) toast(aiMsg(r), '⚠️'); return 0; }
  let auto = 0;
  (r.results || []).forEach((x) => {
    const t = G.DB.get('tickets', x.id);
    if (!t) return;
    G.DB.update('tickets', x.id, { ai: { intent: x.intent, needsHuman: x.needsHuman, confidence: x.confidence, draftReply: x.draftReply, at: new Date().toISOString() } });
    G.audit('AI_TRIAGE', 'ticket', x.id, `${x.intent} · ${x.needsHuman ? 'needs human' : 'AI can answer'} · ${Math.round(x.confidence * 100)}%`);
    if (!G.auto().autoReplyRoutine || t.category === 'PAYMENT_ISSUE') return;
    if (x.intent === 'spam' && x.confidence >= 0.9) {   // obvious spam is closed quietly (kept in the log, never answered)
      G.DB.update('tickets', x.id, { status: 'RESOLVED', resolvedAt: new Date().toISOString(), notes: (t.notes || []).concat('Closed automatically: identified as spam by the AI.') });
      G.audit('AI_SPAM_CLOSED', 'ticket', x.id, Math.round(x.confidence * 100) + '% sure'); auto++;
    } else if (!x.needsHuman && x.confidence >= 0.85 && x.draftReply) {
      G.DB.update('tickets', x.id, { status: 'RESOLVED', resolvedAt: new Date().toISOString(), replies: (t.replies || []).concat({ by: 'Foundation (AI assistant)', text: x.draftReply, at: new Date().toISOString(), ai: true }) });
      G.audit('AI_AUTO_REPLY', 'ticket', x.id, 'resolved automatically'); auto++;
    }
  });
  if (force) toast(auto ? `${auto} message(s) answered automatically; the rest are marked for you.` : 'Messages triaged. Open one to see the AI draft.', '🤖');
  return auto;
}

function Ticket({ id, close }) {
  const t = G.DB.get('tickets', id);
  const d = t.donationId ? G.DB.get('donations', t.donationId) : null;
  const reply = useRef(null);
  const sync = () => toast(d.demo ? 'Demo record — live status sync needs the backend Razorpay API. Current: ' + d.status : 'Syncing…', '🔄');
  const resend = () => {
    if (d.status !== 'CAPTURED') return toast('Only captured payments have receipts.', 'ℹ️');
    G.Donations.issueReceipt(d.id); G.audit('RECEIPT_REISSUE', 'donation', d.id); G.Donations.openReceipt(d.id); toast('Receipt regenerated (email sending needs the backend)', '📧');
  };
  const refund = () => {
    const n = prompt('Resolution / refund note:');
    if (!n) return;
    G.DB.update('tickets', id, { notes: (t.notes || []).concat('Refund/resolution: ' + n) }); G.audit('REFUND_LOG', 'ticket', id, n);
  };
  const submit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target), patch = { status: f.get('st'), assignedTo: f.get('as') };
    if (f.get('reply').trim()) patch.replies = (t.replies || []).concat({ by: 'Foundation', text: f.get('reply').trim(), at: new Date().toISOString() });
    if (f.get('note').trim()) patch.notes = (t.notes || []).concat(f.get('note').trim());
    if (patch.status === 'RESOLVED') patch.resolvedAt = new Date().toISOString();
    G.DB.update('tickets', id, patch); G.audit('TICKET_' + patch.status, 'ticket', id); close(); toast('Ticket updated', '✅');
  };
  const box = { marginBottom: 12 };
  return (
    <>
      <p style={{ fontSize: '.84rem' }}><b>{t.name}</b>{` · ${t.email || ''} ${t.phone || ''} · ${G.fmtDate(t.createdAt)} `}<Chip s={t.status} /></p>
      <div className="note green" style={{ margin: '10px 0' }}>{t.message}</div>
      {t.ai && (
        <div className="card card-body" style={{ ...box, borderColor: '#bfdbfe' }}><b>🤖 AI view</b> <AiChip ai={t.ai} /> <small>{`${t.ai.needsHuman ? 'needs a human' : 'AI can answer'} · ${Math.round(t.ai.confidence * 100)}% sure`}</small>
          {t.ai.draftReply && <><div className="note" style={{ margin: '8px 0' }}>{t.ai.draftReply}</div><button type="button" className="btn btn-ghost btn-sm" onClick={() => { reply.current.value = t.ai.draftReply; }}>↧ Use this draft as my reply</button></>}</div>
      )}
      {d && (
        <div className="card card-body" style={box}><b>Linked donation</b><br /><span>{`${G.inr(d.amount)} · ${d.program} · `}<Chip s={d.status} /> · order <code>{d.orderId}</code>{d.receiptNo ? ' · ' + d.receiptNo : ''}</span>
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}><Btn onClick={sync}>🔄 Sync status with Razorpay</Btn><Btn onClick={resend}>📧 Re-generate / re-send receipt</Btn><Btn onClick={refund}>↩ Log refund / resolution</Btn></div></div>
      )}
      {(t.replies || []).map((r, i) => <div key={i} className="note" style={{ marginBottom: 6 }}><b>{r.by}</b>{` (${G.fmtDate(r.at)}): ${r.text}`}</div>)}
      {(t.notes || []).map((n, i) => <div key={i} className="note" style={{ marginBottom: 6, background: '#f1f5f9', borderColor: '#cbd5e1', color: '#334155' }}>{'🔒 Internal: ' + n}</div>)}
      <form id="tkForm" className="f-grid" style={{ marginTop: 10 }} onSubmit={submit}>
        <div className="field f-full"><label>{`Reply to ${t.name} (emails donor & appears in their dashboard)`}</label><textarea name="reply" rows="3" ref={reply} /></div>
        <div className="field"><label>Internal note</label><input name="note" /></div>
        <div className="field"><label>Status</label><select name="st" defaultValue={t.status}>{['OPEN', 'IN_PROGRESS', 'RESOLVED'].map((s) => <option key={s}>{s}</option>)}</select></div>
        <div className="field"><label>Assign to</label><input name="as" defaultValue={t.assignedTo || ''} placeholder="staff name" /></div>
        <button className="btn btn-primary f-full" type="submit">Save</button>
      </form>
    </>
  );
}

const openTicket = (id) => { const t = G.DB.get('tickets', id); openModal({ wide: true, title: `${t.no} · ${t.subject}`, render: (close) => <Ticket id={id} close={close} /> }); };

export function Issues() {
  const [f, setF] = useSticky('tickets', 'OPEN_ALL');
  const rows = G.DB.all('tickets').filter((t) => (f === 'OPEN_ALL' ? t.status !== 'RESOLVED' : f === 'ALL' ? true : t.category === f));
  const triage = async () => { toast('The AI is reading the open messages…', '🤖'); await runTriage(true); };
  return (
    <>
      <div className="toolbar"><h3 style={{ flex: 1 }}>Payment issues & inquiries desk</h3><Btn kind="btn-orange" onClick={triage}>🤖 AI triage open messages</Btn></div>
      <div className="filters">{[['OPEN_ALL', 'Open'], ['PAYMENT_ISSUE', '💳 Payment issues'], ['CONTACT', '✉️ Contact'], ['CHAT_ESCALATION', '🤖 Chat escalations'], ['ALL', 'All']].map(([key, label]) => <button type="button" key={key} className={'pill ' + (f === key ? 'on' : '')} onClick={() => setF(key)}>{label}</button>)}</div>
      <Table
        cols={[['no', 'Ticket'], [(r) => KINDS[r.category] || r.category, 'Type'], [(r) => <>{r.name}<br /><small>{r.email || r.phone}</small></>, 'From'], [(r) => <><b>{r.subject}</b><br /><small>{String(r.message || '').slice(0, 110)}</small></>, 'Message'], [(r) => <Chip s={r.status} />, 'Status'],
          [(r) => (r.ai ? <><AiChip ai={r.ai} /><br /><small>{`${r.ai.needsHuman ? 'needs a human' : 'AI can answer'} · ${Math.round(r.ai.confidence * 100)}%`}</small></> : r.category === 'PAYMENT_ISSUE' ? <small>always human</small> : '—'), 'AI'], [(r) => G.fmtDate(r.createdAt), 'Raised']]}
        rows={rows}
        actions={(r) => <Btn kind="btn-primary" onClick={() => openTicket(r.id)}>Open</Btn>}
      />
    </>
  );
}

const subscribers = () => Array.from(new Set(G.DB.all('subscribers').map((x) => String(x.email || '').toLowerCase()).filter((e) => /^\S+@\S+\.\S+$/.test(e))));

function Newsletter() {
  const subs = subscribers();
  const copy = () => navigator.clipboard.writeText(subs.join(', ')).then(() => toast('Addresses copied', '📋'));
  const prepare = (e) => {
    e.preventDefault();
    const subject = e.target.elements.subject.value.trim(), body = e.target.elements.body.value.trim();
    if (!subject || !body) return toast('Write a subject and a message.', '⚠️');
    const text = body + '\n\n' + G.ORG.name + '\nTo stop receiving these, reply with the word STOP.';
    if (subs.length > 40) { navigator.clipboard.writeText(subs.join(', ')); toast('Many addresses: they are copied. Paste them into BCC.', '📋'); }
    location.href = `mailto:?${subs.length > 40 ? '' : 'bcc=' + subs.map(encodeURIComponent).join(',').replace(/%40/g, '@') + '&'}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    G.audit('NEWSLETTER_PREPARED', 'newsletter', '', subs.length + ' address(es)');
  };
  return (
    <div className="card card-body" style={{ marginTop: 16 }}>
      <h4>📰 Newsletter</h4>
      <p style={{ fontSize: '.84rem', color: '#4b5563', margin: '4px 0 8px' }}><b>{subs.length}</b>{` subscriber${subs.length === 1 ? '' : 's'}. Addresses go in BCC so people cannot see each other. Send only to people who signed up.`}</p>
      <form id="newsLetter" className="f-grid" onSubmit={prepare}>
        <div className="field f-full"><label>Subject</label><input name="subject" maxLength={150} /></div>
        <div className="field f-full"><label>Message</label><textarea name="body" rows="5" maxLength={1500} /></div>
        <div className="f-full" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="btn btn-primary btn-sm" type="submit" disabled={!subs.length}>✉️ Open in my email</button><button type="button" className="btn btn-ghost btn-sm" id="subCopy" disabled={!subs.length} onClick={copy}>Copy addresses</button></div>
      </form>
    </div>
  );
}

export function Outbox() {
  const [f, setF] = useSticky('out', { show: 'WAITING', kind: 'ALL' });
  const done = G.notify.sent(), all = G.notify.messages();
  const rows = all.filter((m) => (f.show === 'ALL' || !done.has(m.key)) && (f.kind === 'ALL' || m.kind === f.kind));
  const [, redraw] = useSticky('outTick', 0);
  const mark = (key) => { G.notify.markSent(key); G.audit('MESSAGE_SENT', 'message', key.slice(0, 40)); setTimeout(() => redraw((x) => x + 1), 300); };
  return (
    <>
      <h3 style={{ marginBottom: 6 }}>Messages to send</h3>
      <p style={{ color: '#4b5563', fontSize: '.86rem', marginBottom: 10 }}>Written for you. Press Email or WhatsApp, check it, and send. {done.size ? done.size + ' marked as sent.' : ''}</p>
      <div className="toolbar">
        <select id="outShow" className="search" style={{ flex: '0 1 180px' }} value={f.show} onChange={(e) => setF({ ...f, show: e.target.value })}><option value="WAITING">Not sent yet</option><option value="ALL">All</option></select>
        <select id="outKind" className="search" style={{ flex: '0 1 220px' }} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="ALL">All kinds</option>{Array.from(new Set(all.map((m) => m.kind))).map((k) => <option key={k}>{k}</option>)}</select>
      </div>
      {rows.length ? rows.slice(0, 100).map((m) => {
        const l = G.notify.links(m);
        return (
          <div key={m.key} className="card card-body out-row">
            <div><span className="chip">{m.kind}</span> <b>{m.name}</b> <small>{m.email + ' ' + m.phone}</small><div className="out-sub">{m.subject}</div><details><summary>Read the message</summary><pre>{m.body}</pre></details></div>
            <div className="out-act">
              {l.mail && <a className="btn btn-primary btn-sm" href={l.mail} onClick={() => mark(m.key)}>✉️ Email</a>}
              {l.wa && <a className="btn btn-ghost btn-sm" target="_blank" rel="noopener" href={l.wa} onClick={() => mark(m.key)}>💬 WhatsApp</a>}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => mark(m.key)}>{done.has(m.key) ? '✔ Sent' : 'Mark sent'}</button>
            </div>
          </div>
        );
      }) : <Empty icon="✅">Nothing is waiting to be sent.</Empty>}
      <Newsletter />
    </>
  );
}
