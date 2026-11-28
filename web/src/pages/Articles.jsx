/** Awareness list, one article, annual reports. */
import { useEffect, useState } from 'react';
import { G, t, tr } from '../lib/gigf.js';
import { A, go } from '../ui/nav.jsx';
import { PageHero, Empty, publishedArticles } from '../ui/common.jsx';

const ICONS = { environment: '🌍', yoga: '🧘', health: '🥗', women: '👩‍🌾', stories: '🌱', schemes: '🏛️' };
const PHOTOS = { environment: ['about_sprout_hand', 'hero_scene', 'gal1', 'about_natural_sprout'], yoga: ['hero_yoga_women'], women: ['women_shg'], stories: ['gal2'] };
const CATEGORIES = ['all', 'environment', 'yoga', 'health', 'women', 'stories', 'schemes'];

function Cover({ a }) {
  const own = a.cover ? G.mediaUrl(a.cover) : '';
  if (own && own !== '#') return <img className="cover-img" src={own} alt="" loading="lazy" />;
  const list = PHOTOS[a.category];
  if (!list) return ICONS[a.category] || '📰';
  const n = publishedArticles().filter((x) => x.category === a.category).findIndex((x) => x.id === a.id);
  const story = a.category === 'stories' && G.DB.all('gallery').find((g) => g.type === 'PHOTO' && g.category === 'tree');
  return <img className="cover-img" src={story ? G.mediaUrl(story.src) : 'assets/' + list[Math.max(0, n) % list.length] + '.jpg'} alt="" loading="lazy" />;
}

export function Awareness({ route }) {
  const [cat, setCat] = useState('all');
  const [term, setTerm] = useState('');
  useEffect(() => {
    const h = route.anchor;
    if (h && G.DB.all('articles').some((x) => x.id === h || x.slug === h)) location.replace('#article?a=' + encodeURIComponent(h));
  }, [route]);
  const list = publishedArticles().filter((a) => (cat === 'all' || a.category === cat) && (!term || (tr(a.title) + tr(a.summary)).toLowerCase().includes(term)));
  const open = (a) => go('article.html?a=' + encodeURIComponent(a.slug || a.id));
  return (
    <>
      <PageHero title={t('page.awareness')} lead="Practical, easy-to-read guidance for healthy and self-reliant living." />
      <section className="section"><div className="wrap">
        <A className="feature-banner" to="environment.html"><span className="fb-ico">🌍</span><span><b>{t('home.env.title')}</b><small>{t('home.env.kicker')}</small></span><span className="fb-go"><span>{t('home.env.more')}</span> →</span></A>
        <div className="toolbar">
          <div className="filters" id="artCats" style={{ margin: 0 }}>{CATEGORIES.map((c) => <button type="button" key={c} className={'pill' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{c === 'all' ? t('f.all') : t('art.' + c)}</button>)}</div>
          <input className="search" id="artSearch" placeholder="🔎 Search articles" aria-label="Search articles" onChange={(e) => setTerm(e.target.value.toLowerCase())} />
        </div>
        <div className="grid g3" id="artGrid">
          {list.map((a) => (
            <article key={a.id} className="card lift art-card reveal" data-a={a.id} style={{ cursor: 'pointer' }} tabIndex={0} onClick={() => open(a)} onKeyDown={(e) => { if (e.key === 'Enter') open(a); }}>
              <div className="cover"><Cover a={a} /></div>
              <div className="card-body"><span className="chip">{t('art.' + a.category)}</span><h4 style={{ margin: '8px 0 4px', color: 'var(--primary-dark)' }}>{tr(a.title)}</h4><p style={{ fontSize: '.86rem', color: '#4b5563', marginBottom: 8 }}>{tr(a.summary)}</p><span className="link-more">{t('btn.readmore') + ' →'}</span></div>
            </article>
          ))}
          {!list.length && <Empty icon="🔎">No articles match.</Empty>}
        </div>
      </div></section>
    </>
  );
}

export function Article({ route }) {
  const key = new URLSearchParams(route.search).get('a');
  const a = G.DB.all('articles').find((x) => (x.slug === key || x.id === key) && (x.status === 'PUBLISHED' || (x.status === 'SCHEDULED' && x.publishAt && new Date(x.publishAt) <= new Date())));
  useEffect(() => {
    if (!a) return;
    const title = tr(a.title) + ' | Green India Gokul Foundation', text = String(a.seo || tr(a.summary)).slice(0, 160);
    document.title = title;
    [['meta[name=description]', text], ['meta[property="og:title"]', title], ['meta[property="og:description"]', text]].forEach(([sel, value]) => { const m = document.querySelector(sel); if (m) m.setAttribute('content', value); });
  });
  const cover = a && a.cover ? G.mediaUrl(a.cover) : '';
  return (
    <>
      <PageHero title="Article" badge={false} />
      <section className="section"><div className="wrap" id="detail">
        {!a ? <Empty icon="📰">This article was not found. <A to="awareness.html">See all articles</A></Empty> : (
          <article className="card card-body detail">
            <p style={{ fontSize: '.8rem', color: '#6b7280' }}>{G.fmtDate(a.date) + ' · ' + t('art.' + a.category)}</p>
            <h2>{tr(a.title)}</h2>
            {cover && cover !== '#' && <img className="detail-img" src={cover} alt="" />}
            {/* G.md escapes every character first and only then adds its own few tags (js/md.js) */}
            <div className="art-body" dangerouslySetInnerHTML={{ __html: G.md(G.articleBody(a, G.lang()) || G.articleBody(a)) }} />
            <p><A className="link-more" to="awareness.html">{'← ' + t('nav.awareness')}</A></p>
          </article>
        )}
      </div></section>
    </>
  );
}

export function Reports() {
  const list = (G.DB.settings().reports || []).filter((r) => G.safeUrl(r.url, ''));
  return (
    <>
      <PageHero title="Annual Reports" badge={false} />
      <section className="section"><div className="wrap" id="detail">
        {list.length ? <div className="grid g3">{list.map((r, i) => <div key={i} className="card card-body"><h4>{'📄 ' + r.title}</h4><p style={{ color: '#6b7280' }}>{r.year}</p><a className="btn btn-primary btn-sm" href={G.safeUrl(r.url, '')} target="_blank" rel="noopener" download>⬇ Download</a></div>)}</div> : <Empty icon="📄">No annual reports have been published.</Empty>}
      </div></section>
    </>
  );
}
