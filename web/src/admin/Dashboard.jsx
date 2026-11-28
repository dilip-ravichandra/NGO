import { G } from '../lib/gigf.js';

function attentionItems() {
  const D = G.DB, au = G.auto(), items = [];
  const s = (n) => (n > 1 ? 's' : '');
  const open = D.all('tickets').filter((t) => t.status !== 'RESOLVED');
  const pay = open.filter((t) => t.category === 'PAYMENT_ISSUE'); if (pay.length) items.push({ ico: '💳', text: `${pay.length} payment issue${s(pay.length)} need you`, go: 'issues', hot: true });
  const claims = D.all('donations').filter((d) => d.status === 'PENDING' && d.source === 'UPI_DIRECT'); if (claims.length) items.push({ ico: '🔎', text: `${claims.length} UPI payment${s(claims.length)} to verify`, go: 'donations', hot: true });
  const pend = D.all('donations').filter((d) => d.status === 'PENDING' && !d.autoFlagged); if (pend.length) items.push({ ico: '⏳', text: `${pend.length} payment${s(pend.length)} pending (auto-flagged after ${au.stuckMinutes} min)`, go: 'donations' });
  const human = open.filter((t) => t.category !== 'PAYMENT_ISSUE' && (!t.ai || t.ai.needsHuman)); if (human.length) items.push({ ico: '🎫', text: `${human.length} message${s(human.length)} the AI could not settle`, go: 'issues' });
  const drafts = D.all('events').filter((e) => e.status === 'DRAFT'); if (drafts.length) items.push({ ico: '📅', text: `${drafts.length} AI event draft${s(drafts.length)} waiting to publish`, go: 'events' });
  const vols = D.all('volunteers').filter((v) => v.status === 'PENDING'); if (vols.length && !au.autoApproveVolunteers) items.push({ ico: '🤝', text: `${vols.length} volunteer application${s(vols.length)} to review`, go: 'volunteers' });
  return items;
}

function Attention({ goTo }) {
  const au = G.auto(), items = attentionItems();
  const on = (b) => (b ? <span className="chip">ON</span> : <span className="chip gray">OFF</span>);
  return (
    <div className={'card card-body attention ' + (items.length ? 'hot' : 'calm')} style={{ margin: '14px 0' }}>
      <h4>{items.length ? '🔔 Needs your attention' : '✅ Nothing needs you right now'}</h4>
      {items.length ? items.map((i) => <div key={i.text} className="att-row"><span>{i.ico + ' ' + i.text}</span><button type="button" className={'btn ' + (i.hot ? 'btn-orange' : 'btn-ghost') + ' btn-sm'} onClick={() => goTo(i.go)}>Open →</button></div>)
        : <p style={{ color: '#166534', margin: '6px 0' }}>Receipts, translations, stuck-payment checks and routine replies run by themselves. You only get involved for payment problems.</p>}
      <div className="auto-chips"><span>🌐 Auto-translate {on(au.autoTranslate)}</span><span>🧾 Auto receipts <span className="chip">ON</span></span><span>💳 Stuck-payment watch {on(au.flagStuckPayments)}</span><span>🤖 Auto-reply to simple questions {on(au.autoReplyRoutine)}</span><span>🤝 Auto-approve volunteers {on(au.autoApproveVolunteers)}</span><span>📅 AI event intake <span className="chip blue">ready</span></span></div>
    </div>
  );
}

export default function Dashboard({ goTo }) {
  const D = G.DB, don = D.all('donations').filter((d) => d.status === 'CAPTURED'), now = new Date();
  const sum = (a) => a.reduce((x, d) => x + d.amount, 0);
  const thisMonth = don.filter((d) => new Date(d.createdAt).getMonth() === now.getMonth() && new Date(d.createdAt).getFullYear() === now.getFullYear());
  const openT = D.all('tickets').filter((t) => t.status !== 'RESOLVED'), openPay = openT.filter((t) => t.category === 'PAYMENT_ISSUE');
  const byProg = {};
  don.forEach((d) => { byProg[d.program] = (byProg[d.program] || 0) + d.amount; });
  const max = Math.max(1, ...Object.values(byProg));
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1); return { k: d.getFullYear() + '-' + d.getMonth(), l: d.toLocaleString('en', { month: 'short' }), v: 0 }; });
  don.forEach((d) => { const x = new Date(d.createdAt), m = months.find((mm) => mm.k === x.getFullYear() + '-' + x.getMonth()); if (m) m.v += d.amount; });
  const mmax = Math.max(1, ...months.map((m) => m.v));
  const vols = D.all('volunteers');
  const stats = [
    [G.inr(sum(don)), `Total donations (${don.length})`], [G.inr(sum(thisMonth)), 'This month'],
    [vols.filter((v) => v.status === 'APPROVED').length, 'Active volunteers'], [vols.filter((v) => v.status === 'PENDING').length, 'Pending volunteers'],
    [D.all('registrations').length, 'Event registrations'], [openPay.length, 'Open payment issues', openPay.length > 0],
    [openT.length, 'Unresolved inquiries'], [D.all('events').filter((e) => e.status === 'UPCOMING').length, 'Upcoming events']
  ];
  return (
    <>
      <h3>Executive overview</h3>
      <Attention goTo={goTo} />
      <div className="kpi" style={{ marginTop: 14 }}>{stats.map(([v, label, hot]) => <div key={label} className="stat" style={hot ? { borderColor: '#fca5a5' } : undefined}><b style={hot ? { color: '#dc2626' } : undefined}>{v}</b><span>{label}</span></div>)}</div>
      <div className="grid g2">
        <div className="card card-body"><h4>Donations — last 6 months</h4><div className="chart">{months.map((m) => <div key={m.k} className="col"><b>{m.v ? G.inr(m.v) : ''}</b><i style={{ height: Math.round((m.v / mmax) * 100) + '%' }} /><span>{m.l}</span></div>)}</div></div>
        <div className="card card-body"><h4>Donations by programme</h4>
          {Object.keys(byProg).length ? Object.entries(byProg).map(([k, v]) => <div key={k} style={{ margin: '10px 0' }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem' }}><span>{k}</span><b>{G.inr(v)}</b></div><div className="bar"><i style={{ width: (v / max) * 100 + '%' }} /></div></div>) : <p style={{ color: '#6b7280', marginTop: 10 }}>No captured donations yet.</p>}</div>
      </div>
    </>
  );
}
