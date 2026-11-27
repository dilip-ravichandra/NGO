/**
 * Shared data in Supabase: events and news (stage 1). Loaded after data.js, before layout.js.
 * Everyone reads from the database; only an admin (password + e-mailed code) can write (enforced by the database rules, not by this file).
 * Anything not listed in SHARED still lives in the visitor's browser.
 */
(function () {
  const G = window.GIGF, cfg = window.GIGF_CONFIG || {}, url = cfg.supabaseUrl, key = cfg.supabaseKey, TOK = 'gigf_sb';
  if (!url || !key) return;
  const SHARED = ['events', 'news', 'programs', 'gallery', 'articles'];
  const WHOLE = { programs: 'programsShared', gallery: 'galleryShared', articles: 'articlesShared' };   // lists that are copied complete on the first change
  const read = () => { try { return JSON.parse(localStorage.getItem(TOK) || 'null'); } catch (e) { return null; } };
  const save = (s) => localStorage.setItem(TOK, JSON.stringify({ access: s.access_token, refresh: s.refresh_token }));
  const claims = (jwt) => { try { return JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch (e) { return null; } };

  async function token() {   // current access token, refreshed when it is about to expire; null when not signed in
    const t = read(); if (!t || !t.access) return null;
    const c = claims(t.access); if (c && c.exp * 1000 > Date.now() + 60000) return t.access;
    const r = await fetch(url + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: t.refresh }) }).catch(() => null);
    if (!r || !r.ok) return null;
    const j = await r.json(); save(j); return j.access_token;
  }
  async function api(path, opt) {
    opt = opt || {}; const tk = opt.anon ? null : opt.token || await token(), ctl = new AbortController(), to = setTimeout(() => ctl.abort(), opt.timeout || 10000);
    try {
      const r = await fetch(url + path, { method: opt.method || (opt.body ? 'POST' : 'GET'), signal: ctl.signal, headers: Object.assign({ apikey: key, 'Content-Type': 'application/json' }, tk ? { Authorization: 'Bearer ' + tk } : {}, opt.prefer ? { Prefer: opt.prefer } : {}), body: opt.body ? JSON.stringify(opt.body) : undefined });
      const text = await r.text(), j = text ? JSON.parse(text) : null;
      if (!r.ok) throw new Error((j && (j.msg || j.message || j.error_description)) || 'HTTP ' + r.status);
      return j;
    } finally { clearTimeout(to); }
  }

  /* ---------- reading ---------- */
  const clean = (c, row) => {   // values that are written into HTML attributes are normalised here as well
    const x = Object.assign({}, row.data, { id: String(row.id).replace(/[^\w-]/g, ''), status: String(row.status).replace(/[^A-Z_]/g, ''), cloud: true });
    if (c === 'events') { x.slug = String(x.slug || x.id).toLowerCase().replace(/[^a-z0-9-]/g, '-'); x.time = /^\d{1,2}:\d{2}$/.test(x.time) ? x.time : ''; x.program = String(x.program || '').replace(/[^\w-]/g, ''); x.date = /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : G.today(); x.capacity = Number(x.capacity) || 0; x.volSlots = Number(x.volSlots) || 0; }
    if (c === 'programs') { x.slug = String(x.slug || x.id).toLowerCase().replace(/[^a-z0-9-]/g, '-'); x.icon = String(x.icon || '🌿').replace(/[<>"'&`]/g, '').slice(0, 8); x.order = Number(x.order) || 99; x.active = x.status !== 'DRAFT'; ['initiatives', 'impact', 'photos', 'videos'].forEach((k) => { x[k] = Array.isArray(x[k]) ? x[k] : []; }); x.title = x.title || {}; x.tagline = x.tagline || {}; x.desc = x.desc || {}; }
    if (c === 'gallery') { x.type = x.type === 'VIDEO' ? 'VIDEO' : 'PHOTO'; x.src = G.mediaUrl(x.src); x.category = String(x.category || 'community').replace(/[^a-z]/g, ''); x.eventId = String(x.eventId || '').replace(/[^\w-]/g, ''); x.title = x.title || {}; x.date = /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : G.today(); }
    if (c === 'articles') { x.slug = String(x.slug || x.id).toLowerCase().replace(/[^a-z0-9-]/g, '-'); x.category = String(x.category || 'stories').replace(/[^a-z]/g, ''); x.cover = G.mediaUrl(x.cover); if (x.cover === '#') x.cover = ''; x.title = x.title || {}; x.summary = x.summary || {}; x.body = x.body || ''; x.date = /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : G.today(); }
    return x;
  };
  let shared = false, flagsNow = {};
  async function pull() {
    try {
      const results = await Promise.all(SHARED.map((c) => api(`/rest/v1/${c}?select=id,status,data&order=created_at.desc&limit=200`, { timeout: 4000 })).concat(api('/rest/v1/site_settings?select=public_data&id=eq.1', { timeout: 4000 })));
      const st = results.pop(), flags = (st && st[0] && st[0].public_data) || {};
      shared = !!flags.shared; flagsNow = flags;
      SHARED.forEach((c, i) => {
        const remote = results[i].map((r) => clean(c, r)), ids = new Set(remote.map((x) => x.id)), list = G.DB.all(c);
        const whole = WHOLE[c] ? !!flagsNow[WHOLE[c]] : shared;   // once shared, the database is the only source
        const local = whole ? [] : list.filter((x) => !x.cloud && !ids.has(x.id));
        list.splice(0, list.length, ...remote, ...local);
      });
      const pub = (st && st[0] && st[0].public_data) || {};
      if (pub.upi !== undefined) G.DB.saveSettings({ upi: pub.upi });
      G.DB.saveSettings(pub.look !== undefined ? { look: pub.look } : {});   // persist the refreshed copy
    } catch (e) { console.warn('[cloud] using the copy in this browser:', e.message); }
    await pullVolunteers();
    await pullDonations();
  }

  /* ---------- volunteers: private records (each person sees their own, staff see all - decided by the database) ---------- */
  const BUCKET = 'volunteer-ids';
  const me = () => { const t = read(), c = t && claims(t.access); return c ? c.sub : null; };
  const line = (v, n) => String(v == null ? '' : v).slice(0, n);
  const fromRow = (r) => ({ id: String(r.id).replace(/[^\w-]/g, ''), badge: String(r.badge || '').replace(/[^A-Z0-9-]/g, ''), name: r.name || '', email: r.email || '', phone: r.phone || '', city: r.city || '', domain: r.domain || '', idType: r.id_type || '', idFile: r.id_path ? 'uploaded' : '', idPath: r.id_path || '', status: String(r.status).replace(/[^A-Z]/g, ''), duty: r.duty || '', reason: r.reason || '', hours: Number(r.hours) || 0, attendance: Array.isArray(r.attendance) ? r.attendance : [], tasks: Array.isArray(r.tasks) ? r.tasks : [], createdAt: r.created_at, cloud: true });
  const toRow = (v) => ({ name: line(v.name, 80), email: line(v.email, 254) || null, phone: line(v.phone, 20) || null, city: line(v.city, 80) || null, domain: line(v.domain, 80) || null, id_type: line(v.idType, 40) || null, id_path: v.idPath || null, status: v.status || 'PENDING', duty: line(v.duty, 60) || null, reason: line(v.reason, 300) || null, hours: Number(v.hours) || 0, attendance: v.attendance || [], tasks: v.tasks || [] });
  async function pullVolunteers() {
    if (!read() || !['admin', 'dashboard', 'volunteer'].includes(document.body.dataset.page)) return;
    try {
      const rows = (await api('/rest/v1/volunteers?select=*&order=created_at.desc&limit=500', { timeout: 4000 })).map(fromRow), list = G.DB.all('volunteers'), ids = new Set(rows.map((r) => r.id));
      list.splice(0, list.length, ...rows, ...list.filter((x) => !x.cloud && !ids.has(x.id)));
      G.DB.saveSettings({});
    } catch (e) { console.warn('[cloud] volunteers not loaded:', e.message); }
  }
  async function uploadId(file, folder) {
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' }[file.type];
    if (!ext || file.size > 3 * 1024 * 1024) throw new Error('Only JPG, PNG or PDF under 3 MB.');
    const path = folder + '/' + Date.now() + '.' + ext, tk = await token();
    const r = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, { method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + tk, 'Content-Type': file.type }, body: file });
    if (!r.ok) throw new Error('The ID could not be uploaded (' + r.status + ').');
    return path;
  }
  /** a short-lived private link; the database only gives it to staff */
  async function idLink(path) {
    const j = await api(`/storage/v1/object/sign/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`, { body: { expiresIn: 60 } });
    return url + '/storage/v1' + j.signedURL;
  }
  async function applyVolunteer(v, file) {
    const uid = me(); if (!uid) throw new Error('Please log in again.');
    const idPath = await uploadId(file, uid);
    const row = toRow(Object.assign({}, v, { idPath })); ['status', 'duty', 'reason', 'hours', 'attendance', 'tasks'].forEach((k) => delete row[k]);
    const out = await api('/rest/v1/volunteers', { body: Object.assign({ user_id: uid }, row), prefer: 'return=representation' });
    const item = fromRow(out[0]); G.DB.all('volunteers').unshift(item); G.DB.saveSettings({}); return item;
  }
  const taskDone = (idx) => api('/rest/v1/rpc/mark_task_done', { body: { idx: Number(idx) } });
  const vol = {
    add: (x) => send(async () => { const out = await api('/rest/v1/volunteers', { body: Object.assign({ user_id: null }, toRow(x)), prefer: 'return=representation' }); Object.assign(x, fromRow(out[0])); G.DB.saveSettings({}); }),
    update: (x) => send(() => api('/rest/v1/volunteers?id=eq.' + encodeURIComponent(x.id), { method: 'PATCH', body: toRow(x), prefer: 'return=minimal' })),
    remove: (x) => send(async () => { await api('/rest/v1/volunteers?id=eq.' + encodeURIComponent(x.id), { method: 'DELETE', prefer: 'return=minimal' }); if (x.idPath) await api(`/storage/v1/object/${BUCKET}`, { method: 'DELETE', body: { prefixes: [x.idPath] } }); })
  };

  /* ---------- donations: the browser can only call the database functions; it never writes the table ---------- */
  const donRow = (r) => ({ id: String(r.id).replace(/[^\w-]/g, ''), donorName: r.donor_name || '', donorEmail: r.donor_email || '', donorPhone: r.donor_phone || '', donorPan: r.donor_pan || '', program: r.program || '', amount: Number(r.amount) || 0, frequency: r.frequency === 'MONTHLY' ? 'MONTHLY' : 'ONE_TIME', method: r.method || '', status: String(r.status).replace(/[^A-Z]/g, ''), receiptNo: String(r.receipt_no || '').replace(/[^\w/-]/g, ''), paymentId: r.payment_id || (r.utr ? 'UTR ' + r.utr : ''), orderId: r.order_id || (r.utr ? 'upi_' + r.utr : ''), utr: String(r.utr || '').replace(/\D/g, ''), source: r.source || 'GATEWAY', note: r.note || '', cancelled: !!r.cancelled, userEmail: r.donor_email || '', createdAt: r.created_at, demo: true, autoFlagged: true, cloud: true });
  function keepDonation(r) { const x = donRow(r), list = G.DB.all('donations'), i = list.findIndex((d) => d.id === x.id); if (i < 0) list.unshift(x); else list[i] = x; G.DB.saveSettings({}); return x; }
  async function pullDonations() {
    if (!read() || !['admin', 'dashboard'].includes(document.body.dataset.page)) return;
    try {
      const rows = (await api('/rest/v1/donations?select=*&order=created_at.desc&limit=1000', { timeout: 4000 })).map(donRow), list = G.DB.all('donations'), ids = new Set(rows.map((r) => r.id));
      list.splice(0, list.length, ...rows, ...list.filter((x) => !x.cloud && !ids.has(x.id)));
      G.DB.saveSettings({});
    } catch (e) { console.warn('[cloud] donations not loaded:', e.message); }
  }
  const rpc = async (name, body) => { const r = await api('/rest/v1/rpc/' + name, { body }); return Array.isArray(r) ? r[0] : r; };
  const submitUpi = async (c) => keepDonation(await rpc('submit_upi_donation', { p_program: c.program, p_amount: c.amount, p_utr: c.utr, p_name: c.name, p_phone: c.phone, p_pan: c.pan || null }));
  const addOffline = async (d) => keepDonation(await rpc('add_offline_donation', { p_name: d.donorName, p_email: d.donorEmail, p_phone: d.donorPhone, p_program: d.program, p_amount: d.amount, p_method: d.method, p_note: d.note }));
  const verifyDonation = async (id, ok) => keepDonation(await rpc('verify_donation', { target: id, ok }));
  const stopMonthly = (id) => api('/rest/v1/rpc/stop_monthly', { body: { donation: id } });

  /* ---------- gallery files (public pictures; only the admin can add or delete) ---------- */
  const PUBLIC_MEDIA = url + '/storage/v1/object/public/gallery/';
  async function uploadMedia(blob) {
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm' }[blob.type];
    if (!ext) throw new Error('Only JPG, PNG, WebP, MP4 or WebM files.');
    if (blob.size > 50 * 1024 * 1024) throw new Error('That file is over 50 MB.');
    const name = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext, tk = await token();
    const r = await fetch(url + '/storage/v1/object/gallery/' + name, { method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + tk, 'Content-Type': blob.type }, body: blob });
    if (!r.ok) throw new Error('Upload failed (' + r.status + ').');
    return PUBLIC_MEDIA + name;
  }
  const deleteMedia = (src) => (String(src).startsWith(PUBLIC_MEDIA) && canWrite() ? api('/storage/v1/object/gallery', { method: 'DELETE', body: { prefixes: [src.slice(PUBLIC_MEDIA.length)] } }).catch(() => { }) : Promise.resolve());

  /* ---------- writing (admin) ---------- */
  let verified = false;   // set only after the database itself answered is_admin() = true
  const canWrite = () => { const u = G.Auth.current(); return verified && !!read() && !!u && /ADMIN/.test(u.role); };
  let queue = Promise.resolve();
  const row = (c, item) => { const data = Object.assign({}, item); delete data.cloud; return { id: item.id, status: c === 'programs' ? (item.active === false ? 'DRAFT' : 'PUBLISHED') : item.status || (c === 'events' ? 'UPCOMING' : 'PUBLISHED'), data }; };
  const send = (job) => { queue = queue.then(job).catch((e) => G.toast('Not saved to the database: ' + e.message, '⚠️')); return queue; };
  const upsert = (c, items) => api(`/rest/v1/${c}?on_conflict=id`, { body: items.map((x) => row(c, x)), prefer: 'resolution=merge-duplicates,return=minimal' });
  const raw = { add: G.DB.add, update: G.DB.update, remove: G.DB.remove };
  const mirror = (c, job) => { if (!SHARED.includes(c)) return; if (canWrite()) { const f = WHOLE[c]; if (f && !flagsNow[f]) { flagsNow[f] = true; send(async () => { await upsert(c, G.DB.all(c)); await patchPublic({ [f]: true }); }); } send(job); } else if (/admin\.html$/.test(location.pathname)) G.toast('Saved in this browser only. Sign in with your real admin account to publish for everyone.', 'ℹ️'); };
  G.DB.add = (c, item) => { const x = raw.add.call(G.DB, c, item); if (c === 'volunteers' && canWrite()) vol.add(x); mirror(c, () => upsert(c, [x]).then(() => { x.cloud = true; G.DB.saveSettings({}); })); return x; };
  G.DB.update = (c, id, patch) => { const x = raw.update.call(G.DB, c, id, patch); if (c === 'volunteers' && x && x.cloud && canWrite()) vol.update(x); if (x) mirror(c, () => upsert(c, [x])); return x; };
  G.DB.remove = (c, id) => { if (c === 'volunteers' && canWrite()) { const x = G.DB.get(c, id); if (x && x.cloud) vol.remove(Object.assign({}, x)); } raw.remove.call(G.DB, c, id); mirror(c, () => api(`/rest/v1/${c}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', prefer: 'return=minimal' })); };

  /** merge into the public settings, so one setting never wipes another */
  async function patchPublic(change) {
    const st = await api('/rest/v1/site_settings?select=public_data&id=eq.1');
    await api('/rest/v1/site_settings?id=eq.1', { method: 'PATCH', body: { public_data: Object.assign({}, st[0] && st[0].public_data, change) }, prefer: 'return=minimal' });
  }
  async function shareStarter() {
    for (const c of SHARED) { const list = G.DB.all(c); if (list.length) { await upsert(c, list); list.forEach((x) => (x.cloud = true)); } }
    await patchPublic({ shared: true, programsShared: true, galleryShared: true, articlesShared: true });
    flagsNow.programsShared = flagsNow.galleryShared = flagsNow.articlesShared = true;
    shared = true; G.DB.saveSettings({});
  }

  /* ---------- admin identity: e-mail + password, then a code sent to that e-mail ---------- */
  /** 'no' = not a database admin, 'password' = admin who signed in without the password (Google / code), 'code' = needs the e-mailed code, 'ok'. The server decides. */
  async function adminState() {
    verified = false;
    const tk = await token(); if (!tk) return 'no';
    try {
      const c = claims(tk), rows = await api('/rest/v1/profiles?select=name,email,phone,role&id=eq.' + encodeURIComponent(c.sub));
      if (!rows[0] || !/ADMIN/.test(rows[0].role)) return 'no';
      if (!(c.amr || []).some((m) => m.method === 'password')) return 'password';
      G.Auth._start(Object.assign({ id: c.sub }, rows[0]));
      verified = (await api('/rest/v1/rpc/is_admin', { body: {} })) === true;
      return verified ? 'ok' : 'code';
    } catch (e) { return 'no'; }
  }
  function gate(box, state) {
    box.innerHTML = '<div class="wrap" style="max-width:440px;padding:50px 20px"><div class="card card-body gate-card" id="mfaCard"><div class="gate-ico">🔐</div><h3 style="font-family:var(--font-serif);color:var(--primary-dark)">Admin sign in</h3><p id="mfaText"></p></div></div>';
    const card = box.querySelector('#mfaCard'), text = box.querySelector('#mfaText');
    const button = (label, cls) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + (cls || 'btn-primary'); b.style.cssText = 'width:100%;margin-top:10px'; b.textContent = label; card.appendChild(b); return b; };
    const leave = () => { G.Auth.logout(); location.href = 'login.html?next=admin.html'; };
    if (state === 'password') {
      text.textContent = 'The admin portal opens only with the admin email and password. Google and email-code sign in cannot be used here.';
      button('Sign in with email and password').onclick = leave;
      return;
    }
    const email = G.Auth.current().email;
    text.textContent = 'For your security we will email a code to ' + email + '.';
    const send = button('Email me the code');
    const form = document.createElement('form'); form.id = 'mfaForm'; form.hidden = true;
    form.innerHTML = '<input name="code" inputmode="numeric" maxlength="10" autocomplete="one-time-code" aria-label="Code from your email" style="font-size:1.4rem;letter-spacing:5px;text-align:center;width:100%;padding:10px;margin:10px 0;border:1.5px solid #d1d5db;border-radius:10px"><button class="btn btn-primary" type="submit" style="width:100%">Verify →</button>';
    card.appendChild(form);
    button('Sign out', 'btn-ghost').onclick = leave;
    send.onclick = async () => {
      send.disabled = true;
      try { await api('/auth/v1/otp', { anon: true, body: { email, create_user: false } }); form.hidden = false; text.textContent = 'We sent a code to ' + email + '. Check your inbox and spam folder.'; send.textContent = 'Send again'; form.elements.code.focus(); } catch (e) { G.toast('Could not send the code: ' + e.message, '⚠️'); }
      setTimeout(() => (send.disabled = false), 30000);
    };
    form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const mine = claims(await token()).session_id;
        const second = await api('/auth/v1/verify', { anon: true, body: { type: 'email', email, token: form.elements.code.value.trim() } });
        await api('/rest/v1/rpc/confirm_admin_session', { token: second.access_token, body: { target: mine } });
        await api('/auth/v1/logout?scope=local', { token: second.access_token, method: 'POST' }).catch(() => { });
        location.reload();
      } catch (err) { G.toast('That did not work: ' + err.message, '⚠️'); }
    };
  }

  /** note + one-time "share the starter content" button at the top of the admin portal */
  function adminBanner() {
    if (document.getElementById('cloudNote')) return;
    const el = document.createElement('div'); el.id = 'cloudNote'; el.className = 'note'; el.style.cssText = 'margin:10px 16px';
    const on = canWrite();
    if (!on && G.present) return;   // no practice-mode note while presenting
    el.innerHTML = on ? '☁️ <b>Programmes, Events, News, Articles, Gallery, Volunteers, UPI and offline donations</b> are shared. Card test payments, messages and the other sections are still kept in this browser only. ' + (shared ? '' : '<button class="btn btn-primary btn-sm" id="shareBtn">Copy the current programmes, events and news to the database</button>')
      : '💻 Practice mode: nothing you change here reaches other visitors.';
    const root = document.querySelector('.admin-shell'); if (!root) return; root.parentNode.insertBefore(el, root);
    const b = el.querySelector('#shareBtn');
    if (b) b.onclick = async () => { b.disabled = true; try { await shareStarter(); G.toast('Copied to the database', '☁️'); b.remove(); } catch (e) { b.disabled = false; G.toast('Could not copy: ' + e.message, '⚠️'); } };
  }

  G.cloud = { pull, adminState, gate, adminBanner, canWrite, shareStarter, patchPublic, applyVolunteer, uploadMedia, deleteMedia, submitUpi, addOffline, verifyDonation, stopMonthly, uploadId, idLink, taskDone, signedIn: () => !!read() };
})();
