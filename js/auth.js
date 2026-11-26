/** Login / Sign-up page controller (one centred card, two tabs). Uses GIGF.Auth (demo layer → /api/auth/* in production). */
(function () {
  const G = window.GIGF, $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  G.boot(() => {
    if (G.Auth.current()) { location.replace(/ADMIN/.test(G.Auth.current().role) ? 'admin.html' : 'dashboard.html'); return; }
    const stage = $('.auth-stage');
    // falling leaves
    stage.insertAdjacentHTML('afterbegin', Array.from({ length: 14 }, (_, i) => `<span class="leaf" style="left:${(i * 7.3) % 100}%;animation-duration:${9 + (i % 6) * 2}s;animation-delay:${-(i * 1.7)}s;font-size:${1 + (i % 3) * .5}rem">${['🍃', '🌿', '🍀'][i % 3]}</span>`).join(''));

    const tabs = $('.auth-tabs'), panes = { login: $('#paneLogin'), signup: $('#paneSignup'), forgot: $('#paneForgot') };
    const titles = { login: ['Welcome back', 'Sign in to your Gokul Foundation account'], signup: ['Join the movement', 'Create your free account in under a minute'], forgot: ['Reset password', 'We will help you get back in'] };
    function msg(id, text, type) { const m = $('#' + id); m.textContent = text; m.className = 'a-msg show ' + type; }
    function show(name, push) {
      Object.entries(panes).forEach(([k, p]) => p.classList.toggle('on', k === name));
      const main = name === 'signup' ? 'signup' : 'login';
      tabs.classList.toggle('signup', main === 'signup'); tabs.style.display = name === 'forgot' ? 'none' : '';
      $$('.auth-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === main));
      $('#authTitle').textContent = titles[name][0]; $('#authSub').textContent = titles[name][1];
      document.title = titles[name][0] + ' | Green India Gokul Foundation';
      if (push && name !== 'forgot') history.replaceState(null, '', main + '.html' + location.search);
      const first = $('input', panes[name]); first && setTimeout(() => first.focus(), 250);
    }
    show(document.body.dataset.page === 'signup' ? 'signup' : 'login');
    $$('.auth-tabs button').forEach((b) => (b.onclick = () => show(b.dataset.t, true)));
    $$('[data-goto]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); show(a.dataset.goto, true); }));

    // field helpers
    const fld = (el, ok) => { const f = el.closest('.a-field'); f.classList.toggle('bad', !ok); f.classList.toggle('ok', ok && el.value.length > 0); return ok; };
    $$('.eye').forEach((b) => (b.onclick = () => { const i = b.parentElement.querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; b.textContent = i.type === 'password' ? 'Show' : 'Hide'; }));
    const email = (v) => /^\S+@\S+\.\S+$/.test(v.trim()), phone = (v) => /^[6-9]\d{9}$/.test(v.replace(/\D/g, '').slice(-10));
    const busy = (btn, on, txt) => { btn.disabled = on; if (on) { btn.dataset.t = btn.textContent; btn.innerHTML = '<span class="spinner"></span> ' + (txt || 'Please wait…'); } else btn.textContent = btn.dataset.t; };
    const NEXT = (() => { const n = new URLSearchParams(location.search).get('next') || ''; return /^[a-z0-9_-]+\.html(\?[\w=&%.~-]*)?(#[\w-]*)?$/i.test(n) && !/^(login|signup)\.html/i.test(n) ? n : ''; })();
    let PRE_ROLE = '';
    const go = (u) => { G.toast('Welcome, ' + u.name.split(' ')[0] + '!', '🙏'); setTimeout(() => (location.href = /ADMIN/.test(u.role) ? 'admin.html' : NEXT || 'dashboard.html'), 700); };
    // tell the visitor why they are here, and pre-select a matching role
    if (NEXT) {
      const what = /^donate/i.test(NEXT) ? 'donate' : /^volunteer/i.test(NEXT) ? 'volunteer' : /^events/i.test(NEXT) ? 'event' : '';
      if (what) { const box = $('#loginMsg'); box.textContent = '🔒 ' + G.t('auth.req.' + what + '.t'); box.className = 'a-msg show info'; const sb = $('#signupMsg'); sb.textContent = '🔒 ' + G.t('auth.req.' + what + '.t'); sb.className = 'a-msg show info'; }
      const pre = /^volunteer/i.test(NEXT) ? 'volunteer' : /^donate/i.test(NEXT) ? 'donor' : '';
      PRE_ROLE = pre;
    }

    /* ---- login: password / OTP modes ---- */
    $$('.mode-pills button').forEach((b) => (b.onclick = () => { $$('.mode-pills button').forEach((x) => x.classList.toggle('on', x === b)); $('#loginPw').style.display = b.dataset.m === 'pw' ? '' : 'none'; $('#loginOtp').style.display = b.dataset.m === 'otp' ? '' : 'none'; }));
    $('#loginPw').addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target, btn = $('button[type=submit]', f);
      const ok = [fld(f.email, email(f.email.value)), fld(f.password, f.password.value.length >= 6)].every(Boolean); if (!ok) return msg('loginMsg', 'Please fix the highlighted fields.', 'error');
      busy(btn, true, 'Signing in…');
      try { const u = await G.Auth.login(f.email.value, f.password.value); msg('loginMsg', 'Signed in! Redirecting…', 'success'); go(u); } catch (err) { msg('loginMsg', err.message, 'error'); busy(btn, false); }
    });
    let otpTicket = '', otpPhone = '';
    $('#otpSend').onclick = async () => {
      const f = $('#loginOtp'), btn = $('#otpSend'); if (!fld(f.mobile, email(f.mobile.value))) return;
      busy(btn, true, 'Sending…');
      try { const r = await G.Auth.codeSend('email', f.mobile.value, 'login'); otpTicket = r.ticket; otpPhone = f.mobile.value; $('#otpStep2').style.display = ''; msg('loginMsg', r.devCode ? `LOCAL TEST MODE: code is ${r.devCode}` : 'We e-mailed a code to you. Check your inbox (and spam). It is valid for 10 minutes.', 'info'); f.otp.focus(); } catch (err) { msg('loginMsg', err.message, 'error'); }
      busy(btn, false);
    };
    $('#loginOtp').addEventListener('submit', async (e) => { e.preventDefault(); try { const u = await G.Auth.otpLogin(otpPhone || e.target.mobile.value, e.target.otp.value, otpTicket); go(u); } catch (err) { msg('loginMsg', err.message, 'error'); } });
    /* ---- Google ---- */
    (function google() {
      const box = $('#googleBtns'), id = (window.GIGF_CONFIG || {}).googleClientId;
      if (!id) { box.style.display = 'none'; const alt = box.previousElementSibling; if (alt && alt.classList.contains('a-alt')) alt.style.display = 'none'; return; }   // no client ID yet -> no dead button
      const sc = document.createElement('script'); sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true;
      sc.onload = () => {
        box.innerHTML = '';
        google_ = window.google.accounts.id;
        google_.initialize({ client_id: id, callback: async (resp) => { try { const u = await G.Auth.googleLogin(resp.credential, role); go(u); } catch (err) { G.toast(err.message, '⚠️'); } } });
        google_.renderButton(box, { theme: 'outline', size: 'large', width: Math.min(340, box.clientWidth || 340), text: 'continue_with' });
      };
      let google_; sc.onerror = () => { box.innerHTML = '<small>Google sign-in could not load. Check your connection.</small>'; };
      document.head.appendChild(sc);
    })();

    /* ---- signup ---- */
    let role = 'donor';
    $$('.role').forEach((r) => (r.onclick = () => { role = r.dataset.r; $$('.role').forEach((x) => x.classList.toggle('on', x === r)); }));
    if (PRE_ROLE) { const tile = $('.role[data-r=' + PRE_ROLE + ']'); tile && tile.click(); }
    /* live password rules: 8+ chars, capital letter, number, special character */
    const RULES = { len: (v) => v.length >= 8, upper: (v) => /[A-Z]/.test(v), num: (v) => /\d/.test(v), sym: (v) => /[^A-Za-z0-9\s]/.test(v) };
    const meter = $$('.pw-meter i'), hint = $('#pwLabel');
    function paintRules(input) {
      const ul = $('.pw-rules[data-for=' + input.id + ']'), v = input.value; let ok = 0;
      $$('li', ul).forEach((li) => { const pass = RULES[li.dataset.r](v); li.classList.toggle('ok', pass); li.classList.toggle('miss', !pass && v.length > 0); if (pass) ok++; });
      return ok;
    }
    $('#suPw').addEventListener('input', (e) => {
      const v = e.target.value, ok = paintRules(e.target), lvl = v ? Math.max(1, ok) : 0;
      const col = ['#e5e7eb', '#ef4444', '#f59e0b', '#84cc16', '#16a34a'][lvl];
      meter.forEach((m, i) => (m.style.background = i < lvl ? col : '#e5e7eb'));
      hint.textContent = !v ? 'Create a strong password' : ok === 4 ? '✔ Strong password' : ['', 'Weak', 'Fair', 'Almost there'][Math.max(1, ok)] + ' — meet all 4 rules below';
      hint.style.color = ok === 4 ? '#16a34a' : '';
    });
    $('#fgPw').addEventListener('input', (e) => paintRules(e.target));
    const strongEnough = (v) => G.Auth.passwordIssues(v).length === 0;
    $('#signupForm').addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target, btn = $('button[type=submit]', f);
      const ok = [fld(f.name, f.name.value.trim().length > 1), fld(f.email, email(f.email.value)), fld(f.phone, phone(f.phone.value)), fld(f.password, strongEnough(f.password.value)), fld(f.confirm, f.confirm.value === f.password.value && f.confirm.value.length > 0)].every(Boolean);
      const terms = f.terms.checked; $('#termsErr').style.display = terms ? 'none' : 'block';
      if (!ok || !terms) return msg('signupMsg', 'Please fix the highlighted fields.', 'error');
      busy(btn, true, 'Creating account…');
      try { const u = await G.Auth.signup({ name: f.name.value.trim(), email: f.email.value, phone: f.phone.value.replace(/\D/g, '').slice(-10), password: f.password.value, role }); if (!u) { msg('signupMsg', 'Almost done! We e-mailed you a confirmation link. Open it, then log in here.', 'success'); busy(btn, false); return; } msg('signupMsg', 'Account created! Redirecting…', 'success'); go(u); } catch (err) { msg('signupMsg', err.message, 'error'); busy(btn, false); }
    });

    /* ---- forgot password: the code is e-mailed by the server ---- */
    let fgTicket = '';
    $('#forgotReq').addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target, btn = $('button[type=submit]', f); if (!fld(f.email, email(f.email.value))) return;
      busy(btn, true, 'Sending…');
      try { const r = await G.Auth.codeSend('email', f.email.value, 'reset'); fgTicket = r.ticket; $('#forgotStep2').style.display = ''; msg('forgotMsg', r.devCode ? `LOCAL TEST MODE: code is ${r.devCode}` : 'We e-mailed a code to ' + f.email.value.trim() + '. Check your inbox (and spam). It is valid for 10 minutes.', 'info'); } catch (err) { msg('forgotMsg', err.message, 'error'); }
      busy(btn, false);
    });
    $('#forgotConf').addEventListener('submit', async (e) => { e.preventDefault(); const f = e.target, em = $('#forgotReq').email.value; if (!fld(f.pw, strongEnough(f.pw.value))) return; try { await G.Auth.resetPassword(em, f.code.value.trim(), fgTicket, f.pw.value); G.toast('Password updated — please sign in.', '✅'); show('login', true); } catch (err) { msg('forgotMsg', err.message, 'error'); } });
  });
})();
