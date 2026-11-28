import { useState } from 'react';
import { G, t, tr } from '../lib/gigf.js';
import { PageHero, Empty } from '../ui/common.jsx';
import { useLightbox } from '../ui/cards.jsx';

export default function Gallery() {
  const [type, setType] = useState('ALL');
  const [cat, setCat] = useState('all');
  const lightbox = useLightbox();
  const shown = G.sortMedia(G.DB.all('gallery')).filter((g) => (type === 'ALL' || g.type === type) && (cat === 'all' || g.category === cat));
  const types = [['ALL', t('f.all')], ['PHOTO', '📷 ' + t('f.photos')], ['VIDEO', '🎬 ' + t('f.videos')]];
  const cats = [['all', t('f.all')], ['tree', t('cat.tree')], ['cow', t('cat.cow')], ['health', t('cat.health')], ['skill', t('cat.skill')], ['community', t('cat.community')]];
  const pills = (list, value, set) => list.map(([key, label]) => <button type="button" key={key} className={'pill' + (value === key ? ' on' : '')} onClick={() => set(key)}>{label}</button>);
  return (
    <>
      <PageHero title={t('page.gallery')} lead="Moments from our plantation drives and community events." />
      <section className="section"><div className="wrap wide">
        <div className="filters" id="galTypes">{pills(types, type, setType)}</div>
        <div className="filters" id="galCats">{pills(cats, cat, setCat)}</div>
        <div className="section-head" style={{ marginTop: 44 }}><h3>All media</h3><span id="galCount" style={{ fontSize: '.82rem', color: '#6b7280' }}>{shown.length + ' items'}</span></div>
        <div className="masonry" id="galGrid">
          {shown.map((g, i) => (
            <div key={g.id} className="m-item reveal" style={{ '--d': (i % 12) * 80 + 'ms' }} tabIndex={0} role="button" aria-label={tr(g.title)}
              onClick={() => lightbox.show(shown, i)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); lightbox.show(shown, i); } }}>
              {g.type === 'VIDEO'
                ? <><video src={G.mediaUrl(g.src) + '#t=0.6'} preload="metadata" muted playsInline /><span className="m-play">▶</span></>
                : <img src={G.mediaUrl(g.src)} alt={tr(g.title)} loading="lazy" />}
              <span className="chip m-badge">{g.type === 'VIDEO' ? '🎬 Video' : '📷 Photo'}</span><div className="m-cap">{tr(g.title)}</div>
            </div>
          ))}
          {!shown.length && <Empty icon="🖼️">Nothing here yet for this filter.</Empty>}
        </div>
      </div></section>
      {lightbox.node}
    </>
  );
}
