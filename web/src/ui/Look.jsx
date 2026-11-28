/** Festival looks chosen in Admin -> Appearance: colours, greeting, home banner, falling decorations. */
import { useEffect } from 'react';
import { G } from '../lib/gigf.js';
import { useData } from '../lib/store.js';

const HEX = /^#[0-9a-fA-F]{6}$/;
const VARS = { primary: ['--primary', '--primary-dark', '--primary-light', '--dark-green-bar'], accent: ['--accent-orange', '--accent-orange-hover'] };

export function LookDecorations({ page }) {
  const version = useData();
  const look = page === 'admin' ? null : G.look.active();
  useEffect(() => {
    const root = document.documentElement.style;
    Object.entries(VARS).forEach(([key, names]) => names.forEach((n) => (look && HEX.test(look[key]) ? root.setProperty(n, look[key]) : root.removeProperty(n))));
    document.body.classList.toggle('look-on', !!(look && HEX.test(look.accent)));
    if (look && G.look.IMG.test(look.logo || '')) document.querySelectorAll('link[rel="icon"]').forEach((i) => { i.href = look.logo; i.removeAttribute('type'); });
  }, [version, page]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!look || !look.deco) return null;
  return (
    <div className="look-deco" aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => <span key={i} style={{ left: (i * 7.1 + 2) + '%', animationDelay: -(i * 1.3) + 's', animationDuration: (11 + (i % 5) * 2) + 's' }}>{String(look.deco).slice(0, 8)}</span>)}
    </div>
  );
}

export function LookBanner() {
  const look = G.look.active();
  if (!look || !G.look.IMG.test(look.banner || '')) return null;
  const href = look.link && G.safeUrl(look.link, '');
  return (
    <section className="look-banner">
      <img src={look.banner} alt={look.title || 'Festival banner'} />
      {(look.title || look.link) && (
        <div className="look-text">
          {look.title && <h2>{look.title}</h2>}
          {look.subtitle && <p>{look.subtitle}</p>}
          {href && <a className="btn btn-orange" href={href}>{look.linkText || 'Know more →'}</a>}
        </div>
      )}
    </section>
  );
}
export const lookHidesSlides = () => { const l = G.look.active(); return !!(l && G.look.IMG.test(l.banner || '') && !l.keepSlides); };
