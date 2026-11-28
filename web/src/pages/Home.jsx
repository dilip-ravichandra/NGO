import { useCallback, useEffect, useRef, useState } from 'react';
import { G, t, tr, word } from '../lib/gigf.js';
import { A } from '../ui/nav.jsx';
import { toast } from '../ui/feedback.jsx';
import { CountUp, Empty, programsSorted, publishedNews, safePoster, scrollToId } from '../ui/common.jsx';
import { LookBanner, lookHidesSlides } from '../ui/Look.jsx';
import { SLIDES } from '../content/heroSlides.jsx';
import { WORDS, ESSENCE } from '../content/home.js';

/** banner words in the visitor's language (stored translations in js/i18n-banner.js) */
function bannerText(text) {
  const table = G.BANNER && G.BANNER[G.lang()];
  const arrow = /→/.test(text);
  const key = text.replace(/[→⟨⟩〈〉]/g, '').replace(/\s+/g, ' ').trim();
  const found = table && key && table[key];
  return found ? found + (arrow ? ' →' : '') : text;
}

function Hero() {
  const [state, setState] = useState({ slide: 0, run: 0 });
  const [paused, setPaused] = useState(false);
  const touch = useRef(null);
  const show = useCallback((n) => setState((s) => ({ slide: (n + SLIDES.length) % SLIDES.length, run: s.run + 1 })), []);
  useEffect(() => {
    if (paused) return undefined;
    const timer = setTimeout(() => show(state.slide + 1), 6500);
    return () => clearTimeout(timer);
  }, [state, paused, show]);
  const onClick = (e) => { const h = e.target.closest('.hero-hotspot'); if (h) toast(h.dataset.label, '✨'); };
  return (
    <section className="hero-section" id="heroCarousel" hidden={lookHidesSlides()} onClick={onClick} data-notr={G.BANNER && G.BANNER[G.lang()] ? '' : undefined}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (touch.current == null) return; const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 50) show(state.slide + (dx < 0 ? 1 : -1)); touch.current = null; }}>
      <button type="button" className="carousel-arrow prev" aria-label="Previous Slide" onClick={() => show(state.slide - 1)}>〈</button>
      <button type="button" className="carousel-arrow next" aria-label="Next Slide" onClick={() => show(state.slide + 1)}>〉</button>
      <div className="carousel-dots">{SLIDES.map((s, i) => <span key={s.className} className={'dot' + (i === state.slide ? ' active' : '')} onClick={() => show(i)} />)}</div>
      <div className="hero-slides-wrapper">
        {SLIDES.map((s, i) => <div key={s.className} className={'hero-slide ' + s.className + (i === state.slide ? ' active' : '')} style={s.style}>{s.render(bannerText)}</div>)}
      </div>
      <div className="hero-progress"><i key={state.run} style={{ animation: 'heroBar 6.5s linear forwards' }} /></div>
    </section>
  );
}

const isNew = (e) => e.createdAt && Date.now() - new Date(e.createdAt).getTime() < 7 * 86400000;
const eventTag = (e) => (isNew(e) ? '✨ ' + word(WORDS.newEvent) : '📅 ' + word(WORDS.upcomingEvent));

function Videos() {
  const all = G.sortMedia(G.DB.all('gallery')).filter((g) => g.type === 'VIDEO' && G.mediaUrl(g.src));
  const picked = all.filter((g) => g.featured);
  const videos = (picked.length ? picked : all).slice(0, 4);
  const [index, setIndex] = useState(0);
  const [wanted, setWanted] = useState(false);
  const player = useRef(null);
  const current = videos[Math.min(index, videos.length - 1)];
  useEffect(() => { if (wanted && player.current) player.current.play().catch(() => { }); }, [index, wanted]);
  useEffect(() => {
    const v = player.current;
    if (!v || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver((en) => { if (!en[0].isIntersecting) v.pause(); }, { threshold: 0.25 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  if (!current) return null;
  return (
    <div className="power-media" id="powerMedia">
      <video id="powerVideo" ref={player} src={G.safeUrl(current.src, '') + '#t=0.6'} controls muted playsInline preload="metadata" />
      <div className="power-list" id="powerList">
        {videos.map((g, i) => <button type="button" key={g.id} className={i === index ? 'on' : ''} onClick={() => { setIndex(i); setWanted(true); if (i === index && player.current) player.current.play().catch(() => { }); }}>{'▶ ' + tr(g.title)}</button>)}
      </div>
    </div>
  );
}

/** made-up examples shown only until the admin adds real ones. The "Sample" label must stay: donors must never take them as real. */
const SAMPLE_VOICES = [
  { id: 's1', sample: true, name: 'Asha', role: 'volunteer', text: 'Planting saplings with the team was the best Sunday I have had in a long time. Everything was well organised and easy to join.' },
  { id: 's2', sample: true, name: 'Ravi', role: 'donor', text: 'I like that I can choose the programme my gift goes to, and find my receipt again whenever I need it.' },
  { id: 's3', sample: true, name: 'Lakshmi', role: 'workshop participant', text: 'The skills session gave me the confidence to start stitching from home and to join a savings group.' }
];

function Voices() {
  const real = G.DB.all('testimonials'), list = real.length ? real : SAMPLE_VOICES;
  return (
    <section className="section alt"><div className="wrap">
      <div className="section-head reveal"><h3>Voices</h3></div>
      <div className="grid g3" id="testi">
        {list.map((x) => (
          <blockquote key={x.id} className="card reveal card-body" style={{ fontStyle: 'italic' }}>
            {x.sample && <><span className="chip warn" style={{ fontStyle: 'normal', marginBottom: 8 }}>Sample testimonial</span><br /></>}
            {'“' + x.text + '”'}
            <footer style={{ marginTop: 8, fontStyle: 'normal', fontWeight: 700, color: 'var(--primary-dark)' }}>{'— ' + x.name + (x.role ? ', ' + x.role : '')}</footer>
          </blockquote>
        ))}
        {!real.length && <p style={{ gridColumn: '1/-1', color: '#6b7280', fontSize: '.82rem' }}>These are made-up examples to show the layout. Have you taken part in our work? <A to="contact.html">Share your experience</A>.</p>}
      </div>
    </div></section>
  );
}

const Icon = ({ paths }) => <svg viewBox="0 0 48 48" width="62" height="62" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: paths }} />;

export default function Home({ route }) {
  useEffect(() => { if (route.anchor) scrollToId(route.anchor, 120); }, [route.anchor]);
  const news = publishedNews();
  // events that are not over yet stay at the top of "Latest news", newest posting first
  const live = G.DB.all('events').filter((e) => e.status === 'UPCOMING' && e.date >= G.today()).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || a.date.localeCompare(b.date));
  const posted = live.filter((e) => e.createdAt);
  const topEvents = posted.concat(live.filter((e) => !e.createdAt)).slice(0, Math.max(3, posted.length));
  const topNews = news.filter((n) => !(n.title && n.title.en === 'Our new website is live')).slice(0, Math.max(0, 3 - topEvents.length));

  // moving numbers: what the admin typed first; the rest are counted from the site itself (nothing is invented)
  const own = (G.DB.settings().impact || []).map((m) => { const mm = String(m.value).match(/^([^\d]*)([\d,.]+)(.*)$/); return mm ? [Number(mm[2].replace(/,/g, '')), mm[3], m.label, mm[1]] : [0, m.value, m.label, '']; });
  const progs = G.DB.all('programs').filter((p) => p.active);
  const stats = own.concat([
    [progs.length, '', word(WORDS.programmes)], [progs.reduce((n, p) => n + (p.initiatives || []).length, 0), '', word(WORDS.initiatives)],
    [live.length, '', word(WORDS.upcomingEvents)], [6, '', word(WORDS.languages)]
  ]).slice(0, 4);

  const quick = [['programs.html', '🌳', 'nav.programs'], ['events.html', '📅', 'nav.events'], ['donate.html', '💚', 'btn.donate'], ['volunteer.html', '🤝', 'nav.volunteer']];
  const ticker = news.length || live.length;
  return (
    <>
      <div className="ticker" id="ticker" aria-label="News ticker">
        {ticker ? <div className="ticker-track">
          {[0, 1].map((k) => live.map((e) => <A key={k + e.id} className="tick-event" to={'events.html#' + (e.slug || '')}>{eventTag(e) + ': ' + tr(e.title) + ' · ' + G.fmtDate(e.date)}</A>))}
          {news.concat(news).map((n, i) => <A key={n.id + i} to={G.safeUrl(n.link || '#news')}>{tr(n.title)}</A>)}
        </div> : null}
      </div>
      <LookBanner />
      <Hero />
      <div className="wrap"><div className="quick" id="quick">{quick.map(([to, icon, key]) => <A key={to} to={to} className="reveal"><span className="e">{icon}</span>{t(key)}</A>)}</div></div>

      <section className="section" id="programsSection"><div className="wrap">
        <div className="section-head reveal"><h3>{t('home.programs')}</h3><A className="link-more" to="programs.html">{t('btn.viewall')}</A></div>
        <div className="pillars-grid" id="pillars">{programsSorted().map((p) => <A key={p.id} className="pillar-card reveal" to={'programs.html#' + p.slug} style={{ textDecoration: 'none' }}><div className="pillar-icon-box" style={{ fontSize: '1.9rem' }}>{p.icon}</div><div className="pillar-title">{tr(p.title)}</div></A>)}</div>
      </div></section>

      <section className="section" id="news"><div className="wrap">
        <div className="section-head reveal"><h3>{t('home.news')}</h3></div>
        <div className="grid g3" id="newsGrid">
          {topEvents.map((e) => (
            <article key={e.id} className="card lift news-card news-event reveal">
              {safePoster(e.poster) && <img className="news-poster" src={safePoster(e.poster)} alt="" />}
              <div className="card-body"><span className="news-tag">{eventTag(e)}</span><div className="date">{G.fmtDate(e.date) + (e.time ? ' · ' + e.time : '')}</div><h4>{tr(e.title)}</h4><p style={{ fontSize: '.86rem', color: '#4b5563', marginBottom: 10 }}>{'📍 ' + (e.location || '')}</p><A className="link-more" to={'event.html?e=' + (e.slug || '')}>{t('btn.readmore') + ' →'}</A></div>
            </article>
          ))}
          {topNews.map((n) => (
            <article key={n.id} className="card lift news-card reveal"><div className="card-body"><div className="date">{G.fmtDate(n.date) + (n.pinned ? ' 📌' : '')}</div><h4>{tr(n.title)}</h4><p style={{ fontSize: '.86rem', color: '#4b5563', marginBottom: 10 }}>{tr(n.summary)}</p>{n.link && <A className="link-more" to={G.safeUrl(n.link)}>{t('btn.readmore') + ' →'}</A>}</div></article>
          ))}
          {!topEvents.length && !topNews.length && <Empty icon="📰">No news yet.</Empty>}
        </div>
        <p id="newsMore" style={{ textAlign: 'center', marginTop: 18 }}><A className="link-more" to="events.html">{t('btn.viewall') + ' →'}</A></p>
      </div></section>

      <section className="power-band"><div className="wrap wide"><div className="power-grid">
        <div className="power-text"><h3 id="powerTitle">{word(WORDS.powerTitle)}</h3><p id="powerText">{t('home.aboutText')}</p>
          <div id="impact" className="power-stats">{stats.map((f) => <div key={f[2]} className="power-stat"><CountUp to={Number(f[0]) || 0} prefix={f[3] || ''} suffix={f[1] || ''} /><span>{f[2]}</span></div>)}</div></div>
        <Videos />
      </div></div></section>

      <Voices />

      <section className="section essence" id="about"><div className="wrap">
        <div className="essence-head"><span id="essKicker">{word(WORDS.essKicker)}</span><h3 id="essTitle">{word(WORDS.essTitle)}</h3></div>
        <div className="essence-grid" id="essence">{ESSENCE.map((c) => <article key={c[1][0]} className="essence-card reveal"><Icon paths={c[0]} /><h4>{word(c[1])}</h4><p>{word(c[2])}</p></article>)}</div>
      </div></section>

      <section className="section"><div className="wrap"><div className="card reveal" style={{ background: 'linear-gradient(115deg,#0f4d2a,#1ea855)', color: '#fff', textAlign: 'center', padding: '44px 20px' }}>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.9rem', marginBottom: 8 }}>{t('home.support')}</h3><p style={{ color: '#d1fae5', marginBottom: 18 }}>{t('home.supportText')}</p>
        <A className="btn btn-orange" to="donate.html" style={{ fontSize: '1.05rem', padding: '14px 32px' }}>💚 <span>{t('btn.donate')}</span></A>
      </div></div></section>
    </>
  );
}
