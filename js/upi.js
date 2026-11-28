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

  /* Fixed wording for this box. Money instructions are not left to machine translation at view time. */
  const WORDS = {
    en: { head: 'Or pay straight to our UPI ID', note: 'No gateway: you pay from any UPI app, then tell us the reference. We check it and then send your receipt to your dashboard.', dummy: 'DUMMY DETAILS for demonstration. Do not send any money.', copy: 'Copy', amount: 'Amount', open: 'Open my UPI app (phone)', ref: '12-digit UPI reference (UTR) from your app', done: 'I have paid', monthly: 'Paying by UPI ID here is a one-time gift. It will not repeat every month. For monthly giving, use the Donate button in the form.' },
    kn: { head: 'ಅಥವಾ ನಮ್ಮ UPI ID ಗೆ ನೇರವಾಗಿ ಪಾವತಿಸಿ', note: 'ಗೇಟ್‌ವೇ ಇಲ್ಲ: ಯಾವುದೇ UPI ಆ್ಯಪ್‌ನಿಂದ ಪಾವತಿಸಿ, ನಂತರ ರೆಫರೆನ್ಸ್ ಸಂಖ್ಯೆಯನ್ನು ನಮಗೆ ತಿಳಿಸಿ. ನಾವು ಪರಿಶೀಲಿಸಿ ನಿಮ್ಮ ರಸೀದಿಯನ್ನು ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ಗೆ ಕಳುಹಿಸುತ್ತೇವೆ.', dummy: 'ಇವು ಪ್ರದರ್ಶನಕ್ಕಾಗಿ ನಕಲಿ ವಿವರಗಳು. ಯಾವುದೇ ಹಣ ಕಳುಹಿಸಬೇಡಿ.', copy: 'ನಕಲಿಸಿ', amount: 'ಮೊತ್ತ', open: 'ನನ್ನ UPI ಆ್ಯಪ್ ತೆರೆಯಿರಿ (ಫೋನ್)', ref: 'ನಿಮ್ಮ ಆ್ಯಪ್‌ನಲ್ಲಿರುವ 12 ಅಂಕಿಯ UPI ರೆಫರೆನ್ಸ್ (UTR)', done: 'ನಾನು ಪಾವತಿಸಿದ್ದೇನೆ', monthly: 'ಇಲ್ಲಿ UPI ID ಮೂಲಕ ನೀಡುವುದು ಒಂದು ಬಾರಿಯ ದೇಣಿಗೆ. ಇದು ಪ್ರತಿ ತಿಂಗಳು ಪುನರಾವರ್ತನೆಯಾಗುವುದಿಲ್ಲ. ಮಾಸಿಕ ದೇಣಿಗೆಗೆ ಫಾರ್ಮ್‌ನಲ್ಲಿರುವ ದೇಣಿಗೆ ಬಟನ್ ಬಳಸಿ.' },
    hi: { head: 'या सीधे हमारी UPI ID पर भुगतान करें', note: 'कोई गेटवे नहीं: किसी भी UPI ऐप से भुगतान करें, फिर हमें रेफ़रेंस नंबर बताएँ। हम जाँच करके आपकी रसीद आपके डैशबोर्ड पर भेजेंगे।', dummy: 'ये प्रदर्शन के लिए नकली विवरण हैं। कोई पैसा न भेजें।', copy: 'कॉपी करें', amount: 'राशि', open: 'मेरा UPI ऐप खोलें (फ़ोन)', ref: 'आपके ऐप का 12 अंकों का UPI रेफ़रेंस (UTR)', done: 'मैंने भुगतान कर दिया है', monthly: 'यहाँ UPI ID से दिया गया दान एक बार का होता है। यह हर महीने दोहराया नहीं जाएगा। मासिक दान के लिए फ़ॉर्म का दान बटन इस्तेमाल करें।' },
    ta: { head: 'அல்லது எங்கள் UPI ID-க்கு நேரடியாகச் செலுத்துங்கள்', note: 'கேட்வே இல்லை: எந்த UPI செயலியிலிருந்தும் செலுத்தி, பின்னர் குறிப்பு எண்ணை எங்களிடம் தெரிவியுங்கள். சரிபார்த்த பிறகு ரசீதை உங்கள் டாஷ்போர்டுக்கு அனுப்புவோம்.', dummy: 'இவை செயல்விளக்கத்திற்கான போலி விவரங்கள். பணம் அனுப்ப வேண்டாம்.', copy: 'நகலெடு', amount: 'தொகை', open: 'என் UPI செயலியைத் திற (போன்)', ref: 'உங்கள் செயலியில் உள்ள 12 இலக்க UPI குறிப்பு எண் (UTR)', done: 'நான் செலுத்திவிட்டேன்', monthly: 'இங்கு UPI ID வழியாகச் செலுத்துவது ஒருமுறை நன்கொடை மட்டுமே. இது மாதந்தோறும் தொடராது. மாதாந்திர நன்கொடைக்கு படிவத்தில் உள்ள நன்கொடை பொத்தானைப் பயன்படுத்துங்கள்.' },
    te: { head: 'లేదా మా UPI IDకి నేరుగా చెల్లించండి', note: 'గేట్‌వే లేదు: ఏదైనా UPI యాప్ నుండి చెల్లించి, రిఫరెన్స్ నంబర్‌ను మాకు తెలియజేయండి. మేము తనిఖీ చేసి మీ రసీదును మీ డాష్‌బోర్డ్‌కు పంపుతాము.', dummy: 'ఇవి ప్రదర్శన కోసం నకిలీ వివరాలు. డబ్బు పంపవద్దు.', copy: 'కాపీ చేయండి', amount: 'మొత్తం', open: 'నా UPI యాప్ తెరవండి (ఫోన్)', ref: 'మీ యాప్‌లోని 12 అంకెల UPI రిఫరెన్స్ (UTR)', done: 'నేను చెల్లించాను', monthly: 'ఇక్కడ UPI ID ద్వారా ఇచ్చేది ఒకసారి విరాళం మాత్రమే. ఇది ప్రతి నెలా కొనసాగదు. నెలవారీ విరాళం కోసం ఫారమ్‌లోని విరాళం బటన్‌ను ఉపయోగించండి.' },
    ml: { head: 'അല്ലെങ്കിൽ ഞങ്ങളുടെ UPI ID-ലേക്ക് നേരിട്ട് അടയ്ക്കുക', note: 'ഗേറ്റ്‌വേ ഇല്ല: ഏത് UPI ആപ്പിൽ നിന്നും പണമടച്ച ശേഷം റഫറൻസ് നമ്പർ ഞങ്ങളെ അറിയിക്കുക. പരിശോധിച്ച ശേഷം രസീത് നിങ്ങളുടെ ഡാഷ്‌ബോർഡിലേക്ക് അയയ്ക്കും.', dummy: 'ഇവ പ്രദർശനത്തിനുള്ള വ്യാജ വിവരങ്ങളാണ്. പണം അയയ്ക്കരുത്.', copy: 'പകർത്തുക', amount: 'തുക', open: 'എന്റെ UPI ആപ്പ് തുറക്കുക (ഫോൺ)', ref: 'നിങ്ങളുടെ ആപ്പിലെ 12 അക്ക UPI റഫറൻസ് (UTR)', done: 'ഞാൻ പണമടച്ചു', monthly: 'ഇവിടെ UPI ID വഴി നൽകുന്നത് ഒറ്റത്തവണ സംഭാവനയാണ്. ഇത് എല്ലാ മാസവും ആവർത്തിക്കില്ല. പ്രതിമാസ സംഭാവനയ്ക്ക് ഫോമിലെ സംഭാവന ബട്ടൺ ഉപയോഗിക്കുക.' }
  };

  function init() {
    const form = $('#donForm'); if (!form || $('#upiCard')) return;
    const u = details(), card = document.createElement('div'); card.id = 'upiCard'; card.className = 'card card-body upi-card';
    const w = WORDS[G.lang()] || WORDS.en;
    card.setAttribute('data-notr', '');
    card.innerHTML = `<h4>📲 ${w.head}</h4><p class="upi-note">${w.note}</p>
      <div class="note" id="upiMonthly" style="margin-bottom:10px" hidden>${w.monthly}</div>
      ${u.dummy && !G.present ? `<div class="note"><b>${w.dummy}</b></div>` : ''}
      <div class="upi-grid"><img alt="UPI QR code" src="${u.qr || placeholder()}"><div>
        <div class="upi-id"><b id="upiId"></b> <button type="button" class="btn btn-ghost btn-sm" id="upiCopy">${w.copy}</button></div><div id="upiName" style="font-size:.84rem;color:#6b7280"></div>
        <p>${w.amount}: <b id="upiAmt"></b></p>
        ${u.dummy ? '' : '<a class="btn btn-ghost btn-sm" id="upiOpen" href="#">' + w.open + '</a>'}
        <div class="field"><label>${w.ref}</label><input id="upiUtr" inputmode="numeric" maxlength="12" placeholder="e.g. 123456789012"></div>
        <button type="button" class="btn btn-primary" id="upiDone">${w.done}</button></div></div>`;
    form.insertAdjacentElement('afterend', card);
    $('#upiId').textContent = u.id; $('#upiName').textContent = u.name;
    const amount = () => Number($('#dAmount').value) || 0;
    if (G.donDraft) $('#upiUtr').value = String(G.donDraft.saved._utr || '').replace(/\D/g, '').slice(0, 12);
    const paint = () => { const f = document.querySelector('.seg button.on'); $('#upiMonthly').hidden = !f || f.dataset.f !== 'MONTHLY'; $('#upiAmt').textContent = G.inr(amount()); const a = $('#upiOpen'); if (a) a.href = `upi://pay?pa=${encodeURIComponent(u.id)}&pn=${encodeURIComponent(u.name)}&am=${amount()}&cu=INR&tn=${encodeURIComponent('Donation')}`; };
    paint(); document.addEventListener('input', paint); document.addEventListener('click', () => setTimeout(paint, 0));
    $('#upiCopy').onclick = () => navigator.clipboard.writeText(u.id).then(() => G.toast('UPI ID copied', '📋'));
    $('#upiDone').onclick = async () => {
      if (!G.Auth.current()) { if (G.donDraft) G.donDraft.save(); return G.requireLogin('donate', 'donate.html'); }
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
      $('#upiUtr').value = ''; btn.disabled = false; if (G.donDraft) G.donDraft.clear();
      G.modal({ title: '⏳ Waiting to be checked', html: `<p>Thank you. We have noted your payment of <b>${G.inr(claim.amount)}</b> (reference ${G.esc(utr)}). A receipt appears in <a href="dashboard.html">your dashboard</a> after we confirm it in the bank statement.</p>` });
    };
  }
  G.upi = { details, DUMMY, ID, IMG };
  G.boot(() => { if (document.body.dataset.page === 'donate') init(); });
})();
