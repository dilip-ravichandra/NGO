/**
 * Admin back-office (REQUIREMENTS §4.6 / PDF §7). Gate: ADMIN role session.
 * DEMO: runs on the browser data layer. In production the same screens call
 * /api/admin/* behind real auth (see README-ROADMAP.md).
 */
(function () {
  const G = window.GIGF, $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s)), esc = G.esc, tr = G.tr;
  const root = () => $('#adminRoot');
  let sec = (location.hash || '#dash').slice(1);

  /* ---------- helpers ---------- */
  const chip = (s) => `<span class="chip ${/CAPTURED|APPROVED|RESOLVED|PUBLISHED|UPCOMING|DONE/.test(s) ? '' : /FAILED|REJECTED|OPEN|CANCEL/.test(s) ? 'red' : /DRAFT|COMPLETED/.test(s) ? 'gray' : 'warn'}">${s}</span>`;
  const csv = (name, cols, rows) => {
    // a visitor-typed value starting with = + - @ would run as a formula in Excel: prefix it with ' (plain phone numbers / amounts are left alone)
    const safe = (v) => { v = String(v == null ? '' : v); return /^\s*[=@]/.test(v) || /^[\t\r]/.test(v) || /^\s*[+\-](?![\d\s]*$)/.test(v) ? "'" + v : v; };
    const q = (v) => '"' + safe(v).replace(/"/g, '""') + '"';
    const text = '﻿' + [cols.map((c) => q(c[1])).join(',')].concat(rows.map((r) => cols.map((c) => q(typeof c[0] === 'function' ? c[0](r) : r[c[0]])).join(','))).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); a.download = name; a.click(); URL.revokeObjectURL(a.href);
  };
  const table = (cols, rows, actions) => rows.length ? `<div class="tbl-wrap"><table class="t"><tr>${cols.map((c) => `<th>${c[1]}</th>`).join('')}${actions ? '<th></th>' : ''}</tr>${rows.map((r) => `<tr>${cols.map((c) => `<td>${typeof c[0] === 'function' ? c[0](r) : esc(r[c[0]])}</td>`).join('')}${actions ? `<td style="white-space:nowrap">${actions(r)}</td>` : ''}</tr>`).join('')}</table></div>` : G.emptyBox('📭', 'Nothing here yet.');
  /* ---------- AI helpers (server-side keys; the browser only talks to /api/*) ---------- */
  const CFG = window.GIGF_CONFIG || {};
  const aiPost = async (path, body) => {
    const tok = (() => { try { return sessionStorage.getItem('gigf_admin_token') || ''; } catch (e) { return ''; } })();
    try { const r = await fetch(path, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { 'x-admin-token': tok } : {}), body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); return Object.assign({ status: r.status }, j); } catch (e) { return { status: 0, error: 'network' }; }
  };
  const aiMsg = (r) => ({ 0: 'Could not reach the AI server. Start the site with "node dev-server.js".', 401: 'The AI is admin-only. Enter the admin AI token in Settings → AI access.', 413: 'That picture is too large.', 429: 'The AI is busy right now (free limits). Wait a minute and try again.', 503: r && r.error === 'no_vision_model' ? 'No AI model that can read pictures is configured.' : 'AI is not configured on this server (add an API key to .env.local).' }[r && r.status] || 'The AI could not read this. Try a clearer picture, or paste the text instead.');
  const chatContext = () => ({ programs: G.DB.all('programs').filter((p) => p.active).map((p) => tr(p.title) + ': ' + tr(p.tagline) + ' ' + tr(p.desc)), events: G.DB.all('events').filter((e) => e.status === 'UPCOMING').slice(0, 6).map((e) => ({ title: tr(e.title), date: e.date, location: e.location })) });
  /** downscale + re-encode an image file so it is small enough to send/store; returns a data URL */
  const compressImage = (file, maxEdge, quality, maxChars) => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('read'));
    fr.onload = () => { const img = new Image(); img.onerror = () => reject(new Error('decode')); img.onload = () => {
      const k = Math.min(1, maxEdge / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      let q = quality, out = c.toDataURL('image/jpeg', q); while (out.length > maxChars && q > 0.3) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
      resolve(out); }; img.src = fr.result; };
    fr.readAsDataURL(file);
  });
  /** AUTOMATION: fill every empty Kannada/Hindi/Tamil/Telugu box from the English text when something is saved */
  async function ensureTranslations(out, keys) {
    if (!G.auto().autoTranslate || !G.autoTranslateAvailable()) return 0;
    let n = 0;
    for (const to of ['kn', 'hi', 'ta', 'te', 'ml']) {
      const jobs = keys.filter((k) => out[k] && out[k].en && !out[k][to]); if (!jobs.length) continue;
      const res = await G.translate(jobs.map((k) => out[k].en), to);
      jobs.forEach((k, i) => { if (res && res[i]) { out[k][to] = res[i]; n++; } });
    }
    if (n) G.audit('AUTO_TRANSLATE', 'content', '', n + ' field(s)');
    return n;
  }
  const act = (a, id, label, cls) => `<button class="btn ${cls || 'btn-ghost'} btn-sm" data-a="${a}" data-id="${id}">${label}</button> `;

  /** generic editor modal. fields: {k,label,type,opts,full,req} */
  function editor({ title, fields, item, onSave }) {
    item = item || {};
    const inp = (f) => {
      const v = item[f.k];
      if (f.type === 'i18n' || f.type === 'i18nArea') {
        const o = v || {}; const T = f.type === 'i18nArea' ? (l) => `<textarea name="${f.k}.${l}" rows="3">${esc(o[l] || '')}</textarea>` : (l) => `<input name="${f.k}.${l}" value="${esc(o[l] || '')}">`;
        return `<div class="field f-full"><label>${f.label}</label>${[['en', 'English'], ['kn', 'ಕನ್ನಡ'], ['hi', 'हिन्दी'], ['ta', 'தமிழ்'], ['te', 'తెలుగు'], ['ml', 'മലയാളം']].map((l) => `<div style="display:flex;gap:6px;align-items:start;margin-bottom:6px"><span class="chip gray" style="min-width:64px;text-align:center">${l[1]}</span><div style="flex:1">${T(l[0])}</div></div>`).join('')}<button type="button" class="btn btn-ghost btn-sm" data-autotr="${f.k}">✨ Auto-translate</button></div>`;
      }
      const wrap = (h) => `<div class="field ${f.full ? 'f-full' : ''}"><label>${f.label}</label>${h}</div>`;
      if (f.type === 'textarea') return wrap(`<textarea name="${f.k}" rows="${f.rows || 5}">${esc(Array.isArray(v) ? v.join('\n\n') : (v && typeof v === 'object' ? (v.en || []).join('\n\n') : v || ''))}</textarea>`);
      if (f.type === 'select') return wrap(`<select name="${f.k}">${f.opts.map((o) => `<option value="${esc(o[0])}" ${String(v) === String(o[0]) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`);
      if (f.type === 'checkbox') return `<div class="field"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="${f.k}" style="width:auto" ${v ? 'checked' : ''}> ${f.label}</label></div>`;
      return wrap(`<input name="${f.k}" type="${f.type || 'text'}" value="${esc(v == null ? '' : v)}" ${f.req ? 'required' : ''}>`);
    };
    const m = G.modal({ wide: true, title, html: `<form id="edForm" class="f-grid">${fields.map(inp).join('')}<div class="f-full" style="display:flex;gap:8px"><button class="btn btn-primary" type="submit">Save</button>${fields.some((f) => f.type === 'i18n' || f.type === 'i18nArea') ? '<button class="btn btn-ghost" type="button" data-autotr="*">✨ Translate all empty languages</button>' : ''}<button class="btn btn-ghost" type="button" id="edCancel">Cancel</button></div></form>` });
    $('#edCancel', m).onclick = () => m.close();
    // one button per field + one for the whole form: fills EMPTY Kannada / Hindi boxes from the English text using Groq
    const fieldKeys = fields.filter((f) => f.type === 'i18n' || f.type === 'i18nArea').map((f) => f.k);
    m.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-autotr]'); if (!b) return;
      const keys = b.dataset.autotr === '*' ? fieldKeys : [b.dataset.autotr];
      const jobs = [];   // [input, englishText, lang]
      keys.forEach((k) => { const en = (m.querySelector(`[name="${k}.en"]`) || {}).value; if (!en || !en.trim()) return; ['kn', 'hi', 'ta', 'te', 'ml'].forEach((to) => { const inp = m.querySelector(`[name="${k}.${to}"]`); if (inp && !inp.value.trim()) jobs.push([inp, en.trim(), to]); }); });
      if (!jobs.length) return G.toast('Nothing to translate: write the English text first (only empty Kannada/Hindi boxes are filled).', 'ℹ️');
      const label = b.textContent; b.disabled = true; b.textContent = '⏳ Translating…';
      let done = 0;
      for (const to of ['kn', 'hi', 'ta', 'te', 'ml']) {
        const js = jobs.filter((j) => j[2] === to); if (!js.length) continue;
        const res = await G.translate(js.map((j) => j[1]), to);
        js.forEach((j, i) => { if (res && res[i]) { j[0].value = res[i]; done++; } });
      }
      b.disabled = false; b.textContent = label;
      G.toast(done ? `Translated ${done} field(s) — please review before saving.` : 'Auto-translate is not reachable. Start the site with "node dev-server.js" (needs GROQ_API_KEY) or deploy the /api folder.', done ? '✨' : '⚠️');
    });
    $('#edForm', m).addEventListener('submit', async (e) => {
      e.preventDefault(); const f = new FormData(e.target), out = {};
      fields.forEach((fl) => {
        if (fl.type === 'i18n' || fl.type === 'i18nArea') out[fl.k] = { en: f.get(fl.k + '.en') || '', kn: f.get(fl.k + '.kn') || '', hi: f.get(fl.k + '.hi') || '', ta: f.get(fl.k + '.ta') || '', te: f.get(fl.k + '.te') || '', ml: f.get(fl.k + '.ml') || '' };
        else if (fl.type === 'checkbox') out[fl.k] = !!f.get(fl.k);
        else if (fl.type === 'number') out[fl.k] = Number(f.get(fl.k));
        else if (fl.type === 'textarea' && fl.lines) out[fl.k] = String(f.get(fl.k)).split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
        else out[fl.k] = f.get(fl.k);
      });
      const sb = $('button[type=submit]', m); if (sb) { sb.disabled = true; sb.textContent = '⏳ Saving…'; }
      await ensureTranslations(out, fieldKeys);
      onSave(out); m.close();
    });
  }

  /* ---------- sections ---------- */
  const S = {};
  S.dash = () => {
    const D = G.DB, don = D.all('donations').filter((d) => d.status === 'CAPTURED'), now = new Date();
    const sum = (a) => a.reduce((x, d) => x + d.amount, 0), month = don.filter((d) => new Date(d.createdAt).getMonth() === now.getMonth() && new Date(d.createdAt).getFullYear() === now.getFullYear());
    const openT = D.all('tickets').filter((t) => t.status !== 'RESOLVED'), openPay = openT.filter((t) => t.category === 'PAYMENT_ISSUE');
    const byProg = {}; don.forEach((d) => (byProg[d.program] = (byProg[d.program] || 0) + d.amount)); const max = Math.max(1, ...Object.values(byProg));
    const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1); return { k: d.getFullYear() + '-' + d.getMonth(), l: d.toLocaleString('en', { month: 'short' }), v: 0 }; });
    don.forEach((d) => { const x = new Date(d.createdAt), mm = months.find((m) => m.k === x.getFullYear() + '-' + x.getMonth()); if (mm) mm.v += d.amount; }); const mmax = Math.max(1, ...months.map((m) => m.v));
    return `<h3>Executive overview</h3>${attentionPanel()}<div class="kpi" style="margin-top:14px">
      <div class="stat"><b>${G.inr(sum(don))}</b><span>Total donations (${don.length})</span></div><div class="stat"><b>${G.inr(sum(month))}</b><span>This month</span></div>
      <div class="stat"><b>${D.all('volunteers').filter((v) => v.status === 'APPROVED').length}</b><span>Active volunteers</span></div><div class="stat"><b>${D.all('volunteers').filter((v) => v.status === 'PENDING').length}</b><span>Pending volunteers</span></div>
      <div class="stat"><b>${D.all('registrations').length}</b><span>Event registrations</span></div><div class="stat" style="border-color:${openPay.length ? '#fca5a5' : ''}"><b style="color:${openPay.length ? '#dc2626' : ''}">${openPay.length}</b><span>Open payment issues</span></div>
      <div class="stat"><b>${openT.length}</b><span>Unresolved inquiries</span></div><div class="stat"><b>${D.all('events').filter((e) => e.status === 'UPCOMING').length}</b><span>Upcoming events</span></div></div>
      <div class="grid g2"><div class="card card-body"><h4>Donations — last 6 months</h4><div class="chart">${months.map((m) => `<div class="col"><b>${m.v ? G.inr(m.v) : ''}</b><i style="height:${Math.round((m.v / mmax) * 100)}%"></i><span>${m.l}</span></div>`).join('')}</div></div>
      <div class="card card-body"><h4>Donations by programme</h4>${Object.keys(byProg).length ? Object.entries(byProg).map(([k, v]) => `<div style="margin:10px 0"><div style="display:flex;justify-content:space-between;font-size:.82rem"><span>${esc(k)}</span><b>${G.inr(v)}</b></div><div class="bar"><i style="width:${(v / max) * 100}%"></i></div></div>`).join('') : '<p style="color:#6b7280;margin-top:10px">No captured donations yet.</p>'}</div></div>`;
  };

  function attentionItems() {
    const D = G.DB, au = G.auto(), items = [];
    const open = D.all('tickets').filter((t) => t.status !== 'RESOLVED');
    const pay = open.filter((t) => t.category === 'PAYMENT_ISSUE'); if (pay.length) items.push({ ico: '💳', text: `${pay.length} payment issue${pay.length > 1 ? 's' : ''} need you`, go: 'issues', hot: true });
    const claims = D.all('donations').filter((d) => d.status === 'PENDING' && d.source === 'UPI_DIRECT'); if (claims.length) items.push({ ico: '🔎', text: `${claims.length} UPI payment${claims.length > 1 ? 's' : ''} to verify`, go: 'donations', hot: true });
    const pend = D.all('donations').filter((d) => d.status === 'PENDING' && !d.autoFlagged); if (pend.length) items.push({ ico: '⏳', text: `${pend.length} payment${pend.length > 1 ? 's' : ''} pending (auto-flagged after ${au.stuckMinutes} min)`, go: 'donations' });
    const human = open.filter((t) => t.category !== 'PAYMENT_ISSUE' && (!t.ai || t.ai.needsHuman)); if (human.length) items.push({ ico: '🎫', text: `${human.length} message${human.length > 1 ? 's' : ''} the AI could not settle`, go: 'issues' });
    const dr = D.all('events').filter((e) => e.status === 'DRAFT'); if (dr.length) items.push({ ico: '📅', text: `${dr.length} AI event draft${dr.length > 1 ? 's' : ''} waiting to publish`, go: 'events' });
    const vp = D.all('volunteers').filter((v) => v.status === 'PENDING'); if (vp.length && !au.autoApproveVolunteers) items.push({ ico: '🤝', text: `${vp.length} volunteer application${vp.length > 1 ? 's' : ''} to review`, go: 'volunteers' });
    return items;
  }
  function attentionPanel() {
    const au = G.auto(), items = attentionItems(), on = (b) => (b ? '<span class="chip">ON</span>' : '<span class="chip gray">OFF</span>');
    return `<div class="card card-body attention ${items.length ? 'hot' : 'calm'}" style="margin:14px 0"><h4>${items.length ? '🔔 Needs your attention' : '✅ Nothing needs you right now'}</h4>
      ${items.length ? items.map((i) => `<div class="att-row"><span>${i.ico} ${i.text}</span><button class="btn ${i.hot ? 'btn-orange' : 'btn-ghost'} btn-sm" data-sec="${i.go}">Open →</button></div>`).join('') : '<p style="color:#166534;margin:6px 0">Receipts, translations, stuck-payment checks and routine replies run by themselves. You only get involved for payment problems.</p>'}
      <div class="auto-chips"><span>🌐 Auto-translate ${on(au.autoTranslate)}</span><span>🧾 Auto receipts <span class="chip">ON</span></span><span>💳 Stuck-payment watch ${on(au.flagStuckPayments)}</span><span>🤖 Auto-reply to simple questions ${on(au.autoReplyRoutine)}</span><span>🤝 Auto-approve volunteers ${on(au.autoApproveVolunteers)}</span><span>📅 AI event intake <span class="chip blue">ready</span></span></div></div>`;
  }
  S.programs = () => { const list = G.DB.all('programs').slice().sort((a, b) => a.order - b.order); return `<div class="toolbar"><h3 style="flex:1">Programmes</h3><button class="btn btn-orange btn-sm" data-a="prog-new">✨ New programme</button></div>
    <p style="color:#4b5563;font-size:.86rem;margin-bottom:10px">Speak, type or drop a flyer and the AI fills the form, or fill it yourself.</p>
    ${table([[(r) => esc(r.icon), ''], [(r) => esc(tr(r.title)), 'Title'], [(r) => (r.active ? chip('PUBLISHED') : chip('DRAFT')), 'Visible'], [(r) => (r.initiatives || []).length, 'Initiatives'], [(r) => (r.photos || []).length + ' / ' + (r.videos || []).length, 'Photos / videos'], [(r) => (r.impact || []).length, 'Figures']], list, (r) => act('prog-up', r.id, '↑') + act('prog-down', r.id, '↓') + act('prog-edit', r.id, '✏️ Edit') + act('prog-del', r.id, '🗑️'))}`; };
  S.events = () => `<div class="toolbar"><h3 style="flex:1">Events</h3><button class="btn btn-orange btn-sm" data-a="ev-ai">✨ Create from poster / text</button><button class="btn btn-primary btn-sm" data-a="ev-new">＋ New event</button></div>${table([[(r) => esc(tr(r.title)) + (r.tentative ? ' <span class="chip warn">sample</span>' : '') + (r.source === 'AI' ? ' <span class="chip blue">AI</span>' : '') + (r.poster ? ' 🖼️' : ''), 'Event'], [(r) => G.fmtDate(r.date) + ' ' + esc(r.time), 'When'], ['location', 'Where'], [(r) => G.DB.all('registrations').filter((x) => x.eventId === r.id).length + ' / ' + esc(r.capacity), 'Registered'], [(r) => chip(r.status) + (r.status === 'DRAFT' ? ' <small>not public</small>' : ''), 'Status']], G.DB.all('events').sort((a, b) => a.date.localeCompare(b.date)), (r) => (r.status === 'DRAFT' ? act('ev-pub', r.id, '🚀 Publish', 'btn-primary') : '') + act('ev-edit', r.id, '✏️') + act('ev-regs', r.id, '👥 Attendance') + act('ev-del', r.id, '🗑️'))}`;
  S.news = () => `<div class="toolbar"><h3 style="flex:1">News & updates</h3><button class="btn btn-primary btn-sm" data-a="news-new">＋ New update</button></div>${table([[(r) => esc(tr(r.title)) + (r.pinned ? ' 📌' : ''), 'Title'], ['date', 'Date'], [(r) => chip(r.status) + (r.status === 'SCHEDULED' ? ' ' + esc(r.publishAt || '') : ''), 'Status']], G.DB.all('news'), (r) => act('news-edit', r.id, '✏️') + act('news-del', r.id, '🗑️'))}`;
  const artFilter = () => (window._art = window._art || { q: '', st: 'ALL' });
  const artTable = () => { const f = artFilter(), q = f.q.toLowerCase(); return table([[(r) => esc(tr(r.title)), 'Title'], ['category', 'Category'], ['date', 'Date'], [(r) => chip(r.status) + (r.status === 'SCHEDULED' ? '<br><small>' + esc(String(r.publishAt || '').replace('T', ' ')) + '</small>' : ''), 'Status'], [(r) => '<code>' + esc(r.slug || r.id) + '</code>', 'Address']], G.DB.all('articles').filter((a) => (f.st === 'ALL' || a.status === f.st) && (!q || (tr(a.title) + ' ' + tr(a.summary) + ' ' + a.category).toLowerCase().includes(q))).sort((a, b) => String(b.date).localeCompare(String(a.date))), (r) => act('art-edit', r.id, '✏️ Edit') + act('art-view', r.id, '👁️') + act('art-del', r.id, '🗑️')); };
  S.articles = () => { const f = artFilter(); return `<div class="toolbar"><h3 style="flex:1">Awareness articles / blog</h3><button class="btn btn-ghost btn-sm" data-a="art-map">⬇ Sitemap</button><button class="btn btn-orange btn-sm" data-a="art-new">✨ New article</button></div>
    <div class="toolbar"><input class="search" id="artQ" placeholder="Search articles" value="${esc(f.q)}"><select id="artSt" class="search" style="flex:0 1 170px">${['ALL', 'DRAFT', 'SCHEDULED', 'PUBLISHED'].map((x) => `<option ${x === f.st ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div id="artList">${artTable()}</div>`; };
  const galFilter = () => (window._gal = window._gal || { q: '', type: 'ALL', cat: 'ALL', ev: 'ALL', sel: new Set() });
  const galRows = () => { const f = galFilter(), q = f.q.toLowerCase(); return G.sortMedia(G.DB.all('gallery')).filter((m) => (f.type === 'ALL' || m.type === f.type) && (f.cat === 'ALL' || m.category === f.cat) && (f.ev === 'ALL' || (m.eventId || '') === f.ev) && (!q || (Object.values(m.title || {}).join(' ') + ' ' + m.date).toLowerCase().includes(q))); };
  const catName = (k) => (catOpts.find((o) => o[0] === k) || [k, k])[1];
  const optList = (list, sel) => list.map((o) => `<option value="${esc(o[0])}" ${o[0] === sel ? 'selected' : ''}>${esc(o[1])}</option>`).join('');
  const galGrid = () => { const rows = galRows(), f = galFilter(); return rows.length ? `<div class="gal-admin">${rows.map((m) => { const ev = m.eventId && G.DB.get('events', m.eventId); return `<figure class="gal-item ${f.sel.has(m.id) ? 'on' : ''}">
      <label><input type="checkbox" data-sel="${esc(m.id)}" ${f.sel.has(m.id) ? 'checked' : ''}> ${m.type === 'VIDEO' ? '🎬' : '📷'}${m.featured ? ' ⭐' : ''}</label>
      ${m.type === 'VIDEO' ? `<video src="${esc(G.mediaUrl(m.src))}#t=0.6" preload="metadata" muted playsinline></video>` : `<img src="${esc(G.mediaUrl(m.src))}" alt="" loading="lazy">`}
      <figcaption><b>${esc(tr(m.title))}</b><small>${esc(catName(m.category))}${ev ? ' · ' + esc(tr(ev.title)) : ''}</small></figcaption>
      <div class="gal-act">${act('gal-left', m.id, '←')}${act('gal-right', m.id, '→')}${act('gal-edit', m.id, '✏️')}${act('gal-del', m.id, '🗑️')}</div></figure>`; }).join('')}</div>` : G.emptyBox('🖼️', 'Nothing matches.'); };
  const galBulk = () => { const n = galFilter().sel.size; return n ? `<div class="note gal-bulk"><b>${n} selected</b>
      <select id="bulkCat">${optList([['', 'Move to programme…']].concat(catOpts), '')}</select><select id="bulkEv">${optList([['-', 'Set event…']].concat(evOpts()), '-')}</select>
      <button class="btn btn-ghost btn-sm" data-a="gal-star">⭐ Home video section on/off</button><button class="btn btn-danger btn-sm" data-a="gal-bulkdel">Delete selected</button><button class="btn btn-ghost btn-sm" data-a="gal-none">Clear</button></div>` : ''; };
  S.gallery = () => { const f = galFilter(); return `<div class="toolbar"><h3 style="flex:1">Gallery manager</h3><button class="btn btn-ghost btn-sm" data-a="vid-new">🔗 Add video by link</button></div>
    <div class="card card-body" id="galDrop" style="border:2px dashed #86efac;margin-bottom:14px"><b>⬇ Add photos and videos</b> <small>(drop them here or choose)</small>
      <div class="toolbar" style="margin-top:8px"><label style="flex:0 1 220px">Programme<select id="galCat" class="search">${optList(catOpts, f.upCat || 'community')}</select></label><label style="flex:0 1 260px">Event<select id="galEvent" class="search">${optList(evOpts(), f.upEv || '')}</select></label>
      <label class="btn btn-primary btn-sm" style="cursor:pointer;align-self:end">Choose files<input id="galUp" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" multiple hidden></label></div>
      <label style="display:flex;gap:8px;align-items:center;font-size:.86rem"><input type="checkbox" id="galAi" ${f.ai ? 'checked' : ''}> ✨ Suggest captions with AI</label><small style="color:#6b7280">AI sends each photo to an outside service: leave it off for children or anyone who has not agreed. <span id="galStatus"></span></small></div>
    <div class="toolbar"><input class="search" id="galQ" placeholder="Search caption or date" value="${esc(f.q)}"><select id="galType" class="search" style="flex:0 1 130px">${optList([['ALL', 'All types'], ['PHOTO', 'Photos'], ['VIDEO', 'Videos']], f.type)}</select><select id="galFcat" class="search" style="flex:0 1 190px">${optList([['ALL', 'All programmes']].concat(catOpts), f.cat)}</select><select id="galFev" class="search" style="flex:0 1 220px">${optList([['ALL', 'All events']].concat(evOpts()), f.ev)}</select><button class="btn btn-ghost btn-sm" data-a="gal-all">Select all shown</button></div>
    <div id="galBulk">${galBulk()}</div><div id="galList">${galGrid()}</div>`; };
  const volFilter = () => (window._vol = window._vol || { q: '', st: 'ALL' });
  const volRows = () => { const f = volFilter(), q = f.q.toLowerCase(); return G.DB.all('volunteers').filter((v) => (f.st === 'ALL' || v.status === f.st) && (!q || [v.name, v.email, v.phone, v.city, v.domain, v.duty, v.badge].join(' ').toLowerCase().includes(q))); };
  const volTable = () => table([['badge', 'Badge'], ['name', 'Name'], [(r) => esc(r.email) + '<br>' + esc(r.phone), 'Contact'], [(r) => esc(r.duty || '—'), 'Role'], [(r) => esc(r.domain) + '<br>' + esc(r.city), 'Area'], [(r) => chip(r.status), 'Status'], [(r) => Number(r.hours) || 0, 'Hrs'], [(r) => (r.tasks || []).filter((t) => !t.done).length + ' open', 'Tasks']], volRows(), (r) => (r.status === 'PENDING' ? act('vol-ok', r.id, '✔ Approve', 'btn-primary') + act('vol-no', r.id, '✖ Reject') : '') + act('vol-open', r.id, '👤 Open') + act('vol-cert', r.id, '🏅'));
  S.volunteers = () => { const f = volFilter(); return `<div class="toolbar"><h3 style="flex:1">Volunteers</h3><button class="btn btn-orange btn-sm" data-a="vol-new">✨ Add volunteer</button><button class="btn btn-ghost btn-sm" data-a="vol-csv">⬇ Report (CSV)</button></div>
    <div class="toolbar"><input class="search" id="volQ" placeholder="Search name, phone, city, role, badge" value="${esc(f.q)}"><select id="volSt" class="search" style="flex:0 1 180px">${['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((x) => `<option ${x === f.st ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div id="volList">${volTable()}</div>`; };
  S.donations = () => {
    const f = window._don || { q: '', st: 'ALL', pg: 'ALL', md: 'ALL', from: '', to: '', tab: 'ledger' }; window._don = f;
    const rows = G.DB.all('donations').filter((d) => (f.st === 'ALL' || d.status === f.st) && (f.pg === 'ALL' || d.program === f.pg) && (f.md === 'ALL' || d.method === f.md) && (!f.q || (d.donorName + d.donorEmail + d.receiptNo + d.paymentId + (d.utr || '')).toLowerCase().includes(f.q.toLowerCase())) && (!f.from || d.createdAt.slice(0, 10) >= f.from) && (!f.to || d.createdAt.slice(0, 10) <= f.to));
    window._donRows = rows;
    const head = `<div class="toolbar"><h3 style="flex:1">Donations & receipts</h3><button class="btn btn-orange btn-sm" data-a="don-add">✨ Record offline gift</button><button class="btn btn-primary btn-sm" data-a="don-csv">⬇ Export Excel/CSV</button></div>
      <div class="toolbar">${[['ledger', '📒 All'], ['verify', '🔎 To verify (' + G.DB.all('donations').filter((d) => d.status === 'PENDING' && d.source === 'UPI_DIRECT').length + ')'], ['monthly', '🔁 Monthly donors'], ['reports', '📊 Reports']].map((x) => `<button class="btn btn-sm ${f.tab === x[0] ? 'btn-primary' : 'btn-ghost'}" data-a="don-tab" data-id="${x[0]}">${x[1]}</button>`).join('')}</div>`;
    if (f.tab === 'verify') return head + '<p style="font-size:.84rem;margin-bottom:8px">Find each reference in the bank statement before pressing Verify. A receipt is created only then.</p>' + table([[(r) => G.fmtDate(r.createdAt), 'Date'], [(r) => esc(r.donorName) + '<br><small>' + esc(r.donorEmail) + ' · ' + esc(r.donorPhone) + '</small>', 'Donor'], ['program', 'Programme'], [(r) => '<b>' + G.inr(r.amount) + '</b>', 'Amount'], [(r) => '<code>' + esc(r.utr) + '</code>', 'UPI reference']], G.DB.all('donations').filter((d) => d.status === 'PENDING' && d.source === 'UPI_DIRECT'), (r) => act('don-verify', r.id, '✔ Verify', 'btn-primary') + act('don-reject', r.id, '✖ Not received'));
    if (f.tab === 'monthly') { const m = G.DB.all('donations').filter((d) => d.frequency === 'MONTHLY' && d.status === 'CAPTURED'); const live = m.filter((d) => !d.cancelled);
      return head + `<p style="font-size:.84rem;margin-bottom:8px"><b>${live.length}</b> active · <b>${G.inr(live.reduce((a, d) => a + d.amount, 0))}</b> pledged per month · ${m.length - live.length} stopped. Automatic monthly debits start with the payment gateway.</p>` + table([[(r) => G.fmtDate(r.createdAt), 'Since'], [(r) => esc(r.donorName) + '<br><small>' + esc(r.donorEmail) + '</small>', 'Donor'], ['program', 'Programme'], [(r) => G.inr(r.amount), 'Per month'], [(r) => (r.cancelled ? chip('CANCEL') : chip('ACTIVE')), 'State']], m, (r) => (r.cancelled ? '' : act('don-stop', r.id, 'Stop'))); }
    if (f.tab === 'reports') return head + donReports();
    return head + `<div class="toolbar"><input class="search" id="dq" placeholder="Search name / email / receipt" value="${esc(f.q)}"><select id="dst" class="search" style="flex:0"><option>ALL</option><option>CAPTURED</option><option>PENDING</option><option>FAILED</option></select><select id="dpg" class="search" style="flex:0"><option>ALL</option>${[...new Set(G.DB.all('donations').map((d) => d.program))].map((p) => `<option>${esc(p)}</option>`).join('')}</select><select id="dmd" class="search" style="flex:0"><option>ALL</option>${[...new Set(G.DB.all('donations').map((d) => d.method))].map((p) => `<option ${p === f.md ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select><input type="date" id="dfr" class="search" style="flex:0" value="${f.from}"><input type="date" id="dto" class="search" style="flex:0" value="${f.to}"></div>
      <p style="font-size:.84rem;margin-bottom:8px">${rows.length} records · <b>${G.inr(rows.filter((d) => d.status === 'CAPTURED').reduce((a, d) => a + d.amount, 0))}</b> captured</p>
      ${table([[(r) => G.fmtDate(r.createdAt), 'Date'], [(r) => esc(r.donorName) + '<br><small>' + esc(r.donorEmail) + '</small>', 'Donor'], ['program', 'Programme'], [(r) => '<b>' + G.inr(r.amount) + '</b>' + (r.frequency === 'MONTHLY' ? ' 🔁' : ''), 'Amount'], ['method', 'Method'], [(r) => chip(r.status) + (r.demo && !G.present ? ' <span class="chip warn">demo</span>' : ''), 'Status'], [(r) => esc(r.receiptNo || '—'), 'Receipt']], rows, (r) => (r.source === 'UPI_DIRECT' && r.status === 'PENDING' ? act('don-verify', r.id, '✔ Verify', 'btn-primary') : r.source ? '' : act('don-sync', r.id, '🔄 Sync')) + (r.status === 'CAPTURED' ? act('don-rcpt', r.id, '📄 PDF') + act('don-share', r.id, '✉️ Send') : r.source ? '' : act('don-capture', r.id, 'Mark captured')))}`;
  };
  S.issues = () => {
    const f = window._tk || 'OPEN_ALL'; window._tk = f;
    const labels = { PAYMENT_ISSUE: '💳 Payment', CONTACT: '✉️ Contact', CHAT_ESCALATION: '🤖 Chat' };
    const rows = G.DB.all('tickets').filter((t) => (f === 'OPEN_ALL' ? t.status !== 'RESOLVED' : f === 'ALL' ? true : t.category === f));
    return `<div class="toolbar"><h3 style="flex:1">Payment issues & inquiries desk</h3><button class="btn btn-orange btn-sm" data-a="tk-triage">🤖 AI triage open messages</button></div>
      <div class="filters">${[['OPEN_ALL', 'Open'], ['PAYMENT_ISSUE', '💳 Payment issues'], ['CONTACT', '✉️ Contact'], ['CHAT_ESCALATION', '🤖 Chat escalations'], ['ALL', 'All']].map((x) => `<button class="pill ${f === x[0] ? 'on' : ''}" data-a="tk-f" data-id="${x[0]}">${x[1]}</button>`).join('')}</div>
      ${table([['no', 'Ticket'], [(r) => labels[r.category] || r.category, 'Type'], [(r) => esc(r.name) + '<br><small>' + esc(r.email || r.phone) + '</small>', 'From'], [(r) => '<b>' + esc(r.subject) + '</b><br><small>' + esc(r.message).slice(0, 110) + '</small>', 'Message'], [(r) => chip(r.status), 'Status'], [(r) => (r.ai ? `<span class="chip ${r.ai.needsHuman ? 'warn' : ''}">${esc(r.ai.intent)}</span><br><small>${r.ai.needsHuman ? 'needs a human' : 'AI can answer'} · ${Math.round(r.ai.confidence * 100)}%</small>` : r.category === 'PAYMENT_ISSUE' ? '<small>always human</small>' : '—'), 'AI'], [(r) => G.fmtDate(r.createdAt), 'Raised']], rows, (r) => act('tk-open', r.id, 'Open', 'btn-primary'))}`;
  };
  S.testimonials = () => `<div class="toolbar"><h3 style="flex:1">Testimonials</h3><button class="btn btn-primary btn-sm" data-a="ts-new">＋ Add</button></div>${table([['name', 'Name'], ['role', 'Role'], [(r) => esc(r.text).slice(0, 100), 'Text']], G.DB.all('testimonials'), (r) => act('ts-edit', r.id, '✏️') + act('ts-del', r.id, '🗑️'))}`;
  const AUDIT_KIND = { PAY: /^(PAYMENT|RECEIPT|MANUAL_CAPTURE|SYNC_STATUS|REFUND|AUTO_FLAG|AUTO_RECEIPT)/, AI: /^(AI_|AUTO_)/ };
  S.audit = () => {
    const f = window._au || 'ALL'; window._au = f;
    const rows = G.DB.all('audit').filter((r) => (f === 'ALL' ? true : f === 'ADMIN' ? !AUDIT_KIND.PAY.test(r.action) && !AUDIT_KIND.AI.test(r.action) : AUDIT_KIND[f].test(r.action))).slice(0, 400);
    const tone = (a) => (/FAILED|FLAG|ISSUE/.test(a) ? 'red' : /CAPTURED|RECEIPT_ISSUED|APPROVE|POSTED/.test(a) ? '' : /PENDING/.test(a) ? 'warn' : 'gray');
    return `<h3 style="margin-bottom:12px">Security & audit log</h3><div class="filters">${[['ALL', 'All'], ['PAY', '💳 Payments'], ['AI', '🤖 Automation & AI'], ['ADMIN', '🛠️ Admin & users']].map((x) => `<button class="pill ${f === x[0] ? 'on' : ''}" data-a="au-f" data-id="${x[0]}">${x[1]}</button>`).join('')}</div>${table([[(r) => new Date(r.at).toLocaleString('en-IN'), 'When'], ['actor', 'Who'], ['role', 'Role'], [(r) => `<span class="chip ${tone(r.action)}">${esc(r.action)}</span>`, 'Action'], [(r) => esc(r.entity) + ' ' + esc(String(r.entityId).slice(-8)), 'Entity'], [(r) => esc(r.meta), 'Details']], rows)}<p style="font-size:.76rem;color:#6b7280;margin-top:8px">Demo log is stored locally; production log is immutable server-side with IP address.</p>`;
  };
  function automationCard() {
    const au = G.auto(), ck = (k, label, hint) => `<label class="auto-row"><input type="checkbox" name="${k}" ${au[k] ? 'checked' : ''}><span><b>${label}</b><small>${hint}</small></span></label>`;
    return `<form id="autoForm" class="card card-body" style="margin-top:16px"><h4>🤖 Automation — let the website do the routine work</h4>
      ${ck('autoTranslate', 'Translate automatically when I save', 'Empty Kannada / Hindi / Tamil / Telugu boxes are filled from the English text (uses the AI).')}
      ${ck('flagStuckPayments', 'Watch for stuck payments', 'A payment still PENDING after the time below opens a payment-issue ticket by itself. Receipts for captured payments are always issued automatically.')}
      ${ck('autoReplyRoutine', 'Answer simple questions automatically', 'Only when the AI is ≥85% sure it is a plain FAQ (how to donate/volunteer, contact details…). Payments, refunds, complaints are NEVER auto-answered.')}
      ${ck('autoApproveVolunteers', 'Approve volunteers automatically', 'Approves every application that has an ID file. Off by default because nobody checks the ID. Turn on only if you accept that.')}
      <div class="field" style="max-width:260px"><label>Treat a payment as stuck after (minutes)</label><input type="number" name="stuckMinutes" min="2" max="1440" value="${au.stuckMinutes}"></div>
      <h4 style="margin-top:18px">🔑 AI access</h4><p style="font-size:.82rem;color:#4b5563;margin:4px 0 8px">The poster reader and message triage are admin-only. On your own computer they work without a token. On a public server enter the same value as <code>ADMIN_API_TOKEN</code> (kept only for this browser session).</p>
      <div class="field" style="max-width:360px"><label>Admin AI token</label><input type="password" name="token" autocomplete="off" placeholder="(not needed on localhost)" value="${(() => { try { return esc(sessionStorage.getItem('gigf_admin_token') || ''); } catch (e) { return ''; } })()}"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn btn-primary">Save automation settings</button><button class="btn btn-ghost" type="button" data-a="ai-test">🔌 Test the AI connection</button></div></form>`;
  }
  S.users = () => `<h3 style="margin-bottom:12px">Users & roles</h3>${table([['name', 'Name'], ['email', 'Email'], [(r) => chip(r.role), 'Role']], G.DB.all('users'), (r) => (r.id === 'u_admin' ? '' : act('usr-role', r.id, 'Change role')))}`;
  S.settings = () => { const s = G.DB.settings(); return `<h3 style="margin-bottom:12px">Settings</h3><div class="grid g2"><form id="setForm" class="card card-body f-grid"><div class="field f-full"><label>80G registration number</label><input name="reg80G" value="${esc(s.reg80G)}"></div><div class="field f-full"><label>12A registration number</label><input name="reg12A" value="${esc(s.reg12A)}"></div><div class="field f-full"><label>Foundation PAN</label><input name="pan" value="${esc(s.pan)}"></div><div class="field f-full"><label>Homepage impact figures (one per line: <code>value | label</code>) — publish only verified numbers</label><textarea name="impact" rows="4">${esc((s.impact || []).map((m) => m.value + ' | ' + m.label).join('\n'))}</textarea></div><button class="btn btn-primary f-full">Save settings</button></form>
    <div class="card card-body"><h4>Data tools</h4><p style="font-size:.84rem;color:#4b5563;margin:8px 0">Export everything as JSON or reset the data in this browser.</p>${G.demoAdminAllowed() ? '<button class="btn btn-orange btn-sm" data-a="sample-add">🧪 Load sample data (10 fake people)</button> <button class="btn btn-ghost btn-sm" data-a="sample-del">Remove sample data</button><br><br>' : ''}<button class="btn btn-ghost btn-sm" data-a="rep-add">📄 Publish annual report</button><br><br><button class="btn btn-ghost" data-a="db-export">⬇ Export JSON</button> <button class="btn btn-danger" data-a="db-reset" style="margin-top:8px">Reset data</button><hr style="margin:16px 0;border:0;border-top:1px solid #e5e7eb"><h4>Reports</h4><div style="display:grid;gap:8px;margin-top:8px"><button class="btn btn-ghost btn-sm" data-a="don-csv-all">Donations CSV</button><button class="btn btn-ghost btn-sm" data-a="vol-csv">Volunteers CSV</button><button class="btn btn-ghost btn-sm" data-a="reg-csv">Event registrations CSV</button></div></div></div>${automationCard()}`; };

  const NAV = [['dash', '📊', 'Dashboard'], ['outbox', '📨', 'Messages to send'], ['issues', '🎫', 'Payment issues & inquiries'], ['donations', '💚', 'Donations'], ['volunteers', '🤝', 'Volunteers'], ['events', '📅', 'Events'], ['news', '📰', 'News & updates'], ['articles', '✍️', 'Articles'], ['programs', '🌳', 'Programs'], ['gallery', '🖼️', 'Gallery'], ['look', '🎨', 'Appearance'], ['testimonials', '💬', 'Testimonials'], ['users', '👥', 'Users'], ['audit', '🔒', 'Audit log'], ['settings', '⚙️', 'Settings']];

  /* ---------- Appearance: festival logo, banner, colours ---------- */
  let draft = null;   // pictures chosen but not yet saved
  const picked = (k) => (draft && draft[k] !== undefined ? draft[k] : (G.DB.settings().look || {})[k]) || '';
  S.look = () => {
    const l = Object.assign({ on: false, from: '', to: '', primary: '#156637', accent: '#ea580c', deco: '', greeting: '', title: '', subtitle: '', link: '', linkText: '', keepSlides: false }, G.DB.settings().look || {});
    const P = G.look.PRESETS, pic = (k, label, hint) => `<div class="field f-full"><label>${label}</label><input type="file" accept="image/png,image/jpeg,image/webp" data-pic="${k}"><small style="color:#6b7280;display:block">${hint}</small>
      <div class="look-prev" id="prev-${k}">${G.look.IMG.test(picked(k)) ? `<img src="${picked(k)}" alt=""> <button type="button" class="btn btn-ghost btn-sm" data-clear="${k}">Remove</button>` : '<span style="color:#9ca3af">Using the normal one</span>'}</div></div>`;
    const now = G.look.active();
    return `<h3 style="margin-bottom:6px">Appearance</h3><p style="color:#4b5563;margin-bottom:14px">Dress the website up for a festival. Set dates and it switches back by itself. <b>${now ? 'A festival look is showing today.' : 'The normal look is showing today.'}</b></p>
    <form id="lookForm" class="card card-body f-grid" style="max-width:760px">
      <div class="field f-full"><label>Start from a ready-made look</label><select id="lookPreset"><option value="">— choose —</option>${Object.keys(P).map((k) => `<option value="${k}">${P[k].deco} ${esc(P[k].name)}</option>`).join('')}</select></div>
      <div class="field f-full"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="on" style="width:auto" ${l.on ? 'checked' : ''}> Turn the festival look on</label></div>
      <div class="field"><label>Show from (optional)</label><input type="date" name="from" value="${esc(l.from)}"></div><div class="field"><label>Until (optional)</label><input type="date" name="to" value="${esc(l.to)}"></div>
      ${pic('logo', 'Logo', 'Square picture, best as a PNG with a clear background.')}
      ${pic('banner', 'Home banner', 'Wide picture, about 1600 × 600.')}
      <div class="field"><label>Banner heading</label><input name="title" maxlength="80" value="${esc(l.title)}"></div><div class="field"><label>Banner line</label><input name="subtitle" maxlength="140" value="${esc(l.subtitle)}"></div>
      <div class="field"><label>Button text</label><input name="linkText" maxlength="30" value="${esc(l.linkText)}" placeholder="Donate now"></div><div class="field"><label>Button opens</label><input name="link" maxlength="200" value="${esc(l.link)}" placeholder="donate.html"></div>
      <div class="field f-full"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="keepSlides" style="width:auto" ${l.keepSlides ? 'checked' : ''}> Keep the usual slideshow below my banner</label></div>
      <div class="field f-full"><label>Greeting strip (under the menu, all pages)</label><input name="greeting" maxlength="140" value="${esc(l.greeting)}"></div>
      <div class="field"><label>Main colour</label><input type="color" name="primary" value="${esc(l.primary || '#156637')}"></div><div class="field"><label>Button colour</label><input type="color" name="accent" value="${esc(l.accent || '#ea580c')}"></div>
      <div class="field"><label>Falling decoration (one emoji, optional)</label><input name="deco" maxlength="8" value="${esc(l.deco)}" placeholder="🪔"></div>
      <div class="f-full" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" type="submit">Save</button><a class="btn btn-ghost" href="index.html" target="_blank" rel="noopener">Open website</a><button type="button" class="btn btn-danger" id="lookReset">Back to normal</button></div>
    </form>`;
  };
  /** shrink a chosen picture; the logo stays PNG so a clear background survives */
  function shrink(file, k) {
    return new Promise((ok, no) => {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return no(new Error('Please use a PNG, JPG or WebP picture.'));
      const img = new Image(), u = URL.createObjectURL(file);
      img.onload = () => { const max = k === 'logo' ? 256 : 1600, s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        let out = k === 'logo' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.8); if (k !== 'logo') for (let q = 0.65; out.length > 400000 && q > 0.3; q -= 0.15) out = c.toDataURL('image/jpeg', q);
        URL.revokeObjectURL(u); out.length > 600000 ? no(new Error('That picture is too large. Try a smaller one.')) : ok(out); };
      img.onerror = () => no(new Error('Could not read that picture.')); img.src = u;
    });
  }
  async function saveLook(look) {
    G.DB.saveSettings({ look }); draft = null; G.audit('LOOK_CHANGE', 'settings', '', look.on ? 'festival look on' : 'normal look');
    const stored = (JSON.parse(localStorage.getItem('gigf_db_v2') || '{}').settings || {}).look;
    if (JSON.stringify(stored) !== JSON.stringify(look)) return G.toast('This browser is out of space: use smaller pictures.', '⚠️');
    if (G.cloud && G.cloud.canWrite()) { try { await G.cloud.patchPublic({ look }); G.toast('Saved for all visitors', '☁️'); } catch (e) { G.toast('Not saved to the database: ' + e.message, '⚠️'); } }
    else G.toast('Saved on this computer only. Sign in with your real admin account to change it for everyone.', 'ℹ️');
    render();
  }
  function bindLook() {
    const f = $('#lookForm'); if (!f) return;
    const prev = (k) => { const box = $('#prev-' + k); box.innerHTML = G.look.IMG.test(picked(k)) ? `<img src="${picked(k)}" alt=""> <button type="button" class="btn btn-ghost btn-sm" data-clear="${k}">Remove</button>` : '<span style="color:#9ca3af">Using the normal one</span>'; };
    $('#lookPreset').onchange = (e) => { const p = G.look.PRESETS[e.target.value]; if (!p) return; f.elements.primary.value = p.primary || '#156637'; f.elements.accent.value = p.accent || '#ea580c'; f.elements.deco.value = p.deco; f.elements.greeting.value = p.greeting; f.elements.on.checked = e.target.value !== 'normal'; };
    f.onchange = async (e) => { const k = e.target.dataset.pic; if (!k || !e.target.files[0]) return; try { draft = Object.assign({}, draft, { [k]: await shrink(e.target.files[0], k) }); prev(k); f.elements.on.checked = true; } catch (err) { G.toast(err.message, '⚠️'); } };
    f.onclick = (e) => { const k = e.target.dataset && e.target.dataset.clear; if (!k) return; draft = Object.assign({}, draft, { [k]: '' }); prev(k); };
    f.onsubmit = (e) => {
      e.preventDefault(); const v = (n) => String(f.elements[n].value || '').trim();
      if (v('from') && v('to') && v('to') < v('from')) return G.toast('The end date is before the start date.', '⚠️');
      if (v('link') && !G.safeUrl(v('link'), '')) return G.toast('Use a page like donate.html or an https:// address for the button.', '⚠️');
      saveLook({ on: f.elements.on.checked, from: v('from'), to: v('to'), logo: picked('logo'), banner: picked('banner'), title: v('title'), subtitle: v('subtitle'), link: v('link'), linkText: v('linkText'), keepSlides: f.elements.keepSlides.checked, greeting: v('greeting'), primary: v('primary'), accent: v('accent'), deco: v('deco') });
    };
    $('#lookReset').onclick = () => { if (confirm('Remove the festival look, including the uploaded logo and banner?')) saveLook({ on: false }); };
  }

  /* ---------- Programmes: add / edit with AI, voice or by hand ---------- */
  const PIC = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
  const picUrl = (u) => (PIC.test(u || '') ? u : G.safeUrl(u, ''));
  function moveProgram(id, step) {
    const list = G.DB.all('programs').slice().sort((a, b) => a.order - b.order), i = list.findIndex((p) => p.id === id), j = i + step;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    list.forEach((p, k) => { if (p.order !== k + 1) G.DB.update('programs', p.id, { order: k + 1 }); });
    G.audit('PROGRAM_ORDER', 'program', id); render();
  }
  function programForm(id) {
    const p = id ? G.DB.get('programs', id) : { icon: '🌿', active: true };
    const en = (v) => (v && v.en) || '';
    let cover = p.img || '', photos = (p.photos || []).slice(), flyer = '';
    const libVideos = G.DB.all('gallery').filter((g) => g.type === 'VIDEO'), chosen = p.videos || [];
    const others = chosen.filter((v) => !libVideos.some((g) => g.src === v));
    const m = G.modal({ wide: true, title: id ? '✏️ Edit programme' : '✨ New programme', html: `<div class="pg-ai"><b>Let the AI fill it in</b>
        <p style="font-size:.82rem;color:#4b5563">Say or type what the programme does, in any language${id ? ' (this replaces the text below)' : ''}. You check everything before saving.</p>
        <textarea id="pgSay" rows="3" maxlength="6000" placeholder="e.g. We run free computer classes for village youth every weekend in Ramamurthy Nagar. We teach basics, typing and online forms. 40 students so far."></textarea>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px">${voiceLangPicker()}<label class="btn btn-ghost btn-sm" style="cursor:pointer">📷 Flyer picture<input type="file" id="pgFlyer" accept="image/jpeg,image/png,image/webp" hidden></label><button type="button" class="btn btn-primary btn-sm" id="pgRead">✨ Fill the form</button><span id="pgStatus" class="ai-status"></span></div></div>
      <form id="pgForm" class="f-grid" novalidate>
        <div class="field f-full"><label>Name *</label><input name="title" maxlength="80" value="${esc(en(p.title))}"><span class="err">Please give the programme a name</span></div>
        <div class="field"><label>Icon (one emoji)</label><input name="icon" maxlength="8" value="${esc(p.icon || '🌿')}"></div>
        <div class="field"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="active" style="width:auto" ${p.active !== false ? 'checked' : ''}> Visible on the website</label></div>
        <div class="field f-full"><label>Short line</label><input name="tagline" maxlength="140" value="${esc(en(p.tagline))}"></div>
        <div class="field f-full"><label>Description *</label><textarea name="desc" rows="4" maxlength="900">${esc(en(p.desc))}</textarea><span class="err">Please add a description</span></div>
        <div class="field f-full"><label>Initiatives (one per line)</label><textarea name="initiatives" rows="4">${esc((p.initiatives || []).map((x) => (typeof x === 'string' ? x : en(x))).join('\n'))}</textarea></div>
        <div class="field f-full"><label>Impact figures (one per line, as number | what it counts)</label><textarea name="impact" rows="3" placeholder="40 | students trained">${esc((p.impact || []).map((x) => x.value + ' | ' + x.label).join('\n'))}</textarea></div>
        <div class="field f-full"><label>Cover picture</label><input type="file" id="pgCover" accept="image/jpeg,image/png,image/webp"><div class="look-prev" id="pgCoverPrev"></div></div>
        <div class="field f-full"><label>More photos (up to 6)</label><input type="file" id="pgPhotos" accept="image/jpeg,image/png,image/webp" multiple><div class="pg-thumbs" id="pgThumbs"></div></div>
        <div class="field f-full"><label>Videos</label>${libVideos.map((g, i) => `<label style="display:flex;gap:8px;align-items:center;font-weight:500"><input type="checkbox" data-vid="${i}" style="width:auto" ${chosen.includes(g.src) ? 'checked' : ''}> ${esc(tr(g.title))}</label>`).join('')}
          <textarea name="videos" rows="2" placeholder="Or paste links, one per line (a YouTube link, or a video file in assets/)">${esc(others.join('\n'))}</textarea></div>
        <div class="f-full" style="display:flex;gap:8px"><button class="btn btn-primary" type="submit">Save programme</button><button type="button" class="btn btn-ghost" id="pgCancel">Cancel</button></div>
      </form>` });
    const f = $('#pgForm', m), status = $('#pgStatus', m);
    const drawPics = () => {
      $('#pgCoverPrev', m).innerHTML = picUrl(cover) ? `<img src="${esc(picUrl(cover))}" alt="Cover">` : '<span style="color:#9ca3af">A default picture will be used</span>';
      $('#pgThumbs', m).innerHTML = photos.map((u, i) => `<span><img src="${esc(picUrl(u))}" alt=""><button type="button" data-rm="${i}" aria-label="Remove photo">×</button></span>`).join('');
    };
    drawPics();
    $('#pgCancel', m).onclick = () => m.close();
    $('#pgThumbs', m).onclick = (e) => { const b = e.target.closest('[data-rm]'); if (b) { photos.splice(Number(b.dataset.rm), 1); drawPics(); } };
    $('#pgCover', m).onchange = async (e) => { try { cover = await compressImage(e.target.files[0], 900, 0.78, 180000); drawPics(); } catch (x) { G.toast('Could not open that picture.', '⚠️'); } };
    $('#pgPhotos', m).onchange = async (e) => {
      for (const file of Array.from(e.target.files)) { if (photos.length >= 6) { G.toast('Six photos at most.', 'ℹ️'); break; } try { photos.push(await compressImage(file, 800, 0.72, 120000)); } catch (x) { G.toast('Skipped a file that is not a picture.', '⚠️'); } }
      e.target.value = ''; drawPics();
    };
    const vl = $('#aiVL', m); if (vl) vl.onchange = () => { try { sessionStorage.setItem('gigf_voice_lang', vl.value); } catch (e) { } };
    const read = async () => {
      const text = $('#pgSay', m).value.trim(); if (!text && !flyer) return G.toast('Say or type something about the programme first.', 'ℹ️');
      const btn = $('#pgRead', m); btn.disabled = true; status.textContent = '✨ Writing…';
      const r = await aiPost(CFG.extractProgramApi || '/api/extract-program', { text, image: flyer });
      btn.disabled = false;
      if (r.status !== 200 || !r.draft) { status.textContent = '⚠️ ' + aiMsg(r) + ' You can still fill the form yourself.'; return; }
      const d = r.draft, put = (n, v) => { if (v) f.elements[n].value = v; };
      put('title', d.title); put('tagline', d.tagline); put('desc', d.description); put('icon', d.icon);
      put('initiatives', (d.initiatives || []).join('\n')); put('impact', (d.impact || []).map((x) => x.value + ' | ' + x.label).join('\n'));
      status.textContent = '✔ Filled in. Please check, then Save.' + ((r.warnings || []).length ? ' ⚠️ ' + r.warnings.join(' · ') : '');
    };
    $('#pgRead', m).onclick = read;
    $('#pgFlyer', m).onchange = async (e) => { try { flyer = await compressImage(e.target.files[0], 1500, 0.82, 2600000); status.textContent = '📎 ' + e.target.files[0].name + ' attached'; if (!cover) { cover = await compressImage(e.target.files[0], 900, 0.78, 180000); drawPics(); } } catch (x) { G.toast('Could not open that picture.', '⚠️'); } };
    mic($('#pgSay', m), (t) => { if (t.length >= 15 && !$('#pgRead', m).disabled) read(); });   // stop speaking -> the form fills itself
    $$('input[name=title], input[name=tagline], textarea[name=desc], textarea[name=initiatives]', f).forEach((el) => mic(el));
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); if (f.dataset.busy) return;
      const v = (n) => String(f.elements[n].value || '').trim(), lines = (n) => v(n).split('\n').map((x) => x.trim()).filter(Boolean);
      const bad = (n, wrong) => f.elements[n].closest('.field').classList.toggle('bad', wrong);
      const noName = v('title').length < 3, noDesc = v('desc').length < 10; bad('title', noName); bad('desc', noDesc);
      if (noName || noDesc) return G.toast('Please fill the highlighted fields.', '⚠️');
      const videos = Array.from(f.querySelectorAll('[data-vid]:checked')).map((x) => libVideos[Number(x.dataset.vid)].src);
      for (const u of lines('videos')) { if (!G.safeUrl(u, '')) return G.toast('This video address is not allowed: ' + u, '⚠️'); videos.push(u); }
      f.dataset.busy = '1'; const btn = f.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Saving…';
      // keep existing translations only where the English is unchanged
      const keep = (old, text) => (old && old.en === text ? Object.assign({}, old) : { en: text });
      const item = { title: keep(p.title, v('title')), tagline: keep(p.tagline, v('tagline')), desc: keep(p.desc, v('desc')) };
      const inits = lines('initiatives').slice(0, 10).map((text) => keep((p.initiatives || []).find((x) => en(x) === text), text));
      const box = Object.assign({}, item); inits.forEach((x, i) => (box['i' + i] = x));
      try { await ensureTranslations(box, Object.keys(box)); } catch (x) { }
      Object.assign(item, {
        initiatives: inits, icon: v('icon').replace(/[<>"'&`]/g, '').slice(0, 8) || '🌿', active: f.elements.active.checked,
        impact: lines('impact').slice(0, 4).map((l) => { const [value, ...rest] = l.split('|'); return { value: value.trim().slice(0, 20), label: rest.join('|').trim().slice(0, 60) }; }).filter((x) => x.value && x.label),
        img: cover || 'assets/about_natural_sprout.jpg', photos, videos
      });
      const before = localStorage.getItem('gigf_db_v2');
      if (id) G.DB.update('programs', id, item);
      else {
        const slug = (v('title').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'programme').slice(0, 40) + '-' + Date.now().toString(36).slice(-3);
        G.DB.add('programs', Object.assign(item, { id: slug, slug, order: Math.max(0, ...G.DB.all('programs').map((x) => x.order || 0)) + 1 }));
      }
      if (localStorage.getItem('gigf_db_v2') === before) G.toast('This browser is out of space: use fewer or smaller photos.', '⚠️');
      else G.toast('Programme saved', '✅');
      G.audit(id ? 'PROGRAM_UPDATE' : 'PROGRAM_ADD', 'program', id || v('title')); m.close(); render();
    });
  }

  /* ---------- volunteer profile: details, role, tasks, attendance, ID, certificate ---------- */
  const DUTIES = ['', 'Volunteer', 'Field volunteer', 'Team lead', 'Event coordinator', 'Trainer', 'Digital & media'];
  function bindVolunteers() {
    const q = $('#volQ'); if (!q) return;
    q.oninput = () => { volFilter().q = q.value; $('#volList').innerHTML = volTable(); };
    $('#volSt').onchange = (e) => { volFilter().st = e.target.value; $('#volList').innerHTML = volTable(); };
  }
  function volForm(id) {
    const v = id ? G.DB.get('volunteers', id) : { status: 'APPROVED', tasks: [], attendance: [] };
    let tasks = (v.tasks || []).map((t) => Object.assign({}, t));
    let att = (v.attendance || []).map((a) => Object.assign({}, a));
    const logged = att.reduce((n, a) => n + (Number(a.hours) || 0), 0);
    if ((Number(v.hours) || 0) > logged) att.unshift({ date: G.today(), hours: v.hours - logged, note: 'Earlier hours' });
    const areas = G.DB.all('programs').map((p) => tr(p.title)).concat('Digital outreach, photography & design');
    if (v.domain && !areas.includes(v.domain)) areas.push(v.domain);
    const real = !!(G.cloud && G.cloud.canWrite()), opt = (list, sel) => list.map((x) => `<option value="${esc(x)}" ${x === (sel || '') ? 'selected' : ''}>${esc(x || '— none —')}</option>`).join('');
    const wa = String(v.phone || '').replace(/\D/g, '').slice(-10);
    const m = G.modal({ wide: true, title: id ? '👤 ' + esc(v.name) + ' · ' + esc(v.badge || '') : '✨ Add volunteer', html: `${id ? '' : `<div class="pg-ai"><b>Fill by speaking or typing</b><p style="font-size:.82rem;color:#4b5563">Say the details in any language. Do not include Aadhaar or PAN numbers.</p>
        <textarea id="vSay" rows="2" maxlength="2000" placeholder="e.g. Add Kavya Rao, mobile 98765 43210, from Hebbal, wants to help with tree plantation. Ask her to bring gloves."></textarea>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px">${voiceLangPicker()}<button type="button" class="btn btn-primary btn-sm" id="vRead">✨ Fill the form</button><span id="vStatus" class="ai-status"></span></div></div>`}
      <form id="vForm2" class="f-grid" novalidate>
        <div class="field"><label>Name *</label><input name="name" maxlength="80" value="${esc(v.name || '')}"><span class="err">Please enter the name</span></div>
        <div class="field"><label>Mobile</label><input name="phone" inputmode="tel" maxlength="20" value="${esc(v.phone || '')}"><span class="err">10-digit mobile</span></div>
        <div class="field"><label>Email</label><input name="email" type="email" maxlength="254" value="${esc(v.email || '')}"><span class="err">Check the email</span></div>
        <div class="field"><label>City / area</label><input name="city" maxlength="80" value="${esc(v.city || '')}"></div>
        <div class="field"><label>Area of interest</label><select name="domain">${opt(areas, v.domain || areas[0])}</select></div>
        <div class="field"><label>Role</label><select name="duty">${opt(DUTIES.includes(v.duty || '') ? DUTIES : DUTIES.concat(v.duty), v.duty)}</select></div>
        <div class="field"><label>Status</label><select name="status">${opt(['PENDING', 'APPROVED', 'REJECTED'], v.status)}</select></div>
        <div class="field"><label>Reason (if not approved)</label><input name="reason" maxlength="300" value="${esc(v.reason || '')}"></div>
        <div class="field f-full"><label>ID proof</label>
          ${v.idPath ? `<button type="button" class="btn btn-ghost btn-sm" id="vSeeId">🔒 View ID (private link, 1 minute)</button> <span>${esc(v.idType || '')}</span>`
        : `<p style="font-size:.82rem;color:#6b7280">${v.idFile ? 'Only the file name (' + esc(v.idFile) + ') is kept on this device.' : 'No ID uploaded.'}</p>`}
          ${real ? '<div style="display:flex;gap:8px;margin-top:6px"><select name="idType">' + opt(['Aadhaar (masked)', 'Voter ID', 'Driving licence', 'Passport', 'Student ID'], v.idType) + '</select><input type="file" id="vId2" accept="image/jpeg,image/png,application/pdf"></div>' : '<p style="font-size:.78rem;color:#9ca3af">ID files are stored only in the private database, with your real admin login.</p>'}</div>
        <div class="f-full"><label><b>Tasks</b></label><div id="vTasks"></div><div style="display:flex;gap:6px;margin-top:6px"><input id="vNewTask" maxlength="120" placeholder="New task" style="flex:1"><button type="button" class="btn btn-ghost btn-sm" id="vAddTask">＋ Add</button></div></div>
        <div class="f-full"><label><b>Attendance</b> — total <span id="vTotal"></span> hours</label><div id="vAtt"></div><button type="button" class="btn btn-ghost btn-sm" id="vAddDay" style="margin-top:6px">＋ Add a day</button></div>
        <div class="f-full" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" type="submit">Save</button>
          ${id ? `<button type="button" class="btn btn-ghost" id="vCert">🏅 Certificate</button>${v.email ? `<a class="btn btn-ghost" href="mailto:${esc(v.email)}?subject=${encodeURIComponent('Your volunteer application')}&body=${encodeURIComponent('Namaste ' + v.name + ',\n\n')}">✉️ Email</a>` : ''}${wa.length === 10 ? `<a class="btn btn-ghost" target="_blank" rel="noopener" href="https://wa.me/91${wa}">💬 WhatsApp</a>` : ''}<button type="button" class="btn btn-danger" id="vDel">Delete</button>` : ''}</div>
      </form>` });
    const f = $('#vForm2', m);
    const draw = () => {
      $('#vTasks', m).innerHTML = tasks.length ? tasks.map((t, i) => `<div class="v-row"><input type="checkbox" data-t="${i}" data-k="done" ${t.done ? 'checked' : ''} title="Done"><input data-t="${i}" data-k="title" maxlength="120" value="${esc(t.title)}" style="flex:1"><button type="button" class="btn btn-ghost btn-sm" data-rmt="${i}">✕</button></div>`).join('') : '<p style="color:#9ca3af;font-size:.82rem">No tasks.</p>';
      $('#vAtt', m).innerHTML = att.length ? att.map((a, i) => `<div class="v-row"><input type="date" data-a2="${i}" data-k="date" value="${esc(a.date || '')}"><input type="number" min="0" max="24" step="0.5" data-a2="${i}" data-k="hours" value="${esc(Number(a.hours) || 0)}" style="width:80px" title="Hours"><input data-a2="${i}" data-k="note" maxlength="80" value="${esc(a.note || '')}" placeholder="Note" style="flex:1"><button type="button" class="btn btn-ghost btn-sm" data-rma="${i}">✕</button></div>`).join('') : '<p style="color:#9ca3af;font-size:.82rem">No days recorded.</p>';
      total();
    };
    const total = () => ($('#vTotal', m).textContent = att.reduce((n, a) => n + (Number(a.hours) || 0), 0));
    draw();
    f.addEventListener('input', (e) => { const t = e.target.dataset; if (t.t != null) tasks[t.t][t.k] = t.k === 'done' ? e.target.checked : e.target.value; if (t.a2 != null) { att[t.a2][t.k] = t.k === 'hours' ? Math.max(0, Math.min(24, Number(e.target.value) || 0)) : e.target.value; total(); } });
    f.addEventListener('click', (e) => { const b = e.target.closest('[data-rmt],[data-rma]'); if (!b) return; if (b.dataset.rmt != null) tasks.splice(Number(b.dataset.rmt), 1); else att.splice(Number(b.dataset.rma), 1); draw(); });
    const addTask = (title) => { if (title) { tasks.push({ title: title.slice(0, 120), done: false }); draw(); } };
    $('#vAddTask', m).onclick = () => { addTask($('#vNewTask', m).value.trim()); $('#vNewTask', m).value = ''; };
    $('#vNewTask', m).onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#vAddTask', m).click(); } };
    $('#vAddDay', m).onclick = () => { att.push({ date: G.today(), hours: 4, note: 'Present' }); draw(); };
    mic($('#vNewTask', m));
    const see = $('#vSeeId', m); if (see) see.onclick = async () => { const w = window.open('', '_blank'); try { const link = await G.cloud.idLink(v.idPath); if (w) { w.opener = null; w.location = link; } G.audit('ID_VIEWED', 'volunteer', v.id); } catch (e) { if (w) w.close(); G.toast('Could not open the ID: ' + e.message, '⚠️'); } };
    const cert = $('#vCert', m); if (cert) cert.onclick = () => A['vol-cert'](id);
    const del = $('#vDel', m); if (del) del.onclick = () => { if (!confirm('Delete this volunteer and their ID proof? This cannot be undone.')) return; G.DB.remove('volunteers', id); G.audit('VOLUNTEER_DELETE', 'volunteer', id); m.close(); render(); };
    if (!id) {
      const vl = $('#aiVL', m); if (vl) vl.onchange = () => { try { sessionStorage.setItem('gigf_voice_lang', vl.value); } catch (e) { } };
      const read = async () => {
        const text = $('#vSay', m).value.trim(); if (!text) return G.toast('Say or type the details first.', 'ℹ️');
        const st = $('#vStatus', m), b = $('#vRead', m); b.disabled = true; st.textContent = '✨ Reading…';
        const r = await aiPost(CFG.extractVolunteerApi || '/api/extract-volunteer', { text, areas }); b.disabled = false;
        if (r.status !== 200 || !r.draft) { st.textContent = '⚠️ ' + aiMsg(r) + ' You can still fill the form yourself.'; return; }
        const d = r.draft; ['name', 'phone', 'email', 'city'].forEach((k) => { if (d[k]) f.elements[k].value = d[k]; }); if (d.area) f.elements.domain.value = d.area;
        (d.tasks || []).forEach((t) => { if (!tasks.some((x) => x.title === t)) addTask(t); });
        st.textContent = '✔ Filled in. Please check, then Save.' + ((r.warnings || []).length ? ' ⚠️ ' + r.warnings.join(' ') : '');
      };
      $('#vRead', m).onclick = read;
      mic($('#vSay', m), (t) => { if (t.length >= 10 && !$('#vRead', m).disabled) read(); });
    }
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); if (f.dataset.busy) return;
      const val = (n) => String((f.elements[n] || {}).value || '').trim(), mark = (n, wrong) => { f.elements[n].closest('.field').classList.toggle('bad', wrong); return wrong; };
      const phone = val('phone').replace(/\D/g, '').slice(-10);
      const wrong = [mark('name', val('name').length < 2), mark('phone', !!val('phone') && !/^[6-9]\d{9}$/.test(phone)), mark('email', !!val('email') && !/^\S+@\S+\.\S+$/.test(val('email')))].some(Boolean);
      if (wrong) return G.toast('Please check the highlighted fields.', '⚠️');
      const email = val('email').toLowerCase();
      if (G.DB.all('volunteers').some((x) => x.id !== id && ((email && String(x.email).toLowerCase() === email) || (phone && String(x.phone).replace(/\D/g, '').slice(-10) === phone)))) return G.toast('A volunteer with this email or mobile already exists.', '⚠️');
      f.dataset.busy = '1';
      const days = att.filter((a) => a.date);
      const item = { name: val('name'), phone, email, city: val('city'), domain: val('domain'), duty: val('duty'), status: val('status'), reason: val('status') === 'REJECTED' ? val('reason') : '', tasks: tasks.filter((t) => t.title.trim()), attendance: days, hours: days.reduce((n, a) => n + (Number(a.hours) || 0), 0) };
      const file = real && $('#vId2', m) && $('#vId2', m).files[0];
      if (real) item.idType = val('idType');
      if (file) { try { item.idPath = await G.cloud.uploadId(file, 'staff'); item.idFile = 'uploaded'; } catch (x) { f.dataset.busy = ''; return G.toast(x.message, '⚠️'); } }
      if (id) G.DB.update('volunteers', id, item);
      else G.DB.add('volunteers', Object.assign(item, { badge: 'GIGF-VOL-' + String(G.DB.nextSeq('volSeq')).padStart(4, '0'), idType: item.idType || '', idFile: item.idFile || '' }));
      G.audit(id ? 'VOLUNTEER_UPDATE' : 'VOLUNTEER_ADD', 'volunteer', id || item.name); G.toast('Saved', '✅'); m.close(); render();
    });
  }

  /* ---------- donations: reports, offline gifts, verification, UPI details ---------- */
  function donSummary(kind) {
    const m = new Map();
    G.DB.all('donations').filter((d) => d.status === 'CAPTURED').forEach((d) => { const key = kind === 'month' ? String(d.createdAt).slice(0, 7) : kind === 'program' ? d.program : d.method; const x = m.get(key) || { key, count: 0, total: 0 }; x.count++; x.total += d.amount; m.set(key, x); });
    return Array.from(m.values()).sort((a, b) => (kind === 'month' ? b.key.localeCompare(a.key) : b.total - a.total));
  }
  function donReports() {
    const block = (kind, title) => { const rows = donSummary(kind), max = Math.max(1, ...rows.map((r) => r.total)); return `<div class="card card-body" style="margin-bottom:12px"><div class="toolbar"><h4 style="flex:1">${title}</h4><button class="btn btn-ghost btn-sm" data-a="don-rep-csv" data-id="${kind}">⬇ CSV</button></div>${rows.length ? rows.map((r) => `<div class="rep-row"><span>${esc(r.key)}</span><div><i style="width:${Math.round((r.total / max) * 100)}%"></i></div><b>${G.inr(r.total)}</b><small>${r.count}</small></div>`).join('') : '<p style="color:#9ca3af">No confirmed donations yet.</p>'}</div>`; };
    return block('month', 'By month') + block('program', 'By programme') + block('method', 'By payment method');
  }
  async function decide(id, ok) {
    const d = G.DB.get('donations', id); if (!d || d.status !== 'PENDING') return;
    if (!confirm(ok ? `Have you seen ${G.inr(d.amount)} with reference ${d.utr} in the bank statement? A receipt will be issued.` : 'Mark this payment as not received?')) return;
    try {
      if (d.cloud) await G.cloud.verifyDonation(id, ok);
      else { G.DB.update('donations', id, { status: ok ? 'CAPTURED' : 'FAILED', paymentId: 'UTR ' + d.utr }); if (ok) G.Donations.issueReceipt(id); }
      G.audit(ok ? 'UPI_VERIFIED' : 'UPI_REJECTED', 'donation', id, G.inr(d.amount) + ' · ref ' + d.utr); G.toast(ok ? 'Verified, receipt issued' : 'Marked as not received', ok ? '✅' : 'ℹ️'); render();
    } catch (e) { G.toast('Not saved: ' + e.message, '⚠️'); }
  }
  function offlineForm() {
    const progs = G.DB.all('programs').map((p) => tr(p.title)).concat('Where needed most'), opt = (list) => list.map((x) => `<option>${esc(x)}</option>`).join('');
    const m = G.modal({ wide: true, title: '✨ Record an offline gift', html: `<div class="pg-ai"><b>Fill by speaking or typing</b><textarea id="oSay" rows="2" maxlength="1500" placeholder="e.g. Received 2500 rupees cash from Suresh Gowda, mobile 98765 43210, for cow protection."></textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px">${voiceLangPicker()}<button type="button" class="btn btn-primary btn-sm" id="oRead">✨ Fill the form</button><span id="oStatus" class="ai-status"></span></div></div>
      <form id="oForm" class="f-grid" novalidate>
        <div class="field"><label>Donor name *</label><input name="donorName" maxlength="80"><span class="err">Name needed</span></div>
        <div class="field"><label>Amount (₹) *</label><input name="amount" type="number" min="1" step="0.01"><span class="err">Amount needed</span></div>
        <div class="field"><label>Received by</label><select name="method">${opt(['Cash', 'Cheque', 'Bank transfer', 'UPI'])}</select></div>
        <div class="field"><label>Programme</label><select name="program">${opt(progs)}</select></div>
        <div class="field"><label>Mobile</label><input name="donorPhone" inputmode="tel" maxlength="20"></div><div class="field"><label>Email</label><input name="donorEmail" type="email" maxlength="254"></div>
        <div class="field f-full"><label>Note (cheque or reference number)</label><input name="note" maxlength="200"></div>
        <button class="btn btn-primary f-full" type="submit">Save and create receipt</button></form>` });
    const f = $('#oForm', m);
    const vl = $('#aiVL', m); if (vl) vl.onchange = () => { try { sessionStorage.setItem('gigf_voice_lang', vl.value); } catch (e) { } };
    const read = async () => {
      const text = $('#oSay', m).value.trim(); if (!text) return G.toast('Say or type the gift first.', 'ℹ️');
      const st = $('#oStatus', m), b = $('#oRead', m); b.disabled = true; st.textContent = '✨ Reading…';
      const r = await aiPost(CFG.extractDonationApi || '/api/extract-donation', { text, programs: progs }); b.disabled = false;
      if (r.status !== 200 || !r.draft) { st.textContent = '⚠️ ' + aiMsg(r) + ' You can still fill the form yourself.'; return; }
      const d = r.draft, put = (k, v) => { if (v) f.elements[k].value = v; };
      put('donorName', d.name); put('amount', d.amount); put('method', d.method); put('program', d.program); put('donorPhone', d.phone); put('donorEmail', d.email); put('note', d.note);
      st.textContent = '✔ Check the amount, then Save.' + ((r.warnings || []).length ? ' ⚠️ ' + r.warnings.join(' ') : '');
    };
    $('#oRead', m).onclick = read;
    mic($('#oSay', m), (t) => { if (t.length >= 10 && !$('#oRead', m).disabled) read(); });
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); if (f.dataset.busy) return;
      const v = (n) => String(f.elements[n].value || '').trim(), amount = Math.round(Number(v('amount')) * 100) / 100;
      const mark = (n, wrong) => { f.elements[n].closest('.field').classList.toggle('bad', wrong); return wrong; };
      if ([mark('donorName', v('donorName').length < 2), mark('amount', !(amount > 0))].some(Boolean)) return;
      if (!confirm(`Record ${G.inr(amount)} from ${v('donorName')} and create a receipt?`)) return;
      f.dataset.busy = '1';
      const d = { donorName: v('donorName'), donorEmail: v('donorEmail').toLowerCase(), donorPhone: v('donorPhone'), program: v('program'), amount, method: v('method'), note: v('note') };
      try {
        let rec;
        if (G.cloud && G.cloud.canWrite()) rec = await G.cloud.addOffline(d);
        else { rec = G.DB.add('donations', Object.assign({ donorPan: '', frequency: 'ONE_TIME', status: 'CAPTURED', source: 'OFFLINE', userEmail: d.donorEmail, orderId: 'offline_' + Date.now().toString(36), paymentId: d.note, receiptNo: '', demo: true }, d)); G.Donations.issueReceipt(rec.id); }
        G.audit('OFFLINE_DONATION', 'donation', rec.id, G.inr(amount) + ' · ' + d.method); G.toast('Recorded, receipt created', '✅'); m.close(); window._don && (window._don.tab = 'ledger'); render();
      } catch (x) { f.dataset.busy = ''; G.toast('Not saved: ' + x.message, '⚠️'); }
    });
  }
  let upiQr = null;
  const upiCard = () => { const u = G.DB.settings().upi || {}; return `<div class="card card-body" style="margin-top:14px"><h4>📲 Direct UPI details</h4><p style="font-size:.84rem;color:#4b5563">Shown on the Donate page. ${u.id ? '' : '<b>Sample details are showing.</b> '}Use the Foundation's own account, never a personal one.</p>
    <form id="upiForm" class="f-grid"><div class="field"><label>UPI ID</label><input name="id" value="${esc(u.id || '')}" placeholder="foundation@bank"></div><div class="field"><label>Payee name</label><input name="name" maxlength="80" value="${esc(u.name || '')}"></div>
    <div class="field f-full"><label>QR picture from your bank or UPI app</label><input type="file" id="upiFile" accept="image/png,image/jpeg,image/webp"><small style="color:#6b7280">${u.qr ? 'A QR picture is saved.' : 'None yet.'}</small></div>
    <div class="f-full" style="display:flex;gap:8px"><button class="btn btn-primary btn-sm" type="submit">Save</button><button type="button" class="btn btn-ghost btn-sm" id="upiClear">Reset</button></div></form></div>`; };
  function bindUpi() {
    const f = $('#upiForm'); if (!f) return;
    const store = async (upi) => {
      G.DB.saveSettings({ upi }); G.audit('UPI_DETAILS_CHANGED', 'settings', '', upi ? upi.id : 'dummy'); upiQr = null;
      if (G.cloud && G.cloud.canWrite()) { try { await G.cloud.patchPublic({ upi }); G.toast('Saved for all visitors', '☁️'); } catch (e) { G.toast('Not saved to the database: ' + e.message, '⚠️'); } } else G.toast('Saved on this computer only', 'ℹ️');
      render();
    };
    $('#upiFile').onchange = async (e) => { try { upiQr = await compressImage(e.target.files[0], 600, 0.92, 250000); G.toast('Picture ready. Press Save.', '🖼️'); } catch (x) { G.toast('Could not open that picture.', '⚠️'); } };
    f.onsubmit = (e) => { e.preventDefault(); const id = f.elements.id.value.trim(); if (!G.upi.ID.test(id)) return G.toast('That does not look like a UPI ID (name@bank).', '⚠️');
      if (!confirm(`Donors will be told to pay ${id}. Check it carefully: money sent to a wrong ID is hard to recover. Save?`)) return;
      store({ id, name: f.elements.name.value.trim(), qr: upiQr || (G.DB.settings().upi || {}).qr || '' }); };
    $('#upiClear').onclick = () => store(null);
  }

  const galEdit = (id) => { A['gal-edit-form'](id); const el = document.querySelector('.modal-backdrop [name="title.en"]'); if (el) mic(el); };   // speak the caption

  /* ---------- articles: AI draft / voice / manual, formatting, preview, cover, languages, search settings ---------- */
  const ART_CATS = [['environment', 'Environment'], ['yoga', 'Yoga'], ['health', 'Health & Nutrition'], ['women', 'Women Empowerment'], ['stories', 'NGO Stories'], ['schemes', 'Govt Schemes']];
  const LANGS5 = [['en', 'English'], ['kn', 'ಕನ್ನಡ'], ['hi', 'हिन्दी'], ['ta', 'தமிழ்'], ['te', 'తెలుగు'], ['ml', 'മലയാളം']];
  function bindArticles() {
    const q = $('#artQ'); if (!q) return;
    q.oninput = () => { artFilter().q = q.value; $('#artList').innerHTML = artTable(); };
    $('#artSt').onchange = (e) => { artFilter().st = e.target.value; $('#artList').innerHTML = artTable(); };
  }
  const uniqueSlug = (wanted, ownId) => { const base = G.slugify(wanted) || 'article'; let s2 = base, n = 2; while (G.DB.all('articles').some((x) => x.id !== ownId && (x.slug === s2 || x.id === s2))) s2 = base + '-' + n++; return s2; };
  /** translate line by line so headings and lists keep their markers */
  async function translateBody(english, to) {
    const lines = english.split('\n').map((l) => { const m = l.match(/^(\s*(?:#{2,3}\s+|[-•]\s+|\d+[.)]\s+)?)(.*)$/); return { mark: m[1], text: m[2] }; });
    const jobs = lines.filter((l) => l.text.trim()); if (!jobs.length) return '';
    const out = await G.translate(jobs.map((l) => l.text.slice(0, 1900)), to); if (!out || out.some((x) => !x)) return '';
    let i = 0; return lines.map((l) => (l.text.trim() ? l.mark + out[i++] : '')).join('\n');
  }
  function artForm(id) {
    const a = id ? G.DB.get('articles', id) : { status: 'DRAFT', date: G.today(), category: 'stories' };
    const text = { title: Object.assign({}, a.title), summary: Object.assign({}, a.summary), body: {} };
    LANGS5.forEach(([l]) => { text.body[l] = G.articleBody(a, l); });
    const before = { title: text.title.en || '', summary: text.summary.en || '', body: text.body.en || '' };
    let lang = 'en', cover = a.cover || '';
    const m = G.modal({ wide: true, title: id ? '✏️ Edit article' : '✨ New article', html: `<div class="pg-ai"><b>Let the AI draft it</b><p style="font-size:.82rem;color:#4b5563">Say or type your notes in any language${id ? ' (this replaces the English text below)' : ''}. Check every fact before publishing.</p>
        <textarea id="aNotes" rows="3" maxlength="6000" placeholder="e.g. On Sunday 25 volunteers planted 120 saplings near the lake in Ramamurthy Nagar. School children helped water them."></textarea>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px">${voiceLangPicker()}<button type="button" class="btn btn-primary btn-sm" id="aDraft">✨ Draft the article</button><span id="aStatus" class="ai-status"></span></div></div>
      <form id="aForm" class="f-grid" novalidate>
        <div class="f-full lang-tabs">${LANGS5.map(([l, n]) => `<button type="button" class="btn btn-sm ${l === 'en' ? 'btn-primary' : 'btn-ghost'}" data-lg="${l}">${n}</button>`).join('')}</div>
        <div class="field f-full"><label>Title *</label><input name="title" maxlength="120"><span class="err">Give it a title</span></div>
        <div class="field f-full"><label>Short summary *</label><textarea name="summary" rows="2" maxlength="250"></textarea><span class="err">Add a summary</span></div>
        <div class="field f-full"><label>Article *</label><div class="md-bar">${[['h', 'Heading'], ['b', 'Bold'], ['ul', '• List'], ['ol', '1. List'], ['a', '🔗 Link']].map((x) => `<button type="button" class="btn btn-ghost btn-sm" data-md="${x[0]}">${x[1]}</button>`).join('')}<button type="button" class="btn btn-ghost btn-sm" id="aPrevBtn">👁️ Preview</button></div>
          <textarea name="body" rows="10" maxlength="12000"></textarea><div class="art-body md-prev" id="aPrev" hidden></div><span class="err">Write the article</span></div>
        <div class="field"><label>Category</label><select name="category">${ART_CATS.map((c) => `<option value="${c[0]}" ${c[0] === a.category ? 'selected' : ''}>${c[1]}</option>`).join('')}</select></div>
        <div class="field"><label>Date</label><input type="date" name="date" value="${esc(a.date || G.today())}"></div>
        <div class="field"><label>Status</label><select name="status">${['DRAFT', 'SCHEDULED', 'PUBLISHED'].map((x) => `<option ${x === a.status ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
        <div class="field"><label>Publish at (if scheduled, India time)</label><input type="datetime-local" name="publishAt" value="${esc(a.publishAt || '')}"><span class="err">Choose when</span></div>
        <div class="field f-full"><label>Cover picture</label><input type="file" id="aCover" accept="image/jpeg,image/png,image/webp"><div class="look-prev" id="aCoverPrev"></div></div>
        <div class="field"><label>Web address (letters, numbers, dashes)</label><input name="slug" maxlength="60" value="${esc(a.slug || a.id || '')}" placeholder="made from the title"></div>
        <div class="field"><label>Search description (up to 160 letters)</label><input name="seo" maxlength="160" value="${esc(a.seo || '')}" placeholder="the summary is used if empty"></div>
        <button class="btn btn-primary f-full" type="submit">Save article</button></form>` });
    const f = $('#aForm', m), el = (n) => f.elements[n];
    const keep = () => ['title', 'summary', 'body'].forEach((k) => { text[k][lang] = el(k).value; });
    const showLang = (l) => { lang = l; ['title', 'summary', 'body'].forEach((k) => { el(k).value = text[k][l] || ''; el(k).placeholder = l === 'en' ? '' : 'Empty = translated automatically when you save'; }); $$('[data-lg]', f).forEach((b) => (b.className = 'btn btn-sm ' + (b.dataset.lg === l ? 'btn-primary' : 'btn-ghost'))); preview(false); };
    const preview = (on) => { const p = $('#aPrev', m); p.hidden = !on; el('body').hidden = on; if (on) p.innerHTML = G.md(el('body').value) || '<p style="color:#9ca3af">Nothing to show yet.</p>'; $('#aPrevBtn', m).textContent = on ? '✏️ Back to writing' : '👁️ Preview'; };
    const drawCover = () => { const u = cover ? G.mediaUrl(cover) : ''; $('#aCoverPrev', m).innerHTML = u && u !== '#' ? `<img src="${esc(u)}" alt=""> <button type="button" class="btn btn-ghost btn-sm" id="aNoCover">Remove</button>` : '<span style="color:#9ca3af">A picture for the category is used</span>'; const x = $('#aNoCover', m); if (x) x.onclick = () => { cover = ''; drawCover(); }; };
    showLang('en'); drawCover();
    $$('[data-lg]', f).forEach((b) => (b.onclick = () => { keep(); showLang(b.dataset.lg); }));
    $('#aPrevBtn', m).onclick = () => preview($('#aPrev', m).hidden);
    $$('[data-md]', f).forEach((b) => (b.onclick = () => {
      preview(false); const t = el('body'), s0 = t.selectionStart, s1 = t.selectionEnd, sel = t.value.slice(s0, s1), k = b.dataset.md;
      let put;
      if (k === 'b') put = '**' + (sel || 'bold words') + '**';
      else if (k === 'a') { const address = prompt('Address (a page such as donate.html, or https://…)'); if (!address) return; if (!G.safeUrl(address, '')) return G.toast('That address is not allowed.', '⚠️'); put = '[' + (sel || 'link words') + '](' + address + ')'; }
      else { const mark = (i) => (k === 'h' ? '## ' : k === 'ul' ? '- ' : i + 1 + '. '); put = (s0 && t.value[s0 - 1] !== '\n' ? '\n' : '') + (sel || (k === 'h' ? 'Heading' : 'list item')).split('\n').map((l, i) => mark(i) + l).join('\n'); }
      t.setRangeText(put, s0, s1, 'end'); t.focus();
    }));
    $('#aCover', m).onchange = async (e) => { try { cover = await compressImage(e.target.files[0], 1100, 0.78, 200000); drawCover(); } catch (x) { G.toast('Could not open that picture.', '⚠️'); } };
    const vl = $('#aiVL', m); if (vl) vl.onchange = () => { try { sessionStorage.setItem('gigf_voice_lang', vl.value); } catch (e) { } };
    const draftIt = async () => {
      const notes = $('#aNotes', m).value.trim(); if (notes.length < 15) return G.toast('Add a few sentences of notes first.', 'ℹ️');
      const st = $('#aStatus', m), b = $('#aDraft', m); b.disabled = true; st.textContent = '✨ Writing…';
      const r = await aiPost(CFG.draftApi || '/api/draft-article', { notes, category: el('category').selectedOptions[0].textContent }); b.disabled = false;
      if (r.status !== 200 || !r.draft) { st.textContent = '⚠️ ' + aiMsg(r) + ' You can still write it yourself.'; return; }
      keep(); text.title.en = r.draft.title; text.summary.en = r.draft.summary; text.body.en = r.draft.body; showLang('en');
      st.textContent = '✔ Drafted. Read it all before publishing.' + ((r.warnings || []).length ? ' ⚠️ ' + r.warnings.join(' · ') : '');
    };
    $('#aDraft', m).onclick = draftIt;
    mic($('#aNotes', m)); mic(el('body'));
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); if (f.dataset.busy) return; keep(); if (lang !== 'en') showLang('en');
      const v = (n) => String(el(n).value || '').trim(), mark = (n, wrong) => { el(n).closest('.field').classList.toggle('bad', wrong); return wrong; };
      const wrong = [mark('title', (text.title.en || '').trim().length < 3), mark('summary', !(text.summary.en || '').trim()), mark('body', (text.body.en || '').trim().length < 20), mark('publishAt', v('status') === 'SCHEDULED' && !v('publishAt'))].some(Boolean);
      if (wrong) return G.toast('Please fill the highlighted fields.', '⚠️');
      f.dataset.busy = '1'; const btn = f.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Saving…';
      // an old translation is dropped when its English text changed, so it is translated afresh
      ['title', 'summary', 'body'].forEach((k) => { if ((text[k].en || '') !== before[k] && before[k]) LANGS5.slice(1).forEach(([l]) => { const old = k === 'body' ? G.articleBody(a, l) : (a[k] || {})[l]; if (text[k][l] === old) text[k][l] = ''; }); });
      if (G.auto().autoTranslate && G.autoTranslateAvailable()) {
        try { const box = { title: text.title, summary: text.summary }; await ensureTranslations(box, ['title', 'summary']); for (const [l] of LANGS5.slice(1)) if (!text.body[l]) text.body[l] = await translateBody(text.body.en, l); } catch (x) { }
      }
      const body = {}; Object.keys(text.body).forEach((l) => { if (text.body[l]) body[l] = text.body[l]; });
      let picture = cover;
      if (G.cloud && G.cloud.canWrite() && /^data:/.test(picture)) { try { picture = await G.cloud.uploadMedia(await toBlob(picture)); } catch (x) { G.toast('Cover kept inside the article: ' + x.message, 'ℹ️'); } }
      const item = { title: text.title, summary: text.summary, body, category: v('category'), date: v('date') || G.today(), status: v('status'), publishAt: v('status') === 'SCHEDULED' ? v('publishAt') : '', cover: picture, seo: v('seo'), slug: uniqueSlug(v('slug') || text.title.en, id) };
      const snapshot = localStorage.getItem('gigf_db_v2');
      if (id) G.DB.update('articles', id, item); else G.DB.add('articles', Object.assign({ id: item.slug + '-' + Date.now().toString(36).slice(-3) }, item));
      if (localStorage.getItem('gigf_db_v2') === snapshot) G.toast('This browser is out of space: use a smaller cover picture.', '⚠️'); else G.toast(item.status === 'PUBLISHED' ? 'Published' : 'Saved as ' + item.status.toLowerCase(), '✅');
      G.audit('ARTICLE_' + item.status, 'article', id || item.slug); m.close(); render();
    });
  }

  /* ---------- messages ready to send, and the newsletter ---------- */
  const outFilter = () => (window._out = window._out || { show: 'WAITING', kind: 'ALL' });
  const outRows = () => { const f = outFilter(), done = G.notify.sent(); return G.notify.messages().filter((m) => (f.show === 'ALL' || !done.has(m.key)) && (f.kind === 'ALL' || m.kind === f.kind)); };
  S.outbox = () => {
    if (!G.notify) return G.emptyBox('📨', 'Messages are not available.');
    const f = outFilter(), rows = outRows(), done = G.notify.sent(), kinds = Array.from(new Set(G.notify.messages().map((m) => m.kind)));
    const subs = Array.from(new Set(G.DB.all('subscribers').map((x) => String(x.email || '').toLowerCase()).filter((e) => /^\S+@\S+\.\S+$/.test(e))));
    return `<h3 style="margin-bottom:6px">Messages to send</h3><p style="color:#4b5563;font-size:.86rem;margin-bottom:10px">Written for you. Press Email or WhatsApp, check it, and send. ${done.size ? done.size + ' marked as sent.' : ''}</p>
      <div class="toolbar"><select id="outShow" class="search" style="flex:0 1 180px"><option value="WAITING" ${f.show === 'WAITING' ? 'selected' : ''}>Not sent yet</option><option value="ALL" ${f.show === 'ALL' ? 'selected' : ''}>All</option></select><select id="outKind" class="search" style="flex:0 1 220px"><option value="ALL">All kinds</option>${kinds.map((k) => `<option ${k === f.kind ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select></div>
      ${rows.length ? rows.slice(0, 100).map((m) => { const l = G.notify.links(m); return `<div class="card card-body out-row"><div><span class="chip">${esc(m.kind)}</span> <b>${esc(m.name)}</b> <small>${esc(m.email)} ${esc(m.phone)}</small><div class="out-sub">${esc(m.subject)}</div><details><summary>Read the message</summary><pre>${esc(m.body)}</pre></details></div>
        <div class="out-act">${l.mail ? `<a class="btn btn-primary btn-sm" href="${esc(l.mail)}" data-sent="${esc(m.key)}">✉️ Email</a>` : ''}${l.wa ? `<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="${esc(l.wa)}" data-sent="${esc(m.key)}">💬 WhatsApp</a>` : ''}<button type="button" class="btn btn-ghost btn-sm" data-sent="${esc(m.key)}">${done.has(m.key) ? '✔ Sent' : 'Mark sent'}</button></div></div>`; }).join('') : G.emptyBox('✅', 'Nothing is waiting to be sent.')}
      <div class="card card-body" style="margin-top:16px"><h4>📰 Newsletter</h4><p style="font-size:.84rem;color:#4b5563;margin:4px 0 8px"><b>${subs.length}</b> subscriber${subs.length === 1 ? '' : 's'}. Addresses go in BCC so people cannot see each other. Send only to people who signed up.</p>
        <form id="newsLetter" class="f-grid"><div class="field f-full"><label>Subject</label><input name="subject" maxlength="150"></div><div class="field f-full"><label>Message</label><textarea name="body" rows="5" maxlength="1500"></textarea></div>
        <div class="f-full" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary btn-sm" type="submit" ${subs.length ? '' : 'disabled'}>✉️ Open in my email</button><button type="button" class="btn btn-ghost btn-sm" id="subCopy" ${subs.length ? '' : 'disabled'}>Copy addresses</button></div></form></div>`;
  };
  function bindOutbox() {
    const f = $('#newsLetter'); if (!f) return;
    $('#outShow').onchange = (e) => { outFilter().show = e.target.value; render(); }; $('#outKind').onchange = (e) => { outFilter().kind = e.target.value; render(); };
    $$('[data-sent]', $('.admin-main')).forEach((el) => el.addEventListener('click', () => { G.notify.markSent(el.dataset.sent); G.audit('MESSAGE_SENT', 'message', el.dataset.sent.slice(0, 40)); setTimeout(render, 300); }));
    const subs = () => Array.from(new Set(G.DB.all('subscribers').map((x) => String(x.email || '').toLowerCase()).filter((e) => /^\S+@\S+\.\S+$/.test(e))));
    $('#subCopy').onclick = () => navigator.clipboard.writeText(subs().join(', ')).then(() => G.toast('Addresses copied', '📋'));
    f.onsubmit = (e) => {
      e.preventDefault(); const subject = f.elements.subject.value.trim(), body = f.elements.body.value.trim();
      if (!subject || !body) return G.toast('Write a subject and a message.', '⚠️');
      const list = subs(), text = body + '\n\n' + G.ORG.name + '\nTo stop receiving these, reply with the word STOP.';
      if (list.length > 40) { navigator.clipboard.writeText(list.join(', ')); G.toast('Many addresses: they are copied. Paste them into BCC.', '📋'); }
      location.href = `mailto:?${list.length > 40 ? '' : 'bcc=' + list.map(encodeURIComponent).join(',').replace(/%40/g, '@') + '&'}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
      G.audit('NEWSLETTER_PREPARED', 'newsletter', '', list.length + ' address(es)');
    };
  }

  function render() {
    const openCount = G.DB.all('tickets').filter((t) => t.status !== 'RESOLVED').length;
    root().innerHTML = `<div class="admin-shell"><aside class="side">${NAV.map((n) => `<button data-sec="${n[0]}" class="${n[0] === sec ? 'on' : ''}">${n[1]} ${n[2]}${n[0] === 'issues' && openCount ? `<span class="cnt">${openCount}</span>` : ''}</button>`).join('')}</aside><section class="admin-main">${(S[sec] || S.dash)()}</section></div>`;
    bindLook();
    bindVolunteers();
    bindGallery();
    bindArticles();
    bindOutbox();
    const md = $('#dmd'); if (md) md.onchange = () => { window._don.md = md.value; render(); };
    if (sec === 'settings' && G.upi) $('.admin-main').insertAdjacentHTML('beforeend', upiCard()), bindUpi();
    G.applyI18n(); wireInputs();
  }
  function wireInputs() {
    const up = $('#galUp'); if (up) up.onchange = (e) => addPhotos(e.target.files);
    const dd = $('#galDrop'); if (dd) { dd.ondragover = (e) => { e.preventDefault(); dd.style.background = '#f0fdf4'; }; dd.ondragleave = () => (dd.style.background = ''); dd.ondrop = (e) => { e.preventDefault(); dd.style.background = ''; addPhotos(e.dataTransfer.files); }; }
    const f = window._don; if (sec === 'donations' && $('#dst')) { $('#dst').value = f.st; $('#dpg').value = f.pg; const upd = () => { f.q = $('#dq').value; f.st = $('#dst').value; f.pg = $('#dpg').value; f.from = $('#dfr').value; f.to = $('#dto').value; render(); }; ['dst', 'dpg', 'dfr', 'dto'].forEach((i) => ($('#' + i).onchange = upd)); $('#dq').onchange = upd; }
    const af = $('#autoForm'); if (af) af.onsubmit = (e) => { e.preventDefault(); const x = new FormData(af); const val = Math.max(2, Math.min(1440, Number(x.get('stuckMinutes')) || 15)); G.DB.saveSettings({ automation: { autoTranslate: !!x.get('autoTranslate'), flagStuckPayments: !!x.get('flagStuckPayments'), autoReplyRoutine: !!x.get('autoReplyRoutine'), autoApproveVolunteers: !!x.get('autoApproveVolunteers'), stuckMinutes: val } }); try { sessionStorage.setItem('gigf_admin_token', String(x.get('token') || '').trim()); } catch (er) { } G.audit('AUTOMATION_SETTINGS', 'settings', '', JSON.stringify(G.auto())); G.toast('Automation settings saved', '✅'); };
    const sf = $('#setForm'); if (sf) sf.onsubmit = (e) => { e.preventDefault(); const x = new FormData(sf); const impact = String(x.get('impact')).split('\n').map((l) => l.split('|')).filter((p) => p.length === 2 && p[0].trim()).map((p) => ({ value: p[0].trim(), label: p[1].trim() })); G.DB.saveSettings({ reg80G: x.get('reg80G').trim(), reg12A: x.get('reg12A').trim(), pan: x.get('pan').trim(), impact }); G.audit('SETTINGS_UPDATE', 'settings'); G.toast('Settings saved', '✅'); };
  }
  const evOpts = () => [['', '— no particular event —']].concat(G.DB.all('events').map((e) => [e.id, tr(e.title) + ' (' + e.date + ')']));
  const shrinkPhoto = (file) => compressImage(file, 1280, 0.78, 260000);
  const toBlob = async (dataUrl) => { const [head, body] = dataUrl.split(','), bin = atob(body), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return new Blob([arr], { type: head.slice(5, head.indexOf(';')) }); };
  async function addPhotos(files) {
    const list = Array.from(files).filter((f) => /^(image\/(jpeg|png|webp)|video\/(mp4|webm))$/.test(f.type)); if (!list.length) return G.toast('Choose photos (JPG, PNG, WebP) or videos (MP4, WebM).', '⚠️');
    const category = ($('#galCat') || {}).value || 'community', eventId = ($('#galEvent') || {}).value || '', ai = !!($('#galAi') || {}).checked, real = !!(G.cloud && G.cloud.canWrite());
    let done = 0, skippedVideo = 0, failed = 0, i = 0;
    const note = (t) => { const e = $('#galStatus'); if (e) e.textContent = t; };
    let order = Math.min(0, ...G.DB.all('gallery').map((m) => (m.order == null ? 0 : m.order))) - list.length - 1;
    for (const file of list) {
      note(`Adding ${++i} of ${list.length}…`);
      const video = /^video\//.test(file.type);
      let src = '', title = file.name.replace(/\.\w+$/, '').replace(/[_-]+/g, ' ').slice(0, 90);
      try {
        if (video) { if (!real) { skippedVideo++; continue; } src = await G.cloud.uploadMedia(file); }
        else {
          const data = await shrinkPhoto(file);
          if (ai) { const r = await aiPost(CFG.captionApi || '/api/caption-photo', { image: data }); if (r.status === 200 && r.caption) title = r.caption; else note('AI caption not available: ' + aiMsg(r)); }
          src = real ? await G.cloud.uploadMedia(await toBlob(data)) : data;
        }
      } catch (e) { failed++; continue; }
      const before = localStorage.getItem('gigf_db_v2');
      const item = G.DB.add('gallery', { eventId, type: video ? 'VIDEO' : 'PHOTO', src, category, date: G.today(), featured: false, order: ++order, title: { en: title, kn: '', hi: '' } });
      if (localStorage.getItem('gigf_db_v2') === before) { G.DB.remove('gallery', item.id); G.toast('This browser is full. Delete some pictures, or sign in with your real admin account.', '⚠️'); break; }
      done++;
    }
    if (done) G.audit('GALLERY_UPLOAD', 'gallery', '', done + ' file(s)');
    G.toast(`${done} added` + (skippedVideo ? `. ${skippedVideo} video(s) need your real admin account to upload` : '') + (failed ? `. ${failed} failed` : ''), done ? '✅' : 'ℹ️'); render();
  }
  function bindGallery() {
    const q = $('#galQ'); if (!q) return;
    const f = galFilter(), list = () => { $('#galList').innerHTML = galGrid(); };
    q.oninput = () => { f.q = q.value; list(); };
    $('#galType').onchange = (e) => { f.type = e.target.value; list(); }; $('#galFcat').onchange = (e) => { f.cat = e.target.value; list(); }; $('#galFev').onchange = (e) => { f.ev = e.target.value; list(); };
    $('#galCat').onchange = (e) => (f.upCat = e.target.value); $('#galEvent').onchange = (e) => (f.upEv = e.target.value); $('#galAi').onchange = (e) => (f.ai = e.target.checked);
    $('#galList').onchange = (e) => { const id = e.target.dataset.sel; if (!id) return; e.target.checked ? f.sel.add(id) : f.sel.delete(id); e.target.closest('.gal-item').classList.toggle('on', e.target.checked); $('#galBulk').innerHTML = galBulk(); };
    $('#galBulk').onchange = (e) => {
      const set = e.target.id === 'bulkCat' && e.target.value ? { category: e.target.value } : e.target.id === 'bulkEv' && e.target.value !== '-' ? { eventId: e.target.value } : null; if (!set) return;
      f.sel.forEach((id) => G.DB.update('gallery', id, set)); G.audit('GALLERY_BULK', 'gallery', '', f.sel.size + ' item(s)'); G.toast(f.sel.size + ' updated', '✅'); render();
    };
  }
  const removeMedia = (id) => { const m = G.DB.get('gallery', id); if (!m) return; const src = m.src; G.DB.remove('gallery', id); if (G.cloud) G.cloud.deleteMedia(src); };
  function moveMedia(id, step) {
    const shown = galRows(), i = shown.findIndex((m) => m.id === id), other = shown[i + step]; if (i < 0 || !other) return;
    const all = G.sortMedia(G.DB.all('gallery')), a = all.findIndex((m) => m.id === id), b = all.findIndex((m) => m.id === other.id);
    [all[a], all[b]] = [all[b], all[a]];
    all.forEach((m, k) => { if (m.order !== k + 1) G.DB.update('gallery', m.id, { order: k + 1 }); }); render();
  }

  /* ---------- editors ---------- */
  const catOpts = [['tree', 'Tree Plantation'], ['cow', 'Cow Protection'], ['health', 'Yoga & Health'], ['skill', 'Women Empowerment'], ['community', 'Community Events']];
  const progOpts = () => G.DB.all('programs').map((p) => [p.id, tr(p.title)]);
  /* ---------- sample data so the admin screens can be learnt (this browser only; nothing is sent anywhere) ---------- */
  function removeSample() {
    const ids = new Set(G.DB.all('donations').filter((d) => d.sample).map((d) => d.id));
    ['donations', 'users', 'tickets', 'volunteers', 'registrations'].forEach((c) => G.DB.all(c).filter((x) => x.sample || (c === 'tickets' && ids.has(x.donationId))).map((x) => x.id).forEach((id) => G.DB.remove(c, id)));
  }
  function loadSample() {
    removeSample();   // pressing twice never duplicates
    const names = ['Asha Rao', 'Ravi Kumar', 'Meena Iyer', 'Suresh Gowda', 'Fatima Khan', 'John Mathew', 'Lakshmi Devi', 'Arjun Shetty', 'Priya Nair', 'Vikram Singh'];
    const people = names.map((name, i) => ({ name, email: name.split(' ')[0].toLowerCase() + '@example.com', phone: '90000000' + String(i + 1).padStart(2, '0') }));
    const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
    people.forEach((p, i) => G.DB.add('users', Object.assign({ role: i % 3 === 0 ? 'VOLUNTEER' : 'DONOR', hash: '', salt: '', sample: true, createdAt: ago(3000 - i * 100) }, p)));
    const progs = G.DB.all('programs').map((x) => tr(x.title));
    // [person, amount, method, outcome, minutes ago, frequency]
    const pays = [[0, 1000, 'UPI', 'CAPTURED', 2900, 'ONE_TIME'], [1, 500, 'Card', 'CAPTURED', 2400, 'MONTHLY'], [2, 2500, 'Netbanking', 'CAPTURED', 1500, 'ONE_TIME'], [3, 250, 'UPI', 'FAILED', 900, 'ONE_TIME'], [4, 5000, 'Card', 'CAPTURED', 600, 'ONE_TIME'], [5, 750, 'UPI', 'PENDING', 90, 'ONE_TIME'], [6, 1500, 'Netbanking', 'FAILED', 60, 'ONE_TIME'], [7, 100, 'UPI', 'CAPTURED', 30, 'MONTHLY'], [8, 3000, 'Card', 'PENDING', 5, 'ONE_TIME'], [9, 2000, 'UPI', 'FAILED', 3, 'ONE_TIME']];
    pays.forEach(([n, amount, method, status, min, frequency], i) => {
      const p = people[n], key = Date.now().toString(36) + i;
      const d = G.DB.add('donations', { donorName: p.name, donorEmail: p.email, donorPhone: p.phone, donorPan: '', program: progs[i % progs.length], amount, frequency, method, userEmail: p.email, orderId: 'demo_order_' + key, paymentId: status === 'CAPTURED' ? 'demo_pay_' + key : '', status, receiptNo: '', demo: true, sample: true, createdAt: ago(min) });
      G.audit('PAYMENT_' + status, 'donation', d.id, 'sample data · ' + G.inr(amount) + ' · ' + method);
      if (status === 'CAPTURED') G.Donations.issueReceipt(d.id);
      if (status === 'FAILED' && i !== 9) { const t = G.Tickets.create({ category: 'PAYMENT_ISSUE', name: p.name, email: p.email, phone: p.phone, subject: 'Payment FAILED', message: i === 3 ? 'Money was debited from my account but the page said failed. Please check.' : 'My net-banking payment of ' + G.inr(amount) + ' failed. Can I try again?', donationId: d.id }); G.DB.update('tickets', t.id, { sample: true }); }
    });
    [[0, 'APPROVED'], [3, 'PENDING'], [6, 'PENDING']].forEach(([n, status]) => { const p = people[n]; const v = G.Volunteers.apply({ name: p.name, email: p.email, phone: p.phone, city: 'Bengaluru', domain: 'Tree plantation', idType: 'Aadhaar', idFile: 'sample-id.jpg' }); G.DB.update('volunteers', v.id, { sample: true, status }); });
    const ev = G.DB.all('events').find((e) => e.status === 'UPCOMING');
    if (ev) [1, 2, 4, 8].forEach((n) => G.DB.add('registrations', Object.assign({ eventId: ev.id, guests: 1, asVolunteer: false, sample: true }, people[n])));
    [[2, 'Volunteering', 'How can I volunteer on weekends?'], [4, '80G certificate', 'Please send me an 80G certificate for my donation.']].forEach(([n, subject, message]) => { const p = people[n]; const t = G.Tickets.create({ category: 'CONTACT', name: p.name, email: p.email, phone: p.phone, subject, message }); G.DB.update('tickets', t.id, { sample: true }); });
    G.Donations.reconcile();   // the 90-minute-old pending payment gets flagged automatically
  }

  const A = {
    'sample-add': () => { loadSample(); render(); G.toast('Sample data loaded: 10 people, 10 payments', '🧪'); },
    'sample-del': () => { removeSample(); render(); G.toast('Sample data removed', '🧹'); },
    'prog-new': () => programForm(null),
    'prog-edit': (id) => programForm(id),
    'prog-up': (id) => moveProgram(id, -1),
    'prog-down': (id) => moveProgram(id, 1),
    'prog-del': (id) => {
      const p = G.DB.get('programs', id), used = G.DB.all('events').filter((e) => e.program === id).length;
      if (!confirm(`Delete “${tr(p.title)}”?` + (used ? ` ${used} event(s) belong to it and will no longer show a programme.` : '') + ' This cannot be undone.')) return;
      G.DB.remove('programs', id); G.audit('PROGRAM_DELETE', 'program', id); render();
    },
    'ev-new': () => A['ev-edit'](null),
    'ev-edit': (id) => { const e = id ? G.DB.get('events', id) : { status: 'UPCOMING', time: '08:00', capacity: 30, volSlots: 10, program: 'tree', date: G.today() }; editor({ title: id ? 'Edit event' : 'New event', item: e, fields: [{ k: 'title', label: 'Title', type: 'i18n' }, { k: 'desc', label: 'Description', type: 'i18nArea' }, { k: 'program', label: 'Programme', type: 'select', opts: progOpts() }, { k: 'date', label: 'Date', type: 'date' }, { k: 'time', label: 'Time', type: 'time' }, { k: 'location', label: 'Location', full: true }, { k: 'capacity', label: 'Max attendees', type: 'number' }, { k: 'volSlots', label: 'Volunteer slots', type: 'number' }, { k: 'status', label: 'Status', type: 'select', opts: [['UPCOMING', 'Upcoming'], ['DRAFT', 'Draft (not public)'], ['COMPLETED', 'Completed'], ['CANCELLED', 'Cancelled']] }], onSave: (o) => { o.tentative = false; if (id) G.DB.update('events', id, o); else { o.slug = (o.title.en || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36).slice(-4); G.DB.add('events', o); } G.audit(id ? 'EVENT_UPDATE' : 'EVENT_CREATE', 'event', id || ''); render(); } }); },
    'ev-del': (id) => { if (confirm('Delete this event?')) { G.DB.remove('events', id); G.audit('EVENT_DELETE', 'event', id); render(); } },
    'ev-regs': (id) => {
      const e = G.DB.get('events', id), regs = G.DB.all('registrations').filter((r) => r.eventId === id);
      const m = G.modal({ wide: true, title: '👥 ' + esc(tr(e.title)), html: table([['name', 'Name'], [(r) => esc(r.phone) + '<br>' + esc(r.email), 'Contact'], ['guests', 'Guests'], [(r) => (r.asVolunteer ? '🤝' : ''), 'Vol'], [(r) => `<label><input type="checkbox" data-att="${r.id}" ${r.attended ? 'checked' : ''}> present</label>`, 'Attendance']], regs) });
      m.addEventListener('change', (ev) => { if (ev.target.dataset.att) { G.DB.update('registrations', ev.target.dataset.att, { attended: ev.target.checked }); G.audit('ATTENDANCE', 'event', id); } });
    },
    'news-new': () => A['news-edit'](null),
    'news-edit': (id) => { const n = id ? G.DB.get('news', id) : { status: 'DRAFT', date: G.today() }; editor({ title: 'News / update', item: n, fields: [{ k: 'title', label: 'Headline', type: 'i18n' }, { k: 'summary', label: 'Summary', type: 'i18nArea' }, { k: 'date', label: 'Date', type: 'date' }, { k: 'link', label: 'Link (optional: page name like events.html, or https://…)' }, { k: 'status', label: 'Status', type: 'select', opts: [['DRAFT', 'Draft'], ['SCHEDULED', 'Scheduled'], ['PUBLISHED', 'Published']] }, { k: 'publishAt', label: 'Publish at (if scheduled)', type: 'datetime-local' }, { k: 'pinned', label: 'Pin to top', type: 'checkbox' }], onSave: (o) => { if (id) G.DB.update('news', id, o); else G.DB.add('news', o); G.audit('NEWS_' + o.status, 'news', id || ''); render(); } }); },
    'news-del': (id) => { if (confirm('Delete?')) { G.DB.remove('news', id); render(); } },
    'art-new': () => artForm(null),
    'art-edit': (id) => artForm(id),
    'art-view': (id) => { const a = G.DB.get('articles', id), cover = a.cover ? G.mediaUrl(a.cover) : ''; G.modal({ wide: true, title: '👁️ ' + esc(tr(a.title)), html: `${cover && cover !== '#' ? `<img class="detail-img" src="${esc(cover)}" alt="">` : ''}<p style="color:#6b7280">${esc(tr(a.summary))}</p><div class="art-body">${G.md(G.articleBody(a, G.lang()) || G.articleBody(a))}</div>` }); },
    'art-map': () => {
      const base = CFG.siteUrl || location.origin + location.pathname.replace(/[^/]*$/, ''), pages = ['', 'programs.html', 'events.html', 'gallery.html', 'awareness.html', 'environment.html', 'volunteer.html', 'donate.html', 'contact.html', 'reports.html'];
      const now = new Date(), live = G.DB.all('articles').filter((a) => a.status === 'PUBLISHED' || (a.status === 'SCHEDULED' && new Date(a.publishAt) <= now));
      const urls = pages.concat(live.map((a) => 'article.html?a=' + encodeURIComponent(a.slug || a.id)), G.DB.all('events').filter((e) => e.status !== 'DRAFT').map((e) => 'event.html?e=' + encodeURIComponent(e.slug)));
      const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.map((u) => '  <url><loc>' + esc(base + u) + '</loc></url>').join('\n') + '\n</urlset>\n';
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([xml], { type: 'application/xml' })); a.download = 'sitemap.xml'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      G.toast(urls.length + ' pages. Replace sitemap.xml in the project with this file, then push.', '🗺️');
    },
    'art-del': (id) => { if (confirm('Delete?')) { G.DB.remove('articles', id); render(); } },
    'vid-new': () => editor({ title: 'Add video', item: { type: 'VIDEO', category: 'community', date: G.today() }, fields: [{ k: 'title', label: 'Title', type: 'i18n' }, { k: 'eventId', label: 'Event it belongs to', type: 'select', opts: evOpts() }, { k: 'src', label: 'Video file path or URL (.mp4)', full: true, req: true }, { k: 'category', label: 'Category', type: 'select', opts: catOpts }, { k: 'date', label: 'Date', type: 'date' }, { k: 'featured', label: 'Show in the home video section (videos)', type: 'checkbox' }], onSave: (o) => { o.type = 'VIDEO'; o.src = G.safeUrl(o.src, ''); if (!o.src) return G.toast('That video address is not allowed. Use a file path like assets/gallery/x.mp4 or an https:// link.', '⚠️'); G.DB.add('gallery', o); G.audit('GALLERY_ADD', 'gallery'); render(); } }),
    'rep-add': () => editor({ title: 'Publish an annual report', item: { year: String(new Date().getFullYear()) }, fields: [{ k: 'title', label: 'Title', req: true }, { k: 'year', label: 'Year', req: true }, { k: 'url', label: 'PDF address (assets/reports/name.pdf or https://…)', full: true, req: true }], onSave: (o) => { if (!G.safeUrl(o.url, '')) return G.toast('That address is not allowed.', '⚠️'); G.DB.saveSettings({ reports: [{ title: o.title, year: o.year, url: o.url }].concat(G.DB.settings().reports || []) }); G.audit('REPORT_PUBLISH', 'report', o.year); render(); } }),
    'gal-edit': (id) => galEdit(id),
    'gal-edit-form': (id) => editor({ title: 'Edit media', item: G.DB.get('gallery', id), fields: [{ k: 'title', label: 'Caption', type: 'i18n' }, { k: 'eventId', label: 'Event these belong to', type: 'select', opts: evOpts() }, { k: 'category', label: 'Category', type: 'select', opts: catOpts }, { k: 'date', label: 'Date', type: 'date' }, { k: 'featured', label: 'Show in the home video section (videos)', type: 'checkbox' }], onSave: (o) => { G.DB.update('gallery', id, o); G.audit('GALLERY_UPDATE', 'gallery', id); render(); } }),
    'gal-del': (id) => { if (confirm('Delete this media?')) { removeMedia(id); galFilter().sel.delete(id); G.audit('GALLERY_DELETE', 'gallery', id); render(); } },
    'gal-left': (id) => moveMedia(id, -1),
    'gal-right': (id) => moveMedia(id, 1),
    'gal-all': () => { galRows().forEach((m) => galFilter().sel.add(m.id)); render(); },
    'gal-none': () => { galFilter().sel.clear(); render(); },
    'gal-star': () => { const s2 = galFilter().sel, on = !Array.from(s2).every((id) => (G.DB.get('gallery', id) || {}).featured); s2.forEach((id) => G.DB.update('gallery', id, { featured: on })); G.toast(on ? 'Shown first in the home video section (videos only)' : 'Removed from the home video section', '⭐'); render(); },
    'gal-bulkdel': () => { const s2 = galFilter().sel; if (!confirm(`Delete ${s2.size} item(s)? This cannot be undone.`)) return; s2.forEach(removeMedia); G.audit('GALLERY_DELETE', 'gallery', '', s2.size + ' item(s)'); s2.clear(); render(); },
    'ts-new': () => A['ts-edit'](null),
    'ts-edit': (id) => editor({ title: 'Testimonial', item: id ? G.DB.get('testimonials', id) : {}, fields: [{ k: 'name', label: 'Name', req: true }, { k: 'role', label: 'Role (donor / volunteer / beneficiary)' }, { k: 'text', label: 'Quote', type: 'textarea', full: true, rows: 3 }], onSave: (o) => { if (id) G.DB.update('testimonials', id, o); else G.DB.add('testimonials', o); render(); } }),
    'ts-del': (id) => { G.DB.remove('testimonials', id); render(); },
    'vol-ok': (id) => { G.DB.update('volunteers', id, { status: 'APPROVED' }); G.audit('VOLUNTEER_APPROVE', 'volunteer', id); G.toast('Approved', '✅'); render(); },
    'vol-no': (id) => { const why = prompt('Reason for not approving (the volunteer will see it):', ''); if (why === null) return; G.DB.update('volunteers', id, { status: 'REJECTED', reason: why.slice(0, 300) }); G.audit('VOLUNTEER_REJECT', 'volunteer', id, why); render(); },
    'vol-new': () => volForm(null),
    'vol-open': (id) => volForm(id),
    'vol-cert': (id) => { const v = G.DB.get('volunteers', id); if (v.status !== 'APPROVED') return G.toast('Approve the volunteer first', 'ℹ️'); if (G.Volunteers.downloadPDF(v)) G.audit('CERTIFICATE_ISSUED', 'volunteer', id); },
    'vol-csv': () => { csv('volunteers.csv', [['badge', 'Badge'], ['name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['city', 'City'], ['domain', 'Area'], ['duty', 'Role'], ['status', 'Status'], ['reason', 'Reason'], ['hours', 'Hours'], [(r) => (r.tasks || []).filter((t) => t.done).length, 'Tasks done'], [(r) => (r.tasks || []).filter((t) => !t.done).length, 'Tasks open'], [(r) => (r.attendance || []).length, 'Days attended']], volRows()); G.audit('VOLUNTEER_REPORT', 'volunteer', ''); },
    'reg-csv': () => csv('registrations.csv', [[(r) => tr((G.DB.get('events', r.eventId) || {}).title), 'Event'], ['name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['guests', 'Guests'], [(r) => (r.asVolunteer ? 'Yes' : 'No'), 'Volunteer'], [(r) => (r.attended ? 'Yes' : 'No'), 'Attended']], G.DB.all('registrations')),
    'don-csv': () => { csv('donations.csv', [[(r) => r.createdAt.slice(0, 10), 'Date'], ['receiptNo', 'Receipt'], ['donorName', 'Donor'], ['donorEmail', 'Email'], ['donorPhone', 'Phone'], ['donorPan', 'PAN'], ['program', 'Programme'], ['amount', 'Amount INR'], ['frequency', 'Frequency'], ['method', 'Method'], ['status', 'Status'], ['paymentId', 'Payment ID']], window._donRows || G.DB.all('donations')); G.audit('EXPORT', 'donations'); },
    'don-csv-all': () => { window._donRows = G.DB.all('donations'); A['don-csv'](); },
    'don-tab': (t) => { window._don.tab = t; render(); },
    'don-add': () => offlineForm(),
    'don-verify': (id) => decide(id, true),
    'don-reject': (id) => decide(id, false),
    'don-stop': async (id) => { if (!confirm('Mark this monthly donation as stopped?')) return; const d = G.DB.get('donations', id); if (d.cloud) { try { await G.cloud.stopMonthly(id); } catch (e) { return G.toast(e.message, '⚠️'); } } G.DB.update('donations', id, { cancelled: true }); G.audit('MONTHLY_STOPPED', 'donation', id, 'stopped by admin'); render(); },
    'don-share': (id) => {   // downloads the PDF and opens a ready-written message; the admin attaches the file and sends it
      const d = G.DB.get('donations', id); if (!d || !G.Donations.openReceipt(id)) return;
      const msg = `Namaste ${d.donorName}, thank you for your donation of ${G.inr(d.amount)}. Receipt no. ${d.receiptNo} is attached.\n\n${G.ORG.name}`, wa = String(d.donorPhone || '').replace(/\D/g, '').slice(-10);
      G.modal({ title: '✉️ Send the receipt', html: `<p>The PDF has been downloaded. Open a message below, attach the file and send.</p><p style="display:flex;gap:8px;flex-wrap:wrap">${d.donorEmail ? `<a class="btn btn-primary" href="mailto:${esc(d.donorEmail)}?subject=${encodeURIComponent('Donation receipt ' + d.receiptNo)}&body=${encodeURIComponent(msg)}">✉️ Email</a>` : ''}${wa.length === 10 ? `<a class="btn btn-ghost" target="_blank" rel="noopener" href="https://wa.me/91${wa}?text=${encodeURIComponent(msg)}">💬 WhatsApp</a>` : ''}</p>` });
      G.audit('RECEIPT_SEND', 'donation', id, d.receiptNo);
    },
    'don-rep-csv': (k) => { const r = donSummary(k); csv('donations-by-' + k + '.csv', [['key', k === 'month' ? 'Month' : k === 'program' ? 'Programme' : 'Method'], ['count', 'Donations'], ['total', 'Amount INR']], r); },
    'don-rcpt': (id) => { if (!G.Donations.openReceipt(id)) G.toast('Allow pop-ups', '⚠️'); },
    'don-sync': (id) => { const d = G.DB.get('donations', id); G.toast(d.demo ? (G.present ? `Current status: ${d.status}.` : `Demo record — live Razorpay sync is available once the backend is connected. Current status: ${d.status}.`) : 'Syncing with Razorpay…', '🔄'); G.audit('SYNC_STATUS', 'donation', id); },
    'don-capture': (id) => { if (!confirm('Mark as captured and issue receipt? Only do this after confirming in the Razorpay dashboard.')) return; G.DB.update('donations', id, { status: 'CAPTURED', paymentId: G.DB.get('donations', id).paymentId || 'manual_' + Date.now().toString(36) }); G.Donations.issueReceipt(id); G.audit('MANUAL_CAPTURE', 'donation', id, 'marked captured by admin after checking the gateway'); render(); },
    'tk-f': (id) => { window._tk = id; render(); },
    'tk-open': (id) => ticketModal(id),
    'usr-role': (id) => { const r = prompt('New role (REGISTERED_USER, VOLUNTEER, DONOR, CONTENT_ADMIN, FINANCE_SUPPORT_ADMIN, SUPER_ADMIN):'); if (r && /^(REGISTERED_USER|VOLUNTEER|DONOR|CONTENT_ADMIN|FINANCE_SUPPORT_ADMIN|SUPER_ADMIN)$/.test(r)) { G.DB.update('users', id, { role: r }); G.audit('ROLE_CHANGE', 'user', id, r); render(); } },
    'ev-ai': () => aiEventIntake(),
    'ev-pub': (id) => { G.DB.update('events', id, { status: 'UPCOMING' }); G.audit('EVENT_PUBLISH', 'event', id); G.toast('Published on the website', '🚀'); render(); },
    'au-f': (id) => { window._au = id; render(); },
    'tk-triage': async (id, btn) => { G.toast('The AI is reading the open messages…', '🤖'); const n = await runTriage(true); render(); },
    'ai-test': async () => { const r = await aiPost(CFG.extractApi || '/api/extract-event', { text: 'Test: tree walk on 1 Jan 2099 at 10:00 in Lalbagh', today: G.today(), programs: [] }); G.toast(r.status === 200 ? `AI is working (${r.provider} · ${r.model})` : aiMsg(r), r.status === 200 ? '✅' : '⚠️'); },
    'db-export': () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([G.DB.export()], { type: 'application/json' })); a.download = 'gigf-demo-data.json'; a.click(); },
    'db-reset': () => { if (confirm('Delete ALL demo data in this browser (donations, volunteers, tickets, edits)?')) { G.DB.reset(); G.Auth.logout(); location.reload(); } }
  };
  function ticketModal(id) {
    const t = G.DB.get('tickets', id), d = t.donationId ? G.DB.get('donations', t.donationId) : null;
    const m = G.modal({ wide: true, title: `${t.no} · ${esc(t.subject)}`, html: `<p style="font-size:.84rem"><b>${esc(t.name)}</b> · ${esc(t.email)} ${esc(t.phone)} · ${G.fmtDate(t.createdAt)} ${chip(t.status)}</p><div class="note green" style="margin:10px 0">${esc(t.message)}</div>
      ${t.ai ? `<div class="card card-body" style="margin-bottom:12px;border-color:#bfdbfe"><b>🤖 AI view</b> <span class="chip ${t.ai.needsHuman ? 'warn' : ''}">${esc(t.ai.intent)}</span> <small>${t.ai.needsHuman ? 'needs a human' : 'AI can answer'} · ${Math.round(t.ai.confidence * 100)}% sure</small>${t.ai.draftReply ? `<div class="note" style="margin:8px 0">${esc(t.ai.draftReply)}</div><button class="btn btn-ghost btn-sm" data-x="usedraft">↧ Use this draft as my reply</button>` : ''}</div>` : ''}
      ${d ? `<div class="card card-body" style="margin-bottom:12px"><b>Linked donation</b><br>${G.inr(d.amount)} · ${esc(d.program)} · ${chip(d.status)} · order <code>${esc(d.orderId)}</code>${d.receiptNo ? ' · ' + esc(d.receiptNo) : ''}<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" data-x="sync">🔄 Sync status with Razorpay</button><button class="btn btn-ghost btn-sm" data-x="resend">📧 Re-generate / re-send receipt</button><button class="btn btn-ghost btn-sm" data-x="refund">↩ Log refund / resolution</button></div></div>` : ''}
      ${(t.replies || []).map((r) => `<div class="note" style="margin-bottom:6px"><b>${esc(r.by)}</b> (${G.fmtDate(r.at)}): ${esc(r.text)}</div>`).join('')}${(t.notes || []).map((r) => `<div class="note" style="margin-bottom:6px;background:#f1f5f9;border-color:#cbd5e1;color:#334155">🔒 Internal: ${esc(r)}</div>`).join('')}
      <form id="tkForm" class="f-grid" style="margin-top:10px"><div class="field f-full"><label>Reply to ${esc(t.name)} (emails donor & appears in their dashboard)</label><textarea name="reply" rows="3"></textarea></div><div class="field"><label>Internal note</label><input name="note"></div><div class="field"><label>Status</label><select name="st">${['OPEN', 'IN_PROGRESS', 'RESOLVED'].map((s) => `<option ${t.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div><div class="field"><label>Assign to</label><input name="as" value="${esc(t.assignedTo || '')}" placeholder="staff name"></div><button class="btn btn-primary f-full">Save</button></form>` });
    m.addEventListener('click', (e) => {
      const b = e.target.closest('[data-x]'); if (!b) return;
      if (b.dataset.x === 'usedraft') { $('#tkForm textarea[name=reply]', m).value = t.ai.draftReply; return; }
      if (b.dataset.x === 'sync') G.toast(d.demo ? 'Demo record — live status sync needs the backend Razorpay API. Current: ' + d.status : 'Syncing…', '🔄');
      if (b.dataset.x === 'resend') { if (d.status !== 'CAPTURED') return G.toast('Only captured payments have receipts.', 'ℹ️'); G.Donations.issueReceipt(d.id); G.audit('RECEIPT_REISSUE', 'donation', d.id); G.Donations.openReceipt(d.id); G.toast('Receipt regenerated (email sending needs the backend)', '📧'); }
      if (b.dataset.x === 'refund') { const n = prompt('Resolution / refund note:'); if (n) { t.notes.push('Refund/resolution: ' + n); G.DB.update('tickets', id, { notes: t.notes }); G.audit('REFUND_LOG', 'ticket', id, n); m.close(); ticketModal(id); } }
    });
    $('#tkForm', m).addEventListener('submit', (e) => {
      e.preventDefault(); const f = new FormData(e.target), patch = { status: f.get('st'), assignedTo: f.get('as') };
      if (f.get('reply').trim()) patch.replies = (t.replies || []).concat({ by: 'Foundation', text: f.get('reply').trim(), at: new Date().toISOString() });
      if (f.get('note').trim()) patch.notes = (t.notes || []).concat(f.get('note').trim());
      if (patch.status === 'RESOLVED') patch.resolvedAt = new Date().toISOString();
      G.DB.update('tickets', id, patch); G.audit('TICKET_' + patch.status, 'ticket', id); m.close(); G.toast('Ticket updated', '✅'); render();
    });
  }

  /* ---------- AI: create an event from a poster picture and/or pasted text ---------- */
  /* ---------- Voice typing (browser speech recognition: Chrome / Edge / Safari). Speak -> text appears in the field. ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const VOICE_LANGS = [['en-IN', 'English'], ['kn-IN', 'ಕನ್ನಡ'], ['hi-IN', 'हिन्दी'], ['ta-IN', 'தமிழ்'], ['te-IN', 'తెలుగు'], ['ml-IN', 'മലയാളം']];
  const voiceLang = () => { try { const v = sessionStorage.getItem('gigf_voice_lang'); return VOICE_LANGS.some((x) => x[0] === v) ? v : 'en-IN'; } catch (e) { return 'en-IN'; } };
  function mic(field, onDone) {
    if (!SR || !field) return null;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'mic-btn'; b.textContent = '🎤'; b.title = 'Speak instead of typing'; b.setAttribute('aria-label', 'Speak instead of typing');
    let rec = null;
    b.onclick = () => {
      if (rec) return rec.stop();
      rec = new SR(); rec.lang = voiceLang(); rec.interimResults = true; rec.continuous = true;
      const base = field.value ? field.value.replace(/\s+$/, '') + ' ' : ''; let fin = '';
      rec.onresult = (e) => { let tmp = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) fin += t; else tmp += t; } field.value = (base + fin + tmp).trimStart(); field.dispatchEvent(new Event('input', { bubbles: true })); };
      rec.onerror = (e) => G.toast(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'The microphone is blocked. Click the 🔒 icon in the address bar and allow it.' : e.error === 'no-speech' ? 'I did not hear anything. Try again.' : 'Voice typing stopped (' + e.error + ').', '🎤');
      rec.onend = () => { rec = null; b.classList.remove('on'); b.textContent = '🎤'; field.value = field.value.trim(); if (onDone) onDone(field.value); };
      b.classList.add('on'); b.textContent = '⏹ Stop'; try { rec.start(); } catch (e) { rec = null; b.classList.remove('on'); b.textContent = '🎤'; }
    };
    field.insertAdjacentElement('afterend', b); return b;
  }
  const voiceLangPicker = () => SR ? `<label class="voice-lang">🎤 Speak in <select id="aiVL">${VOICE_LANGS.map((x) => `<option value="${x[0]}" ${x[0] === voiceLang() ? 'selected' : ''}>${x[1]}</option>`).join('')}</select></label>` : '<small class="voice-lang">🎤 Voice typing works in Chrome, Edge or Safari.</small>';

  function aiEventIntake() {
    let aiImg = '', poster = '', last = null;
    const m = G.modal({ wide: true, title: '✨ Create an event from a poster or text', html: `<div class="ai-intake">
      <p class="ai-help">Drop the poster, or paste the message you received (WhatsApp, e-mail…). The AI reads it and fills the form. <b>You only check it and press Post.</b> Nothing goes public until you do.</p>
      <div class="ai-grid"><div><div class="ai-drop" id="aiDrop" tabindex="0">📷 <b>Drop the poster here</b><br><small>JPG, PNG or WebP</small><br><label class="btn btn-ghost btn-sm" style="cursor:pointer;margin-top:8px">Choose picture<input type="file" id="aiFile" accept="image/jpeg,image/png,image/webp" hidden></label><img id="aiPrev" alt="Poster preview" hidden></div></div>
      <div><div class="field"><label>…or paste the text / summary</label><textarea id="aiText" rows="7" maxlength="6000" placeholder="e.g. Join us this Sunday at 7:30 AM at Cubbon Park for a mass tree plantation drive. Saplings and gloves provided."></textarea>${voiceLangPicker()}<div style="margin-top:4px"></div></div>
      <button class="btn btn-primary" id="aiRead" type="button">✨ Read it</button> <span id="aiStatus" class="ai-status"></span></div></div><div id="aiOut"></div></div>` });
    const drop = $('#aiDrop', m), status = $('#aiStatus', m), out = $('#aiOut', m);
    async function takeFile(f) {
      if (!f) return; if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return G.toast('Please use a JPG, PNG or WebP picture.', '⚠️');
      if (f.size > 15 * 1024 * 1024) return G.toast('That picture is over 15 MB.', '⚠️');
      try { aiImg = await compressImage(f, 1500, 0.82, 2600000); poster = await compressImage(f, 800, 0.72, 240000); const pv = $('#aiPrev', m); pv.src = poster; pv.hidden = false; status.textContent = '📎 ' + f.name; } catch (e) { G.toast('Could not open that picture.', '⚠️'); }
    }
    $('#aiFile', m).onchange = (e) => takeFile(e.target.files[0]);
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); }; drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); takeFile(e.dataTransfer.files[0]); };
    m.addEventListener('paste', (e) => { const it = Array.from((e.clipboardData || {}).items || []).find((i) => /^image\//.test(i.type)); if (it) takeFile(it.getAsFile()); });   // Ctrl+V a screenshot
    const read = async () => {
      const text = $('#aiText', m).value.trim(); if (!aiImg && !text) return G.toast('Add a poster picture or some text first.', 'ℹ️');
      const btn = $('#aiRead', m); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Reading…'; out.innerHTML = '';
      const r = await aiPost(CFG.extractApi || '/api/extract-event', { image: aiImg || undefined, text, today: G.today(), programs: G.DB.all('programs').map((p) => ({ id: p.id, title: tr(p.title) })) });
      btn.disabled = false; btn.textContent = '↻ Read again';
      if (r.status !== 200) { out.innerHTML = `<div class="note">⚠️ ${esc(aiMsg(r))}</div>`; return; }
      last = r; draft(r);
    };
    $('#aiRead', m).onclick = read;
    const vl = $('#aiVL', m); if (vl) vl.onchange = () => { try { sessionStorage.setItem('gigf_voice_lang', vl.value); } catch (e) { } };
    mic($('#aiText', m), (t) => { if (t.length >= 15 && !$('#aiRead', m).disabled) { status.textContent = '🎤 Got it — reading what you said…'; $('#aiRead', m).click(); } });   // stop speaking -> the AI fills the form
    function draft(r) {
      const d = r.draft, pct = Math.round(r.confidence * 100), U = r.uncertain || [], MS = r.missing || [];
      const flag = (k, v) => (!v || MS.includes(k) ? '<span class="ai-flag miss">✖ not found</span>' : U.includes(k) ? '<span class="ai-flag chk">⚠ please check</span>' : '<span class="ai-flag ok">✔ read</span>');
      const dup = G.DB.all('events').find((e) => e.date === d.date && d.title && tr(e.title).toLowerCase().includes(d.title.toLowerCase().slice(0, 12)));
      out.innerHTML = `<div class="ai-draft"><div class="ai-conf"><b>AI confidence</b><div class="bar"><i style="width:${pct}%;background:${pct >= 80 ? '#16a34a' : pct >= 55 ? '#f59e0b' : '#dc2626'}"></i></div><b>${pct}%</b></div>
        ${(r.warnings || []).map((w) => `<div class="note" style="margin:6px 0">⚠️ ${esc(w)}</div>`).join('')}${dup ? `<div class="note" style="margin:6px 0">🔁 An event with a similar name already exists on ${esc(dup.date)}. Make sure this is not a duplicate.</div>` : ''}
        <form id="aiForm" class="f-grid" novalidate>
          <div class="field f-full"><label>Title ${flag('title', d.title)}</label><input name="title" value="${esc(d.title || '')}"></div>
          <div class="field"><label>Date ${flag('date', d.date)}</label><input name="date" type="date" value="${esc(d.date || '')}"></div>
          <div class="field"><label>Start time ${flag('time', d.time)}</label><input name="time" type="time" value="${esc(d.time || '')}"></div>
          <div class="field f-full"><label>Location ${flag('location', d.location)}</label><input name="location" value="${esc(d.location || '')}"></div>
          <div class="field"><label>Programme ${flag('program', d.program)}</label><select name="program">${progOpts().map((o) => `<option value="${esc(o[0])}" ${o[0] === (d.program || 'community') ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select></div>
          <div class="field"><label>Max attendees ${d.capacity ? flag('capacity', d.capacity) : '<span class="ai-flag chk">default — change if needed</span>'}</label><input name="capacity" type="number" min="1" value="${esc(d.capacity || 50)}"></div>
          <div class="field"><label>Volunteer slots ${d.volunteerSlots ? flag('volunteerSlots', d.volunteerSlots) : '<span class="ai-flag chk">default — change if needed</span>'}</label><input name="volSlots" type="number" min="0" value="${esc(d.volunteerSlots || 10)}"></div>
          <div class="field f-full"><label>Description ${flag('description', d.description)}</label><textarea name="desc" rows="3">${esc(d.description || '')}</textarea></div>
          ${poster ? '<div class="field f-full"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="usePoster" checked style="width:auto"> Show the poster on the event card</label></div>' : ''}
          <div class="f-full ai-actions"><button class="btn btn-primary" type="submit" data-mode="post">✅ Post event</button><button class="btn btn-ghost" type="submit" data-mode="draft">💾 Save as draft</button><small>Kannada, Hindi, Tamil and Telugu are added automatically when you post.</small></div></form></div>`;
      $$('#aiForm input:not([type]), #aiForm input[type=text], #aiForm textarea', out).forEach((el) => mic(el));   // speak to correct any field
      let mode = 'post'; $$('#aiForm button[type=submit]', out).forEach((b) => (b.onclick = () => (mode = b.dataset.mode)));
      $('#aiForm', out).addEventListener('submit', async (e) => {
        e.preventDefault(); if (e.target.dataset.busy) return;   // a double-click must never post the event twice
        const f = new FormData(e.target), val = (k) => String(f.get(k) || '').trim(); let ok = true;
        const bad = (n, c) => { const fld = e.target.elements[n].closest('.field'); fld.classList.toggle('bad', !c); if (!c) ok = false; };
        bad('title', val('title').length >= 3); bad('date', /^\d{4}-\d{2}-\d{2}$/.test(val('date'))); bad('time', /^\d{2}:\d{2}$/.test(val('time'))); bad('location', val('location').length >= 2);
        if (!ok) return G.toast('Please fill the highlighted fields.', '⚠️');
        if (val('date') < G.today() && !confirm('This date is in the past. Post it anyway?')) return;
        if (dup && !confirm('A similar event already exists on that date. Post anyway?')) return;
        e.target.dataset.busy = '1';
        const btns = $$('#aiForm button[type=submit]', out); btns.forEach((b) => (b.disabled = true)); const lab = btns.find((b) => b.dataset.mode === mode); lab.innerHTML = '<span class="spinner"></span> Translating…';
        const ev = { slug: val('title').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + '-' + Date.now().toString(36).slice(-4), title: { en: val('title'), kn: '', hi: '', ta: '', te: '', ml: '' }, desc: { en: val('desc'), kn: '', hi: '', ta: '', te: '' }, program: val('program'), date: val('date'), time: val('time'), location: val('location'), capacity: Math.max(1, Number(val('capacity')) || 50), volSlots: Math.max(0, Number(val('volSlots')) || 0), status: mode === 'draft' ? 'DRAFT' : 'UPCOMING', tentative: false, source: 'AI', aiConfidence: last.confidence, poster: poster && f.get('usePoster') ? poster : '' };
        const n = await ensureTranslations(ev, ['title', 'desc']);
        const rec = G.DB.add('events', ev); G.audit(mode === 'draft' ? 'AI_EVENT_DRAFT' : 'AI_EVENT_POSTED', 'event', rec.id, `confidence ${Math.round(last.confidence * 100)}% · ${last.provider}/${last.model} · ${n} translation(s)`);
        m.close(); G.toast(mode === 'draft' ? 'Saved as a draft (not public yet).' : 'Event is live on the website!', mode === 'draft' ? '💾' : '🎉'); render();
      });
    }
  }

  /* ---------- AI triage of contact / chat messages ---------- */
  async function runTriage(force) {
    const open = G.DB.all('tickets').filter((t) => t.status !== 'RESOLVED' && t.category !== 'PAYMENT_ISSUE' && (force || !t.ai)).slice(0, 8);
    if (!open.length) { if (force) G.toast('No open messages to triage.', 'ℹ️'); return 0; }
    const r = await aiPost(CFG.triageApi || '/api/triage', { tickets: open.map((t) => ({ id: t.id, category: t.category, subject: t.subject, message: t.message })), context: chatContext() });
    if (r.status !== 200) { if (force) G.toast(aiMsg(r), '⚠️'); return 0; }
    let auto = 0;
    (r.results || []).forEach((x) => {
      const t = G.DB.get('tickets', x.id); if (!t) return;
      G.DB.update('tickets', x.id, { ai: { intent: x.intent, needsHuman: x.needsHuman, confidence: x.confidence, draftReply: x.draftReply, at: new Date().toISOString() } });
      G.audit('AI_TRIAGE', 'ticket', x.id, `${x.intent} · ${x.needsHuman ? 'needs human' : 'AI can answer'} · ${Math.round(x.confidence * 100)}%`);
      if (G.auto().autoReplyRoutine && x.intent === 'spam' && x.confidence >= 0.9 && t.category !== 'PAYMENT_ISSUE') {   // obvious spam is closed quietly (kept in the log, never answered)
        G.DB.update('tickets', x.id, { status: 'RESOLVED', resolvedAt: new Date().toISOString(), notes: (t.notes || []).concat('Closed automatically: identified as spam by the AI.') });
        G.audit('AI_SPAM_CLOSED', 'ticket', x.id, Math.round(x.confidence * 100) + '% sure'); auto++; return;
      }
      if (G.auto().autoReplyRoutine && !x.needsHuman && x.confidence >= 0.85 && x.draftReply && t.category !== 'PAYMENT_ISSUE') {
        G.DB.update('tickets', x.id, { status: 'RESOLVED', resolvedAt: new Date().toISOString(), replies: (t.replies || []).concat({ by: 'Foundation (AI assistant)', text: x.draftReply, at: new Date().toISOString(), ai: true }) });
        G.audit('AI_AUTO_REPLY', 'ticket', x.id, 'resolved automatically'); auto++;
      }
    });
    if (force) G.toast(auto ? `${auto} message(s) answered automatically; the rest are marked for you.` : 'Messages triaged. Open one to see the AI draft.', '🤖');
    return auto;
  }

  /* ---------- gate + events ---------- */
  function loginGate() {
    root().innerHTML = `<div class="wrap" style="max-width:440px;padding:50px 20px"><div class="card card-body"><h3 style="color:var(--primary-dark)">🔒 Admin sign-in</h3><p style="font-size:.84rem;color:#6b7280;margin:6px 0 14px">Authorised NGO staff only.</p>
      <form id="adm" class="f-grid"><div class="field f-full"><label>Email</label><input name="e" type="email" required autocomplete="username"></div><div class="field f-full"><label>Password</label><input name="p" type="password" required autocomplete="current-password"></div><button class="btn btn-primary f-full">Sign in</button></form>
      <div class="note" style="margin-top:14px"><b>DEMO mode</b> — test account: <code>${G.ADMIN_DEMO.email}</code> / <code>${G.ADMIN_DEMO.password}</code>. Real admin accounts, 2FA and IP allow-list require the backend.</div></div></div>`;
    $('#adm').onsubmit = async (e) => { e.preventDefault(); try { const u = await G.Auth.login(e.target.e.value, e.target.p.value); if (!/ADMIN/.test(u.role)) { G.Auth.logout(); throw new Error('This account is not an administrator.'); } location.reload(); } catch (err) { G.toast(err.message, '⚠️'); } };
  }
  G.boot(async () => {
    // a real admin (database role + two-factor) may use the portal anywhere; the practice admin works on this computer only
    const state = G.cloud ? await G.cloud.adminState() : 'no';
    if (state === 'code' || state === 'password') return G.cloud.gate(root(), state);
    // not an admin: leave at once. (The practice admin is accepted on this computer only.)
    if (state !== 'ok' && !(G.demoAdminAllowed() && G.Auth.isAdmin())) return location.replace('index.html');
    render();
    if (G.cloud) G.cloud.adminBanner();
    addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h && h !== sec && S[h]) { sec = h; render(); } });
    // AUTOMATION LOOP: receipts + stuck-payment tickets + (optionally) AI answers to simple questions - no clicking needed
    const tick = async () => { let changed = G.Donations.reconcile(); if (G.auto().autoReplyRoutine) changed += await runTriage(false); if (changed && ['dash', 'issues', 'donations'].includes(sec) && !document.querySelector('.modal-backdrop')) render(); };
    tick(); setInterval(tick, 30000);
    root().addEventListener('click', (e) => {
      const s = e.target.closest('[data-sec]'); if (s) { sec = s.dataset.sec; history.replaceState(null, '', '#' + sec); render(); return; }
      const b = e.target.closest('[data-a]'); if (b && A[b.dataset.a]) A[b.dataset.a](b.dataset.id);
    });
  });
})();
