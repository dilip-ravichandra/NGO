import { useEffect, useState } from 'react';
import { G, t, tr } from '../lib/gigf.js';
import { A } from '../ui/nav.jsx';
import { PageHero, programsSorted, upcoming, scrollToId, INLINE_IMG } from '../ui/common.jsx';

const picture = (u) => (INLINE_IMG.test(u || '') ? u : G.safeUrl(u, ''));

function Media({ p }) {
  const photos = (p.photos || []).map(picture).filter(Boolean), videos = (p.videos || []).map((u) => G.safeUrl(u, '')).filter(Boolean);
  if (!photos.length && !videos.length) return null;
  return (
    <div className="prog-media">
      {photos.map((u, i) => <img key={i} src={u} alt={tr(p.title)} loading="lazy" />)}
      {videos.map((u) => (/^(?!https?:).*\.mp4$/i.test(u)
        ? <video key={u} src={u + '#t=0.6'} controls preload="metadata" playsInline />
        : <a key={u} className="link-more" href={u} target="_blank" rel="noopener">▶ Watch video</a>))}
    </div>
  );
}

function Card({ p, open, toggle }) {
  const events = upcoming().filter((e) => e.program === p.id).slice(0, 2);
  return (
    <article className={'card lift prog-card reveal' + (open ? ' open' : '')} id={p.slug} data-id={p.id}>
      <div className="img" style={{ backgroundImage: `url('${picture(p.img)}')` }}><span className="ico">{p.icon}</span></div>
      <div className="card-body">
        <h4>{tr(p.title)}</h4><p>{tr(p.tagline)}</p>
        <div className="prog-detail">
          <p style={{ color: '#374151', marginBottom: 8 }}>{tr(p.desc)}</p>
          <ul>{(p.initiatives || []).map((i, k) => <li key={k}>{tr(i)}</li>)}</ul>
          <Media p={p} />
          {p.impact && p.impact.length > 0 && <div className="impact-row">{p.impact.map((m, k) => <span key={k}><b>{m.value}</b> {m.label}</span>)}</div>}
          {events.length > 0 && (
            <div style={{ fontSize: '.82rem', margin: '8px 0' }}><b>{'📅 ' + t('home.events') + ':'}</b>{' '}
              {events.map((e, k) => <span key={e.id}>{k > 0 && ', '}<A to={'events.html#' + e.slug}>{tr(e.title) + ' (' + G.fmtDate(e.date, { day: 'numeric', month: 'short' }) + ')'}</A></span>)}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><A className="btn btn-orange btn-sm" to={'donate.html?program=' + p.id}>{'💚 ' + t('btn.donateprog')}</A><A className="btn btn-primary btn-sm" to={'volunteer.html?program=' + p.id}>{'🤝 ' + t('btn.volprog')}</A></div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" data-toggle="" onClick={toggle} style={{ marginTop: 12, alignSelf: 'flex-start' }}>{t('btn.know') + ' →'}</button>
      </div>
    </article>
  );
}

export default function Programs({ route }) {
  const [open, setOpen] = useState({});
  useEffect(() => {
    const id = route.anchor;
    if (id && programsSorted().some((p) => p.slug === id)) { setOpen((o) => ({ ...o, [id]: true })); scrollToId(id, 150); }
  }, [route]);
  return (
    <>
      <PageHero title={t('page.programs')} lead="Six focus areas — tap any card to read more, donate or volunteer." />
      <section className="section"><div className="wrap"><div className="grid g3" id="progGrid">
        {programsSorted().map((p) => <Card key={p.id} p={p} open={!!open[p.slug]} toggle={() => setOpen((o) => ({ ...o, [p.slug]: !o[p.slug] }))} />)}
      </div></div></section>
    </>
  );
}
