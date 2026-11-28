/** Top bar, menu, mobile drawer, footer, bottom bar and floating buttons. */
import { useEffect, useRef, useState } from 'react';
import { G, t, tr } from '../lib/gigf.js';
import { A } from './nav.jsx';
import { toast } from './feedback.jsx';
import { logoSrc, programsSorted } from './common.jsx';
import Bell from './Bell.jsx';
import Chat from './Chat.jsx';
import { LookDecorations } from './Look.jsx';

const isAdminUser = (u) => !!u && /ADMIN/.test(u.role);
const WA_HELLO = 'Hello, I would like to know more about Green India Gokul Foundation';

function useClickAway(open, close) {
  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('click', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', esc); };
  }, [open, close]);
}

function logout(e) {
  e.preventDefault();
  G.Auth.logout();
  location.assign('index.html');
}

function LangButtons() {
  const cur = G.lang(), more = cur !== 'en' && cur !== 'kn';
  const [open, setOpen] = useState(false);
  const close = useRef(() => setOpen(false)).current;
  useClickAway(open, close);
  return (
    <div className="lang-switch" role="group" aria-label="Language">
      <button type="button" className={'lang-btn' + (cur === 'en' ? ' on' : '')} onClick={() => G.setLang('en')} aria-label="English">EN</button>
      <button type="button" className={'lang-btn' + (cur === 'kn' ? ' on' : '')} onClick={() => G.setLang('kn')} aria-label="Kannada">ಕನ್ನಡ</button>
      <div className={'lang-more' + (open ? ' open' : '')}>
        <button type="button" className={'lang-btn' + (more ? ' on' : '')} aria-haspopup="true" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>{(more ? G.LANGS.find((l) => l.c === cur).l : 'More') + ' ▾'}</button>
        <div className="lang-menu" role="menu">{G.LANGS.filter((l) => l.c !== 'en' && l.c !== 'kn').map((l) => <button type="button" role="menuitem" key={l.c} className={cur === l.c ? 'on' : ''} onClick={() => G.setLang(l.c)}>{l.l}</button>)}</div>
      </div>
    </div>
  );
}

function Profile() {
  const u = G.Auth.current();
  const [open, setOpen] = useState(false);
  const close = useRef(() => setOpen(false)).current;
  useClickAway(open, close);
  return (
    <div className={'profile-wrap' + (open ? ' open' : '')}>
      <button type="button" className="profile-btn" id="profileBtn" aria-haspopup="true" aria-expanded={open} title={u ? u.name : t('nav.login') + ' / ' + t('nav.signup')} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        <span className="avatar">{u ? u.name.trim()[0].toUpperCase() : '👤'}</span><span className="pname">{u ? u.name.split(' ')[0] : t('nav.login')}</span>{' ▾'}
      </button>
      <div className="profile-menu" role="menu">
        {u ? (
          <>
            <div className="pm-head"><b>{u.name}</b><small>{u.email}</small></div>
            <A role="menuitem" to={isAdminUser(u) ? 'admin.html' : 'dashboard.html'}>{isAdminUser(u) ? '🛠️ Admin portal' : '📊 ' + t('nav.account')}</A>
            <A role="menuitem" to="donate.html">{'💚 ' + t('btn.donate')}</A>
            <a role="menuitem" href="#" onClick={logout}>{'🚪 ' + t('nav.logout')}</a>
          </>
        ) : (
          <>
            <div className="pm-head"><b>Welcome 🙏</b><small>Sign in to donate, volunteer and track receipts</small></div>
            <A role="menuitem" to="login.html" className="pm-login">{'🔑 ' + t('nav.login')}</A>
            <A role="menuitem" to="signup.html" className="pm-signup">{'✨ ' + t('nav.signup')}</A>
          </>
        )}
      </div>
    </div>
  );
}

function Header({ page, openDrawer }) {
  const o = G.ORG;
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(scrollY > 30);
    addEventListener('scroll', f, { passive: true }); f();
    return () => removeEventListener('scroll', f);
  }, []);
  const on = (...pages) => (pages.includes(page) ? ' active-pill' : '');
  return (
    <>
      <header className="top-bar">
        <div className="top-bar-left">
          <a href={'mailto:' + o.email} className="top-bar-contact">{'✉️ ' + o.email}</a>
          {o.phones.map((p) => <span key={p.tel} style={{ display: 'contents' }}><span className="top-bar-sep">|</span><a href={'tel:' + p.tel} className="top-bar-contact">{'📞 ' + p.display}</a></span>)}
        </div>
        <div className="top-bar-center">{t('top.tag')}</div>
        <div className="top-bar-right">
          <LangButtons />
          <Bell />
          <Profile />
          <a href={o.waLink(WA_HELLO)} target="_blank" rel="noopener" className="social-icon-btn wa" title="WhatsApp">💬</a>
        </div>
      </header>
      <nav className={'main-header' + (scrolled ? ' scrolled' : '')}>
        <A to="index.html" className="header-brand"><img src={logoSrc()} alt="Green India Gokul Foundation emblem" className="brand-logo-img" width="64" height="64" />
          <div className="brand-text-block"><h1 className="brand-name">{o.name}</h1><p className="brand-tagline">Nature • Cow Welfare • Health • Skill Development • Rural Prosperity</p></div></A>
        <ul className="nav-menu">
          <li className="nav-item"><A to="index.html" className={'nav-link' + on('home')}>{t('nav.home')}</A></li>
          <li className="nav-item"><A to="programs.html" className={'nav-link' + on('programs')}>{t('nav.programs') + ' ▾'}</A>
            <div className="nav-dropdown">{programsSorted().map((p) => <A key={p.id} className="dropdown-item" to={'programs.html#' + p.slug}>{p.icon + ' ' + tr(p.title)}</A>)}</div></li>
          <li className="nav-item"><A to="events.html" className={'nav-link' + on('events')}>{t('nav.events')}</A></li>
          <li className="nav-item"><A to="gallery.html" className={'nav-link' + on('gallery')}>{t('nav.gallery')}</A></li>
          <li className="nav-item"><A to="awareness.html" className={'nav-link' + on('awareness', 'environment')}>{t('nav.awareness') + ' ▾'}</A>
            <div className="nav-dropdown"><A className="dropdown-item" to="awareness.html">{'📰 ' + t('nav.articles')}</A><A className="dropdown-item" to="environment.html">{'🌍 ' + t('nav.campaign')}</A></div></li>
          <li className="nav-item"><A to="volunteer.html" className={'nav-link' + on('volunteer')}>{t('nav.volunteer')}</A></li>
          <li className="nav-item"><A to="contact.html" className={'nav-link' + on('contact')}>{t('nav.contact')}</A></li>
          <li className="nav-item"><A to="donate.html" className="donate-btn-header">{t('btn.donate')}</A></li>
        </ul>
        <button type="button" className="mobile-menu-btn" id="mobileMenuBtn" aria-label="Open menu" onClick={openDrawer}>☰</button>
      </nav>
    </>
  );
}

function Drawer({ open, close }) {
  const u = G.Auth.current(), cur = G.lang();
  const items = [['index.html', '🏠', 'nav.home'], ['programs.html', '🌳', 'nav.programs'], ['events.html', '📅', 'nav.events'], ['gallery.html', '📸', 'nav.gallery'], ['awareness.html', '📰', 'nav.awareness'], ['environment.html', '🌍', 'nav.campaign'], ['volunteer.html', '👥', 'nav.volunteer'], ['contact.html', '📞', 'nav.contact']]
    .concat(u ? [[isAdminUser(u) ? 'admin.html' : 'dashboard.html', '👤', 'nav.account']] : [['login.html', '🔑', 'nav.login'], ['signup.html', '✍️', 'nav.signup']]);
  return (
    <div id="mobileNavDrawer" className={open ? 'open' : ''} onClick={(e) => { if (e.target === e.currentTarget || e.target.closest('a')) close(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 99999, display: 'none' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 290, maxWidth: '85%', height: '100%', background: '#fff', padding: 20, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: 12, marginBottom: 14 }}>
          <b style={{ color: '#0f4d2a' }}>{G.ORG.name}</b><button type="button" id="closeMobileDrawer" aria-label="Close" onClick={close} style={{ background: 'none', border: 'none', fontSize: '1.6rem', cursor: 'pointer' }}>×</button></div>
        <div className="lang-switch" style={{ marginBottom: 14 }}>{G.LANGS.map((l) => <button type="button" key={l.c} className={'lang-btn dark' + (cur === l.c ? ' on' : '')} onClick={() => G.setLang(l.c)}>{l.l}</button>)}</div>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14, fontWeight: 600 }}>
          {items.map(([to, icon, key]) => <li key={to}><A to={to} className="mobile-drawer-link" style={{ color: '#1f2937', textDecoration: 'none' }}>{icon + ' ' + t(key)}</A></li>)}
        </ul>
        <A to="donate.html" className="donate-btn-header" style={{ marginTop: 'auto', justifyContent: 'center', textAlign: 'center' }}>{t('btn.donate') + ' 💚'}</A>
      </div>
    </div>
  );
}

function MotionButton() {
  const [off, setOff] = useState(document.documentElement.classList.contains('no-motion'));
  const flip = () => {
    const now = document.documentElement.classList.toggle('no-motion');
    try { localStorage.setItem('gigf_motion', now ? 'off' : 'on'); } catch { /* private mode */ }
    setOff(now);
    toast(now ? 'Animations turned off' : 'Animations turned on — scroll to see them', now ? '⏸️' : '✨');
  };
  return <button className="motion-btn" id="motionBtn" type="button" aria-pressed={!off} title="Turn animations on or off" onClick={flip}>✨ <span>Animations</span> <b>{off ? 'Off' : 'On'}</b></button>;
}

function Footer({ page }) {
  const o = G.ORG, s = G.DB.settings();
  const subscribe = (e) => { e.preventDefault(); const form = e.target; G.DB.add('subscribers', { email: form.elements.email.value }); form.reset(); toast('Subscribed — thank you!', '💌'); };
  const small = { fontSize: '.8rem', color: '#a7f3d0', marginBottom: 8 };
  const quick = [['events.html', t('nav.events')], ['gallery.html', t('nav.gallery')], ['reports.html', 'Annual Reports'], ['awareness.html', t('nav.awareness')], ['environment.html', '🌍 ' + t('nav.campaign')], ['volunteer.html', t('nav.volunteer')], ['donate.html', t('btn.donate')], ['contact.html', t('nav.contact')]];
  const bottom = [['index.html', '🏠', t('nav.home'), 'home'], ['programs.html', '🌳', t('nav.programs'), 'programs'], ['donate.html', '❤️', t('page.donate'), 'donate'], ['events.html', '📅', t('nav.events'), 'events'], ['contact.html', '📞', t('nav.contact'), 'contact']];
  return (
    <>
      <div className="bottom-ribbon-banner"><div className="ribbon-motto-text">— Let's Build a Green, Healthy and Prosperous India Together... —</div></div>
      <footer className="site-footer">
        <div className="footer-grid">
          <div className="footer-col reveal">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}><img src={logoSrc()} alt="" width="56" height="56" style={{ width: 56, height: 56, flex: 'none' }} /><h4 style={{ margin: 0, color: '#fff' }}>{o.name}</h4></div>
            <p style={{ fontSize: '.82rem', lineHeight: 1.55, color: '#a7f3d0' }}>Working for a greener, healthier and self-reliant India.</p>
            <p style={{ fontSize: '.74rem', color: '#6ee7b7', marginTop: 10 }}>{(s.reg80G ? '80G: ' + s.reg80G : '') + ' ' + (s.reg12A ? '• 12A: ' + s.reg12A : '')}</p>
          </div>
          <div className="footer-col reveal"><h4>{t('page.programs')}</h4><ul className="footer-links">{programsSorted().map((p) => <li key={p.id}><A to={'programs.html#' + p.slug}>{tr(p.title)}</A></li>)}</ul></div>
          <div className="footer-col reveal"><h4>{t('foot.links')}</h4><ul className="footer-links">{quick.map(([to, label]) => <li key={to}><A to={to}>{label}</A></li>)}</ul></div>
          <div className="footer-col reveal">
            <h4>{t('foot.contact')}</h4>
            <p style={small}>{'📍 ' + o.address}</p>
            <p style={small}>{o.phones.map((p, i) => <span key={p.tel}>{i > 0 && <br />}📞 <a href={'tel:' + p.tel} style={{ color: '#a7f3d0' }}>{p.display}</a></span>)}</p>
            <p style={{ fontSize: '.8rem', marginBottom: 12 }}><a href={'mailto:' + o.email} style={{ color: '#a7f3d0' }}>{'✉️ ' + o.email}</a></p>
            <form id="newsForm" className="footer-newsletter-input" onSubmit={subscribe}><input type="email" name="email" required placeholder={t('f.email')} aria-label={t('f.email')} /><button type="submit">{t('foot.join')}</button></form>
          </div>
        </div>
        <div className="footer-bottom">
          <div>{'© ' + new Date().getFullYear() + ' ' + o.name + '. ' + t('foot.rights') + ' · '}<A to="terms.html" style={{ color: 'inherit' }}>Terms</A>{' · '}<A to="privacy.html" style={{ color: 'inherit' }}>Privacy</A></div>
          <div style={{ fontStyle: 'italic' }}>Crafted with Precision | Designed with Purpose | Delivered with Passion</div>
          <MotionButton />
        </div>
      </footer>
      <nav className="mobile-bottom-nav"><div className="bottom-nav-grid">
        {bottom.map(([to, icon, label, key]) => (
          <A key={key} to={to} className={'bottom-nav-link' + (page === key ? ' active' : '')}>
            <span className="bottom-nav-icon" style={key === 'donate' ? { color: '#ea580c' } : undefined}>{icon}</span>
            <span style={key === 'donate' ? { color: '#ea580c', fontWeight: 700 } : undefined}>{label}</span>
          </A>
        ))}
      </div></nav>
    </>
  );
}

function ScrollTools() {
  const [pos, setPos] = useState({ pct: 0, top: false });
  useEffect(() => {
    const f = () => { const h = document.documentElement.scrollHeight - innerHeight; setPos({ pct: h > 0 ? (scrollY / h) * 100 : 0, top: scrollY > 600 }); };
    addEventListener('scroll', f, { passive: true }); f();
    return () => removeEventListener('scroll', f);
  }, []);
  return (
    <>
      <div className="scroll-progress" id="scrollProgress" style={{ width: pos.pct + '%' }} />
      <button type="button" className={'to-top' + (pos.top ? ' show' : '')} id="toTop" aria-label="Back to top" onClick={() => scrollTo({ top: 0, behavior: 'smooth' })}>↑</button>
    </>
  );
}

const WA_TEXT = { en: 'Chat on WhatsApp', kn: 'WhatsApp ನಲ್ಲಿ ಮಾತನಾಡಿ', hi: 'WhatsApp पर बात करें', ta: 'WhatsApp-ல் பேசுங்கள்', te: 'WhatsAppలో మాట్లాడండి', ml: 'WhatsApp-ൽ സംസാരിക്കൂ' };
const WA_PATH = 'M16 3a13 13 0 0 0-11.2 19.600L3 29l6.6-1.700A13 13 0 1 0 16 3zm0 2.4a10.600 10.600 0 1 1-5.4 19.700l-.4-.2-3.900 1 1-3.800-.2-.4A10.600 10.600 0 0 1 16 5.400zm-4.2 5.300c-.3 0-.700.100-1 .500-.4.400-1.300 1.300-1.300 3.100s1.300 3.600 1.500 3.800c.2.300 2.6 4 6.300 5.500 3.100 1.200 3.700 1 4.400.900.700-.1 2.200-.9 2.500-1.800.3-.9.3-1.600.2-1.800-.1-.2-.4-.3-.8-.5l-2.600-1.200c-.4-.1-.600-.2-.900.2l-1.2 1.500c-.2.3-.4.3-.8.1-.4-.2-1.600-.6-3-1.9-1.1-1-1.9-2.2-2.1-2.6-.2-.4 0-.6.2-.8l.6-.7c.2-.2.3-.4.4-.6.1-.3 0-.5 0-.7l-1.2-2.8c-.3-.7-.6-.6-.8-.6z';

export default function Layout({ page, children }) {
  const [drawer, setDrawer] = useState(false);
  useEffect(() => { setDrawer(false); }, [page]);
  useEffect(() => { if (drawer) { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; } return undefined; }, [drawer]);
  const waText = WA_TEXT[G.lang()] || WA_TEXT.en;
  const sideTab = !G.Auth.current() && page !== 'login' && page !== 'signup';
  const look = G.look.active();
  return (
    <>
      <a href="#main" className="skip" style={{ position: 'absolute', left: -999 }} onClick={(e) => { e.preventDefault(); document.getElementById('main').focus(); }}>Skip to content</a>
      <Header page={page} openDrawer={() => setDrawer(true)} />
      {look && look.greeting && page !== 'admin' && <div className="look-greeting">{look.greeting}</div>}
      <main id="main" tabIndex={-1}>{children}</main>
      <Footer page={page} />
      <Drawer open={drawer} close={() => setDrawer(false)} />
      <a className="wa-float" data-notr="" href={G.ORG.waLink(WA_HELLO)} target="_blank" rel="noopener" aria-label={waText}>
        <span className="wa-note">{waText}</span>
        <span className="wa-dot"><svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true"><path fill="#fff" d={WA_PATH} /></svg></span>
      </a>
      <Chat />
      {sideTab && <A className="side-tab" to="login.html" aria-label="Login or Sign up"><span>{'🔑 ' + t('nav.login') + ' / ' + t('nav.signup')}</span></A>}
      <ScrollTools />
      <LookDecorations page={page} />
    </>
  );
}
