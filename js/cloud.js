/**
 * Shared data in Supabase: events and news (stage 1). Loaded after data.js, before layout.js.
 * Everyone reads from the database; only an admin (password + e-mailed code) can write (enforced by the database rules, not by this file).
 * Anything not listed in SHARED still lives in the visitor's browser.
 */
(function () {
  const G = window.GIGF, cfg = window.GIGF_CONFIG || {}, url = cfg.supabaseUrl, key = cfg.supabaseKey, TOK = 'gigf_sb';
  if (!url || !key) return;
  const SHARED = ['events', 'news'];
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
    return x;
  };
  let shared = false;
  async function pull() {
    try {
      const [ev, nw, st] = await Promise.all(SHARED.map((c) => api(`/rest/v1/${c}?select=id,status,data&order=created_at.desc&limit=200`, { timeout: 4000 })).concat(api('/rest/v1/site_settings?select=public_data&id=eq.1', { timeout: 4000 })));
      shared = !!(st && st[0] && st[0].public_data && st[0].public_data.shared);
      [['events', ev], ['news', nw]].forEach(([c, rows]) => {
        const remote = rows.map((r) => clean(c, r)), ids = new Set(remote.map((x) => x.id)), list = G.DB.all(c);
        const local = shared ? [] : list.filter((x) => !x.cloud && !ids.has(x.id));   // until the admin shares the starter content, it stays visible alongside
        list.splice(0, list.length, ...remote, ...local);
      });
      const pub = (st && st[0] && st[0].public_data) || {};
      G.DB.saveSettings(pub.look !== undefined ? { look: pub.look } : {});   // persist the refreshed copy
    } catch (e) { console.warn('[cloud] using the copy in this browser:', e.message); }
  }

  /* ---------- writing (admin) ---------- */
  let verified = false;   // set only after the database itself answered is_admin() = true
  const canWrite = () => { const u = G.Auth.current(); return verified && !!read() && !!u && /ADMIN/.test(u.role); };
  let queue = Promise.resolve();
  const row = (c, item) => { const data = Object.assign({}, item); delete data.cloud; return { id: item.id, status: item.status || (c === 'events' ? 'UPCOMING' : 'PUBLISHED'), data }; };
  const send = (job) => { queue = queue.then(job).catch((e) => G.toast('Not saved to the database: ' + e.message, '⚠️')); return queue; };
  const upsert = (c, items) => api(`/rest/v1/${c}?on_conflict=id`, { body: items.map((x) => row(c, x)), prefer: 'resolution=merge-duplicates,return=minimal' });
  const raw = { add: G.DB.add, update: G.DB.update, remove: G.DB.remove };
  const mirror = (c, job) => { if (!SHARED.includes(c)) return; if (canWrite()) send(job); else if (/admin\.html$/.test(location.pathname)) G.toast('Saved in this browser only. Sign in with your real admin account to publish for everyone.', 'ℹ️'); };
  G.DB.add = (c, item) => { const x = raw.add.call(G.DB, c, item); mirror(c, () => upsert(c, [x]).then(() => { x.cloud = true; G.DB.saveSettings({}); })); return x; };
  G.DB.update = (c, id, patch) => { const x = raw.update.call(G.DB, c, id, patch); if (x) mirror(c, () => upsert(c, [x])); return x; };
  G.DB.remove = (c, id) => { raw.remove.call(G.DB, c, id); mirror(c, () => api(`/rest/v1/${c}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', prefer: 'return=minimal' })); };

  /** merge into the public settings, so one setting never wipes another */
  async function patchPublic(change) {
    const st = await api('/rest/v1/site_settings?select=public_data&id=eq.1');
    await api('/rest/v1/site_settings?id=eq.1', { method: 'PATCH', body: { public_data: Object.assign({}, st[0] && st[0].public_data, change) }, prefer: 'return=minimal' });
  }
  async function shareStarter() {
    for (const c of SHARED) { const list = G.DB.all(c); if (list.length) { await upsert(c, list); list.forEach((x) => (x.cloud = true)); } }
    await patchPublic({ shared: true });
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
    el.innerHTML = on ? '☁️ <b>Events and News</b> are shared with all visitors. Donations, volunteers, messages and the other sections are still kept in this browser only. ' + (shared ? '' : '<button class="btn btn-primary btn-sm" id="shareBtn">Copy the current events and news to the database</button>')
      : '💻 Practice mode: nothing you change here reaches other visitors.';
    const root = document.querySelector('.admin-shell'); if (!root) return; root.parentNode.insertBefore(el, root);
    const b = el.querySelector('#shareBtn');
    if (b) b.onclick = async () => { b.disabled = true; try { await shareStarter(); G.toast('Copied to the database', '☁️'); b.remove(); } catch (e) { b.disabled = false; G.toast('Could not copy: ' + e.message, '⚠️'); } };
  }

  G.cloud = { pull, adminState, gate, adminBanner, canWrite, shareStarter, patchPublic };
})();
