/**
 * "Pay directly by UPI": the donor pays the Foundation's UPI ID and types the 12-digit reference; staff verify it before a receipt exists.
 * Until real details are saved in Admin -> Settings, a DUMMY id and an unpayable placeholder picture are shown.
 */
(function () {
  const G = window.GIGF, $ = (s, r) => (r || document).querySelector(s);
  const IMG = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, ID = /^[\w.\-]{2,64}@[a-zA-Z]{2,32}$/;
  // neither address can receive money: 'yourbank' and 'invalid' are not UPI handles
  const DUMMY = G.present ? { id: 'greenindiagokul@yourbank', name: 'Green India Gokul Foundation', qr: '', dummy: true } : { id: 'dummy.gigf@invalid', name: 'Green India Gokul Foundation (DUMMY)', qr: '', dummy: true };
  const details = () => { const u = G.DB.settings().upi; return u && ID.test(u.id || '') ? { id: u.id, name: String(u.name || G.ORG.name).slice(0, 80), qr: IMG.test(u.qr || '') ? u.qr : '', dummy: false } : DUMMY; };

  /** a picture that looks like "no QR yet" and cannot be scanned */
  function placeholder() {
    const c = document.createElement('canvas'); c.width = c.height = 320; const g = c.getContext('2d');
    g.fillStyle = '#f9fafb'; g.fillRect(0, 0, 320, 320); g.strokeStyle = '#d1d5db'; g.lineWidth = 6; g.setLineDash([14, 10]); g.strokeRect(10, 10, 300, 300);
    if (G.present) { g.fillStyle = '#6b7280'; g.textAlign = 'center'; g.font = 'bold 34px Arial'; g.fillText('UPI QR', 160, 150); g.font = '22px Arial'; g.fillText('Scan and pay', 160, 190); return c.toDataURL('image/png'); }
    g.fillStyle = '#b91c1c'; g.textAlign = 'center'; g.font = 'bold 46px Arial'; g.fillText('DUMMY', 160, 140); g.font = 'bold 24px Arial'; g.fillText('not a real QR', 160, 180); g.fillText('do not pay', 160, 212);
    return c.toDataURL('image/png');
  }

  function init() {
    const form = $('#donForm'); if (!form || $('#upiCard')) return;
    const u = details(), card = document.createElement('div'); card.id = 'upiCard'; card.className = 'card card-body upi-card';
    card.innerHTML = `<h4>📲 Or pay straight to our UPI ID</h4><p class="upi-note">No gateway: you pay from any UPI app, then tell us the reference. We check it and then send your receipt to your dashboard.</p>
      ${u.dummy && !G.present ? '<div class="note"><b>DUMMY DETAILS</b> for demonstration. Do not send any money.</div>' : ''}
      <div class="upi-grid"><img alt="UPI QR code" src="${u.qr || placeholder()}"><div>
        <div class="upi-id"><b id="upiId"></b> <button type="button" class="btn btn-ghost btn-sm" id="upiCopy">Copy</button></div><div id="upiName" style="font-size:.84rem;color:#6b7280"></div>
        <p>Amount: <b id="upiAmt"></b></p>
        ${u.dummy ? '' : '<a class="btn btn-ghost btn-sm" id="upiOpen" href="#">Open my UPI app (phone)</a>'}
        <div class="field"><label>12-digit UPI reference (UTR) from your app</label><input id="upiUtr" inputmode="numeric" maxlength="12" placeholder="e.g. 123456789012"></div>
        <button type="button" class="btn btn-primary" id="upiDone">I have paid</button></div></div>`;
    form.insertAdjacentElement('afterend', card);
    $('#upiId').textContent = u.id; $('#upiName').textContent = u.name;
    const amount = () => Number($('#dAmount').value) || 0;
    const paint = () => { $('#upiAmt').textContent = G.inr(amount()); const a = $('#upiOpen'); if (a) a.href = `upi://pay?pa=${encodeURIComponent(u.id)}&pn=${encodeURIComponent(u.name)}&am=${amount()}&cu=INR&tn=${encodeURIComponent('Donation')}`; };
    paint(); document.addEventListener('input', paint); document.addEventListener('click', () => setTimeout(paint, 0));
    $('#upiCopy').onclick = () => navigator.clipboard.writeText(u.id).then(() => G.toast('UPI ID copied', '📋'));
    $('#upiDone').onclick = async () => {
      if (!G.Auth.current()) return G.requireLogin('donate', 'donate.html');
      const name = form.elements.name.value.trim(), phone = form.elements.phone.value.trim(), pan = form.elements.pan.value.trim().toUpperCase(), utr = $('#upiUtr').value.replace(/\s/g, '');
      if (name.length < 2 || !/^[6-9]\d{9}$/.test(phone.replace(/\D/g, '').slice(-10))) return G.toast('Please fill your name and mobile number above.', '⚠️');
      if (pan && !G.Donations.PAN.test(pan)) return G.toast('Please check the PAN above, or leave it empty.', '⚠️');
      if (amount() < 10) return G.toast('Please choose an amount of at least ₹10.', '⚠️');
      if (!/^\d{12}$/.test(utr)) return G.toast('The UPI reference has exactly 12 digits.', '⚠️');
      if (G.DB.all('donations').some((d) => d.utr === utr)) return G.toast('This reference has already been submitted.', 'ℹ️');
      const btn = $('#upiDone'); btn.disabled = true;
      const claim = { program: $('#dProgram').selectedOptions[0].textContent.replace(/^\S+\s/, ''), amount: amount(), utr, name, phone, pan, email: G.Auth.current().email };
      let shared = false;
      if (G.cloud && G.cloud.signedIn()) {
        try { await G.cloud.submitUpi(claim); shared = true; } catch (e) {
          if (/duplicate|unique/i.test(e.message)) { btn.disabled = false; return G.toast('This reference has already been submitted.', 'ℹ️'); }
          G.toast('Could not reach the Foundation, so this is saved on this device only. ' + e.message, '⚠️');
        }
      }
      if (!shared) {
        const d = G.DB.add('donations', { donorName: name, donorEmail: claim.email, donorPhone: phone, donorPan: pan, program: claim.program, amount: claim.amount, frequency: 'ONE_TIME', method: 'UPI direct', userEmail: claim.email, orderId: 'upi_' + utr, paymentId: '', utr, source: 'UPI_DIRECT', status: 'PENDING', receiptNo: '', demo: true, autoFlagged: true });
        G.audit('UPI_CLAIM', 'donation', d.id, G.inr(d.amount) + ' · ref ' + utr);
      }
      $('#upiUtr').value = ''; btn.disabled = false;
      G.modal({ title: '⏳ Waiting to be checked', html: `<p>Thank you. We have noted your payment of <b>${G.inr(claim.amount)}</b> (reference ${G.esc(utr)}). A receipt appears in <a href="dashboard.html">your dashboard</a> after we confirm it in the bank statement.</p>` });
    };
  }
  G.upi = { details, DUMMY, ID, IMG };
  G.boot(() => { if (document.body.dataset.page === 'donate') init(); });
})();
