/**
 * Notifications: a bell for admin, donors and volunteers, pop-up alerts for the admin, and the list of messages ready to send.
 * Everything is worked out from the records the person can already see; nothing new is stored except what has been read / sent.
 */
(function () {
  const G = window.GIGF, $ = (s, r) => (r || document).querySelector(s), tr = (v) => G.tr(v);
  const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v.slice(-600))); } catch (e) { } };
  const all = (c) => G.DB.all(c) || [];
  const mine = (email, v) => !!email && String(v || '').toLowerCase() === String(email).toLowerCase();
  const soon = (date, days) => { const diff = (new Date(date + 'T00:00:00') - new Date(G.today() + 'T00:00:00')) / 86400000; return diff >= 0 && diff <= days; };

  /** newest first: { id, icon, text, link, at } */
  function list(u) {
    const out = [], add = (id, icon, text, link, at) => out.push({ id, icon, text, link, at: at || '' });
    if (!u) return out;
    if (/ADMIN/.test(u.role)) {
      all('tickets').filter((t) => t.status !== 'RESOLVED').forEach((t) => add('t-' + t.id, t.category === 'PAYMENT_ISSUE' ? '💳' : '✉️', (t.category === 'PAYMENT_ISSUE' ? 'Payment problem from ' : 'New message from ') + t.name, 'admin.html#issues', t.createdAt));
      all('donations').filter((d) => d.status === 'PENDING' && d.source === 'UPI_DIRECT').forEach((d) => add('u-' + d.id, '🔎', `${d.donorName} says they paid ${G.inr(d.amount)} by UPI: please verify`, 'admin.html#donations', d.createdAt));
      all('volunteers').filter((v) => v.status === 'PENDING').forEach((v) => add('v-' + v.id, '🤝', 'New volunteer application: ' + v.name, 'admin.html#volunteers', v.createdAt));
    } else {
      all('donations').filter((d) => mine(u.email, d.userEmail || d.donorEmail)).forEach((d) => {
        if (d.status === 'CAPTURED' && d.receiptNo) add('r-' + d.id, '🧾', `Receipt ${d.receiptNo} for ${G.inr(d.amount)} is ready`, 'dashboard.html#donations', d.createdAt);
        else if (d.status === 'FAILED') add('f-' + d.id, '⚠️', `Your payment of ${G.inr(d.amount)} did not go through`, 'dashboard.html#donations', d.createdAt);
        else if (d.status === 'PENDING') add('p-' + d.id, '⏳', `Your payment of ${G.inr(d.amount)} is waiting to be checked`, 'dashboard.html#donations', d.createdAt);
      });
      all('tickets').filter((t) => mine(u.email, t.email)).forEach((t) => (t.replies || []).forEach((r, i) => add(`a-${t.id}-${i}`, '💬', `The Foundation replied about ${t.no}`, 'dashboard.html#support', r.at || t.createdAt)));
      all('volunteers').filter((v) => mine(u.email, v.email)).forEach((v) => {
        if (v.status === 'APPROVED') add('va-' + v.id, '🎉', 'Your volunteer application is approved', 'dashboard.html#volunteer', v.createdAt);
        if (v.status === 'REJECTED') add('vr-' + v.id, 'ℹ️', 'Your volunteer application was not approved' + (v.reason ? ': ' + v.reason : ''), 'dashboard.html#volunteer', v.createdAt);
        (v.tasks || []).forEach((t, i) => { if (!t.done) add(`vt-${v.id}-${i}-${t.title}`, '📋', 'Task for you: ' + t.title, 'dashboard.html#volunteer', v.createdAt); });
      });
      all('registrations').filter((r) => mine(u.email, r.email)).forEach((r) => { const e = G.DB.get('events', r.eventId); if (e && e.status === 'UPCOMING' && soon(e.date, 3)) add('e-' + r.id, '📅', `Reminder: ${tr(e.title)} is on ${G.fmtDate(e.date)} at ${e.time}`, 'event.html?e=' + e.slug, e.date); });
    }
    return out.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 40);
  }
  const seenKey = (u) => 'gigf_seen_' + (u.id || u.email);
  const unread = (u) => { const s = new Set(get(seenKey(u), [])); return list(u).filter((n) => !s.has(n.id)); };

  /* ---------- bell ---------- */
  function paint() {
    const u = G.Auth.current(), box = $('#bellWrap'); if (!u || !box) return;
    const n = unread(u).length, c = $('#bellCount', box); c.textContent = n > 9 ? '9+' : String(n); c.hidden = !n;
    $('#bellBtn', box).setAttribute('aria-label', `Notifications, ${n} unread`);
  }
  function open() {
    const u = G.Auth.current(), menu = $('#bellMenu'), items = list(u), seen = new Set(get(seenKey(u), []));
    menu.textContent = '';
    const head = document.createElement('b'); head.textContent = 'Notifications'; menu.appendChild(head);
    if (/ADMIN/.test(u.role) && 'Notification' in window && Notification.permission !== 'granted') {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-ghost btn-sm'; b.id = 'bellAllow'; b.textContent = '🔔 Turn on pop-up alerts';
      b.onclick = (e) => { e.stopPropagation(); Notification.requestPermission().then((p) => { G.toast(p === 'granted' ? 'Pop-up alerts are on while the admin portal is open' : 'Your browser blocked the alerts', '🔔'); open(); }); }; menu.appendChild(b);
    }
    if (!items.length) { const p = document.createElement('p'); p.textContent = 'Nothing new.'; menu.appendChild(p); }
    items.forEach((n) => {
      const a = document.createElement('a'); a.href = n.link; a.className = seen.has(n.id) ? '' : 'new'; a.textContent = n.icon + ' ' + n.text;
      a.addEventListener('click', () => { menu.hidden = true; });
      menu.appendChild(a);
    });
    put(seenKey(u), Array.from(new Set(get(seenKey(u), []).concat(items.map((n) => n.id)))));
    paint();
  }
  function mount() {
    const u = G.Auth.current(), bar = $('.top-bar-right'); if (!u || !bar || $('#bellWrap')) return;
    const w = document.createElement('div'); w.id = 'bellWrap'; w.className = 'bell-wrap'; w.setAttribute('data-notr', '');
    w.innerHTML = '<button type="button" id="bellBtn" class="bell-btn" aria-haspopup="true">🔔<span id="bellCount" hidden></span></button><div id="bellMenu" class="bell-menu" hidden></div>';
    const profile = $('.profile-wrap', bar); bar.insertBefore(w, profile || null);
    $('#bellBtn', w).onclick = (e) => { e.stopPropagation(); const m = $('#bellMenu', w); m.hidden = !m.hidden; if (!m.hidden) open(); };
    document.addEventListener('click', (e) => { if (!w.contains(e.target)) $('#bellMenu', w).hidden = true; });
    paint(); watch(u);
  }
  /** keeps the count fresh; for the admin also shows a browser pop-up when something new arrives */
  function watch(u) {
    const known = new Set(list(u).map((n) => n.id));
    const check = () => {
      paint();
      const fresh = list(u).filter((n) => !known.has(n.id)); fresh.forEach((n) => known.add(n.id));
      if (fresh.length && /ADMIN/.test(u.role) && document.body.dataset.page === 'admin' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(fresh.length === 1 ? 'Green India Gokul Foundation' : fresh.length + ' new items', { body: fresh.slice(0, 3).map((n) => n.text).join('\n'), tag: 'gigf-admin' });
      }
    };
    addEventListener('storage', () => { G.DB.reload(); check(); });   // something changed in another tab
    setInterval(async () => { if (document.body.dataset.page === 'admin' && G.cloud && G.cloud.canWrite()) { try { await G.cloud.pull(); } catch (e) { } } check(); }, 45000);
    setInterval(check, 8000);
  }

  /* ---------- messages ready to send (admin) ---------- */
  function messages() {
    const sign = '\n\n' + G.ORG.name, out = [], add = (key, kind, name, email, phone, subject, body, at) => { if (email || phone) out.push({ key, kind, name, email: email || '', phone: String(phone || ''), subject, body: `Namaste ${name},\n\n${body}${sign}`, at: at || '' }); };
    all('donations').filter((d) => d.status === 'CAPTURED' && d.receiptNo).forEach((d) => add('rc-' + d.id, 'Receipt', d.donorName, d.donorEmail, d.donorPhone, 'Donation receipt ' + d.receiptNo, `Thank you for your donation of ${G.inr(d.amount)} to ${d.program}. Your receipt number is ${d.receiptNo}. You can download the receipt from your dashboard.`, d.createdAt));
    all('donations').filter((d) => d.status === 'FAILED').forEach((d) => add('fl-' + d.id, 'Payment failed', d.donorName, d.donorEmail, d.donorPhone, 'Your donation did not go through', `Your donation of ${G.inr(d.amount)} did not go through. If money left your account, please reply with the bank reference and we will check.`, d.createdAt));
    all('tickets').forEach((t) => (t.replies || []).forEach((r, i) => add(`rp-${t.id}-${i}`, 'Reply', t.name, t.email, t.phone, 'About your request ' + t.no, r.text || r.message || '', r.at || t.createdAt)));
    all('volunteers').filter((v) => v.status !== 'PENDING').forEach((v) => add(`vs-${v.id}-${v.status}`, v.status === 'APPROVED' ? 'Volunteer approved' : 'Volunteer not approved', v.name, v.email, v.phone, 'Your volunteer application', v.status === 'APPROVED' ? `Your volunteer application is approved. Your volunteer ID is ${v.badge}. Welcome to the team!` : `Thank you for applying. We are not able to approve the application at this time.${v.reason ? ' Reason: ' + v.reason : ''}`, v.createdAt));
    all('volunteers').forEach((v) => (v.tasks || []).forEach((t, i) => { if (!t.done) add(`tk-${v.id}-${i}-${t.title}`, 'Task', v.name, v.email, v.phone, 'A volunteer task for you', `Here is a task for you: ${t.title}. You can mark it done in your dashboard.`, v.createdAt); }));
    all('registrations').forEach((r) => { const e = G.DB.get('events', r.eventId); if (!e || e.status !== 'UPCOMING') return; const when = `${G.fmtDate(e.date)} at ${e.time}, ${e.location}`;
      if (soon(e.date, 2)) add('rm-' + r.id, 'Event reminder', r.name, r.email, r.phone, 'Reminder: ' + tr(e.title), `This is a reminder that ${tr(e.title)} is on ${when}. See you there!`, e.date);
      else if (soon(e.date, 400)) add('cf-' + r.id, 'Event confirmation', r.name, r.email, r.phone, 'You are registered: ' + tr(e.title), `You are registered for ${tr(e.title)} on ${when}.`, r.createdAt); });
    return out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }
  const sent = () => new Set(get('gigf_sent_messages', []));
  const markSent = (key) => put('gigf_sent_messages', Array.from(sent().add(key)));
  const links = (m) => { const wa = m.phone.replace(/\D/g, '').slice(-10); return { mail: m.email ? `mailto:${encodeURIComponent(m.email).replace('%40', '@')}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}` : '', wa: wa.length === 10 ? `https://wa.me/91${wa}?text=${encodeURIComponent(m.body)}` : '' }; };

  G.notify = { list, unread, messages, sent, markSent, links, mount };
  G.boot(() => { mount(); });
})();
