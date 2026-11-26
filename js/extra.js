/** Real PDF receipts/certificates, event details page, article page, annual reports page. Loaded after data.js / pages.js. */
(function () {
  const G = window.GIGF, $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => G.esc(s), tr = (v) => G.tr(v);

  /* ---------- PDF: the page is drawn on a canvas (so ₹ and every Indian script work) and wrapped in a one-page A4 PDF ---------- */
  function pdfFromCanvas(canvas, name, landscape) {
    const jpg = atob(canvas.toDataURL('image/jpeg', 0.92).split(',')[1]);
    const W = landscape ? 842 : 595, H = landscape ? 595 : 842, draw = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    const objs = ['<</Type/Catalog/Pages 2 0 R>>', '<</Type/Pages/Kids[3 0 R]/Count 1>>',
      `<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${W} ${H}]/Resources<</XObject<</Im0 4 0 R>>>>/Contents 5 0 R>>`,
      `<</Type/XObject/Subtype/Image/Width ${canvas.width}/Height ${canvas.height}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${jpg.length}>>\nstream\n${jpg}\nendstream`,
      `<</Length ${draw.length}>>\nstream\n${draw}\nendstream`];
    let out = '%PDF-1.4\n'; const at = [];
    objs.forEach((o, i) => { at.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const x = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${at.map((n) => String(n).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${x}\n%%EOF`;
    const bytes = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function sheet(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.textBaseline = 'top';
    /** wrapped text; returns the y below it */
    const text = (s, x, y, o) => {
      o = o || {}; g.font = `${o.bold ? 'bold ' : ''}${o.size || 24}px Arial, "Noto Sans Kannada", "Noto Sans Devanagari", "Noto Sans Tamil", "Noto Sans Telugu", "Noto Sans Malayalam", sans-serif`; g.fillStyle = o.color || '#222'; g.textAlign = o.align || 'left';
      const max = o.max || w - x - 80, words = String(s).split(' '); let line = '';
      words.forEach((word) => { const next = line ? line + ' ' + word : word; if (line && g.measureText(next).width > max) { g.fillText(line, x, y); y += (o.size || 24) * 1.4; line = word; } else line = next; });
      g.fillText(line, x, y); return y + (o.size || 24) * 1.4;
    };
    return { c, g, text };
  }
  function receiptPDF(d) {
    const o = G.ORG, s = G.DB.settings(), p = sheet(1240, 1754), g = p.g;
    let y = p.text(o.nameCaps, 80, 80, { size: 44, bold: true, color: '#0f4d2a' });
    y = p.text(o.address, 80, y, { size: 22 }); y = p.text(o.email + ' · ' + o.phones.map((x) => x.display).join(', '), 80, y, { size: 22 });
    g.fillStyle = '#156637'; g.fillRect(80, y + 12, 1080, 5);
    y = p.text('Donation Receipt', 80, y + 50, { size: 38, bold: true }) + 10;
    if (d.demo) y = p.text('DEMO RECEIPT - test mode. No money was charged and this is not a valid tax document.', 80, y, { size: 22, color: '#9a3412' }) + 14;
    [['Receipt No.', d.receiptNo], ['Date', new Date(d.createdAt).toLocaleDateString('en-IN')], ['Donor Name', d.donorName], ['Email / Phone', d.donorEmail + ' / ' + (d.donorPhone || '-')], ['PAN', d.donorPan || '-'], ['Programme', d.program], ['Frequency', d.frequency === 'MONTHLY' ? 'Monthly' : 'One-time'], ['Payment Method', d.method], ['Payment ID', d.paymentId], ['Amount', G.inr(d.amount)]].forEach((row) => {
      const top = y; p.text(row[0], 100, top + 14, { size: 24, bold: true, max: 300 }); const end = p.text(row[1] || '-', 440, top + 14, { size: 24, max: 700 });
      const bottom = Math.max(end, top + 62); g.strokeStyle = '#ccc'; g.strokeRect(80, top, 1080, bottom - top); y = bottom;
    });
    y = p.text(s.reg80G || s.reg12A ? [s.reg80G ? 'Section 80G: ' + s.reg80G : '', s.reg12A ? 'Section 12A: ' + s.reg12A : ''].filter(Boolean).join('. ') : '80G / 12A registration numbers have not yet been configured by the Foundation.', 80, y + 40, { size: 22 });
    p.text('Thank you for supporting ' + o.name + '.', 80, y + 20, { size: 22, color: '#555' });
    pdfFromCanvas(p.c, 'Receipt-' + String(d.receiptNo).replace(/\W+/g, '-') + '.pdf');
  }
  function certificatePDF(v) {
    const p = sheet(1754, 1240), g = p.g, mid = { align: 'center', max: 1500 };
    g.strokeStyle = '#156637'; g.lineWidth = 14; g.strokeRect(50, 50, 1654, 1140); g.lineWidth = 3; g.strokeRect(80, 80, 1594, 1080);
    p.text(G.ORG.nameCaps, 877, 190, Object.assign({ size: 34, color: '#555' }, mid));
    p.text('Certificate of Appreciation', 877, 290, Object.assign({ size: 76, bold: true, color: '#0f4d2a' }, mid));
    p.text('This is proudly presented to', 877, 460, Object.assign({ size: 32 }, mid));
    p.text(v.name, 877, 540, Object.assign({ size: 66, bold: true, color: '#156637' }, mid));
    p.text(`in recognition of volunteer service in ${v.domain || 'community work'} (${v.hours || 0} hours).`, 877, 700, Object.assign({ size: 32 }, mid));
    p.text(`Volunteer ID: ${v.badge}     Issued: ${new Date().toLocaleDateString('en-IN')}`, 877, 960, Object.assign({ size: 28, color: '#555' }, mid));
    pdfFromCanvas(p.c, 'Certificate-' + v.badge + '.pdf', true);
  }
  G.Donations.openReceipt = (id) => { const d = G.DB.get('donations', id); if (!d || !d.receiptNo) return false; receiptPDF(d); return true; };
  G.Volunteers.downloadPDF = (v) => { certificatePDF(v); return true; };

  /* ---------- event details page: event.html?e=slug ---------- */
  function initEvent() {
    const box = $('#detail'), slug = new URLSearchParams(location.search).get('e');
    const e = G.DB.all('events').find((x) => x.slug === slug && x.status !== 'DRAFT');
    if (!e) { box.innerHTML = '<div class="empty"><span class="e">📅</span>This event was not found. <a href="events.html">See all events</a></div>'; return; }
    document.title = tr(e.title) + ' | Green India Gokul Foundation'; describe(tr(e.desc));
    const prog = G.DB.get('programs', e.program), media = G.DB.all('gallery').filter((m) => m.eventId === e.id), done = e.status !== 'UPCOMING';
    const poster = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(e.poster || '') ? e.poster : '';
    box.innerHTML = `<article class="card card-body detail"><h2>${esc(tr(e.title))}</h2>
      <p class="ev-meta"><span>📅 ${G.fmtDate(e.date)}</span> <span>🕒 ${esc(e.time)}</span> <span>📍 ${esc(e.location)}</span> ${prog ? `<a href="programs.html#${esc(prog.slug)}">${esc(prog.icon)} ${esc(tr(prog.title))}</a>` : ''}</p>
      ${poster ? `<img class="detail-img" src="${poster}" alt="">` : ''}<p>${esc(tr(e.desc))}</p>
      <p><a class="link-more" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.location)}">🗺️ Open in Google Maps</a></p>
      ${done ? '<span class="chip gray">Completed</span>' : `<button class="btn btn-primary" data-reg="${esc(e.id)}">${G.t('btn.register')}</button>`}</article>
      <h3 style="margin:30px 0 12px">📸 Photos and videos from this event</h3>
      ${media.length ? `<div class="detail-media">${media.map((m) => (m.type === 'VIDEO' ? `<video src="${esc(G.safeUrl(m.src, ''))}#t=0.6" controls preload="metadata" playsinline></video>` : `<img src="${esc(G.safeUrl(m.src, ''))}" alt="${esc(tr(m.title))}" loading="lazy">`)).join('')}</div>` : '<p style="color:#6b7280">No photos have been added for this event.</p>'}`;
  }

  /* ---------- article page: article.html?a=slug ---------- */
  function describe(text) { const m = $('meta[name=description]'); if (m) m.setAttribute('content', String(text).slice(0, 160)); }
  function initArticle() {
    const box = $('#detail'), key = new URLSearchParams(location.search).get('a');
    const a = G.DB.all('articles').find((x) => (x.slug === key || x.id === key) && (x.status === 'PUBLISHED' || (x.status === 'SCHEDULED' && x.publishAt && new Date(x.publishAt) <= new Date())));
    if (!a) { box.innerHTML = '<div class="empty"><span class="e">📰</span>This article was not found. <a href="awareness.html">See all articles</a></div>'; return; }
    const raw = a.body && !Array.isArray(a.body) && typeof a.body === 'object' ? (a.body[G.lang()] || a.body.en) : a.body, body = Array.isArray(raw) ? raw : String(raw || '').split(/\n\s*\n/);
    document.title = tr(a.title) + ' | Green India Gokul Foundation'; describe(tr(a.summary));
    box.innerHTML = `<article class="card card-body detail"><p style="font-size:.8rem;color:#6b7280">${G.fmtDate(a.date)} · ${esc(G.t("art." + a.category))}</p><h2>${esc(tr(a.title))}</h2>${body.map((p) => `<p>${esc(p)}</p>`).join('')}<p><a class="link-more" href="awareness.html">← ${G.t('nav.awareness')}</a></p></article>`;
  }

  /* ---------- annual reports ---------- */
  function initReports() {
    const list = (G.DB.settings().reports || []).filter((r) => G.safeUrl(r.url, ''));
    $('#detail').innerHTML = list.length ? `<div class="grid g3">${list.map((r) => `<div class="card card-body"><h4>📄 ${esc(r.title)}</h4><p style="color:#6b7280">${esc(r.year)}</p><a class="btn btn-primary btn-sm" href="${esc(G.safeUrl(r.url, ''))}" target="_blank" rel="noopener" download>⬇ Download</a></div>`).join('')}</div>` : '<div class="empty"><span class="e">📄</span>No annual reports have been published.</div>';
  }

  G.boot(() => { const run = { event: initEvent, article: initArticle, reports: initReports }[document.body.dataset.page]; if (run) run(); });
})();
