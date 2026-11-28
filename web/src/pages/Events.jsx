import { useEffect, useState } from 'react';
import { G, t, tr } from '../lib/gigf.js';
import { A } from '../ui/nav.jsx';
import { PageHero, Empty, progById, scrollToId, INLINE_IMG } from '../ui/common.jsx';
import { EventCard, openRegister } from '../ui/cards.jsx';

function Calendar({ events, month, setMonth, pick }) {
  const y = month.getFullYear(), m = month.getMonth(), first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate(), today = G.today();
  return (
    <div className="cal">
      <div className="cal-head"><button type="button" className="btn btn-ghost btn-sm" id="calPrev" onClick={() => setMonth(new Date(y, m - 1, 1))}>‹</button><b>{month.toLocaleString('en', { month: 'long', year: 'numeric' })}</b><button type="button" className="btn btn-ghost btn-sm" id="calNext" onClick={() => setMonth(new Date(y, m + 1, 1))}>›</button></div>
      <div className="cal-grid">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={'h' + i} className="cal-dow">{d}</div>)}
        {Array.from({ length: first }, (_, k) => <div key={'e' + k} className="cal-day dim" />)}
        {Array.from({ length: days }, (_, k) => {
          const date = `${y}-${String(m + 1).padStart(2, '0')}-${String(k + 1).padStart(2, '0')}`;
          return (
            <div key={date} className={'cal-day' + (date === today ? ' today' : '')}><span className="d">{k + 1}</span>
              {events.filter((e) => e.date === date).map((e) => <button type="button" key={e.id} className="cal-ev" title={tr(e.title)} onClick={() => pick(e)}>{tr(e.title)}</button>)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Events({ route }) {
  const [view, setView] = useState('list');
  const [program, setProgram] = useState('all');
  const [month, setMonth] = useState(new Date(2026, 11, 1));

  useEffect(() => {
    const reg = new URLSearchParams(route.search).get('reg');
    if (reg && G.Auth.current() && G.DB.get('events', reg)) {
      history.replaceState(null, '', '#events');
      scrollToId(G.DB.get('events', reg).slug, 300);
      const timer = setTimeout(() => openRegister(reg), 500);
      return () => clearTimeout(timer);
    }
    if (route.anchor) scrollToId(route.anchor, 200);
    return undefined;
  }, [route]);

  const all = G.DB.all('events').filter((e) => program === 'all' || e.program === program).sort((a, b) => a.date.localeCompare(b.date));
  const up = all.filter((e) => e.status === 'UPCOMING'), past = all.filter((e) => e.status === 'COMPLETED');
  const pick = (e) => { setView('list'); scrollToId(e.slug, 100); };
  return (
    <>
      <PageHero title={t('page.events')} lead="Register for upcoming events or book a volunteer slot." />
      <section className="section"><div className="wrap">
        <div className="toolbar" style={{ justifyContent: 'space-between' }}>
          <div className="filters" id="evFilters" style={{ margin: 0 }}>
            <button type="button" className={'pill' + (program === 'all' ? ' on' : '')} onClick={() => setProgram('all')}>{t('f.all')}</button>
            {G.DB.all('programs').map((p) => <button type="button" key={p.id} className={'pill' + (program === p.id ? ' on' : '')} onClick={() => setProgram(p.id)}>{p.icon + ' ' + tr(p.title)}</button>)}
          </div>
          <div className="view-switch">
            <button type="button" className={'pill' + (view === 'list' ? ' on' : '')} data-v="list" onClick={() => setView('list')}>☰ List</button>
            <button type="button" className={'pill' + (view === 'cal' ? ' on' : '')} data-v="cal" onClick={() => setView('cal')}>📆 Calendar</button>
          </div>
        </div>
        <div id="evBody">
          {view === 'cal' ? <Calendar events={all} month={month} setMonth={setMonth} pick={pick} /> : (
            <>
              {up.length ? <div className="grid g2">{up.map((e) => <EventCard key={e.id} e={e} />)}</div> : <Empty icon="📅">No upcoming events for this filter.</Empty>}
              {past.length > 0 && <>
                <h3 className="section-head" style={{ marginTop: 34 }}><span style={{ fontFamily: 'var(--font-serif)', color: 'var(--primary-dark)', fontSize: '1.4rem' }}>Completed events</span></h3>
                <div className="grid g2">{past.map((e) => <EventCard key={e.id} e={e} compact />)}</div>
              </>}
            </>
          )}
        </div>
      </div></section>
    </>
  );
}

export function EventDetail({ route }) {
  const slug = new URLSearchParams(route.search).get('e');
  const e = G.DB.all('events').find((x) => x.slug === slug && x.status !== 'DRAFT');
  useEffect(() => {
    if (!e) return;
    document.title = tr(e.title) + ' | Green India Gokul Foundation';
    const meta = document.querySelector('meta[name=description]');
    if (meta) meta.setAttribute('content', String(tr(e.desc)).slice(0, 160));
  });
  const prog = e && progById(e.program);
  const media = e ? G.DB.all('gallery').filter((m) => m.eventId === e.id) : [];
  return (
    <>
      <PageHero title="Event details" crumb="Event" badge={false} />
      <section className="section"><div className="wrap" id="detail">
        {!e ? <Empty icon="📅">This event was not found. <A to="events.html">See all events</A></Empty> : (
          <>
            <article className="card card-body detail">
              <h2>{tr(e.title)}</h2>
              <p className="ev-meta"><span>{'📅 ' + G.fmtDate(e.date)}</span> <span>{'🕒 ' + e.time}</span> <span>{'📍 ' + e.location}</span> {prog && <A to={'programs.html#' + prog.slug}>{prog.icon + ' ' + tr(prog.title)}</A>}</p>
              {INLINE_IMG.test(e.poster || '') && <img className="detail-img" src={e.poster} alt="" />}
              <p>{tr(e.desc)}</p>
              <p><a className="link-more" target="_blank" rel="noopener" href={'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(e.location)}>🗺️ Open in Google Maps</a></p>
              {e.status !== 'UPCOMING' ? <span className="chip gray">Completed</span> : <button type="button" className="btn btn-primary" data-reg={e.id} onClick={() => openRegister(e.id)}>{t('btn.register')}</button>}
            </article>
            <h3 style={{ margin: '30px 0 12px' }}>📸 Photos and videos from this event</h3>
            {media.length ? <div className="detail-media">{media.map((m) => (m.type === 'VIDEO' ? <video key={m.id} src={G.mediaUrl(m.src) + '#t=0.6'} controls preload="metadata" playsInline /> : <img key={m.id} src={G.mediaUrl(m.src)} alt={tr(m.title)} loading="lazy" />))}</div> : <p style={{ color: '#6b7280' }}>No photos have been added for this event.</p>}
          </>
        )}
      </div></section>
    </>
  );
}
