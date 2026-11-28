/** Small building blocks used by several pages. */
import { useEffect, useRef, useState } from 'react';
import { G, t, tr } from '../lib/gigf.js';
import { A } from './nav.jsx';

export function Empty({ icon, children }) {
  return <div className="empty"><span className="e">{icon}</span>{children}</div>;
}

/** heading that pops in word by word */
export function Words({ as: Tag = 'h2', className, text }) {
  const words = String(text || '').trim().split(/\s+/);
  return (
    <Tag className={className} aria-label={text}>
      {words.map((w, i) => <span key={i + w}>{i > 0 && ' '}<span className="w" aria-hidden="true" style={{ '--i': i }}>{w}</span></span>)}
    </Tag>
  );
}

export function logoSrc() {
  const l = G.look.active();
  return l && G.look.IMG.test(l.logo || '') ? l.logo : 'assets/logo-emblem.svg';
}

export function PageHero({ title, crumb, lead, badge = true }) {
  return (
    <section className="page-hero">
      <div className="wrap">
        <div className="crumbs"><A to="index.html">{t('nav.home')}</A>{' › '}<span>{crumb || title}</span></div>
        <Words text={title} />
        {lead != null && <p>{lead}</p>}
      </div>
      {badge && <div className="hero-badge-hang"><img src={logoSrc()} alt="" /></div>}
    </section>
  );
}

export function Field({ label, error, bad, full, children, style }) {
  return (
    <div className={'field' + (full ? ' f-full' : '') + (bad ? ' bad' : '')} style={style}>
      {label != null && <label>{label}</label>}
      {children}
      {error != null && <span className="err">{error}</span>}
    </div>
  );
}

/** number that counts up when scrolled into view */
export function CountUp({ to, prefix = '', suffix = '' }) {
  const ref = useRef(null);
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame = 0;
    const run = () => {
      if (document.documentElement.classList.contains('no-motion')) return setValue(to);
      const t0 = performance.now();
      const step = (now) => { const p = Math.min(1, (now - t0) / 1700); setValue(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) frame = requestAnimationFrame(step); };
      frame = requestAnimationFrame(step);
    };
    if (!('IntersectionObserver' in window)) { run(); return undefined; }
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { io.disconnect(); run(); } }, { threshold: 0.4 });
    io.observe(ref.current);
    return () => { io.disconnect(); cancelAnimationFrame(frame); };
  }, [to]);
  return <b className="count" ref={ref}>{prefix + value.toLocaleString('en-IN') + suffix}</b>;
}

export const programsSorted = () => G.DB.all('programs').filter((p) => p.active).sort((a, b) => a.order - b.order);
export const progById = (id) => G.DB.all('programs').find((p) => p.id === id);
export const programTitle = (id) => { const p = progById(id); return p ? tr(p.title) : id === 'community' ? t('cat.community') : ''; };
export const upcoming = () => G.DB.all('events').filter((e) => e.status === 'UPCOMING').sort((a, b) => a.date.localeCompare(b.date));
const due = (x) => x.status === 'PUBLISHED' || (x.status === 'SCHEDULED' && x.publishAt && new Date(x.publishAt) <= new Date());
export const publishedNews = () => G.DB.all('news').filter(due).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.date.localeCompare(a.date));
export const publishedArticles = () => G.DB.all('articles').filter(due).sort((a, b) => b.date.localeCompare(a.date));
export const INLINE_IMG = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
export const safePoster = (u) => (typeof u === 'string' && INLINE_IMG.test(u) ? u : '');   // only real inline images are ever rendered

export function scrollToId(id, delay = 60) {
  setTimeout(() => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, delay);
}
