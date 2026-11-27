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
  S.programs = () => `<div class="toolbar"><h3 style="flex:1">Programs</h3></div>${table([['icon', ''], [(r) => esc(tr(r.title)), 'Title'], [(r) => (r.active ? chip('PUBLISHED') : chip('DRAFT')), 'Visible'], [(r) => (r.impact || []).length + ' metrics', 'Impact']], G.DB.all('programs').sort((a, b) => a.order - b.order), (r) => act('prog-edit', r.id, '✏️ Edit'))}`;
  S.events = () => `<div class="toolbar"><h3 style="flex:1">Events</h3><button class="btn btn-orange btn-sm" data-a="ev-ai">✨ Create from poster / text</button><button class="btn btn-primary btn-sm" data-a="ev-new">＋ New event</button></div>${table([[(r) => esc(tr(r.title)) + (r.tentative ? ' <span class="chip warn">sample</span>' : '') + (r.source === 'AI' ? ' <span class="chip blue">AI</span>' : '') + (r.poster ? ' 🖼️' : ''), 'Event'], [(r) => G.fmtDate(r.date) + ' ' + esc(r.time), 'When'], ['location', 'Where'], [(r) => G.DB.all('registrations').filter((x) => x.eventId === r.id).length + ' / ' + esc(r.capacity), 'Registered'], [(r) => chip(r.status) + (r.status === 'DRAFT' ? ' <small>not public</small>' : ''), 'Status']], G.DB.all('events').sort((a, b) => a.date.localeCompare(b.date)), (r) => (r.status === 'DRAFT' ? act('ev-pub', r.id, '🚀 Publish', 'btn-primary') : '') + act('ev-edit', r.id, '✏️') + act('ev-regs', r.id, '👥 Attendance') + act('ev-del', r.id, '🗑️'))}`;
  S.news = () => `<div class="toolbar"><h3 style="flex:1">News & updates</h3><button class="btn btn-primary btn-sm" data-a="news-new">＋ New update</button></div>${table([[(r) => esc(tr(r.title)) + (r.pinned ? ' 📌' : ''), 'Title'], ['date', 'Date'], [(r) => chip(r.status) + (r.status === 'SCHEDULED' ? ' ' + esc(r.publishAt || '') : ''), 'Status']], G.DB.all('news'), (r) => act('news-edit', r.id, '✏️') + act('news-del', r.id, '🗑️'))}`;
  S.articles = () => `<div class="toolbar"><h3 style="flex:1">Awareness articles / blog</h3><button class="btn btn-primary btn-sm" data-a="art-new">＋ New article</button></div>${table([[(r) => esc(tr(r.title)), 'Title'], ['category', 'Category'], ['date', 'Date'], [(r) => chip(r.status), 'Status']], G.DB.all('articles'), (r) => act('art-edit', r.id, '✏️') + act('art-del', r.id, '🗑️'))}`;
  S.gallery = () => `<div class="toolbar"><h3 style="flex:1">Gallery manager</h3><select id="galEvent" class="search" style="flex:0 1 240px">${evOpts().map((o) => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join('')}</select><label class="btn btn-primary btn-sm" style="cursor:pointer">⬆ Upload photos<input id="galUp" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden></label><button class="btn btn-ghost btn-sm" data-a="vid-new">🎬 Add video (URL / path)</button></div>
    <div class="note" style="margin-bottom:12px">Drag-and-drop & large video upload need the backend storage (S3/R2). In this demo, photos are compressed and kept in your browser; videos are added by file path or URL.</div>
    <div id="galDrop" class="card card-body" style="text-align:center;border:2px dashed #86efac;margin-bottom:14px">⬇ Drop photos here</div>
    ${table([[(r) => (r.type === 'PHOTO' ? `<img src="${esc(G.safeUrl(r.src, ''))}" height="46" style="border-radius:6px" alt="">` : '🎬'), ''], [(r) => esc(tr(r.title)), 'Title'], ['type', 'Type'], ['category', 'Category'], [(r) => (r.featured ? '⭐ Home' : ''), 'Featured']], G.DB.all('gallery'), (r) => act('gal-edit', r.id, '✏️') + act('gal-del', r.id, '🗑️'))}`;
  S.volunteers = () => `<div class="toolbar"><h3 style="flex:1">Volunteers</h3><button class="btn btn-ghost btn-sm" data-a="vol-csv">⬇ CSV</button></div>${table([['badge', 'Badge'], ['name', 'Name'], [(r) => esc(r.email) + '<br>' + esc(r.phone), 'Contact'], [(r) => esc(r.domain) + '<br>' + esc(r.city), 'Domain'], [(r) => esc(r.idType) + ': ' + esc(r.idFile), 'ID proof'], [(r) => chip(r.status), 'Status'], [(r) => r.hours || 0, 'Hrs']], G.DB.all('volunteers'), (r) => (r.status === 'PENDING' ? act('vol-ok', r.id, '✔ Approve', 'btn-primary') + act('vol-no', r.id, '✖ Reject') : '') + act('vol-task', r.id, '📋 Task') + act('vol-hrs', r.id, '⏱ Hours') + act('vol-cert', r.id, '🏅'))}`;
  S.donations = () => {
    const f = window._don || { q: '', st: 'ALL', pg: 'ALL', from: '', to: '' }; window._don = f;
    const rows = G.DB.all('donations').filter((d) => (f.st === 'ALL' || d.status === f.st) && (f.pg === 'ALL' || d.program === f.pg) && (!f.q || (d.donorName + d.donorEmail + d.receiptNo + d.paymentId).toLowerCase().includes(f.q.toLowerCase())) && (!f.from || d.createdAt.slice(0, 10) >= f.from) && (!f.to || d.createdAt.slice(0, 10) <= f.to));
    window._donRows = rows;
    return `<div class="toolbar"><h3 style="flex:1">Donations & receipts</h3><button class="btn btn-primary btn-sm" data-a="don-csv">⬇ Export Excel/CSV</button></div>
      <div class="toolbar"><input class="search" id="dq" placeholder="Search name / email / receipt" value="${esc(f.q)}"><select id="dst" class="search" style="flex:0"><option>ALL</option><option>CAPTURED</option><option>PENDING</option><option>FAILED</option></select><select id="dpg" class="search" style="flex:0"><option>ALL</option>${[...new Set(G.DB.all('donations').map((d) => d.program))].map((p) => `<option>${esc(p)}</option>`).join('')}</select><input type="date" id="dfr" class="search" style="flex:0" value="${f.from}"><input type="date" id="dto" class="search" style="flex:0" value="${f.to}"></div>
      <p style="font-size:.84rem;margin-bottom:8px">${rows.length} records · <b>${G.inr(rows.filter((d) => d.status === 'CAPTURED').reduce((a, d) => a + d.amount, 0))}</b> captured</p>
      ${table([[(r) => G.fmtDate(r.createdAt), 'Date'], [(r) => esc(r.donorName) + '<br><small>' + esc(r.donorEmail) + '</small>', 'Donor'], ['program', 'Programme'], [(r) => '<b>' + G.inr(r.amount) + '</b>' + (r.frequency === 'MONTHLY' ? ' 🔁' : ''), 'Amount'], ['method', 'Method'], [(r) => chip(r.status) + (r.demo ? ' <span class="chip warn">demo</span>' : ''), 'Status'], [(r) => esc(r.receiptNo || '—'), 'Receipt']], rows, (r) => act('don-sync', r.id, '🔄 Sync') + (r.status === 'CAPTURED' ? act('don-rcpt', r.id, '📄') : act('don-capture', r.id, 'Mark captured')))}`;
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
    <div class="card card-body"><h4>Data tools (demo)</h4><p style="font-size:.84rem;color:#4b5563;margin:8px 0">Export everything as JSON or reset the demo data in this browser.</p>${G.demoAdminAllowed() ? '<button class="btn btn-orange btn-sm" data-a="sample-add">🧪 Load sample data (10 fake people)</button> <button class="btn btn-ghost btn-sm" data-a="sample-del">Remove sample data</button><br><br>' : ''}<button class="btn btn-ghost btn-sm" data-a="rep-add">📄 Publish annual report</button><br><br><button class="btn btn-ghost" data-a="db-export">⬇ Export JSON</button> <button class="btn btn-danger" data-a="db-reset" style="margin-top:8px">Reset demo data</button><hr style="margin:16px 0;border:0;border-top:1px solid #e5e7eb"><h4>Reports</h4><div style="display:grid;gap:8px;margin-top:8px"><button class="btn btn-ghost btn-sm" data-a="don-csv-all">Donations CSV</button><button class="btn btn-ghost btn-sm" data-a="vol-csv">Volunteers CSV</button><button class="btn btn-ghost btn-sm" data-a="reg-csv">Event registrations CSV</button></div></div></div>${automationCard()}`; };

  const NAV = [['dash', '📊', 'Dashboard'], ['issues', '🎫', 'Payment issues & inquiries'], ['donations', '💚', 'Donations'], ['volunteers', '🤝', 'Volunteers'], ['events', '📅', 'Events'], ['news', '📰', 'News & updates'], ['articles', '✍️', 'Articles'], ['programs', '🌳', 'Programs'], ['gallery', '🖼️', 'Gallery'], ['look', '🎨', 'Appearance'], ['testimonials', '💬', 'Testimonials'], ['users', '👥', 'Users'], ['audit', '🔒', 'Audit log'], ['settings', '⚙️', 'Settings']];

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

  function render() {
    const openCount = G.DB.all('tickets').filter((t) => t.status !== 'RESOLVED').length;
    root().innerHTML = `<div class="admin-shell"><aside class="side">${NAV.map((n) => `<button data-sec="${n[0]}" class="${n[0] === sec ? 'on' : ''}">${n[1]} ${n[2]}${n[0] === 'issues' && openCount ? `<span class="cnt">${openCount}</span>` : ''}</button>`).join('')}</aside><section class="admin-main">${(S[sec] || S.dash)()}</section></div>`;
    bindLook();
    G.applyI18n(); wireInputs();
  }
  function wireInputs() {
    const up = $('#galUp'); if (up) up.onchange = (e) => addPhotos(e.target.files);
    const dd = $('#galDrop'); if (dd) { dd.ondragover = (e) => { e.preventDefault(); dd.style.background = '#f0fdf4'; }; dd.ondragleave = () => (dd.style.background = ''); dd.ondrop = (e) => { e.preventDefault(); dd.style.background = ''; addPhotos(e.dataTransfer.files); }; }
    const f = window._don; if (sec === 'donations') { $('#dst').value = f.st; $('#dpg').value = f.pg; const upd = () => { f.q = $('#dq').value; f.st = $('#dst').value; f.pg = $('#dpg').value; f.from = $('#dfr').value; f.to = $('#dto').value; render(); }; ['dst', 'dpg', 'dfr', 'dto'].forEach((i) => ($('#' + i).onchange = upd)); $('#dq').onchange = upd; }
    const af = $('#autoForm'); if (af) af.onsubmit = (e) => { e.preventDefault(); const x = new FormData(af); const val = Math.max(2, Math.min(1440, Number(x.get('stuckMinutes')) || 15)); G.DB.saveSettings({ automation: { autoTranslate: !!x.get('autoTranslate'), flagStuckPayments: !!x.get('flagStuckPayments'), autoReplyRoutine: !!x.get('autoReplyRoutine'), autoApproveVolunteers: !!x.get('autoApproveVolunteers'), stuckMinutes: val } }); try { sessionStorage.setItem('gigf_admin_token', String(x.get('token') || '').trim()); } catch (er) { } G.audit('AUTOMATION_SETTINGS', 'settings', '', JSON.stringify(G.auto())); G.toast('Automation settings saved', '✅'); };
    const sf = $('#setForm'); if (sf) sf.onsubmit = (e) => { e.preventDefault(); const x = new FormData(sf); const impact = String(x.get('impact')).split('\n').map((l) => l.split('|')).filter((p) => p.length === 2 && p[0].trim()).map((p) => ({ value: p[0].trim(), label: p[1].trim() })); G.DB.saveSettings({ reg80G: x.get('reg80G').trim(), reg12A: x.get('reg12A').trim(), pan: x.get('pan').trim(), impact }); G.audit('SETTINGS_UPDATE', 'settings'); G.toast('Settings saved', '✅'); };
  }
  const evOpts = () => [['', '— no particular event —']].concat(G.DB.all('events').map((e) => [e.id, tr(e.title) + ' (' + e.date + ')']));
  function addPhotos(files) {
    Array.from(files).filter((f) => /^image\//.test(f.type)).forEach((file) => {
      const img = new Image(), r = new FileReader();
      r.onload = () => { img.onload = () => { const s = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); const src = c.toDataURL('image/jpeg', 0.78); const base = file.name.replace(/\.\w+$/, ''); G.DB.add('gallery', { eventId: ($('#galEvent') || {}).value || '', type: 'PHOTO', src, category: 'community', date: G.today(), featured: false, title: { en: base, kn: '', hi: '' } }); G.audit('GALLERY_UPLOAD', 'gallery', '', file.name); render(); }; img.src = r.result; };
      r.readAsDataURL(file);
    });
    G.toast('Uploading…', '⬆');
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
    'prog-edit': (id) => { const p = G.DB.get('programs', id); editor({ title: 'Edit programme', item: Object.assign({}, p, { impactText: '' }), fields: [{ k: 'title', label: 'Title', type: 'i18n' }, { k: 'tagline', label: 'Tagline', type: 'i18n' }, { k: 'desc', label: 'Description', type: 'i18nArea' }, { k: 'active', label: 'Visible on website', type: 'checkbox' }], onSave: (o) => { G.DB.update('programs', id, o); G.audit('PROGRAM_UPDATE', 'program', id); render(); } }); },
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
    'art-new': () => A['art-edit'](null),
    'art-edit': (id) => { const a = id ? G.DB.get('articles', id) : { status: 'DRAFT', date: G.today(), category: 'yoga' }; editor({ title: 'Article', item: a, fields: [{ k: 'title', label: 'Title', type: 'i18n' }, { k: 'summary', label: 'Summary', type: 'i18nArea' }, { k: 'category', label: 'Category', type: 'select', opts: [['environment', 'Environment'], ['yoga', 'Yoga'], ['health', 'Health & Nutrition'], ['women', 'Women Empowerment'], ['stories', 'NGO Stories'], ['schemes', 'Govt Schemes']] }, { k: 'date', label: 'Date', type: 'date' }, { k: 'status', label: 'Status', type: 'select', opts: [['DRAFT', 'Draft'], ['SCHEDULED', 'Scheduled'], ['PUBLISHED', 'Published']] }, { k: 'publishAt', label: 'Publish at', type: 'datetime-local' }, { k: 'body', label: 'Body (blank line = new paragraph)', type: 'textarea', lines: true, full: true, rows: 10 }], onSave: (o) => { if (id) { const old = G.DB.get('articles', id); if (old && old.body && !Array.isArray(old.body)) o.body = Object.assign({}, old.body, { en: o.body }); G.DB.update('articles', id, o); } else { o.slug = (o.title.en || 'article').toLowerCase().replace(/[^a-z0-9]+/g, '-'); o.id = o.slug + '-' + Date.now().toString(36).slice(-3); G.DB.add('articles', o); } G.audit('ARTICLE_' + o.status, 'article', id || ''); render(); } }); },
    'art-del': (id) => { if (confirm('Delete?')) { G.DB.remove('articles', id); render(); } },
    'vid-new': () => editor({ title: 'Add video', item: { type: 'VIDEO', category: 'community', date: G.today() }, fields: [{ k: 'title', label: 'Title', type: 'i18n' }, { k: 'eventId', label: 'Event it belongs to', type: 'select', opts: evOpts() }, { k: 'src', label: 'Video file path or URL (.mp4)', full: true, req: true }, { k: 'category', label: 'Category', type: 'select', opts: catOpts }, { k: 'date', label: 'Date', type: 'date' }, { k: 'featured', label: 'Feature on homepage', type: 'checkbox' }], onSave: (o) => { o.type = 'VIDEO'; o.src = G.safeUrl(o.src, ''); if (!o.src) return G.toast('That video address is not allowed. Use a file path like assets/gallery/x.mp4 or an https:// link.', '⚠️'); G.DB.add('gallery', o); G.audit('GALLERY_ADD', 'gallery'); render(); } }),
    'rep-add': () => editor({ title: 'Publish an annual report', item: { year: String(new Date().getFullYear()) }, fields: [{ k: 'title', label: 'Title', req: true }, { k: 'year', label: 'Year', req: true }, { k: 'url', label: 'PDF address (assets/reports/name.pdf or https://…)', full: true, req: true }], onSave: (o) => { if (!G.safeUrl(o.url, '')) return G.toast('That address is not allowed.', '⚠️'); G.DB.saveSettings({ reports: [{ title: o.title, year: o.year, url: o.url }].concat(G.DB.settings().reports || []) }); G.audit('REPORT_PUBLISH', 'report', o.year); render(); } }),
    'gal-edit': (id) => editor({ title: 'Edit media', item: G.DB.get('gallery', id), fields: [{ k: 'title', label: 'Caption', type: 'i18n' }, { k: 'eventId', label: 'Event these belong to', type: 'select', opts: evOpts() }, { k: 'category', label: 'Category', type: 'select', opts: catOpts }, { k: 'date', label: 'Date', type: 'date' }, { k: 'featured', label: 'Feature on homepage', type: 'checkbox' }], onSave: (o) => { G.DB.update('gallery', id, o); G.audit('GALLERY_UPDATE', 'gallery', id); render(); } }),
    'gal-del': (id) => { if (confirm('Delete this media?')) { G.DB.remove('gallery', id); G.audit('GALLERY_DELETE', 'gallery', id); render(); } },
    'ts-new': () => A['ts-edit'](null),
    'ts-edit': (id) => editor({ title: 'Testimonial', item: id ? G.DB.get('testimonials', id) : {}, fields: [{ k: 'name', label: 'Name', req: true }, { k: 'role', label: 'Role (donor / volunteer / beneficiary)' }, { k: 'text', label: 'Quote', type: 'textarea', full: true, rows: 3 }], onSave: (o) => { if (id) G.DB.update('testimonials', id, o); else G.DB.add('testimonials', o); render(); } }),
    'ts-del': (id) => { G.DB.remove('testimonials', id); render(); },
    'vol-ok': (id) => { G.DB.update('volunteers', id, { status: 'APPROVED' }); G.audit('VOLUNTEER_APPROVE', 'volunteer', id); G.toast('Approved', '✅'); render(); },
    'vol-no': (id) => { G.DB.update('volunteers', id, { status: 'REJECTED' }); G.audit('VOLUNTEER_REJECT', 'volunteer', id); render(); },
    'vol-task': (id) => { const t = prompt('Task to assign:'); if (!t) return; const v = G.DB.get('volunteers', id); G.DB.update('volunteers', id, { tasks: (v.tasks || []).concat({ title: t, done: false }) }); G.audit('TASK_ASSIGN', 'volunteer', id, t); G.toast('Task assigned', '📋'); },
    'vol-hrs': (id) => { const h = Number(prompt('Hours to add for today:', '4')); if (!h) return; const v = G.DB.get('volunteers', id); G.DB.update('volunteers', id, { hours: (v.hours || 0) + h, attendance: (v.attendance || []).concat({ date: G.today(), hours: h, note: 'Present' }) }); G.audit('ATTENDANCE', 'volunteer', id, h + 'h'); render(); },
    'vol-cert': (id) => { const v = G.DB.get('volunteers', id); if (v.status !== 'APPROVED') return G.toast('Approve the volunteer first', 'ℹ️'); if (G.Volunteers.downloadPDF(v)) G.audit('CERTIFICATE_ISSUED', 'volunteer', id); },
    'vol-csv': () => csv('volunteers.csv', [['badge', 'Badge'], ['name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['city', 'City'], ['domain', 'Domain'], ['status', 'Status'], ['hours', 'Hours']], G.DB.all('volunteers')),
    'reg-csv': () => csv('registrations.csv', [[(r) => tr((G.DB.get('events', r.eventId) || {}).title), 'Event'], ['name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['guests', 'Guests'], [(r) => (r.asVolunteer ? 'Yes' : 'No'), 'Volunteer'], [(r) => (r.attended ? 'Yes' : 'No'), 'Attended']], G.DB.all('registrations')),
    'don-csv': () => { csv('donations.csv', [[(r) => r.createdAt.slice(0, 10), 'Date'], ['receiptNo', 'Receipt'], ['donorName', 'Donor'], ['donorEmail', 'Email'], ['donorPhone', 'Phone'], ['donorPan', 'PAN'], ['program', 'Programme'], ['amount', 'Amount INR'], ['frequency', 'Frequency'], ['method', 'Method'], ['status', 'Status'], ['paymentId', 'Payment ID']], window._donRows || G.DB.all('donations')); G.audit('EXPORT', 'donations'); },
    'don-csv-all': () => { window._donRows = G.DB.all('donations'); A['don-csv'](); },
    'don-rcpt': (id) => { if (!G.Donations.openReceipt(id)) G.toast('Allow pop-ups', '⚠️'); },
    'don-sync': (id) => { const d = G.DB.get('donations', id); G.toast(d.demo ? `Demo record — live Razorpay sync is available once the backend is connected. Current status: ${d.status}.` : 'Syncing with Razorpay…', '🔄'); G.audit('SYNC_STATUS', 'donation', id); },
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
    // AUTOMATION LOOP: receipts + stuck-payment tickets + (optionally) AI answers to simple questions - no clicking needed
    const tick = async () => { let changed = G.Donations.reconcile(); if (G.auto().autoReplyRoutine) changed += await runTriage(false); if (changed && ['dash', 'issues', 'donations'].includes(sec) && !document.querySelector('.modal-backdrop')) render(); };
    tick(); setInterval(tick, 30000);
    root().addEventListener('click', (e) => {
      const s = e.target.closest('[data-sec]'); if (s) { sec = s.dataset.sec; history.replaceState(null, '', '#' + sec); render(); return; }
      const b = e.target.closest('[data-a]'); if (b && A[b.dataset.a]) A[b.dataset.a](b.dataset.id);
    });
  });
})();
