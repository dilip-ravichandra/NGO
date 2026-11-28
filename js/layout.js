/**
 * Shared layout for every public page: top bar, header/nav, language switcher,
 * mobile drawer, footer, bottom nav, toast + modal helpers, and the
 * "Gokul Sewa Mitra" 24/7 chatbot (answers from live data, escalates to Admin).
 * Pages call GIGF.boot(fn) to run code after the shell is in place.
 */
(function () {
  const G = window.GIGF;
  const q = [];
  let ready = false;
  G.boot = (fn) => (ready ? fn() : q.push(fn));

  /* ---------------- toast & modal ---------------- */
  G.toast = function (msg, icon) {
    let c = document.getElementById('toastContainer');
    if (!c) { c = document.createElement('div'); c.id = 'toastContainer'; c.className = 'toast-container'; document.body.appendChild(c); }
    const t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status');
    t.innerHTML = `<span>${icon || '✅'}</span><span>${G.esc(msg)}</span>`;
    c.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350); }, 3800);
  };
  window.showToast = G.toast;

  let lastFocus = null;
  G.modal = function ({ title, html, wide, onClose }) {
    lastFocus = document.activeElement;
    const b = document.createElement('div');
    b.className = 'modal-backdrop show';
    b.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true" style="${wide ? 'max-width:860px' : ''}">
      <div class="modal-header"><div class="modal-title">${title || ''}</div><button class="btn-close-modal" aria-label="Close">&times;</button></div>
      <div class="modal-body">${html || ''}</div></div>`;
    document.body.appendChild(b);
    document.body.style.overflow = 'hidden';
    const close = () => { b.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', esc); if (lastFocus) lastFocus.focus && lastFocus.focus(); if (onClose) onClose(); };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', esc);
    b.addEventListener('click', (e) => { if (e.target === b) close(); });
    b.querySelector('.btn-close-modal').addEventListener('click', close);
    b.close = close;
    return b;
  };

  /* ---------------- login gate (donate / volunteer / event registration need an account) ---------------- */
  G.gateHTML = function (kind, next) {
    const nx = encodeURIComponent(next || (window.GIGF_FILE || location.pathname.split('/').pop()) + (window.GIGF_SEARCH ?? location.search));
    return `<div class="gate" role="alertdialog" aria-labelledby="gateT"><div class="gate-ico" aria-hidden="true">🔒</div>
      <h3 id="gateT">${G.t('auth.req.' + kind + '.t')}</h3><p>${G.t('auth.req.' + kind + '.b')}</p>
      <div class="gate-actions"><a class="btn btn-primary gate-login" href="login.html?next=${nx}">🔑 ${G.t('nav.login')}</a><a class="btn btn-orange gate-signup" href="signup.html?next=${nx}">✨ ${G.t('auth.req.signup')}</a></div>
      <small>🔐 ${G.t('auth.req.note')}</small></div>`;
  };
  /** Shows the "log in first" popup. Returns false so callers can `if (!G.requireLogin(...)) return;` */
  G.requireLogin = function (kind, next) {
    if (G.Auth.current()) return true;
    const m = G.modal({ title: '🔒 ' + G.t('nav.login') + ' / ' + G.t('nav.signup'), html: G.gateHTML(kind, next) + `<button type="button" class="gate-later">${G.t('auth.req.later')}</button>` });
    m.querySelector('.gate-later').onclick = () => m.close();
    const first = m.querySelector('.gate-login'); first && first.focus();
    return false;
  };
  // any link to the donate / volunteer pages asks guests to log in first (the pages themselves are also gated)
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]'); if (!a || G.Auth.current()) return;
    if (['login', 'signup'].includes(document.body.dataset.page) || e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || a.target === '_blank') return;
    const href = a.getAttribute('href') || '', m = href.match(/^(donate|volunteer)\.html(\?[^#]*)?(#.*)?$/);
    if (!m) return;
    e.preventDefault(); G.requireLogin(m[1], href);
  });

  /* ---------------- shell ---------------- */
  const P = (p) => document.body.dataset.page === p ? ' active-pill' : '';
  function header() {
    const o = G.ORG, u = G.Auth.current(), t = G.t;
    const progLinks = G.DB.all('programs').filter((p) => p.active).sort((a, b) => a.order - b.order)
      .map((p) => `<a class="dropdown-item" href="programs.html#${p.slug}">${p.icon} ${G.esc(G.tr(p.title))}</a>`).join('');
    const cur = G.lang();
    const moreActive = cur !== 'en' && cur !== 'kn';
    const moreLabel = moreActive ? G.LANGS.find((l) => l.c === cur).l : 'More';
    const langs = `<button class="lang-btn${cur === 'en' ? ' on' : ''}" data-lang="en" aria-label="English">EN</button>
      <button class="lang-btn${cur === 'kn' ? ' on' : ''}" data-lang="kn" aria-label="Kannada">ಕನ್ನಡ</button>
      <div class="lang-more"><button type="button" class="lang-btn${moreActive ? ' on' : ''}" id="langMore" aria-haspopup="true" aria-expanded="false">${moreLabel} ▾</button>
        <div class="lang-menu" role="menu">${G.LANGS.filter((l) => l.c !== 'en' && l.c !== 'kn').map((l) => `<button role="menuitem" class="${cur === l.c ? 'on' : ''}" data-lang="${l.c}">${l.l}</button>`).join('')}</div></div>`;
    const dash = u && /ADMIN/.test(u.role) ? 'admin.html' : 'dashboard.html';
    const profile = u
      ? `<div class="profile-wrap"><button type="button" class="profile-btn" id="profileBtn" aria-haspopup="true" aria-expanded="false" title="${G.esc(u.name)}"><span class="avatar">${G.esc(u.name.trim()[0].toUpperCase())}</span><span class="pname">${G.esc(u.name.split(' ')[0])}</span> ▾</button>
          <div class="profile-menu" role="menu"><div class="pm-head"><b>${G.esc(u.name)}</b><small>${G.esc(u.email)}</small></div>
            <a role="menuitem" href="${dash}">${/ADMIN/.test(u.role) ? '🛠️ Admin portal' : '📊 ' + t('nav.account')}</a><a role="menuitem" href="donate.html">💚 ${t('btn.donate')}</a><a role="menuitem" href="#" id="logoutLink">🚪 ${t('nav.logout')}</a></div></div>`
      : `<div class="profile-wrap"><button type="button" class="profile-btn" id="profileBtn" aria-haspopup="true" aria-expanded="false" title="${t('nav.login')} / ${t('nav.signup')}"><span class="avatar">👤</span><span class="pname">${t('nav.login')}</span> ▾</button>
          <div class="profile-menu" role="menu"><div class="pm-head"><b>Welcome 🙏</b><small>Sign in to donate, volunteer and track receipts</small></div>
            <a role="menuitem" href="login.html" class="pm-login">🔑 ${t('nav.login')}</a><a role="menuitem" href="signup.html" class="pm-signup">✨ ${t('nav.signup')}</a></div></div>`;
    return `
    <header class="top-bar">
      <div class="top-bar-left">
        <a href="mailto:${o.email}" class="top-bar-contact">✉️ ${o.email}</a><span class="top-bar-sep">|</span>
        ${o.phones.map((p) => `<a href="tel:${p.tel}" class="top-bar-contact">📞 ${p.display}</a>`).join('<span class="top-bar-sep">|</span>')}
      </div>
      <div class="top-bar-center" data-i18n="top.tag">${t('top.tag')}</div>
      <div class="top-bar-right"><div class="lang-switch" role="group" aria-label="Language">${langs}</div>${profile}
        <a href="${o.waLink('Hello, I would like to know more about Green India Gokul Foundation')}" target="_blank" rel="noopener" class="social-icon-btn wa" title="WhatsApp">💬</a></div>
    </header>
    <nav class="main-header">
      <a href="index.html" class="header-brand"><img src="assets/logo-emblem.svg" alt="Green India Gokul Foundation emblem" class="brand-logo-img" width="64" height="64">
        <div class="brand-text-block"><h1 class="brand-name">${o.name}</h1><p class="brand-tagline">Nature • Cow Welfare • Health • Skill Development • Rural Prosperity</p></div></a>
      <ul class="nav-menu">
        <li class="nav-item"><a href="index.html" class="nav-link${P('home')}" data-i18n="nav.home">${t('nav.home')}</a></li>
        <li class="nav-item"><a href="programs.html" class="nav-link${P('programs')}">${t('nav.programs')} ▾</a><div class="nav-dropdown">${progLinks}</div></li>
        <li class="nav-item"><a href="events.html" class="nav-link${P('events')}" data-i18n="nav.events">${t('nav.events')}</a></li>
        <li class="nav-item"><a href="gallery.html" class="nav-link${P('gallery')}" data-i18n="nav.gallery">${t('nav.gallery')}</a></li>
        <li class="nav-item"><a href="awareness.html" class="nav-link${P('awareness')}${P('environment')}">${t('nav.awareness')} ▾</a><div class="nav-dropdown"><a class="dropdown-item" href="awareness.html">📰 ${t('nav.articles')}</a><a class="dropdown-item" href="environment.html">🌍 ${t('nav.campaign')}</a></div></li>
        <li class="nav-item"><a href="volunteer.html" class="nav-link${P('volunteer')}" data-i18n="nav.volunteer">${t('nav.volunteer')}</a></li>
        <li class="nav-item"><a href="contact.html" class="nav-link${P('contact')}" data-i18n="nav.contact">${t('nav.contact')}</a></li>
        <li class="nav-item"><a href="donate.html" class="donate-btn-header" data-i18n="btn.donate">${t('btn.donate')}</a></li>
      </ul>
      <button class="mobile-menu-btn" id="mobileMenuBtn" aria-label="Open menu">&#9776;</button>
    </nav>`;
  }

  function drawer() {
    const t = G.t, u = G.Auth.current();
    const L = (h, i, k) => `<li><a href="${h}" class="mobile-drawer-link" style="color:#1f2937;text-decoration:none">${i} ${t(k)}</a></li>`;
    return `<div id="mobileNavDrawer" style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99999;display:none">
      <div style="position:absolute;top:0;left:0;width:290px;max-width:85%;height:100%;background:#fff;padding:20px;display:flex;flex-direction:column;overflow:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e5e7eb;padding-bottom:12px;margin-bottom:14px">
          <b style="color:#0f4d2a">${G.ORG.name}</b><button id="closeMobileDrawer" aria-label="Close" style="background:none;border:none;font-size:1.6rem;cursor:pointer">&times;</button></div>
        <div class="lang-switch" style="margin-bottom:14px">${G.LANGS.map((l) => `<button class="lang-btn dark${G.lang() === l.c ? ' on' : ''}" data-lang="${l.c}">${l.l}</button>`).join('')}</div>
        <ul style="list-style:none;display:flex;flex-direction:column;gap:14px;font-weight:600">
          ${L('index.html', '🏠', 'nav.home')}${L('programs.html', '🌳', 'nav.programs')}${L('events.html', '📅', 'nav.events')}${L('gallery.html', '📸', 'nav.gallery')}
          ${L('awareness.html', '📰', 'nav.awareness')}${L('environment.html', '🌍', 'nav.campaign')}${L('volunteer.html', '👥', 'nav.volunteer')}${L('contact.html', '📞', 'nav.contact')}
          ${u ? L(/ADMIN/.test(u.role) ? 'admin.html' : 'dashboard.html', '👤', 'nav.account') : L('login.html', '🔑', 'nav.login') + L('signup.html', '✍️', 'nav.signup')}
        </ul>
        <a href="donate.html" class="donate-btn-header" style="margin-top:auto;justify-content:center;text-align:center">${t('btn.donate')} 💚</a>
      </div></div>`;
  }

  function footer() {
    const o = G.ORG, t = G.t, s = G.DB.settings();
    return `
    <div class="bottom-ribbon-banner"><div class="ribbon-motto-text">— Let's Build a Green, Healthy and Prosperous India Together... —</div></div>
    <footer class="site-footer"><div class="footer-grid">
      <div class="footer-col"><div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><img src="assets/logo-emblem.svg" alt="" width="56" height="56" style="width:56px;height:56px;flex:none"><h4 style="margin:0;color:#fff">${o.name}</h4></div>
        <p style="font-size:.82rem;line-height:1.55;color:#a7f3d0">Working for a greener, healthier and self-reliant India.</p>
        <p style="font-size:.74rem;color:#6ee7b7;margin-top:10px">${s.reg80G ? '80G: ' + G.esc(s.reg80G) : ''} ${s.reg12A ? '• 12A: ' + G.esc(s.reg12A) : ''}</p></div>
      <div class="footer-col"><h4>${t('page.programs')}</h4><ul class="footer-links">${G.DB.all('programs').filter((p) => p.active).sort((a, b) => a.order - b.order).map((p) => `<li><a href="programs.html#${p.slug}">${G.esc(G.tr(p.title))}</a></li>`).join('')}</ul></div>
      <div class="footer-col"><h4>${t('foot.links')}</h4><ul class="footer-links">
        <li><a href="events.html">${t('nav.events')}</a></li><li><a href="gallery.html">${t('nav.gallery')}</a></li><li><a href="reports.html">Annual Reports</a></li><li><a href="awareness.html">${t('nav.awareness')}</a></li><li><a href="environment.html">🌍 ${t('nav.campaign')}</a></li>
        <li><a href="volunteer.html">${t('nav.volunteer')}</a></li><li><a href="donate.html">${t('btn.donate')}</a></li><li><a href="contact.html">${t('nav.contact')}</a></li></ul></div>
      <div class="footer-col"><h4>${t('foot.contact')}</h4>
        <p style="font-size:.8rem;color:#a7f3d0;margin-bottom:8px">📍 ${o.address}</p>
        <p style="font-size:.8rem;color:#a7f3d0;margin-bottom:8px">${o.phones.map((p) => `📞 <a href="tel:${p.tel}" style="color:#a7f3d0">${p.display}</a>`).join('<br>')}</p>
        <p style="font-size:.8rem;margin-bottom:12px"><a href="mailto:${o.email}" style="color:#a7f3d0">✉️ ${o.email}</a></p>
        <form id="newsForm" class="footer-newsletter-input"><input type="email" required placeholder="${t('f.email')}" aria-label="${t('f.email')}"><button type="submit">${t('foot.join')}</button></form></div>
    </div>
    <div class="footer-bottom"><div>© ${new Date().getFullYear()} ${o.name}. ${t('foot.rights')} · <a href="terms.html" style="color:inherit">Terms</a> · <a href="privacy.html" style="color:inherit">Privacy</a></div><div style="font-style:italic">Crafted with Precision | Designed with Purpose | Delivered with Passion</div><button class="motion-btn" id="motionBtn" type="button" aria-pressed="true" title="Turn animations on or off">✨ <span>Animations</span> <b></b></button></div></footer>
    <nav class="mobile-bottom-nav"><div class="bottom-nav-grid">
      <a href="index.html" class="bottom-nav-link"><span class="bottom-nav-icon">🏠</span><span>${t('nav.home')}</span></a>
      <a href="programs.html" class="bottom-nav-link"><span class="bottom-nav-icon">🌳</span><span>${t('nav.programs')}</span></a>
      <a href="donate.html" class="bottom-nav-link"><span class="bottom-nav-icon" style="color:#ea580c">❤️</span><span style="color:#ea580c;font-weight:700">${t('page.donate')}</span></a>
      <a href="events.html" class="bottom-nav-link"><span class="bottom-nav-icon">📅</span><span>${t('nav.events')}</span></a>
      <a href="contact.html" class="bottom-nav-link"><span class="bottom-nav-icon">📞</span><span>${t('nav.contact')}</span></a></div></nav>`;
  }

  function chatShell() {
    const t = G.t;
    const waText = { en: 'Chat on WhatsApp', kn: 'WhatsApp ನಲ್ಲಿ ಮಾತನಾಡಿ', hi: 'WhatsApp पर बात करें', ta: 'WhatsApp-ல் பேசுங்கள்', te: 'WhatsAppలో మాట్లాడండి', ml: 'WhatsApp-ൽ സംസാരിക്കൂ' }[G.lang()] || 'Chat on WhatsApp';
    return `<a class="wa-float" data-notr href="${G.ORG.waLink('Hello, I would like to know more about Green India Gokul Foundation')}" target="_blank" rel="noopener" aria-label="${waText}"><span class="wa-note">${waText}</span><span class="wa-dot"><svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true"><path fill="#fff" d="M16 3a13 13 0 0 0-11.2 19.600L3 29l6.6-1.700A13 13 0 1 0 16 3zm0 2.4a10.600 10.600 0 1 1-5.4 19.700l-.4-.2-3.900 1 1-3.800-.2-.4A10.600 10.600 0 0 1 16 5.400zm-4.2 5.300c-.3 0-.700.100-1 .500-.4.400-1.300 1.300-1.300 3.100s1.300 3.600 1.500 3.800c.2.300 2.6 4 6.300 5.500 3.100 1.200 3.700 1 4.400.900.700-.1 2.200-.9 2.500-1.800.3-.9.3-1.600.2-1.800-.1-.2-.4-.3-.8-.5l-2.600-1.200c-.4-.1-.600-.2-.900.200l-1.200 1.500c-.2.3-.4.3-.8.100-.4-.2-1.600-.6-3-1.900-1.100-1-1.900-2.200-2.100-2.600-.2-.4 0-.6.2-.8l.6-.7c.2-.2.3-.4.4-.6.100-.3 0-.5 0-.7l-1.200-2.800c-.3-.7-.6-.6-.8-.6z"/></svg></span></a>` + `<button class="chat-launcher-btn" id="chatLauncher" aria-label="Open chat" title="${t('chat.title')}">💬</button>
    <div class="chat-window" id="chatWindow" role="dialog" aria-label="${t('chat.title')}">
      <div class="chat-header"><div style="display:flex;align-items:center;gap:8px"><img src="assets/logo-emblem.svg" alt="" width="30" height="30" style="width:30px;height:30px;border-radius:50%;background:#fff"><div><div style="font-weight:700;font-size:.88rem">${t('chat.title')}</div><div style="font-size:.68rem;opacity:.85">● ${t('chat.sub')}</div></div></div>
        <button id="closeChat" aria-label="Close" style="background:none;border:none;color:#fff;font-size:1.3rem;cursor:pointer">&times;</button></div>
      <div class="chat-messages" id="chatMessages"></div>
      <div class="chat-quick-chips" id="chatChips"></div>
      <div class="chat-input-row"><input class="chat-input" id="chatInput" placeholder="${t('chat.ph')}" aria-label="${t('chat.ph')}"><button class="btn-send-chat" id="sendChatBtn" aria-label="Send">&#10148;</button></div></div>`;
  }

  /* ---------------- chatbot (tool-assisted, local data) ---------------- */
  function initChat() {
    const L = G.lang(), win = document.getElementById('chatWindow'), box = document.getElementById('chatMessages'), inp = document.getElementById('chatInput');
    const sess = (sessionStorage.getItem('gigf_chat') || (sessionStorage.setItem('gigf_chat', G.uid('chat')), sessionStorage.getItem('gigf_chat')));
    const Tx = (en, kn, hi) => ({ en, kn, hi })[L] || en;
    const o = G.ORG;
    const log = (role, text) => { const c = G.DB.all('chats'); let s = c.find((x) => x.id === sess); if (!s) s = G.DB.add('chats', { id: sess, messages: [], escalated: false }); s.messages.push({ role, text, at: new Date().toISOString() }); G.DB.update('chats', sess, { messages: s.messages }); };
    const add = (html, user) => { const m = document.createElement('div'); m.className = 'chat-msg ' + (user ? 'user' : 'bot'); m[user ? 'textContent' : 'innerHTML'] = html; box.appendChild(m); box.scrollTop = box.scrollHeight; return m; };
    const bot = (html) => { const typing = add('…'); setTimeout(() => { typing.innerHTML = html; box.scrollTop = box.scrollHeight; }, 450); };
    const chips = document.getElementById('chatChips');
    const chipDefs = [[Tx('How to donate?', 'ದೇಣಿಗೆ ಹೇಗೆ?', 'दान कैसे करें?'), 'donate'], [Tx('80G receipt', '80G ರಸೀದಿ', '80G रसीद'), '80g'], [Tx('Upcoming events', 'ಮುಂಬರುವ ಕಾರ್ಯಕ್ರಮ', 'आगामी आयोजन'), 'events'], [Tx('Volunteer', 'ಸ್ವಯಂಸೇವಕ', 'स्वयंसेवक'), 'volunteer'], [Tx('Payment problem', 'ಪಾವತಿ ಸಮಸ್ಯೆ', 'भुगतान समस्या'), 'payment']];
    chips.innerHTML = chipDefs.map((c) => `<button class="chip-btn" data-k="${c[1]}">${c[0]}</button>`).join('') + `<button class="chip-btn chip-admin" data-k="admin">🙋 ${G.t('chat.admin')}</button>`;

    const has = (s, words) => words.some((w) => s.includes(w));
    function escalateForm(prefill) {
      const u = G.Auth.current();
      const m = add(`<b>${G.t('chat.admin')}</b><form class="chat-form"><input name="name" required placeholder="${G.t('f.name')}" value="${G.esc(u ? u.name : '')}"><input name="contact" required placeholder="${G.t('f.email')} / ${G.t('f.phone')}" value="${G.esc(u ? u.email : '')}"><textarea name="msg" required rows="3" placeholder="${G.t('f.message')}">${G.esc(prefill || '')}</textarea><button type="submit">${G.t('btn.send')}</button></form>`);
      m.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault(); const f = new FormData(e.target);
        const isMail = /@/.test(f.get('contact'));
        const t = G.Tickets.create({ category: 'CHAT_ESCALATION', name: f.get('name'), email: isMail ? f.get('contact') : '', phone: isMail ? '' : f.get('contact'), subject: 'Chat escalation', message: f.get('msg') });
        G.DB.update('chats', sess, { escalated: true, ticket: t.no });
        m.innerHTML = '✅ ' + Tx(`Ticket <b>${t.no}</b> created. Our team will contact you.`, `ಟಿಕೆಟ್ <b>${t.no}</b> ರಚಿಸಲಾಗಿದೆ. ನಮ್ಮ ತಂಡ ಶೀಘ್ರ ಉತ್ತರಿಸುತ್ತದೆ.`, `टिकट <b>${t.no}</b> बन गया है। हमारी टीम जल्द उत्तर देगी।`) +
          `<br><a href="${o.waLink('Hello, my ticket is ' + t.no)}" target="_blank" rel="noopener" class="chat-wa">💬 WhatsApp ${o.phones[0].display}</a>`;
      });
    }
    function answer(text, key) {
      const s = (key || text).toLowerCase();
      if (key === 'admin') return escalateForm();
      if (!key && /^\s*(hi+|hello|hey|namaste|good (morning|afternoon|evening)|ನಮಸ್ಕಾರ|नमस्ते|வணக்கம்|నమస్కారం)[\s!.?]*$/i.test(text)) return bot(Tx('Hello! 👋 I can help you find upcoming events, donate, volunteer, or learn about our programs. What would you like to know?', 'ನಮಸ್ಕಾರ! 👋 ಕಾರ್ಯಕ್ರಮಗಳು, ದೇಣಿಗೆ, ಸ್ವಯಂಸೇವೆ ಅಥವಾ ನಮ್ಮ ಯೋಜನೆಗಳ ಬಗ್ಗೆ ನಾನು ಸಹಾಯ ಮಾಡಬಲ್ಲೆ. ಏನು ತಿಳಿಯಬೇಕು?', 'नमस्ते! 👋 मैं आयोजन, दान, स्वयंसेवा या हमारे कार्यक्रमों में मदद कर सकता हूँ। आप क्या जानना चाहेंगे?'));
      if (key === 'payment' || has(s, ['payment', 'failed', 'deducted', 'not received', 'ಪಾವತಿ', 'भुगतान', 'paid but', 'refund', 'money back', 'charged twice', 'complaint', 'ಮರುಪಾವತಿ', 'रिफंड', 'वापसी'])) {
        const u = G.Auth.current();
        if (u) {
          const mine = G.Donations.mine().slice(0, 3);
          if (mine.length) return bot(Tx('Your latest donations:', 'ನಿಮ್ಮ ಇತ್ತೀಚಿನ ದೇಣಿಗೆಗಳು:', 'आपके हाल के दान:') + '<ul class="chat-list">' + mine.map((d) => `<li>${G.inr(d.amount)} · ${G.esc(d.program)} · <b>${d.status}</b>${d.receiptNo ? ' · ' + d.receiptNo : ''}</li>`).join('') + '</ul>' + Tx('If something looks wrong you can raise a ticket from My Dashboard, or talk to our team:', 'ಏನಾದರೂ ತಪ್ಪಾಗಿದ್ದರೆ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ನಲ್ಲಿ ಟಿಕೆಟ್ ರಚಿಸಿ ಅಥವಾ ತಂಡವನ್ನು ಸಂಪರ್ಕಿಸಿ:', 'कुछ गलत लगे तो डैशबोर्ड से टिकट बनाएँ या टीम से बात करें:')) || escalateForm();
        }
        bot(Tx('Please <a href="login.html">log in</a> so I can check your donations securely. If the money was debited but you got no receipt, tap below and our team will resolve it.', 'ದಯವಿಟ್ಟು <a href="login.html">ಲಾಗಿನ್</a> ಮಾಡಿ. ಹಣ ಕಡಿತವಾಗಿ ರಸೀದಿ ಬಂದಿಲ್ಲದಿದ್ದರೆ ಕೆಳಗೆ ಒತ್ತಿ.', 'कृपया <a href="login.html">लॉग इन</a> करें ताकि मैं आपके दान सुरक्षित रूप से देख सकूँ। राशि कटी पर रसीद नहीं मिली तो नीचे दबाएँ।'));
        return setTimeout(() => escalateForm('Payment issue: '), 700);
      }
      if (has(s, ['80g', 'tax', 'receipt', 'ರಸೀದಿ', 'रसीद', 'कर'])) {
        const st = G.DB.settings();
        return bot(Tx(`A receipt with a sequential number is generated for every successful donation. Add your PAN while donating so it can be printed on the receipt. ${st.reg80G ? 'Our 80G registration: <b>' + G.esc(st.reg80G) + '</b>.' : 'Our 80G/12A registration details will be shown here once configured by the Foundation — please confirm with our team before claiming a deduction.'}`,
          'ಪ್ರತಿ ಯಶಸ್ವಿ ದೇಣಿಗೆಗೆ ಕ್ರಮಸಂಖ್ಯೆಯ ರಸೀದಿ ರಚನೆಯಾಗುತ್ತದೆ. ರಸೀದಿಯಲ್ಲಿ PAN ಬರಲು ದೇಣಿಗೆ ಸಮಯದಲ್ಲಿ ನಮೂದಿಸಿ. 80G ವಿವರಗಳಿಗಾಗಿ ನಮ್ಮ ತಂಡವನ್ನು ಸಂಪರ್ಕಿಸಿ.',
          'हर सफल दान पर क्रमांक वाली रसीद बनती है। रसीद पर PAN के लिए दान करते समय दर्ज करें। 80G विवरण के लिए कृपया हमारी टीम से पुष्टि करें।'));
      }
      if (has(s, ['donat', 'ದೇಣಿಗೆ', 'दान', 'money', 'upi', 'sponsor'])) return bot(Tx('You can donate one-time or monthly by UPI, card or net-banking from the <a href="donate.html">Donate page</a>. Choose a program or “Where needed most”.', '<a href="donate.html">ದೇಣಿಗೆ ಪುಟ</a>ದಲ್ಲಿ UPI, ಕಾರ್ಡ್ ಅಥವಾ ನೆಟ್‌ಬ್ಯಾಂಕಿಂಗ್ ಮೂಲಕ ಒಂದು ಬಾರಿ ಅಥವಾ ಮಾಸಿಕ ದೇಣಿಗೆ ನೀಡಬಹುದು.', '<a href="donate.html">दान पृष्ठ</a> से UPI, कार्ड या नेटबैंकिंग द्वारा एक बार या मासिक दान कर सकते हैं।'));
      if (has(s, ['event', 'ಕಾರ್ಯಕ್ರಮ', 'आयोजन', 'camp', 'drive'])) {
        const ev = G.DB.all('events').filter((e) => e.status === 'UPCOMING').sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
        return bot(ev.length ? Tx('Upcoming events:', 'ಮುಂಬರುವ ಕಾರ್ಯಕ್ರಮಗಳು:', 'आगामी आयोजन:') + '<ul class="chat-list">' + ev.map((e) => `<li><a href="events.html#${e.slug}">${G.esc(G.tr(e.title))}</a> — ${G.fmtDate(e.date)}</li>`).join('') + '</ul>' : Tx('No events are scheduled right now.', 'ಈಗ ಯಾವುದೇ ಕಾರ್ಯಕ್ರಮ ನಿಗದಿಯಾಗಿಲ್ಲ.', 'अभी कोई आयोजन निर्धारित नहीं है।'));
      }
      if (has(s, ['volunteer', 'ಸ್ವಯಂ', 'स्वयं', 'join'])) return bot(Tx('Register on the <a href="volunteer.html">Volunteer page</a> with a government ID. After admin approval you get a digital badge, tasks and a certificate.', '<a href="volunteer.html">ಸ್ವಯಂಸೇವಕ ಪುಟ</a>ದಲ್ಲಿ ಗುರುತಿನ ಚೀಟಿಯೊಂದಿಗೆ ನೋಂದಾಯಿಸಿ. ಅನುಮೋದನೆಯ ನಂತರ ಬ್ಯಾಡ್ಜ್, ಕಾರ್ಯಗಳು ಮತ್ತು ಪ್ರಮಾಣಪತ್ರ ಸಿಗುತ್ತದೆ.', '<a href="volunteer.html">स्वयंसेवक पृष्ठ</a> पर सरकारी ID के साथ पंजीकरण करें। स्वीकृति के बाद बैज, कार्य और प्रमाणपत्र मिलेगा।'));
      if (has(s, ['goshala', 'cow', 'visit', 'ಗೋ', 'गौ', 'timing', 'hours'])) return bot(Tx(`Please call us to confirm goshala visit timings: <a href="tel:${o.phones[0].tel}">${o.phones[0].display}</a>.`, `ಗೋಶಾಲೆ ಭೇಟಿ ಸಮಯ ದೃಢೀಕರಿಸಲು ಕರೆ ಮಾಡಿ: <a href="tel:${o.phones[0].tel}">${o.phones[0].display}</a>.`, `गौशाला भ्रमण का समय जानने के लिए कॉल करें: <a href="tel:${o.phones[0].tel}">${o.phones[0].display}</a>।`));
      if (has(s, ['contact', 'phone', 'address', 'email', 'whatsapp', 'ಸಂಪರ್ಕ', 'संपर्क', 'where', 'location'])) return bot(`📍 ${o.address}<br>📞 ${o.phones.map((p) => `<a href="tel:${p.tel}">${p.display}</a>`).join(', ')}<br>✉️ <a href="mailto:${o.email}">${o.email}</a><br><a href="${o.waLink()}" target="_blank" rel="noopener" class="chat-wa">💬 WhatsApp</a>`);
      if (has(s, ['program', 'tree', 'yoga', 'women', 'ಕಾರ್ಯಕ್ರಮಗಳು', 'कार्यक्रम'])) return bot(Tx('See all our <a href="programs.html">programs</a>: ', 'ನಮ್ಮ <a href="programs.html">ಕಾರ್ಯಕ್ರಮಗಳು</a>: ', 'हमारे <a href="programs.html">कार्यक्रम</a>: ') + G.DB.all('programs').map((p) => p.icon + ' ' + G.esc(G.tr(p.title))).join(', '));
      bot(Tx("I'm not sure about that one. I can help with events, donating, volunteering and our programs — or type “talk to admin” and our team will follow up.", 'ಇದರ ಬಗ್ಗೆ ಖಚಿತವಿಲ್ಲ. ಕಾರ್ಯಕ್ರಮಗಳು, ದೇಣಿಗೆ, ಸ್ವಯಂಸೇವೆ ಬಗ್ಗೆ ಸಹಾಯ ಮಾಡಬಲ್ಲೆ — ಅಥವಾ “admin” ಎಂದು ಬರೆಯಿರಿ, ನಮ್ಮ ತಂಡ ಸಂಪರ್ಕಿಸುತ್ತದೆ.', 'इस बारे में पक्का नहीं। मैं आयोजन, दान, स्वयंसेवा में मदद कर सकता हूँ — या “admin” लिखें, हमारी टीम संपर्क करेगी।'));
      if (has(s, ['admin', 'human', 'support', 'agent', 'person', 'team'])) setTimeout(() => escalateForm(text), 500);
    }
    /* ---- LLM (Groq via server-side proxy). Falls back to the built-in answers above if unavailable. ---- */
    const cfg = window.GIGF_CONFIG || {}, hist = []; let llmDown = false, busy = false;
    const PAGES = /\b(donate|volunteer|events|gallery|programs|contact|awareness|environment)\.html\b/g;
    const fmt = (txt) => G.esc(String(txt)
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')                  // markdown links -> their text only
      .replace(/(?:https?:\/\/|www\.)\S+/gi, '')                  // never show raw web addresses
      .replace(/^\s{0,3}#{1,6}\s*(.+)$/gm, '**$1**')              // headings -> bold line
      .replace(/^\s*[-*•]\s+/gm, '• ')                            // bullets
      .replace(/`([^`]+)`/g, '$1').replace(/\|/g, ' '))
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(PAGES, '<a href="$1.html">$1.html</a>').replace(/\n{3,}/g, '\n\n').replace(/\n/g, '<br>');
    const context = () => ({
      programs: G.DB.all('programs').filter((p) => p.active).map((p) => G.tr(p.title) + ': ' + G.tr(p.tagline) + ' ' + G.tr(p.desc) + ' Initiatives: ' + (p.initiatives || []).map((i) => G.tr(i)).join(', ')),
      events: G.DB.all('events').filter((e) => e.status === 'UPCOMING').sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6).map((e) => ({ title: G.tr(e.title), date: e.date, location: e.location, tentative: !!e.tentative }))
    });
    async function askLLM() {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 20000);
      try {
        const r = await fetch(cfg.chatApi, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: hist.slice(-10), lang: L, context: context() }), signal: ctl.signal });
        if (!r.ok) { if ([404, 405, 503].includes(r.status)) llmDown = true; return null; }   // not deployed / no key -> stop trying this session
        const j = await r.json(); return j && j.reply ? j : null;
      } catch (e) { return null; } finally { clearTimeout(to); }
    }
    const local = (t) => has(t.toLowerCase(), ['payment', 'failed', 'deducted', 'not received', 'ಪಾವತಿ', 'भुगतान', 'paid but', 'refund', 'money back', 'charged twice', 'complaint', 'ಮರುಪಾವತಿ', 'रिफंड', 'वापसी']);  // payment look-ups use the donor's own records, not the LLM
    async function send(t, k) {
      t = (t || '').trim(); if (!t || busy) return; add(t, true); log('user', t); inp.value = '';
      if (!cfg.chatApi || llmDown || k === 'admin' || k === 'payment' || local(t)) return answer(t, k);
      hist.push({ role: 'user', content: t }); busy = true;
      const typing = add('<span class="dots"><i></i><i></i><i></i></span>'); typing.classList.add('typing');
      const j = await askLLM(); busy = false;
      if (!j) { typing.remove(); hist.pop(); return answer(t, k); }
      typing.classList.remove('typing'); typing.innerHTML = fmt(j.reply); box.scrollTop = box.scrollHeight;
      hist.push({ role: 'assistant', content: j.reply }); log('bot', j.reply);
      if (j.escalate) setTimeout(() => escalateForm(t), 500);
    }
    document.getElementById('chatLauncher').addEventListener('click', () => { win.classList.toggle('open'); if (win.classList.contains('open')) inp.focus(); });
    document.getElementById('closeChat').addEventListener('click', () => win.classList.remove('open'));
    document.getElementById('sendChatBtn').addEventListener('click', () => send(inp.value));
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(inp.value); });
    chips.addEventListener('click', (e) => { const b = e.target.closest('.chip-btn'); if (b) send(b.textContent, b.dataset.k); });
    add(G.t('chat.hello'));
  }

  /* ---------------- boot ---------------- */
  document.addEventListener('DOMContentLoaded', async () => {
    await G.Auth.ensureDemoAdmin();
    if (G.cloud) await G.cloud.pull();   // shared events and news, before the page draws them
    const h = document.getElementById('gigf-header'), f = document.getElementById('gigf-footer');
    if (h) h.outerHTML = header();
    if (f) f.outerHTML = footer();
    const wrap = document.createElement('div');
    const needTab = !G.Auth.current() && !['login', 'signup'].includes(document.body.dataset.page);
    wrap.innerHTML = drawer() + chatShell() + (needTab ? `<a class="side-tab" href="login.html" aria-label="Login or Sign up"><span>🔑 ${G.t('nav.login')} / ${G.t('nav.signup')}</span></a>` : '') + '<div class="scroll-progress" id="scrollProgress"></div><button class="to-top" id="toTop" aria-label="Back to top">↑</button>';
    document.body.append(...wrap.children);
    const sp = document.getElementById('scrollProgress'), tt = document.getElementById('toTop');
    const onScroll = () => { const h = document.documentElement.scrollHeight - innerHeight; sp.style.width = (h > 0 ? (scrollY / h) * 100 : 0) + '%'; tt.classList.toggle('show', scrollY > 600); document.querySelector('.main-header') && document.querySelector('.main-header').classList.toggle('scrolled', scrollY > 30); };
    addEventListener('scroll', onScroll, { passive: true }); onScroll(); tt.onclick = () => scrollTo({ top: 0, behavior: 'smooth' });
    const tc = document.createElement('div'); tc.id = 'toastContainer'; tc.className = 'toast-container'; document.body.appendChild(tc);

    // language "More" dropdown + profile menu (click to open, click outside / Esc to close)
    const menus = [['langMore', '.lang-more'], ['profileBtn', '.profile-wrap']].map(([id, sel]) => ({ btn: document.getElementById(id), box: document.querySelector(sel) })).filter((m) => m.btn);
    const closeMenus = (except) => menus.forEach((m) => { if (m !== except) { m.box.classList.remove('open'); m.btn.setAttribute('aria-expanded', 'false'); } });
    menus.forEach((m) => m.btn.addEventListener('click', (e) => { e.stopPropagation(); const open = !m.box.classList.contains('open'); closeMenus(m); m.box.classList.toggle('open', open); m.btn.setAttribute('aria-expanded', String(open)); }));
    document.addEventListener('click', () => closeMenus());
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenus(); });
    const mb = document.getElementById('motionBtn'), root = document.documentElement;
    const paint = () => { const off = root.classList.contains('no-motion'); mb.querySelector('b').textContent = off ? 'Off' : 'On'; mb.setAttribute('aria-pressed', String(!off)); };
    paint(); mb.addEventListener('click', () => { const off = root.classList.toggle('no-motion'); try { localStorage.setItem('gigf_motion', off ? 'off' : 'on'); } catch (e) { } paint(); G.toast(off ? 'Animations turned off' : 'Animations turned on — scroll to see them', off ? '⏸️' : '✨'); if (!off) setTimeout(() => location.reload(), 600); });
    document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => G.setLang(b.dataset.lang)));
    const dr = document.getElementById('mobileNavDrawer');
    document.getElementById('mobileMenuBtn').addEventListener('click', () => { dr.classList.add('open'); document.body.style.overflow = 'hidden'; });
    const closeDr = () => { dr.classList.remove('open'); document.body.style.overflow = ''; };
    document.getElementById('closeMobileDrawer').addEventListener('click', closeDr);
    dr.addEventListener('click', (e) => { if (e.target === dr) closeDr(); });
    const lo = document.getElementById('logoutLink'); if (lo) lo.addEventListener('click', (e) => { e.preventDefault(); G.Auth.logout(); location.href = 'index.html'; });
    const nf = document.getElementById('newsForm');
    if (nf) nf.addEventListener('submit', (e) => { e.preventDefault(); const em = nf.querySelector('input').value; G.DB.add('subscribers', { email: em }); nf.reset(); G.toast('Subscribed — thank you!', '💌'); });
    document.querySelectorAll('.bottom-nav-link').forEach((a) => { if ((a.getAttribute('data-page-file') || a.getAttribute('href')) === (window.GIGF_FILE || location.pathname.split('/').pop())) a.classList.add('active'); });

    // scroll-reveal animation for any .reveal element
    const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 }) : null;
    G.observeReveal = (root) => (root || document).querySelectorAll('.reveal:not(.in), .reveal-l:not(.in), .reveal-r:not(.in), .reveal-z:not(.in)').forEach((el) => (io ? io.observe(el) : el.classList.add('in')));

    G.applyI18n(); initChat();
    if (G.look) G.look.apply();   // festival logo / banner / colours
    // banner text follows the language switcher immediately (stored translations in js/i18n-banner.js)
    const bt = G.BANNER && G.BANNER[G.lang()];
    if (bt && document.getElementById('heroCarousel')) {
      const root = document.getElementById('heroCarousel'), walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [];
      while (walk.nextNode()) nodes.push(walk.currentNode);
      nodes.forEach((n) => { const raw = n.nodeValue, key = raw.replace(/[→⟨⟩〈〉]/g, '').replace(/\s+/g, ' ').trim(); if (key && bt[key]) { n.nodeValue = raw.replace(raw.trim(), bt[key] + (/→/.test(raw) ? ' →' : '')); n.parentElement.setAttribute('data-notr', ''); } });
      root.querySelectorAll('[data-label]').forEach((el) => { if (bt[el.dataset.label]) el.dataset.label = bt[el.dataset.label]; });
    }
    // Canva-style word-by-word pop for banner headings
    document.querySelectorAll('.hero-heading, .page-hero h2').forEach((el) => {
      const txt = el.textContent.trim(); if (!txt || el.dataset.split) return; el.dataset.split = 1; el.setAttribute('aria-label', txt);
      el.innerHTML = txt.split(/\s+/).map((w, i) => `<span class="w" aria-hidden="true" style="--i:${i}">${G.esc(w)}</span>`).join(' ');
    });
    // elements that pop in as they scroll into view
    document.querySelectorAll('.section-head, .footer-col, .section > .wrap > .card').forEach((el) => el.classList.add('reveal'));
    ready = true; q.forEach((fn) => fn());
    G.observeReveal();
  });
})();
