/**
 * Festival looks: the admin changes logo, home banner, colours, greeting and falling decorations, optionally between two dates.
 * Stored in settings.look (and shared through Supabase by cloud.js). Loaded after data.js / cloud.js, before layout.js.
 * Everything is validated before use; text is only ever written with textContent.
 */
(function () {
  const G = window.GIGF;
  const IMG = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, HEX = /^#[0-9a-fA-F]{6}$/;
  const PRESETS = {
    normal: { name: 'Normal (green)', primary: '', accent: '', deco: '', greeting: '' },
    diwali: { name: 'Deepavali', primary: '#7c2d12', accent: '#d97706', deco: '🪔', greeting: 'Happy Deepavali! May your home be filled with light.' },
    independence: { name: 'Independence / Republic Day', primary: '#14532d', accent: '#ff7a00', deco: '🇮🇳', greeting: 'Jai Hind! Greetings from Green India Gokul Foundation.' },
    environment: { name: 'Environment Day', primary: '#065f46', accent: '#16a34a', deco: '🍃', greeting: 'World Environment Day: plant a tree with us!' },
    ganesha: { name: 'Ganesh Chaturthi', primary: '#9a3412', accent: '#e11d48', deco: '🌺', greeting: 'Happy Ganesh Chaturthi! Celebrate with eco-friendly idols.' },
    ugadi: { name: 'Ugadi', primary: '#3f6212', accent: '#ca8a04', deco: '🌼', greeting: 'Ugadi greetings! Wishing you a prosperous new year.' },
    newyear: { name: 'Christmas / New Year', primary: '#7f1d1d', accent: '#15803d', deco: '✨', greeting: 'Season’s greetings and a happy new year!' }
  };
  /** the look that applies today, or null */
  function active() {
    const l = G.DB.settings().look; if (!l || !l.on) return null;
    const d = new Date(), today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return (l.from && today < l.from) || (l.to && today > l.to) ? null : l;
  }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }

  function apply() {
    const l = active(); if (!l || document.body.dataset.page === 'admin') return;
    const root = document.documentElement.style;
    if (HEX.test(l.primary)) { root.setProperty('--primary', l.primary); root.setProperty('--primary-dark', l.primary); root.setProperty('--primary-light', l.primary); root.setProperty('--dark-green-bar', l.primary); }
    if (HEX.test(l.accent)) { document.body.classList.add('look-on'); root.setProperty('--accent-orange', l.accent); root.setProperty('--accent-orange-hover', l.accent); }
    if (IMG.test(l.logo || '')) {
      document.querySelectorAll('img[src*="logo-emblem"]').forEach((i) => { i.src = l.logo; });
      document.querySelectorAll('link[rel="icon"]').forEach((i) => { i.href = l.logo; i.removeAttribute('type'); });
    }
    const header = document.querySelector('.main-header');
    if (l.greeting && header) header.insertAdjacentElement('afterend', el('div', 'look-greeting', l.greeting));
    const hero = document.getElementById('heroCarousel');
    if (hero && IMG.test(l.banner || '')) {
      const b = el('section', 'look-banner'), img = el('img'); img.src = l.banner; img.alt = l.title || 'Festival banner'; b.appendChild(img);
      if (l.title || l.link) {
        const box = el('div', 'look-text'); if (l.title) box.appendChild(el('h2', '', l.title)); if (l.subtitle) box.appendChild(el('p', '', l.subtitle));
        const href = l.link && G.safeUrl(l.link, ''); if (href) { const a = el('a', 'btn btn-orange', l.linkText || 'Know more →'); a.href = href; box.appendChild(a); }
        b.appendChild(box);
      }
      hero.insertAdjacentElement('beforebegin', b); if (!l.keepSlides) hero.hidden = true;
    }
    if (l.deco) {
      const wrap = el('div', 'look-deco'); wrap.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 14; i++) { const s = el('span', '', String(l.deco).slice(0, 8)); s.style.left = (i * 7.1 + 2) + '%'; s.style.animationDelay = -(i * 1.3) + 's'; s.style.animationDuration = 11 + (i % 5) * 2 + 's'; wrap.appendChild(s); }
      document.body.appendChild(wrap);
    }
  }
  G.look = { apply, active, PRESETS, IMG };
})();
