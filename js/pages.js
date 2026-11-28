/**
 * Page controllers for the public site. Each page sets <body data-page="…">.
 * All content comes from GIGF.DB so Admin edits show up instantly.
 */
(function () {
  const G = window.GIGF;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = G.esc, tr = G.tr, t = G.t;
  const html = (el, h) => { el.innerHTML = h; G.observeReveal && G.observeReveal(el); };
  const progById = (id) => G.DB.all('programs').find((p) => p.id === id);
  const publishedNews = () => G.DB.all('news').filter((n) => n.status === 'PUBLISHED' || (n.status === 'SCHEDULED' && n.publishAt && new Date(n.publishAt) <= new Date()))
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.date.localeCompare(a.date));
  const publishedArticles = () => G.DB.all('articles').filter((a) => a.status === 'PUBLISHED' || (a.status === 'SCHEDULED' && a.publishAt && new Date(a.publishAt) <= new Date())).sort((a, b) => b.date.localeCompare(a.date));
  const upcoming = () => G.DB.all('events').filter((e) => e.status === 'UPCOMING').sort((a, b) => a.date.localeCompare(b.date));
  const regCount = (id) => G.DB.all('registrations').filter((r) => r.eventId === id);
  const emptyBox = (icon, msg) => `<div class="empty"><span class="e">${icon}</span>${msg}</div>`;
  const SAMPLE_VOICES = [
    { sample: true, name: 'Asha', role: 'volunteer', text: 'Planting saplings with the team was the best Sunday I have had in a long time. Everything was well organised and easy to join.' },
    { sample: true, name: 'Ravi', role: 'donor', text: 'I like that I can choose the programme my gift goes to, and find my receipt again whenever I need it.' },
    { sample: true, name: 'Lakshmi', role: 'workshop participant', text: 'The skills session gave me the confidence to start stitching from home and to join a savings group.' }
  ];

  /* ---------- shared renderers ---------- */
  function programCard(p, opts) {
    return `<article class="card lift prog-card reveal" id="${p.slug}" data-id="${p.id}">
      <div class="img" style="background-image:url('${esc(progPic(p.img))}')"><span class="ico">${p.icon}</span></div>
      <div class="card-body"><h4>${esc(tr(p.title))}</h4><p>${esc(tr(p.tagline))}</p>
        <div class="prog-detail">${progDetail(p)}</div>
        <button class="btn btn-ghost btn-sm" data-toggle style="margin-top:12px;align-self:flex-start">${t('btn.know')} →</button></div></article>`;
  }
  const progPic = (u) => (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(u || '') ? u : G.safeUrl(u, ''));
  function progMedia(p) {
    const photos = (p.photos || []).map(progPic).filter(Boolean), vids = (p.videos || []).map((u) => G.safeUrl(u, '')).filter(Boolean);
    if (!photos.length && !vids.length) return '';
    return '<div class="prog-media">' + photos.map((u) => `<img src="${esc(u)}" alt="${esc(tr(p.title))}" loading="lazy">`).join('') +
      vids.map((u) => (/^(?!https?:).*\.mp4$/i.test(u) ? `<video src="${esc(u)}#t=0.6" controls preload="metadata" playsinline></video>` : `<a class="link-more" href="${esc(u)}" target="_blank" rel="noopener">▶ Watch video</a>`)).join('') + '</div>';
  }
  function progDetail(p) {
    const evs = upcoming().filter((e) => e.program === p.id).slice(0, 2);
    return `<p style="color:#374151;margin-bottom:8px">${esc(tr(p.desc))}</p>
      <ul>${(p.initiatives || []).map((i) => `<li>${esc(tr(i))}</li>`).join('')}</ul>
      ${progMedia(p)}
      ${p.impact && p.impact.length ? '<div class="impact-row">' + p.impact.map((m) => `<span><b>${esc(m.value)}</b> ${esc(m.label)}</span>`).join('') + '</div>' : ''}
      ${evs.length ? '<div style="font-size:.82rem;margin:8px 0"><b>📅 ' + t('home.events') + ':</b> ' + evs.map((e) => `<a href="events.html#${e.slug}">${esc(tr(e.title))} (${G.fmtDate(e.date, { day: 'numeric', month: 'short' })})</a>`).join(', ') + '</div>' : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn btn-orange btn-sm" href="donate.html?program=${p.id}">💚 ${t('btn.donateprog')}</a><a class="btn btn-primary btn-sm" href="volunteer.html?program=${p.id}">🤝 ${t('btn.volprog')}</a></div>`;
  }
  const safePoster = (u) => (typeof u === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(u) ? u : '');   // only real inline images are ever rendered
  function eventCard(e, compact) {
    const d = new Date(e.date), regs = regCount(e.id).length, left = Math.max(0, e.capacity - regs), pct = Math.min(100, Math.round((regs / e.capacity) * 100));
    return `<article class="card lift ev-card reveal" id="${e.slug}"><div class="ev-date"><b>${d.getDate()}</b><span>${d.toLocaleString('en', { month: 'short' })}</span><span>${d.getFullYear()}</span></div>
      <div class="ev-body"><h4><a href="event.html?e=${esc(e.slug)}">${esc(tr(e.title))}</a></h4>
      <div class="ev-meta"><span>🕒 ${e.time}</span><span>📍 ${esc(e.location)}</span>${progById(e.program) ? `<span>${progById(e.program).icon} ${esc(tr(progById(e.program).title))}</span>` : ''}</div>
      ${compact ? '' : `<p style="font-size:.86rem;color:#4b5563">${esc(tr(e.desc))}</p>`}
      ${!compact && safePoster(e.poster) ? `<img class="ev-poster" src="${safePoster(e.poster)}" alt="Poster: ${esc(tr(e.title))}" loading="lazy" data-poster="${e.id}">` : ''}
      ${e.status === 'UPCOMING' ? `<div class="bar" title="${pct}% booked"><i style="width:${pct}%"></i></div><div style="font-size:.74rem;color:#6b7280;margin-bottom:8px">${left > 0 ? left + ' spots left' : 'Fully booked'}${e.tentative ? ' · <span class="chip warn">Tentative</span>' : ''}</div>
      <button class="btn btn-primary btn-sm" data-reg="${e.id}" ${left ? '' : 'disabled'}>${t('btn.register')}</button>` : '<span class="chip gray">Completed</span> <a class="link-more" href="event.html?e=' + esc(e.slug) + '">📸 ' + t('nav.gallery') + '</a>'}</div></article>`;
  }

  /* ---------- event registration modal ---------- */
  function openRegister(id) {
    if (!G.requireLogin('event', 'events.html?reg=' + id)) return;
    const e = G.DB.get('events', id), u = G.Auth.current() || {};
    const volLeft = Math.max(0, (e.volSlots == null ? 10 : e.volSlots) - G.DB.all('registrations').filter((r) => r.eventId === id && r.asVolunteer).length);
    const m = G.modal({ title: '📅 ' + esc(tr(e.title)), html: `<p style="font-size:.84rem;color:#4b5563;margin-bottom:12px">${G.fmtDate(e.date)} · ${e.time} · ${esc(e.location)}</p>
      <form id="regForm" novalidate class="f-grid">
        <div class="field"><label>${t('f.name')} *</label><input name="name" value="${esc(u.name || '')}" required><span class="err">Required</span></div>
        <div class="field"><label>${t('f.phone')} *</label><input name="phone" inputmode="tel" value="${esc(u.phone || '')}" placeholder="9XXXXXXXXX"><span class="err">Enter a valid 10-digit mobile</span></div>
        <div class="field f-full"><label>${t('f.email')} *</label><input name="email" type="email" value="${esc(u.email || '')}"><span class="err">Enter a valid email</span></div>
        <div class="field"><label>Guests (incl. you)</label><select name="guests">${[1, 2, 3, 4, 5].map((n) => `<option>${n}</option>`).join('')}</select></div>
        <div class="field" style="align-self:end"><label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" name="vol" style="width:auto" ${volLeft ? '' : 'disabled'}> Book a volunteer slot (${volLeft} left)</label></div>
        <button class="btn btn-primary f-full" type="submit">${t('btn.register')} →</button></form>`});
    $('#regForm', m).addEventListener('submit', (ev) => {
      ev.preventDefault(); const f = new FormData(ev.target); let ok = true;
      const bad = (n, c) => { const fld = ev.target.elements[n].closest('.field'); fld.classList.toggle('bad', !c); if (!c) ok = false; };
      bad('name', f.get('name').trim().length > 1); bad('phone', /^[6-9]\d{9}$/.test(f.get('phone').replace(/\D/g, '').slice(-10))); bad('email', /^\S+@\S+\.\S+$/.test(f.get('email')));
      if (!ok) return;
      if (G.DB.all('registrations').some((r) => r.eventId === id && r.email.toLowerCase() === f.get('email').toLowerCase())) return G.toast('You are already registered for this event.', 'ℹ️');
      if (e.capacity - regCount(id).length < Number(f.get('guests'))) return G.toast('Not enough spots left for that many guests.', '⚠️');
      G.DB.add('registrations', { eventId: id, name: f.get('name'), phone: f.get('phone'), email: f.get('email'), guests: Number(f.get('guests')), asVolunteer: !!f.get('vol'), attended: false });
      m.close(); G.toast('Registered! See you at ' + tr(e.title), '🎉');
      if (document.body.dataset.page === 'events') renderEvents();
    });
  }
  document.addEventListener('click', (ev) => { const b = ev.target.closest('[data-reg]'); if (b) openRegister(b.dataset.reg); const p = ev.target.closest('[data-poster]'); if (p) { const e = G.DB.get('events', p.dataset.poster); if (e && safePoster(e.poster)) G.modal({ wide: true, title: '🖼️ ' + esc(tr(e.title)), html: `<img src="${safePoster(e.poster)}" alt="Event poster" style="width:100%;border-radius:12px">` }); } });

  /* ---------- lightbox (single unified handler, keyboard + swipe) ---------- */
  function lightbox(items, start) {
    let i = start;
    const lb = document.createElement('div'); lb.className = 'lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true');
    lb.innerHTML = '<button class="lb-btn lb-x" aria-label="Close">×</button><button class="lb-btn lb-prev" aria-label="Previous">‹</button><div class="lb-stage"></div><button class="lb-btn lb-next" aria-label="Next">›</button><div class="lb-cap"></div>';
    document.body.appendChild(lb); document.body.style.overflow = 'hidden';
    const stage = $('.lb-stage', lb), cap = $('.lb-cap', lb);
    function show() {
      const g = items[i]; stage.innerHTML = '';
      const node = document.createElement(g.type === 'VIDEO' ? 'video' : 'img');
      node.src = G.mediaUrl(g.src); node.alt = tr(g.title);
      if (g.type === 'VIDEO') { node.controls = true; node.autoplay = true; node.playsInline = true; }
      stage.appendChild(node);
      const cat = G.DB.all('programs').find((p) => p.id === g.category);
      cap.innerHTML = `${esc(tr(g.title))}<small>${G.fmtDate(g.date)} · ${esc(cat ? tr(cat.title) : g.category === 'community' ? t('cat.community') : '')} · ${i + 1}/${items.length}</small>`;
      const ev = g.eventId && G.DB.get('events', g.eventId);
      if (ev) { const line = document.createElement('div'); line.className = 'lb-event'; line.textContent = '📅 ' + tr(ev.title) + (ev.location ? ' · 📍 ' + ev.location : ''); cap.appendChild(line); }
    }
    const close = () => { lb.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', key); };
    const go = (d) => { i = (i + d + items.length) % items.length; show(); };
    const key = (e) => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'ArrowRight') go(1); };
    document.addEventListener('keydown', key);
    $('.lb-x', lb).onclick = close; $('.lb-prev', lb).onclick = () => go(-1); $('.lb-next', lb).onclick = () => go(1);
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    let sx = null; lb.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', (e) => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); sx = null; });
    show(); $('.lb-x', lb).focus();
  }
  function galleryTile(g, idx) {
    const media = g.type === 'VIDEO' ? `<video src="${esc(G.mediaUrl(g.src))}#t=0.6" preload="metadata" muted playsinline></video><span class="m-play">▶</span>` : `<img src="${esc(G.mediaUrl(g.src))}" alt="${esc(tr(g.title))}" loading="lazy">`;
    return `<div class="m-item reveal" style="--d:${(idx % 12) * 80}ms" data-i="${idx}" tabindex="0" role="button" aria-label="${esc(tr(g.title))}">${media}<span class="chip m-badge">${g.type === 'VIDEO' ? '🎬 Video' : '📷 Photo'}</span><div class="m-cap">${esc(tr(g.title))}</div></div>`;
  }
  function bindGallery(container, items) {
    const open = (el) => { const it = el.closest('.m-item'); if (it) lightbox(items, Number(it.dataset.i)); };
    container.addEventListener('click', (e) => open(e.target));
    container.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e.target); } });
  }

  /* =====================================================================
     HOME
     ===================================================================== */
  /* ---------- media manager: only ONE video plays at a time; all stop when the tab is hidden or page unloads ---------- */
  const allVideos = () => Array.from(document.querySelectorAll('video'));
  const pauseAll = (except) => allVideos().forEach((v) => { if (v !== except && !v.paused) v.pause(); });
  document.addEventListener('play', (e) => { if (e.target && e.target.tagName === 'VIDEO') pauseAll(e.target); }, true);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseAll(); });
  addEventListener('pagehide', () => pauseAll());
  G.pauseAllVideos = pauseAll;

  /* ---------- count-up numbers (start when scrolled into view) ---------- */
  function countUp(el) {
    const to = Number(el.dataset.to) || 0, suf = el.dataset.suffix || '', pre = el.dataset.prefix || '', dur = 1700, t0 = performance.now();
    if (document.documentElement.classList.contains('no-motion')) { el.textContent = pre + to.toLocaleString('en-IN') + suf; return; }
    (function f(t) { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = pre + Math.round(to * e).toLocaleString('en-IN') + suf; if (p < 1) requestAnimationFrame(f); })(t0);
  }
  const countIO = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { countUp(e.target); countIO.unobserve(e.target); } }), { threshold: 0.4 }) : null;
  G.observeCounts = (root) => $$('.count', root).forEach((el) => (countIO ? countIO.observe(el) : countUp(el)));

  /* ---------- slideshow "presentation" (gallery + home) ---------- */
  G.Slideshow = function (root, items, opt) {
    opt = Object.assign({ autoplay: true, interval: 5200 }, opt || {});
    let i = 0, timer = null, playing = opt.autoplay, inView = true, seen = false;
    root.innerHTML = `<div class="ss"><div class="ss-stage" tabindex="0" aria-roledescription="carousel" aria-label="Gallery slideshow"><div class="ss-bg"></div><div class="ss-media"></div>
      <button class="ss-nav ss-prev" aria-label="Previous">‹</button><button class="ss-nav ss-next" aria-label="Next">›</button>
      <div class="ss-count"></div><div class="ss-tools"><button class="ss-btn" data-ss="play" aria-label="Play/pause">⏸</button><button class="ss-btn" data-ss="fs" aria-label="Fullscreen">⛶</button></div>
      <div class="ss-cap"></div><div class="ss-bar"><i></i></div></div><div class="ss-thumbs"></div></div>`;
    const stage = $('.ss-stage', root), media = $('.ss-media', root), bg = $('.ss-bg', root), cap = $('.ss-cap', root), cnt = $('.ss-count', root), bar = $('.ss-bar i', root), thumbs = $('.ss-thumbs', root), pbtn = $('[data-ss=play]', root);
    const catName = (g) => { const p = G.DB.all('programs').find((x) => x.id === g.category); return p ? tr(p.title) : g.category === 'community' ? t('cat.community') : ''; };
    function drawThumbs() {
      thumbs.innerHTML = items.map((g, k) => `<button class="ss-th ${k === i ? 'on' : ''}" style="--i:${k}" data-k="${k}" aria-label="${esc(tr(g.title))}">${g.type === 'VIDEO' ? `<video src="${esc(G.mediaUrl(g.src))}#t=0.6" preload="metadata" muted playsinline></video><span>▶</span>` : `<img src="${esc(G.mediaUrl(g.src))}" alt="" loading="lazy">`}</button>`).join('');
    }
    function pauseVideo() { const v = media.querySelector('video'); if (v && !v.paused) v.pause(); }
    function clearTimer() { clearTimeout(timer); bar.style.transition = 'none'; bar.style.width = '0'; }
    function arm() {
      clearTimer(); const g = items[i]; if (!playing || !g || !inView) return;
      void bar.offsetWidth; bar.style.transition = `width ${opt.interval}ms linear`; bar.style.width = '100%';
      timer = setTimeout(() => { const v = media.querySelector('video'); if (v && !v.paused) return; go(1); }, opt.interval);
    }
    function show(k, dir, grow) {
      if (!items.length) { media.innerHTML = '<div class="empty" style="color:#fff">Nothing to show for this filter.</div>'; cap.innerHTML = cnt.textContent = ''; thumbs.innerHTML = ''; bg.style.backgroundImage = ''; return; }
      i = (k + items.length) % items.length; const g = items[i];
      const el = document.createElement(g.type === 'VIDEO' ? 'video' : 'img');
      el.className = 'ss-item ' + (grow ? 'grow' : dir < 0 ? 'from-l' : 'from-r'); el.src = G.mediaUrl(g.src); el.alt = tr(g.title);
      if (g.type === 'VIDEO') { el.controls = true; el.playsInline = true; el.preload = 'metadata'; el.onplay = clearTimer; el.onended = () => { if (playing && inView) go(1); }; }
      else el.classList.add('kb');
      pauseVideo();
      const old = media.firstElementChild; media.appendChild(el);
      if (old) { old.classList.add('out'); setTimeout(() => old.remove(), 600); }
      bg.style.backgroundImage = g.type === 'PHOTO' ? `url('${g.src}')` : '';
      cap.innerHTML = `<b>${esc(tr(g.title))}</b><small>${G.fmtDate(g.date)}${catName(g) ? ' · ' + esc(catName(g)) : ''}</small>`;
      cnt.textContent = (i + 1) + ' / ' + items.length;
      $$('.ss-th', thumbs).forEach((b, n) => b.classList.toggle('on', n === i));
      const on = $('.ss-th.on', thumbs); if (on && thumbs.scrollTo) thumbs.scrollTo({ left: on.offsetLeft - thumbs.clientWidth / 2 + on.clientWidth / 2, behavior: 'smooth' });
      arm();
    }
    const go = (d) => show(i + d, d);
    $('.ss-prev', root).onclick = () => go(-1); $('.ss-next', root).onclick = () => go(1);
    thumbs.onclick = (e) => { const b = e.target.closest('.ss-th'); if (b) show(Number(b.dataset.k), Number(b.dataset.k) - i); };
    pbtn.onclick = () => { playing = !playing; pbtn.textContent = playing ? '⏸' : '▶'; playing ? arm() : clearTimer(); };
    $('[data-ss=fs]', root).onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else (stage.requestFullscreen || stage.webkitRequestFullscreen || (() => G.toast('Fullscreen not supported', 'ℹ️'))).call(stage); };
    stage.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'ArrowRight') go(1); else if (e.key === ' ' && e.target === stage) { e.preventDefault(); pbtn.click(); } });
    let sx = null; stage.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', (e) => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1); sx = null; });
    stage.addEventListener('mouseenter', () => { if (playing && items[i] && items[i].type !== 'VIDEO') { clearTimeout(timer); const w = bar.getBoundingClientRect().width / stage.clientWidth; bar.style.transition = 'none'; bar.style.width = (w * 100) + '%'; } });
    stage.addEventListener('mouseleave', () => arm());
    const api = { update(list, start) { items = list; i = 0; seen = true; drawThumbs(); show(start || 0, 1, true); }, goto(k) { show(k, k - i); }, get index() { return i; } };
    drawThumbs();
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => es.forEach((e) => {
        const vis = e.intersectionRatio >= 0.12;
        if (vis === inView && seen) return;
        inView = vis;
        if (!vis) { pauseVideo(); clearTimer(); return; }   // scrolled away: stop video and autoplay
        if (!seen) { seen = true; show(i, 1, true); } else arm();  // first time on screen: grow in from tiny
      }), { threshold: [0, 0.12, 0.5] }).observe(stage);
    } else { seen = true; show(0, 1, true); }
    return api;
  };

  function initHome() {
    // hero carousel
    const slides = $$('.hero-slide'), dots = $$('.carousel-dots .dot'); let cur = 0, timer;
    const hsEl = $('.hero-section'); hsEl.insertAdjacentHTML('beforeend', '<div class="hero-progress"><i></i></div>'); const pb = $('.hero-progress i', hsEl);
    const restartBar = () => { pb.style.animation = 'none'; void pb.offsetWidth; pb.style.animation = 'heroBar 6.5s linear forwards'; };
    const show = (n) => { cur = (n + slides.length) % slides.length; slides.forEach((s, k) => s.classList.toggle('active', k === cur)); dots.forEach((d, k) => d.classList.toggle('active', k === cur)); restartBar(); };
    const start = () => { clearInterval(timer); timer = setInterval(() => show(cur + 1), 6500); restartBar(); };
    $('.carousel-arrow.next').onclick = () => { show(cur + 1); start(); }; $('.carousel-arrow.prev').onclick = () => { show(cur - 1); start(); };
    dots.forEach((d, k) => (d.onclick = () => { show(k); start(); })); start();
    const hs = $('.hero-section'); hs.addEventListener('mouseenter', () => clearInterval(timer)); hs.addEventListener('mouseleave', start);
    let tx = null; hs.addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; }, { passive: true });
    hs.addEventListener('touchend', (e) => { if (tx == null) return; const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 50) { show(cur + (dx < 0 ? 1 : -1)); start(); } tx = null; });
    $$('.hero-hotspot').forEach((h) => h.addEventListener('click', () => G.toast(h.dataset.label, '✨')));

    // ticker
    const news = publishedNews();
    // events that are not over yet stay at the top of "Latest news", newest posting first; they drop off after the event date or when marked completed
    const live = G.DB.all('events').filter((e) => e.status === 'UPCOMING' && e.date >= G.today()).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || a.date.localeCompare(b.date));
    const word = (w) => w[Math.max(0, ['en', 'kn', 'hi', 'ta', 'te', 'ml'].indexOf(G.lang()))];
    const isNew = (e) => e.createdAt && Date.now() - new Date(e.createdAt).getTime() < 7 * 86400000;
    const evTag = (e) => (isNew(e) ? '✨ ' + word(['NEW EVENT', 'ಹೊಸ ಕಾರ್ಯಕ್ರಮ', 'नया आयोजन', 'புதிய நிகழ்வு', 'కొత్త కార్యక్రమం', 'പുതിയ പരിപാടി']) : '📅 ' + word(['UPCOMING EVENT', 'ಮುಂಬರುವ ಕಾರ್ಯಕ್ರಮ', 'आगामी आयोजन', 'வரவிருக்கும் நிகழ்வு', 'రాబోయే కార్యక్రమం', 'വരാനിരിക്കുന്ന പരിപാടി']));
    const evNews = (e) => `<article class="card lift news-card news-event reveal">${safePoster(e.poster) ? `<img class="news-poster" src="${safePoster(e.poster)}" alt="">` : ''}<div class="card-body"><span class="news-tag">${evTag(e)}</span><div class="date">${G.fmtDate(e.date)}${e.time ? ' · ' + esc(e.time) : ''}</div><h4>${esc(tr(e.title))}</h4><p style="font-size:.86rem;color:#4b5563;margin-bottom:10px">📍 ${esc(e.location || '')}</p><a class="link-more" href="event.html?e=${esc(e.slug || '')}">${t('btn.readmore')} →</a></div></article>`;
    html($('#ticker'), news.length || live.length ? `<div class="ticker-track">${[0, 1].map(() => live.map((e) => `<a class="tick-event" href="events.html#${esc(e.slug || '')}">${evTag(e)}: ${esc(tr(e.title))} · ${G.fmtDate(e.date)}</a>`).join('')).join('')}${news.concat(news).map((n) => `<a href="${esc(G.safeUrl(n.link || '#news'))}">${esc(tr(n.title))}</a>`).join('')}</div>` : '');
    // quick access
    html($('#quick'), [['programs.html', '🌳', 'nav.programs'], ['events.html', '📅', 'nav.events'], ['donate.html', '💚', 'btn.donate'], ['volunteer.html', '🤝', 'nav.volunteer']].map((q) => `<a href="${q[0]}" class="reveal"><span class="e">${q[1]}</span>${t(q[2])}</a>`).join(''));
    // pillars
    html($('#pillars'), G.DB.all('programs').filter((p) => p.active).sort((a, b) => a.order - b.order).map((p) => `<a class="pillar-card reveal" href="programs.html#${p.slug}" style="text-decoration:none"><div class="pillar-icon-box" style="font-size:1.9rem">${p.icon}</div><div class="pillar-title">${esc(tr(p.title))}</div></a>`).join(''));
    // news
    const posted = live.filter((e) => e.createdAt), topEv = posted.concat(live.filter((e) => !e.createdAt)).slice(0, Math.max(3, posted.length));
    const topNews = news.filter((n) => !(n.title && n.title.en === 'Our new website is live')).slice(0, Math.max(0, 3 - topEv.length));
    if (!$('#newsMore')) $('#newsGrid').insertAdjacentHTML('afterend', `<p id="newsMore" style="text-align:center;margin-top:18px"><a class="link-more" href="events.html">${t('btn.viewall')} →</a></p>`);
    html($('#newsGrid'), topEv.map(evNews).join('') + topNews.map((n) => `<article class="card lift news-card reveal"><div class="card-body"><div class="date">${G.fmtDate(n.date)} ${n.pinned ? '📌' : ''}</div><h4>${esc(tr(n.title))}</h4><p style="font-size:.86rem;color:#4b5563;margin-bottom:10px">${esc(tr(n.summary))}</p>${n.link ? `<a class="link-more" href="${esc(G.safeUrl(n.link))}">${t('btn.readmore')} →</a>` : ''}</div></article>`).join('') || (live.length ? '' : emptyBox('📰', 'No news yet.')));
    // events
    html($('#homeEvents'), upcoming().slice(0, 3).map((e) => eventCard(e, true)).join('') || emptyBox('📅', 'No upcoming events right now.'));
    // wide gallery strip
    G.Slideshow($('#galleryStrip'), G.DB.all('gallery').filter((g) => g.featured).slice(0, 8));
    // impact + testimonials (CMS-managed; no hard-coded figures)
    // moving numbers: figures the admin typed in Settings come first; the rest are counted from the site itself (nothing is invented)
    const own = (G.DB.settings().impact || []).map((m) => { const mm = String(m.value).match(/^([^\d]*)([\d,\.]+)(.*)$/); return mm ? [Number(mm[2].replace(/,/g, '')), mm[3], m.label, mm[1]] : [0, m.value, m.label, '']; });
    const progs = G.DB.all('programs').filter((p) => p.active);
    const counted = [
      [progs.length, '', word(['Programmes', 'ಕಾರ್ಯಕ್ರಮಗಳು', 'कार्यक्रम', 'திட்டங்கள்', 'కార్యక్రమాలు', 'പദ്ധതികൾ'])],
      [progs.reduce((n, p) => n + (p.initiatives || []).length, 0), '', word(['Initiatives', 'ಉಪಕ್ರಮಗಳು', 'पहल', 'முயற்சிகள்', 'చొరవలు', 'സംരംഭങ്ങൾ'])],
      [live.length, '', word(['Upcoming events', 'ಮುಂಬರುವ ಕಾರ್ಯಕ್ರಮಗಳು', 'आगामी आयोजन', 'வரவிருக்கும் நிகழ்வுகள்', 'రాబోయే ఈవెంట్లు', 'വരാനിരിക്കുന്ന പരിപാടികൾ'])],
      [6, '', word(['Languages', 'ಭಾಷೆಗಳು', 'भाषाएँ', 'மொழிகள்', 'భాషలు', 'ഭാഷകൾ'])]];
    html($('#impact'), own.concat(counted).slice(0, 4).map((f) => `<div class="power-stat"><b class="count" data-to="${Number(f[0]) || 0}" data-suffix="${esc(f[1] || '')}" data-prefix="${esc(f[3] || '')}">0</b><span>${esc(f[2])}</span></div>`).join(''));
    G.observeCounts($('#impact'));
    $('#powerTitle').textContent = word(['Small actions today, a greener tomorrow', 'ಇಂದಿನ ಸಣ್ಣ ಹೆಜ್ಜೆ, ನಾಳಿನ ಹಸಿರು ಭವಿಷ್ಯ', 'आज के छोटे कदम, कल का हरा भविष्य', 'இன்றைய சிறு செயல், நாளைய பசுமை', 'నేటి చిన్న అడుగు, రేపటి పచ్చదనం', 'ഇന്നത്തെ ചെറിയ ചുവട്, നാളത്തെ പച്ചപ്പ്']);
    $('#powerText').textContent = t('home.aboutText');
    const allVids = G.sortMedia(G.DB.all('gallery')).filter((g) => g.type === 'VIDEO' && G.mediaUrl(g.src)), picked = allVids.filter((g) => g.featured);
    const vids = (picked.length ? picked : allVids).slice(0, 4), player = $('#powerVideo');
    if (!vids.length) $('#powerMedia').hidden = true;
    else {
      const play = (i, start) => { player.src = G.safeUrl(vids[i].src, '') + '#t=0.6'; $$('#powerList button').forEach((x, k) => x.classList.toggle('on', k === i)); if (start) player.play().catch(() => { }); };
      html($('#powerList'), vids.map((g, i) => `<button type="button" data-i="${i}">▶ ${esc(tr(g.title))}</button>`).join(''));
      $$('#powerList button').forEach((x) => (x.onclick = () => play(Number(x.dataset.i), true)));
      play(0, false);
      if ('IntersectionObserver' in window) new IntersectionObserver((en) => { if (!en[0].isIntersecting) player.pause(); }, { threshold: 0.25 }).observe(player);   // stops when scrolled away
      document.addEventListener('play', (e) => { if (e.target.tagName === 'VIDEO' && e.target !== player && !e.target.muted) player.pause(); }, true);
    }
    // four boxes
    const icon = (d) => `<svg viewBox="0 0 48 48" width="62" height="62" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    $('#essKicker').textContent = word(['Our essence', 'ನಮ್ಮ ತಿರುಳು', 'हमारा सार', 'எங்கள் சாரம்', 'మా సారాంశం', 'ഞങ്ങളുടെ സത്ത']);
    $('#essTitle').textContent = word(['For a greener, healthier India', 'ಹಸಿರು, ಆರೋಗ್ಯಕರ ಭಾರತಕ್ಕಾಗಿ', 'हरित, स्वस्थ भारत के लिए', 'பசுமையான, ஆரோக்கியமான இந்தியாவிற்காக', 'పచ్చని, ఆరోగ్యకరమైన భారతదేశం కోసం', 'ഹരിതവും ആരോഗ്യകരവുമായ ഇന്ത്യയ്ക്കായി']);
    html($('#essence'), [
      [icon('<path d="M24 30V16"/><path d="M24 20c0-6 5-9 11-9 0 6-4 10-11 9z"/><path d="M24 25c0-5-4-8-10-8 0 5 4 9 10 8z"/><path d="M8 36c6-4 10-4 16 0s10 4 16-2"/>'),
        ['Who we are', 'ನಾವು ಯಾರು', 'हम कौन हैं', 'நாங்கள் யார்', 'మేము ఎవరు', 'ഞങ്ങൾ ആരാണ്'],
        ['A Bengaluru foundation working with communities on environment, cow protection, health and livelihoods.', 'ಪರಿಸರ, ಗೋ ಸಂರಕ್ಷಣೆ, ಆರೋಗ್ಯ ಮತ್ತು ಜೀವನೋಪಾಯಕ್ಕಾಗಿ ಸಮುದಾಯಗಳೊಂದಿಗೆ ಕೆಲಸ ಮಾಡುವ ಬೆಂಗಳೂರಿನ ಪ್ರತಿಷ್ಠಾನ.', 'पर्यावरण, गौ संरक्षण, स्वास्थ्य और आजीविका पर समुदायों के साथ काम करने वाला बेंगलुरु का फ़ाउंडेशन।', 'சுற்றுச்சூழல், பசுப் பாதுகாப்பு, நலம், வாழ்வாதாரத்திற்காக மக்களுடன் பணியாற்றும் பெங்களூரு அறக்கட்டளை.', 'పర్యావరణం, గో సంరక్షణ, ఆరోగ్యం, జీవనోపాధిపై ప్రజలతో పనిచేసే బెంగళూరు ఫౌండేషన్.', 'പരിസ്ഥിതി, ഗോ സംരക്ഷണം, ആരോഗ്യം, ഉപജീവനം എന്നിവയിൽ ജനങ്ങളോടൊപ്പം പ്രവർത്തിക്കുന്ന ബെംഗളൂരു ഫൗണ്ടേഷൻ.']],
      [icon('<circle cx="24" cy="24" r="6"/><path d="M4 24s7-12 20-12 20 12 20 12-7 12-20 12S4 24 4 24z"/>'),
        ['Vision', 'ದೃಷ್ಟಿ', 'दृष्टि', 'தொலைநோக்கு', 'దృష్టి', 'ദർശനം'],
        ['A greener, healthier and self-reliant India.', 'ಹಸಿರು, ಆರೋಗ್ಯಕರ ಮತ್ತು ಸ್ವಾವಲಂಬಿ ಭಾರತ.', 'हरित, स्वस्थ और आत्मनिर्भर भारत।', 'பசுமையான, ஆரோக்கியமான, தற்சார்புள்ள இந்தியா.', 'పచ్చని, ఆరోగ్యకరమైన, స్వావలంబన భారతదేశం.', 'ഹരിതവും ആരോഗ്യകരവും സ്വയംപര്യാപ്തവുമായ ഇന്ത്യ.']],
      [icon('<circle cx="24" cy="24" r="17"/><circle cx="24" cy="24" r="9"/><circle cx="24" cy="24" r="2"/>'),
        ['Mission', 'ಧ್ಯೇಯ', 'मिशन', 'நோக்கம்', 'లక్ష్యం', 'ദൗത്യം'],
        ['To plant trees, protect indigenous cows, spread yoga and health awareness, and build skills for women and youth.', 'ಮರ ನೆಡುವುದು, ದೇಸಿ ಗೋವುಗಳ ರಕ್ಷಣೆ, ಯೋಗ-ಆರೋಗ್ಯ ಜಾಗೃತಿ ಮತ್ತು ಮಹಿಳೆಯರು-ಯುವಕರಿಗೆ ಕೌಶಲ್ಯ.', 'पेड़ लगाना, देसी गायों की रक्षा, योग व स्वास्थ्य जागरूकता, और महिलाओं व युवाओं का कौशल विकास।', 'மரம் நடுதல், நாட்டுப் பசுக்களைக் காத்தல், யோகா-நல விழிப்புணர்வு, பெண்கள் மற்றும் இளைஞர்களுக்குத் திறன் பயிற்சி.', 'చెట్లు నాటడం, దేశీ ఆవుల రక్షణ, యోగా-ఆరోగ్య అవగాహన, మహిళలు-యువతకు నైపుణ్యాలు.', 'മരങ്ങൾ നടുക, നാടൻ പശുക്കളെ സംരക്ഷിക്കുക, യോഗ-ആരോഗ്യ അവബോധം, സ്ത്രീകൾക്കും യുവാക്കൾക്കും നൈപുണ്യം.']],
      [icon('<path d="M24 22s-9-5-9-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 11-9 11z"/><path d="M6 28c6 0 8 4 14 6l6 2M42 28c-6 0-8 4-14 6l-6 2"/>'),
        ['Giving back', 'ಸಮಾಜಕ್ಕೆ ಮರಳಿ', 'समाज को लौटाना', 'சமூகத்திற்குத் திருப்பி', 'సమాజానికి తిరిగి', 'സമൂഹത്തിന് തിരികെ'],
        ['Join as a volunteer, take part in an event or support a programme.', 'ಸ್ವಯಂಸೇವಕರಾಗಿ ಸೇರಿ, ಕಾರ್ಯಕ್ರಮದಲ್ಲಿ ಭಾಗವಹಿಸಿ ಅಥವಾ ಯೋಜನೆಗೆ ಬೆಂಬಲ ನೀಡಿ.', 'स्वयंसेवक बनें, आयोजन में भाग लें या किसी कार्यक्रम का सहयोग करें।', 'தன்னார்வலராக இணையுங்கள், நிகழ்வில் பங்கேற்கவும் அல்லது திட்டத்தை ஆதரிக்கவும்.', 'వాలంటీర్‌గా చేరండి, ఈవెంట్‌లో పాల్గొనండి లేదా కార్యక్రమానికి మద్దతివ్వండి.', 'സന്നദ്ധ പ്രവർത്തകനായി ചേരൂ, പരിപാടിയിൽ പങ്കെടുക്കൂ, അല്ലെങ്കിൽ ഒരു പദ്ധതിയെ പിന്തുണയ്ക്കൂ.']]
    ].map((c) => `<article class="essence-card reveal">${c[0]}<h4>${word(c[1])}</h4><p>${word(c[2])}</p></article>`).join(''));
    // until real ones are added in Admin, show made-up examples. The "Sample" label must stay: donors must never take them as real.
    const real = G.DB.all('testimonials'), ts = real.length ? real : SAMPLE_VOICES;
    html($('#testi'), ts.map((x) => `<blockquote class="card reveal card-body" style="font-style:italic">${x.sample ? '<span class="chip warn" style="font-style:normal;margin-bottom:8px">Sample testimonial</span><br>' : ''}“${esc(x.text)}”<footer style="margin-top:8px;font-style:normal;font-weight:700;color:var(--primary-dark)">— ${esc(x.name)}${x.role ? ', ' + esc(x.role) : ''}</footer></blockquote>`).join('') +
      (real.length ? '' : '<p style="grid-column:1/-1;color:#6b7280;font-size:.82rem">These are made-up examples to show the layout. Have you taken part in our work? <a href="contact.html">Share your experience</a>.</p>'));
  }

  /* =====================================================================
     PROGRAMS
     ===================================================================== */
  function initPrograms() {
    const g = $('#progGrid');
    html(g, G.DB.all('programs').filter((p) => p.active).sort((a, b) => a.order - b.order).map(programCard).join(''));
    g.addEventListener('click', (e) => { const b = e.target.closest('[data-toggle]'); if (b) b.closest('.prog-card').classList.toggle('open'); });
    const openHash = () => { const id = (window.GIGF_HASH ?? location.hash).slice(1); window.GIGF_HASH = ''; const c = id && document.getElementById(id); if (c && c.classList.contains('prog-card')) { c.classList.add('open'); c.scrollIntoView({ behavior: 'smooth', block: 'center' }); } };
    openHash(); window.addEventListener('hashchange', openHash);
  }

  /* =====================================================================
     EVENTS (list + calendar)
     ===================================================================== */
  let evView = 'list', evProg = 'all', calMonth = new Date(2026, 11, 1);
  function renderEvents() {
    const all = G.DB.all('events').filter((e) => evProg === 'all' || e.program === evProg).sort((a, b) => a.date.localeCompare(b.date));
    const up = all.filter((e) => e.status === 'UPCOMING'), past = all.filter((e) => e.status === 'COMPLETED');
    const box = $('#evBody');
    if (evView === 'list') {
      html(box, (up.length ? `<div class="grid g2">${up.map((e) => eventCard(e)).join('')}</div>` : emptyBox('📅', 'No upcoming events for this filter.')) +
        (past.length ? `<h3 class="section-head" style="margin-top:34px"><span style="font-family:var(--font-serif);color:var(--primary-dark);font-size:1.4rem">Completed events</span></h3><div class="grid g2">${past.map((e) => eventCard(e, true)).join('')}</div>` : ''));
    } else {
      const y = calMonth.getFullYear(), m = calMonth.getMonth(), first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate(), todayS = G.today();
      let cells = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => `<div class="cal-dow">${d}</div>`).join('');
      for (let k = 0; k < first; k++) cells += '<div class="cal-day dim"></div>';
      for (let d = 1; d <= days; d++) {
        const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, evs = all.filter((e) => e.date === ds);
        cells += `<div class="cal-day ${ds === todayS ? 'today' : ''}"><span class="d">${d}</span>${evs.map((e) => `<button class="cal-ev" data-reg-info="${e.id}" title="${esc(tr(e.title))}">${esc(tr(e.title))}</button>`).join('')}</div>`;
      }
      html(box, `<div class="cal"><div class="cal-head"><button class="btn btn-ghost btn-sm" id="calPrev">‹</button><b>${calMonth.toLocaleString('en', { month: 'long', year: 'numeric' })}</b><button class="btn btn-ghost btn-sm" id="calNext">›</button></div><div class="cal-grid">${cells}</div></div>`);
      $('#calPrev').onclick = () => { calMonth = new Date(y, m - 1, 1); renderEvents(); }; $('#calNext').onclick = () => { calMonth = new Date(y, m + 1, 1); renderEvents(); };
    }
    $$('.view-switch .pill').forEach((p) => p.classList.toggle('on', p.dataset.v === evView));
  }
  function initEvents() {
    html($('#evFilters'), `<button class="pill on" data-p="all">${t('f.all')}</button>` + G.DB.all('programs').map((p) => `<button class="pill" data-p="${p.id}">${p.icon} ${esc(tr(p.title))}</button>`).join(''));
    $('#evFilters').addEventListener('click', (e) => { const b = e.target.closest('.pill'); if (!b) return; evProg = b.dataset.p; $$('#evFilters .pill').forEach((x) => x.classList.toggle('on', x === b)); renderEvents(); });
    $$('.view-switch .pill').forEach((p) => (p.onclick = () => { evView = p.dataset.v; renderEvents(); }));
    $('#evBody').addEventListener('click', (e) => { const b = e.target.closest('[data-reg-info]'); if (b) { evView = 'list'; renderEvents(); const c = document.getElementById(G.DB.get('events', b.dataset.regInfo).slug); c && c.scrollIntoView({ behavior: 'smooth', block: 'center' }); } });
    renderEvents();
    const rg = new URLSearchParams(window.GIGF_SEARCH ?? location.search).get('reg');
    if (rg && G.Auth.current() && G.DB.get('events', rg)) { history.replaceState(null, '', 'events.html'); setTimeout(() => { const ev = G.DB.get('events', rg), c = document.getElementById(ev.slug); c && c.scrollIntoView({ behavior: 'smooth', block: 'center' }); openRegister(rg); }, 500); }
    if ((window.GIGF_HASH ?? location.hash)) setTimeout(() => { const c = document.getElementById((window.GIGF_HASH ?? location.hash).slice(1)); c && c.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 200);
  }

  /* =====================================================================
     GALLERY
     ===================================================================== */
  function initGallery() {
    let type = 'ALL', cat = 'all', shown = [], show = null;
    const cats = [['all', t('f.all')], ['tree', t('cat.tree')], ['cow', t('cat.cow')], ['health', t('cat.health')], ['skill', t('cat.skill')], ['community', t('cat.community')]];
    html($('#galTypes'), [['ALL', t('f.all')], ['PHOTO', '📷 ' + t('f.photos')], ['VIDEO', '🎬 ' + t('f.videos')]].map((x, i) => `<button class="pill ${i ? '' : 'on'}" data-t="${x[0]}">${x[1]}</button>`).join(''));
    html($('#galCats'), cats.map((x, i) => `<button class="pill ${i ? '' : 'on'}" data-c="${x[0]}">${x[1]}</button>`).join(''));
    const draw = () => {
      shown = G.sortMedia(G.DB.all('gallery')).filter((g) => (type === 'ALL' || g.type === type) && (cat === 'all' || g.category === cat));
      html($('#galGrid'), shown.map(galleryTile).join('') || emptyBox('🖼️', 'Nothing here yet for this filter.'));
      $('#galCount').textContent = shown.length + ' items';
    };
    $('#galTypes').onclick = (e) => { const b = e.target.closest('.pill'); if (!b) return; type = b.dataset.t; $$('#galTypes .pill').forEach((x) => x.classList.toggle('on', x === b)); draw(); };
    $('#galCats').onclick = (e) => { const b = e.target.closest('.pill'); if (!b) return; cat = b.dataset.c; $$('#galCats .pill').forEach((x) => x.classList.toggle('on', x === b)); draw(); };
    const grid = $('#galGrid');
    const open = (el) => { const it = el.closest('.m-item'); if (it) lightbox(shown, Number(it.dataset.i)); };
    grid.addEventListener('click', (e) => open(e.target));
    grid.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e.target); } });
    draw();
  }

  /* =====================================================================
     AWARENESS / BLOG
     ===================================================================== */
  function initAwareness() {
    let cat = 'all', term = '';
    const cats = ['all', 'environment', 'yoga', 'health', 'women', 'stories', 'schemes'], ico = { environment: '🌍', yoga: '🧘', health: '🥗', women: '👩‍🌾', stories: '🌱', schemes: '🏛️' };
    html($('#artCats'), cats.map((c, i) => `<button class="pill ${i ? '' : 'on'}" data-c="${c}">${c === 'all' ? t('f.all') : t('art.' + c)}</button>`).join(''));
    const PHOTOS = { environment: ['about_sprout_hand', 'hero_scene', 'gal1', 'about_natural_sprout'], yoga: ['hero_yoga_women'], women: ['women_shg'], stories: ['gal2'] }, used = {};
    const cover = (a) => { const own = a.cover ? G.mediaUrl(a.cover) : ''; if (own && own !== '#') return `<img class="cover-img" src="${esc(own)}" alt="" loading="lazy">`; const l = PHOTOS[a.category]; if (!l) return ico[a.category] || '📰'; const all = publishedArticles().filter((x) => x.category === a.category), n = all.findIndex((x) => x.id === a.id); const story = a.category === 'stories' && G.DB.all('gallery').find((g) => g.type === 'PHOTO' && g.category === 'tree'); return `<img class="cover-img" src="${story ? esc(G.mediaUrl(story.src)) : 'assets/' + l[Math.max(0, n) % l.length] + '.jpg'}" alt="" loading="lazy">`; };
    const draw = () => {
      const list = publishedArticles().filter((a) => (cat === 'all' || a.category === cat) && (!term || (tr(a.title) + tr(a.summary)).toLowerCase().includes(term)));
      html($('#artGrid'), list.map((a) => `<article class="card lift art-card reveal" data-a="${a.id}" style="cursor:pointer"><div class="cover">${cover(a)}</div><div class="card-body"><span class="chip">${t('art.' + a.category)}</span><h4 style="margin:8px 0 4px;color:var(--primary-dark)">${esc(tr(a.title))}</h4><p style="font-size:.86rem;color:#4b5563;margin-bottom:8px">${esc(tr(a.summary))}</p><span class="link-more">${t('btn.readmore')} →</span></div></article>`).join('') || emptyBox('🔎', 'No articles match.'));
    };
    $('#artCats').onclick = (e) => { const b = e.target.closest('.pill'); if (!b) return; cat = b.dataset.c; $$('#artCats .pill').forEach((x) => x.classList.toggle('on', x === b)); draw(); };
    $('#artSearch').oninput = (e) => { term = e.target.value.toLowerCase(); draw(); };
    const read = (id) => {
      const a = G.DB.get('articles', id); if (!a) return;
      const bd = a.body && !Array.isArray(a.body) && typeof a.body === 'object' ? (a.body[G.lang()] || a.body.en) : a.body; const body = Array.isArray(bd) ? bd : String(bd || '').split(/\n\s*\n/);
      const m = G.modal({ wide: true, title: esc(tr(a.title)), html: `<div class="art-body"><p style="font-size:.78rem;color:#6b7280">${G.fmtDate(a.date)} · ${t('art.' + a.category)}</p>${body.map((p) => `<p>${esc(p)}</p>`).join('')}<button class="btn btn-ghost btn-sm" id="shareBtn">🔗 Share</button></div>` });
      history.replaceState(null, '', '#' + id);
      $('#shareBtn', m).onclick = () => { const u = location.href; if (navigator.share) navigator.share({ title: tr(a.title), url: u }).catch(() => { }); else navigator.clipboard.writeText(u).then(() => G.toast('Link copied', '🔗')); };
    };
    $('#artGrid').onclick = (e) => { const c = e.target.closest('[data-a]'); if (c) location.href = 'article.html?a=' + encodeURIComponent((G.DB.get('articles', c.dataset.a) || {}).slug || c.dataset.a); };
    draw(); { const h = (window.GIGF_HASH ?? location.hash).slice(1); if (h && G.DB.all('articles').some((x) => x.id === h || x.slug === h)) location.replace('article.html?a=' + encodeURIComponent(h)); }
  }

  /* =====================================================================
     CONTACT
     ===================================================================== */
  function validate(form, rules) {
    let ok = true;
    Object.keys(rules).forEach((n) => { const el = form.elements[n]; const good = rules[n](el.value.trim()); el.closest('.field').classList.toggle('bad', !good); if (!good) ok = false; });
    return ok;
  }
  const V = { req: (v) => v.length > 1, email: (v) => /^\S+@\S+\.\S+$/.test(v), phone: (v) => /^[6-9]\d{9}$/.test(v.replace(/\D/g, '').slice(-10)), msg: (v) => v.length >= 10, pan: (v) => !v || G.Donations.PAN.test(v.toUpperCase()) };
  function initContact() {
    const o = G.ORG;
    html($('#contactTiles'), `
      <div class="card contact-tile reveal"><span class="e">📞</span><h4>Helpline</h4>${o.phones.map((p) => `<div><a href="tel:${p.tel}">${p.display}</a></div>`).join('')}</div>
      <div class="card contact-tile reveal"><span class="e">✉️</span><h4>Email</h4><a href="mailto:${o.email}" style="word-break:break-all">${o.email}</a></div>
      <div class="card contact-tile reveal"><span class="e">💬</span><h4>WhatsApp</h4>${o.phones.map((p) => `<div><a target="_blank" rel="noopener" href="https://wa.me/${p.wa}?text=${encodeURIComponent('Hello, I would like to know more about Green India Gokul Foundation')}">Chat on ${p.display}</a></div>`).join('')}</div>
      <div class="card contact-tile reveal"><span class="e">📍</span><h4>Office</h4><div style="font-size:.84rem">${o.address}</div><a href="${o.mapLink}" target="_blank" rel="noopener">Open in Google Maps ↗</a></div>`);
    $('#map').src = o.mapEmbed;
    const u = G.Auth.current(), f = $('#contactForm');
    if (u) { f.elements.name.value = u.name; f.elements.email.value = u.email; f.elements.phone.value = u.phone || ''; }
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validate(f, { name: V.req, email: V.email, phone: (v) => !v || V.phone(v), message: V.msg })) return G.toast('Please fix the highlighted fields.', '⚠️');
      const btn = $('button[type=submit]', f); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      setTimeout(() => {
        const tk = G.Tickets.create({ category: 'CONTACT', name: f.elements.name.value, email: f.elements.email.value, phone: f.elements.phone.value, subject: f.elements.subject.value, message: f.elements.message.value });
        html($('#contactResult'), `<div class="note green"><b>Thank you!</b> Your message is logged as <b>${tk.no}</b>. We will reply on ${esc(tk.email)}.<br><a target="_blank" rel="noopener" href="${o.waLink('Hello, my enquiry reference is ' + tk.no)}">Need it faster? WhatsApp us →</a></div>`);
        f.reset(); btn.disabled = false; btn.textContent = t('btn.send'); G.toast('Message sent', '✉️');
      }, 600);
    });
  }

  /* =====================================================================
     DONATE
     ===================================================================== */
  /* Visitors can fill in the form first. On submit they are asked to log in; their entries are put back afterwards (this tab only, never PAN). */
  /* `extra` returns choices that are not named form fields (amount buttons, one-time/monthly...). */
  function keepTyped(form, kind, extra) {
    const key = 'gigf_draft_' + kind;
    let saved = {};
    try { saved = JSON.parse(sessionStorage.getItem(key) || '{}') || {}; Object.keys(saved).forEach((n) => { const el = form.elements[n]; if (el && el.type !== 'file' && saved[n]) el.value = saved[n]; }); } catch (e) { }
    const save = () => { try { const d = {}; Array.from(form.elements).forEach((el) => { if (el.name && !['file', 'checkbox', 'radio', 'password'].includes(el.type) && el.name !== 'pan') d[el.name] = el.value; }); if (extra) Object.assign(d, extra()); sessionStorage.setItem(key, JSON.stringify(d)); } catch (x) { } };
    const clear = () => { try { sessionStorage.removeItem(key); } catch (x) { } };
    form.addEventListener('submit', (e) => {
      if (G.Auth.current()) return clear();
      e.preventDefault(); e.stopImmediatePropagation();
      save();
      G.requireLogin(kind, kind + '.html' + (window.GIGF_SEARCH || ''));
    }, true);
    return { saved, save, clear };
  }

  function initDonate() {
    const params = new URLSearchParams(window.GIGF_SEARCH ?? location.search), cfg = window.GIGF_CONFIG || {};
    const st = { freq: 'ONE_TIME', amount: 1000, method: 'UPI', program: params.get('program') || 'general' };
    const progs = G.DB.all('programs').filter((p) => p.active);
    $('#dProgram').innerHTML = progs.map((p) => `<option value="${p.id}">${p.icon} ${esc(tr(p.title))}</option>`).join('') + `<option value="general">🌱 Where needed most</option>`;
    $('#dProgram').value = progs.some((p) => p.id === st.program) ? st.program : 'general';
    const u = G.Auth.current(); if (u) { $('#dName').value = u.name; $('#dEmail').value = u.email; $('#dPhone').value = u.phone || ''; }
    const amtBtns = $$('.amt'); const custom = $('#dAmount');
    const setAmt = (v) => { st.amount = Number(v) || 0; custom.value = v; amtBtns.forEach((b) => b.classList.toggle('on', Number(b.dataset.a) === st.amount)); upd(); };
    amtBtns.forEach((b) => (b.onclick = () => setAmt(b.dataset.a))); custom.oninput = () => setAmt(custom.value);
    $$('.seg button').forEach((b) => (b.onclick = () => { st.freq = b.dataset.f; $$('.seg button').forEach((x) => x.classList.toggle('on', x === b)); upd(); }));
    $$('.pay-opt').forEach((b) => (b.onclick = () => { st.method = b.dataset.m; $$('.pay-opt').forEach((x) => x.classList.toggle('on', x === b)); }));
    function upd() { $('#dSummary').innerHTML = `<b>${G.inr(st.amount)}</b> ${st.freq === 'MONTHLY' ? 'every month' : 'one-time'} → ${esc($('#dProgram').selectedOptions[0].textContent)}`; $('#dSubmit').innerHTML = `💚 ${t('btn.donate')} ${G.inr(st.amount)}${st.freq === 'MONTHLY' ? ' / month' : ''}`; }
    $('#dProgram').onchange = upd; setAmt(1000);
    const draft = keepTyped($('#donForm'), 'donate', () => ({ _amount: st.amount, _program: $('#dProgram').value, _freq: st.freq, _method: st.method, _utr: ($('#upiUtr') || {}).value || '' }));
    const was = draft.saved;
    if (Array.from($('#dProgram').options).some((o) => o.value === was._program)) $('#dProgram').value = was._program;
    $$('.seg button').forEach((b) => { if (b.dataset.f === was._freq) b.click(); });
    $$('.pay-opt').forEach((b) => { if (b.dataset.m === was._method) b.click(); });
    if (was._amount > 0) setAmt(was._amount); else upd();
    G.donDraft = draft;   // upi.js saves and restores the UPI reference with it
    $('#demoBanner').style.display = (cfg.razorpayKey && cfg.apiBase) || G.present ? 'none' : 'block';
    if (G.present) $('#dSubmit').addEventListener('click', (e) => { $('#dOutcome').value = e.shiftKey ? 'FAILED' : e.altKey ? 'PENDING' : 'CAPTURED'; });

    const form = $('#donForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const okAmt = st.amount >= 10; $('#amtField').classList.toggle('bad', !okAmt);
      if (!validate(form, { name: V.req, email: V.email, phone: V.phone, pan: V.pan }) || !okAmt) return G.toast('Please fix the highlighted fields.', '⚠️');
      const d = { name: form.elements.name.value.trim(), email: form.elements.email.value.trim(), phone: form.elements.phone.value.trim(), pan: form.elements.pan.value.trim(), program: $('#dProgram').selectedOptions[0].textContent.replace(/^\S+\s/, ''), amount: st.amount, frequency: st.freq, method: st.method };
      const btn = $('#dSubmit'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Processing…';
      try {
        let rec;
        if (cfg.razorpayKey && cfg.apiBase) rec = await realCheckout(cfg, d);   // production path (REQUIREMENTS §4.5)
        else { await new Promise((r) => setTimeout(r, 900)); rec = G.Donations.create(d, $('#dOutcome').value); }
        result(rec);
      } catch (err) { if (err.message === 'LOGIN_REQUIRED') G.requireLogin('donate', 'donate.html' + (window.GIGF_SEARCH || '')); else G.toast(err.message || 'Payment could not start', '⚠️'); }
      btn.disabled = false; upd();
    });
    function result(rec) {
      const ok = rec.status === 'CAPTURED';
      const m = G.modal({ title: ok ? '🎉 Donation successful' : rec.status === 'FAILED' ? '⚠️ Payment failed' : '⏳ Payment pending', html: ok
        ? `<div class="success"><div class="tick">✓</div><h3 style="color:var(--primary-dark);margin:10px 0 4px">Thank you, ${esc(rec.donorName)}!</h3><p style="font-size:.86rem;color:#4b5563">${G.inr(rec.amount)} to ${esc(rec.program)}${rec.frequency === 'MONTHLY' ? ' (monthly)' : ''}.</p>
          <div style="background:#f6faf7;border-radius:10px;padding:10px;margin:14px 0;font-size:.84rem;text-align:left">Receipt no: <b>${esc(rec.receiptNo)}</b><br>Payment ID: <code>${esc(rec.paymentId)}</code>${rec.demo && !G.present ? '<br><span class="chip warn">DEMO — no money charged</span>' : ''}</div>
          <button class="btn btn-primary" id="rView">📄 View / Print Receipt</button> <a class="btn btn-ghost" href="dashboard.html">My donations</a></div>`
        : `<div class="success"><p style="margin-bottom:12px;font-size:.9rem">${rec.status === 'FAILED' ? 'Your payment did not go through. If money was debited it is normally refunded automatically by your bank in a few working days.' : 'Your payment is awaiting confirmation. We will update the status automatically.'}</p>
          <button class="btn btn-orange" id="rIssue">Report this to our team</button></div>` });
      const rv = $('#rView', m); if (rv) rv.onclick = () => { if (!G.Donations.openReceipt(rec.id)) G.toast('Allow pop-ups to view the receipt', '⚠️'); };
      const ri = $('#rIssue', m); if (ri) ri.onclick = () => { const tk = G.Tickets.create({ category: 'PAYMENT_ISSUE', name: rec.donorName, email: rec.donorEmail, phone: rec.donorPhone, subject: 'Payment ' + rec.status, message: `Order ${rec.orderId} for ${G.inr(rec.amount)} is ${rec.status}.`, donationId: rec.id }); m.close(); G.toast('Ticket ' + tk.no + ' created — our team will follow up.', '🎫'); };
      form.reset(); if (u) { $('#dName').value = u.name; $('#dEmail').value = u.email; }
    }
  }
  /** Real Razorpay flow — only runs when window.GIGF_CONFIG = {apiBase, razorpayKey} is provided by the deployment. */
  async function realCheckout(cfg, d) {
    const r = await fetch(cfg.apiBase + '/api/donations/create-order', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
    if (!r.ok) throw new Error('Could not create order');
    const order = await r.json();
    await new Promise((res, rej) => { if (window.Razorpay) return res(); const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = res; s.onerror = () => rej(new Error('Razorpay failed to load')); document.head.appendChild(s); });
    return new Promise((res, rej) => {
      const rz = new window.Razorpay({ key: cfg.razorpayKey, order_id: order.orderId, amount: order.amountPaise, currency: 'INR', name: G.ORG.name, prefill: { name: d.name, email: d.email, contact: d.phone },
        handler: async (resp) => { // never trust the browser callback alone: server verifies the HMAC signature
          const v = await fetch(cfg.apiBase + '/api/donations/verify', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(resp) });
          v.ok ? res(await v.json()) : rej(new Error('Payment verification failed'));
        }, modal: { ondismiss: () => rej(new Error('Payment cancelled')) } });
      rz.open();
    });
  }

  /* =====================================================================
     VOLUNTEER
     ===================================================================== */
  function initVolunteer() {
    const f = $('#volForm'), u = G.Auth.current(), mine = G.Volunteers.mine();
    keepTyped(f, 'volunteer');
    const progs = G.DB.all('programs');
    $('#vDomain').innerHTML = progs.map((p) => `<option value="${esc(tr(p.title))}" data-id="${p.id}">${p.icon} ${esc(tr(p.title))}</option>`).join('') + '<option>📱 Digital outreach, photography & design</option>';
    const pre = new URLSearchParams(window.GIGF_SEARCH ?? location.search).get('program'); const o = $(`#vDomain option[data-id="${pre}"]`); if (o) o.selected = true;
    if (u) { f.elements.name.value = u.name; f.elements.email.value = u.email; f.elements.phone.value = u.phone || ''; }
    const showStatus = (v) => {
      html($('#volStatus'), `<div class="card card-body"><h4 style="color:var(--primary-dark)">Your volunteer application</h4><p style="margin:6px 0">Status: <span class="chip ${v.status === 'APPROVED' ? '' : v.status === 'REJECTED' ? 'red' : 'warn'}">${v.status}</span></p>
        <div class="id-badge"><div style="font-weight:800;color:#fef08a;font-size:.85rem">${G.ORG.nameCaps}</div><div style="font-size:.7rem;opacity:.85">Volunteer ID</div><h3 style="margin:10px 0 2px">${esc(v.name)}</h3><div style="font-size:.82rem">${esc(v.domain)} · ${esc(v.city)}</div><div style="margin-top:8px;font-family:monospace;color:#fef08a">${v.badge}</div>${v.status !== 'APPROVED' ? '<div style="margin-top:8px;font-size:.72rem;opacity:.9">Valid after admin approval</div>' : ''}</div>
        <p style="font-size:.82rem;color:#6b7280;margin-top:10px">${v.status === 'PENDING' ? 'Our team is reviewing your ID proof. You will be notified once approved.' : v.status === 'APPROVED' ? 'You are approved! Check your dashboard for tasks, attendance and your certificate.' : 'Unfortunately your application was not approved. Contact us for details.'}</p><a class="btn btn-primary btn-sm" href="dashboard.html">Open dashboard</a></div>`);
      f.closest('.card').style.display = 'none';
    };
    if (mine) showStatus(mine);
    $('#vFile').addEventListener('change', (e) => {
      const file = e.target.files[0], fld = e.target.closest('.field'); fld.classList.remove('bad');
      if (!file) return; const okType = /^(image\/(jpeg|png)|application\/pdf)$/.test(file.type), okSize = file.size <= 3 * 1024 * 1024;
      if (!okType || !okSize) { fld.classList.add('bad'); fld.querySelector('.err').textContent = !okType ? 'Only JPG, PNG or PDF allowed' : 'File must be under 3 MB'; e.target.value = ''; $('#vFileName').textContent = ''; return; }
      $('#vFileName').textContent = '📎 ' + file.name + ' (' + Math.round(file.size / 1024) + ' KB)';
    });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const file = $('#vFile').files[0]; $('#vFile').closest('.field').classList.toggle('bad', !file); if (!file) $('#vFile').closest('.field').querySelector('.err').textContent = 'Please upload a government ID proof';
      if (!validate(f, { name: V.req, email: V.email, phone: V.phone, city: V.req }) || !file) return G.toast('Please fix the highlighted fields.', '⚠️');
      if (G.DB.all('volunteers').some((v) => v.email.toLowerCase() === f.elements.email.value.toLowerCase())) return G.toast('This email already has an application.', 'ℹ️');
      const data = { name: f.elements.name.value, email: f.elements.email.value, phone: f.elements.phone.value, city: f.elements.city.value, domain: f.elements.domain.value, idType: f.elements.idType.value };
      const btn = f.querySelector('[type=submit]'); btn.disabled = true;
      let v = null;
      if (G.cloud && G.cloud.signedIn()) {   // real account: the application and the ID go to the private database
        try { v = await G.cloud.applyVolunteer(data, file); G.toast('Application sent. Badge ' + v.badge, '🎖️'); }
        catch (err) { if (/duplicate|unique/i.test(err.message)) { btn.disabled = false; return G.toast('You have already applied.', 'ℹ️'); } G.toast('Could not send it to the Foundation, so it is saved on this device only. ' + err.message, '⚠️'); }
      }
      if (!v) { v = G.Volunteers.apply(Object.assign(data, { idFile: file.name, idSize: file.size })); G.toast('Application saved on this device. Badge ' + v.badge, '🎖️'); }
      btn.disabled = false; showStatus(v);
    });
  }

  /* ---------- router ---------- */
  G.boot(() => {
    const page = document.body.dataset.page;
    ({ home: initHome, programs: initPrograms, events: initEvents, gallery: initGallery, awareness: initAwareness, contact: initContact, donate: initDonate, volunteer: initVolunteer }[page] || (() => { }))();
  });
  G.lightbox = lightbox; G.validate = validate; G.V = V; G.emptyBox = emptyBox; G.publishedNews = publishedNews;
})();
