/** User dashboard: profile, donation history/receipts/recurring, events, volunteer area, support tickets. */
(function () {
  const G = window.GIGF, $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s)), esc = G.esc, tr = G.tr;
  G.boot(() => {
    const u = G.Auth.current();
    if (!u) { location.href = 'login.html?next=dashboard.html'; return; }
    if (/ADMIN/.test(u.role)) { location.href = 'admin.html'; return; }
    try { G.Donations.reconcile(); } catch (e) { }
    let tab = (location.hash || '#overview').slice(1);
    const statusChip = (s) => `<span class="chip ${s === 'CAPTURED' || s === 'APPROVED' || s === 'RESOLVED' ? '' : s === 'FAILED' || s === 'REJECTED' ? 'red' : 'warn'}">${s}</span>`;
    const roleLabel = { REGISTERED_USER: 'Registered User', VOLUNTEER: 'Volunteer', DONOR: 'Donor' }[u.role] || u.role;

    const views = {
      overview() {
        const dons = G.Donations.mine().filter((d) => d.status === 'CAPTURED'), total = dons.reduce((a, d) => a + d.amount, 0);
        const regs = G.DB.all('registrations').filter((r) => r.email.toLowerCase() === u.email.toLowerCase()), v = G.Volunteers.mine();
        return `<div class="stats" style="margin-bottom:22px"><div class="stat"><b>${G.inr(total)}</b><span>Total donated</span></div><div class="stat"><b>${dons.length}</b><span>Donations</span></div><div class="stat"><b>${regs.length}</b><span>Event registrations</span></div><div class="stat"><b>${v ? v.hours || 0 : '—'}</b><span>Volunteer hours</span></div></div>
        <div class="grid g2"><div class="card card-body"><h4>Profile</h4><form id="profForm" class="f-grid" style="margin-top:10px"><div class="field"><label>${G.t('f.name')}</label><input name="name" value="${esc(u.name)}"></div><div class="field"><label>${G.t('f.phone')}</label><input name="phone" value="${esc(u.phone || '')}"></div><div class="field f-full"><label>${G.t('f.email')}</label><input value="${esc(u.email)}" disabled></div><button class="btn btn-primary f-full" type="submit">Save profile</button></form></div>
        <div class="card card-body"><h4>Quick actions</h4><div style="display:grid;gap:10px;margin-top:12px"><a class="btn btn-orange" href="donate.html">💚 Make a donation</a><a class="btn btn-primary" href="events.html">📅 Browse events</a>${v ? '' : '<a class="btn btn-ghost" href="volunteer.html">🤝 Become a volunteer</a>'}<button class="btn btn-ghost" data-go="support">🎫 Contact support</button></div></div></div>`;
      },
      donations() {
        const rows = G.Donations.mine();
        if (!rows.length) return G.emptyBox('💚', 'No donations yet. <a href="donate.html">Make your first donation</a>.');
        return `<div class="tbl-wrap"><table class="t"><tr><th>Date</th><th>Programme</th><th>Amount</th><th>Type</th><th>Status</th><th>Receipt</th><th></th></tr>${rows.map((d) => `<tr><td>${G.fmtDate(d.createdAt)}</td><td>${esc(d.program)}</td><td><b>${G.inr(d.amount)}</b></td><td>${d.frequency === 'MONTHLY' ? '🔁 Monthly' : 'One-time'}${d.cancelled ? ' <span class="chip gray">stopped</span>' : ''}</td><td>${statusChip(d.status)}</td><td>${d.receiptNo ? `<a href="#" data-rcpt="${d.id}">${esc(d.receiptNo)}</a>` : '—'}</td>
          <td style="white-space:nowrap">${d.frequency === 'MONTHLY' && d.status === 'CAPTURED' && !d.cancelled ? `<button class="btn btn-ghost btn-sm" data-stop="${d.id}">Stop monthly</button> ` : ''}<button class="btn btn-ghost btn-sm" data-issue="${d.id}">Report issue</button></td></tr>`).join('')}</table></div>
          <p style="font-size:.76rem;color:#6b7280;margin-top:8px">Receipts open in a new tab — use Print → Save as PDF.</p>`;
      },
      events() {
        const regs = G.DB.all('registrations').filter((r) => r.email.toLowerCase() === u.email.toLowerCase());
        if (!regs.length) return G.emptyBox('📅', 'You have not registered for any event. <a href="events.html">See upcoming events</a>.');
        return `<div class="grid g2">${regs.map((r) => { const e = G.DB.get('events', r.eventId) || {}; return `<div class="card card-body"><h4>${esc(tr(e.title) || 'Event')}</h4><p style="font-size:.84rem;color:#4b5563">${e.date ? G.fmtDate(e.date) : ''} · ${esc(e.location || '')}</p><p style="margin:8px 0">${r.guests} guest(s) ${r.asVolunteer ? '<span class="chip blue">Volunteer slot</span>' : ''} ${r.attended ? '<span class="chip">Attended</span>' : ''}</p><button class="btn btn-ghost btn-sm" data-unreg="${r.id}">Cancel registration</button></div>`; }).join('')}</div>`;
      },
      volunteer() {
        const v = G.Volunteers.mine();
        if (!v) return G.emptyBox('🤝', 'You are not a volunteer yet. <a href="volunteer.html">Apply now</a>.');
        const tasks = v.tasks || [];
        return `<div class="grid g2"><div class="card card-body"><h4>Digital ID</h4><div class="id-badge" style="margin-top:10px"><div style="font-weight:800;color:#fef08a;font-size:.85rem">${G.ORG.nameCaps}</div><h3 style="margin:10px 0 2px">${esc(v.name)}</h3><div style="font-size:.82rem">${esc(v.domain)} · ${esc(v.city)}</div><div style="margin-top:8px;font-family:monospace;color:#fef08a">${v.badge}</div></div><p style="margin-top:10px">Status: ${statusChip(v.status)}</p>
          ${v.status === 'APPROVED' ? `<button class="btn btn-primary btn-sm" id="certBtn" style="margin-top:8px">🏅 Certificate</button>` : ''}</div>
        <div class="card card-body"><h4>Tasks assigned</h4>${tasks.length ? '<ul style="margin:10px 0 0 18px">' + tasks.map((k, i) => `<li style="margin-bottom:6px">${esc(k.title)} <span class="chip ${k.done ? '' : 'warn'}">${k.done ? 'Done' : 'To do'}</span> ${k.done ? '' : `<button class="btn btn-ghost btn-sm" data-done="${i}">Mark done</button>`}</li>`).join('') + '</ul>' : '<p style="color:#6b7280;margin-top:8px">No tasks yet.</p>'}
          <h4 style="margin-top:16px">Attendance</h4>${(v.attendance || []).length ? '<ul style="margin:8px 0 0 18px">' + v.attendance.map((a) => `<li>${G.fmtDate(a.date)} — ${esc(a.note || 'Present')} (${a.hours}h)</li>`).join('') + '</ul>' : '<p style="color:#6b7280;margin-top:8px">No attendance recorded yet.</p>'}<p style="margin-top:8px"><b>Total hours:</b> ${v.hours || 0}</p></div></div>`;
      },
      support() {
        const mine = G.DB.all('tickets').filter((x) => (x.email || '').toLowerCase() === u.email.toLowerCase());
        return `<div class="grid g2"><div class="card card-body"><h4>Message the Foundation</h4><form id="supForm" class="f-grid" style="margin-top:10px"><div class="field f-full"><label>${G.t('f.subject')}</label><input name="subject" required></div><div class="field f-full"><label>${G.t('f.message')}</label><textarea name="message" rows="4" required></textarea></div><button class="btn btn-primary f-full" type="submit">${G.t('btn.send')}</button></form></div>
          <div><h4 style="margin-bottom:8px">My tickets</h4>${mine.length ? mine.map((x) => `<div class="card card-body" style="margin-bottom:10px"><b>${x.no}</b> ${statusChip(x.status)}<div style="font-size:.84rem;margin:4px 0">${esc(x.subject)}</div>${(x.replies || []).map((r) => `<div class="note green" style="margin-top:6px"><b>Foundation:</b> ${esc(r.text)}</div>`).join('')}</div>`).join('') : G.emptyBox('🎫', 'No tickets yet.')}</div></div>`;
      }
    };
    const tabs = [['overview', '🏠 Overview'], ['donations', '💚 Donations'], ['events', '📅 My events'], ['volunteer', '🤝 Volunteer'], ['support', '🎫 Support']];
    function render() {
      if (!views[tab]) tab = 'overview';
      $('#dashHello').textContent = `Namaste, ${u.name.split(' ')[0]} 🙏`; $('#dashRole').textContent = roleLabel;
      $('#dashTabs').innerHTML = tabs.map((x) => `<button class="tab ${x[0] === tab ? 'on' : ''}" data-tab="${x[0]}">${x[1]}</button>`).join('');
      $('#dashBody').innerHTML = views[tab](); G.observeReveal();
    }
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab],[data-go]'); if (b) { tab = b.dataset.tab || b.dataset.go; history.replaceState(null, '', '#' + tab); render(); return; }
      const rc = e.target.closest('[data-rcpt]'); if (rc) { e.preventDefault(); if (!G.Donations.openReceipt(rc.dataset.rcpt)) G.toast('Allow pop-ups to view the receipt', '⚠️'); return; }
      const st = e.target.closest('[data-stop]'); if (st && confirm('Stop this monthly donation?')) { G.DB.update('donations', st.dataset.stop, { cancelled: true }); G.audit('MONTHLY_STOPPED', 'donation', st.dataset.stop, 'stopped by donor'); G.toast('Monthly donation stopped', '🛑'); render(); return; }
      const un = e.target.closest('[data-unreg]'); if (un && confirm('Cancel this registration?')) { G.DB.remove('registrations', un.dataset.unreg); render(); return; }
      const dn = e.target.closest('[data-done]'); if (dn) { const v = G.Volunteers.mine(); v.tasks[dn.dataset.done].done = true; G.DB.update('volunteers', v.id, { tasks: v.tasks }); render(); return; }
      if (e.target.id === 'certBtn') { const v = G.Volunteers.mine(); if (!G.Volunteers.downloadPDF(v)) G.toast('Allow pop-ups', '⚠️'); return; }
      const is = e.target.closest('[data-issue]');
      if (is) {
        const d = G.DB.get('donations', is.dataset.issue);
        const m = G.modal({ title: '🎫 Report a payment / receipt issue', html: `<p style="font-size:.84rem;margin-bottom:10px">${G.inr(d.amount)} · ${esc(d.program)} · ${d.status}</p><form id="issForm"><div class="field"><label>What went wrong?</label><select name="why"><option>Money debited but donation not shown</option><option>Receipt missing</option><option>Wrong name / PAN on receipt</option><option>Payment failed or stuck pending</option><option>Other</option></select></div><div class="field" style="margin-top:10px"><label>Details (optional)</label><textarea name="d" rows="3"></textarea></div><button class="btn btn-primary" style="margin-top:12px" type="submit">Submit ticket</button></form>` });
        $('#issForm', m).addEventListener('submit', (ev) => { ev.preventDefault(); const f = new FormData(ev.target); const tk = G.Tickets.create({ category: 'PAYMENT_ISSUE', name: u.name, email: u.email, phone: u.phone, subject: f.get('why'), message: f.get('d') || f.get('why'), donationId: d.id }); m.close(); G.toast(`Ticket ${tk.no} created. Our finance team will respond.`, '🎫'); tab = 'support'; render(); });
      }
    });
    document.addEventListener('submit', (e) => {
      if (e.target.id === 'profForm') { e.preventDefault(); const f = new FormData(e.target); G.DB.update('users', u.id, { name: f.get('name'), phone: f.get('phone') }); u.name = f.get('name'); u.phone = f.get('phone'); localStorage.setItem('gigf_session', JSON.stringify(u)); G.toast('Profile saved', '✅'); render(); }
      if (e.target.id === 'supForm') { e.preventDefault(); const f = new FormData(e.target); const tk = G.Tickets.create({ category: 'CONTACT', name: u.name, email: u.email, phone: u.phone, subject: f.get('subject'), message: f.get('message') }); G.toast('Sent — ' + tk.no, '✉️'); render(); }
    });
    render();
  });
})();
