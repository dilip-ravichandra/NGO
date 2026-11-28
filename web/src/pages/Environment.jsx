/** "Save Environment" campaign: content from the Foundation's printed awareness brochure (see content/campaign.js). */
import { useState } from 'react';
import { G, t, tr } from '../lib/gigf.js';
import { A } from '../ui/nav.jsx';
import { PageHero, upcoming } from '../ui/common.jsx';
import { S, SLOGANS, PLEDGES, EFFECTS, BODY, STRAT } from '../content/campaign.js';

const tx = (o) => (o && (o[G.lang()] || o.en)) || '';
const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } } };
const article = (id) => G.DB.get('articles', id) || (G.envArticles || []).find((a) => a.id === id);
const paragraphs = (id) => { const a = article(id); if (!a) return []; const b = a.body; return Array.isArray(b) ? b : (b && (b[G.lang()] || b.en)) || []; };
const Medical = () => <p className="env-note">{'⚠️ ' + tx(S.med)}</p>;

function Confetti({ on }) {
  const [pieces] = useState(() => Array.from({ length: 18 }, (_, i) => ({ leaf: ['🍃', '🌿', '🍀', '🌳'][i % 4], style: { left: (10 + Math.random() * 80) + '%', '--x': ((Math.random() - 0.5) * 220) + 'px', '--r': (Math.random() * 360) + 'deg', animationDelay: (Math.random() * 0.3) + 's' } })));
  if (!on || document.documentElement.classList.contains('no-motion')) return null;
  return pieces.map((p, i) => <span key={i} className="confetti" style={p.style}>{p.leaf}</span>);
}

function Pledges() {
  const [done, setDone] = useState(() => store.get('gigf_pledges', []));
  const [open, setOpen] = useState({});
  const n = done.length, C = 2 * Math.PI * 34;
  const pick = (id, on) => { const next = on ? Array.from(new Set(done.concat(id))) : done.filter((x) => x !== id); setDone(next); store.set('gigf_pledges', next); };
  const share = `${tx(S.hPledge)}: ${PLEDGES.filter((p) => done.includes(p.id)).map((p) => tx(p.t)).join(' • ')}\n${G.ORG.name} — ${location.href.split('#')[0]}`;
  return (
    <section className="section" id="pledge"><div className="wrap">
      <div className="section-head"><div><h3 id="hPledge">{tx(S.hPledge)}</h3><p id="pledgeSub" style={{ color: '#6b7280', marginTop: 6 }}>{tx(S.pledgeSub)}</p></div></div>
      <div id="envPledges">{PLEDGES.map((p, i) => (
        <article key={p.id} className={'pledge-card reveal' + (done.includes(p.id) ? ' done' : '') + (open[p.id] ? ' open' : '')} style={{ '--d': i * 90 + 'ms' }} data-id={p.id}>
          <button type="button" className="pl-face" aria-expanded={!!open[p.id]} data-flip="" onClick={() => setOpen((o) => ({ ...o, [p.id]: !o[p.id] }))}><span className="pl-ico">{p.icon}</span><b>{tx(p.t)}</b><small>{tx(S.tip) + ' ▾'}</small></button>
          <div className="pl-tip">{'💡 ' + tx(p.tip)}</div>
          <label className="pl-check"><input type="checkbox" checked={done.includes(p.id)} data-pick={p.id} onChange={(e) => pick(p.id, e.target.checked)} /><span>{tx(S.iPledge)}</span></label>
        </article>
      ))}</div>
      <div id="envPledgeBar">
        <div className="pledge-bar reveal">
          <svg className="ring" viewBox="0 0 80 80" width="84" height="84" aria-hidden="true">
            <circle cx="40" cy="40" r="34" fill="none" stroke="#e5e7eb" strokeWidth="8" />
            <circle cx="40" cy="40" r="34" fill="none" stroke="#16a34a" strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - n / PLEDGES.length)} transform="rotate(-90 40 40)" style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.25,.8,.35,1)' }} />
            <text x="40" y="46" textAnchor="middle" fontSize="22" fontWeight="800" fill="#0f4d2a">{n + '/5'}</text>
          </svg>
          <div><b>{n + ' ' + tx(S.pledged)}</b><div className="pl-msg">{n === PLEDGES.length ? tx(S.thanks) : ''}</div>
            {n > 0 && <a className="btn btn-primary btn-sm" target="_blank" rel="noopener" href={'https://wa.me/?text=' + encodeURIComponent(share)}>{'💬 ' + tx(S.share)}</a>}</div>
        </div>
        <Confetti on={n === PLEDGES.length} />
      </div>
    </div></section>
  );
}

function Health() {
  const [tab, setTab] = useState('short');
  return (
    <section className="section alt" id="envHealth"><div className="wrap">
      <div className="section-head"><h3 id="hHealth">{tx(S.hHealth)}</h3></div>
      <div id="envHealthBody">
        <div className="tabs env-tabs" role="tablist">{['short', 'long'].map((k) => <button type="button" key={k} className={'tab ' + (tab === k ? 'on' : '')} role="tab" data-t={k} onClick={() => setTab(k)}>{(k === 'short' ? '⚡' : '⏳') + ' ' + tx(S[k])}</button>)}</div>
        <div className="eff-grid">{EFFECTS[tab].map(([icon, name], k) => <div key={tab + k} className="eff reveal" style={{ '--d': k * 80 + 'ms' }}><span>{icon}</span><b>{tx(name)}</b></div>)}</div>
        <Medical />
      </div>
    </div></section>
  );
}

function Covid() {
  const [sel, setSel] = useState('lungs');
  const g = BODY.find((b) => b.id === sel);
  return (
    <section className="section" id="envCovid" hidden><div className="wrap">
      <div className="section-head"><div><h3 id="hCovid">{tx(S.hCovid)}</h3><p id="covidSub" style={{ color: '#6b7280', marginTop: 6 }}>{tx(S.covidSub)}</p></div></div>
      <div id="envCovidBody">
        <div className="flow"><div className="flow-box f1"><span>🏭</span>{tx(S.fAir)}</div><span className="flow-arrow">➜</span><div className="flow-box f2"><span>⚠️</span>{tx(S.fImp)}</div><span className="flow-arrow">➜</span><div className="flow-box f3"><span>🦠</span>{tx(S.fCov)}</div></div>
        <div className="body-pills" role="tablist">{BODY.map((b) => <button type="button" key={b.id} className={'pill ' + (b.id === sel ? 'on' : '')} role="tab" data-b={b.id} onClick={() => setSel(b.id)}>{b.icon + ' ' + tx(b.n)}</button>)}</div>
        <div className="body-out"><div className="body-ico">{g.icon}</div><div><h4>{tx(g.n)}</h4><ul>{g.items.map((i, k) => <li key={k}>{tx(i)}</li>)}</ul></div></div>
        <Medical />
      </div>
    </div></section>
  );
}

function Strategies() {
  const [on, setOn] = useState(() => store.get('gigf_strat', []));
  const pct = Math.round((on.length / STRAT.length) * 100);
  const flip = (i, checked) => { const next = checked ? Array.from(new Set(on.concat(i))) : on.filter((x) => x !== i); setOn(next); store.set('gigf_strat', next); };
  return (
    <section className="section" id="envStrat" hidden><div className="wrap">
      <div className="section-head"><div><h3 id="hStrat">{tx(S.hStrat)}</h3><p id="stratSub" style={{ color: '#6b7280', marginTop: 6 }}>{tx(S.stratSub)}</p></div></div>
      <div id="envStratBody">
        <div className="bar" aria-label={pct + '%'}><i style={{ width: pct + '%' }} /></div>
        <ul className="strat">{STRAT.map((s, i) => <li key={i} className={'reveal ' + (on.includes(i) ? 'on' : '')} style={{ '--d': i * 60 + 'ms' }}><label><input type="checkbox" data-s={i} checked={on.includes(i)} onChange={(e) => flip(i, e.target.checked)} /><span className="bx" /><span>{tx(s)}</span></label></li>)}</ul>
      </div>
    </div></section>
  );
}

export default function Environment() {
  const message = paragraphs('only-one-earth');
  const drive = upcoming().filter((e) => e.program === 'tree')[0];
  const brochureShare = `${tx(S.hBro)} — ${location.href.split('#')[0]}`;
  return (
    <>
      <PageHero title={t('page.environment')} lead={tx(S.lead)} />
      <section className="section" id="envMessage"><div className="wrap"><div id="envMsg"><div className="env-msg-grid">
        <div className="card env-essay reveal"><div className="section-head" style={{ marginBottom: 10 }}><h3>{tx(S.hMessage)}</h3></div>
          {message.map((p, i) => <p key={i}>{p}</p>)}
          <blockquote className="env-quote">{'“' + tx(S.unity) + '”'}</blockquote></div>
        <div className="env-side reveal"><img src="assets/about_natural_sprout.jpg" alt="Hands holding a young plant" loading="lazy" /><div className="env-who">{tx(S.who)}</div><div className="env-resp">{'🌿 ' + tx(S.resp)}</div></div>
      </div></div></div></section>
      <section className="section alt" id="envSlogans"><div className="wrap"><div id="envSlog"><ul className="env-slogans">{SLOGANS.map((s, i) => <li key={i} className="reveal" style={{ '--d': i * 110 + 'ms' }}><span className="sq" /><b>{tx(s)}</b></li>)}</ul></div></div></section>
      <Pledges />
      <Health />
      <Covid />
      <section className="section alt" id="envTrees"><div className="wrap"><div id="envTreesBody"><div className="trees-card reveal"><div className="trees-ico">🌳</div><div style={{ flex: 1 }}>
        <h3>{tx(S.hTrees)}</h3>
        {paragraphs('trees-and-clean-air').slice(0, 2).map((p, i) => <p key={i}>{p}</p>)}
        {drive && <p className="env-next">📅 <A to={'events.html#' + drive.slug}>{tr(drive.title) + ' — ' + G.fmtDate(drive.date)}</A></p>}
        <div className="cta-row"><A className="btn btn-primary" to="events.html">{'📅 ' + tx(S.ctaEv)}</A><A className="btn btn-ghost" to="volunteer.html?program=tree">{'🤝 ' + tx(S.ctaVol)}</A><A className="btn btn-orange" to="donate.html?program=tree">{'💚 ' + tx(S.ctaDon)}</A></div>
      </div></div></div></div></section>
      <Strategies />
      <section className="section alt" id="envBrochure"><div className="wrap"><div id="envBro">
        <div className="bro-card reveal"><div className="bro-ico">📄</div><div style={{ flex: 1 }}><h3>{tx(S.hBro)}</h3><p>{tx(S.broSub)}</p></div>
          <div className="cta-row" style={{ margin: 0 }}><a className="btn btn-primary" href="assets/Green-India-Gokul-Awareness-Brochure.pdf" download>{'⬇ ' + tx(S.dl)}</a><a className="btn btn-ghost" target="_blank" rel="noopener" href={'https://wa.me/?text=' + encodeURIComponent(brochureShare)}>{'💬 ' + tx(S.shareP)}</a></div></div>
        <p className="bro-contact">{'📍 ' + G.ORG.address}<br />📞 {G.ORG.phones.map((p, i) => <span key={p.tel}>{i > 0 && ' · '}<a href={'tel:' + p.tel}>{p.display}</a></span>)} · ✉️ <a href={'mailto:' + G.ORG.email}>{G.ORG.email}</a></p>
      </div></div></section>
    </>
  );
}
