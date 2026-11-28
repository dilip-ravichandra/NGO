/** Login / sign-up / forgot password: one card with two tabs. */
import { useEffect, useRef, useState } from 'react';
import { G, CFG, t } from '../lib/gigf.js';
import { safeNext } from '../lib/routes.js';
import { V } from '../lib/validate.js';
import { toast } from '../ui/feedback.jsx';
import { A, go } from '../ui/nav.jsx';

const TITLES = { login: ['Welcome back', 'Sign in to your Gokul Foundation account'], signup: ['Join the movement', 'Create your free account in under a minute'], forgot: ['Reset password', 'We will help you get back in'] };
const RULES = [['len', (v) => v.length >= 8, <>At least <b>8 characters</b></>], ['upper', (v) => /[A-Z]/.test(v), <>One <b>capital letter</b> (A–Z)</>], ['num', (v) => /\d/.test(v), <>One <b>number</b> (0–9)</>], ['sym', (v) => /[^A-Za-z0-9\s]/.test(v), <>One <b>special character</b> (! @ # $ % & …)</>]];
const strong = (v) => G.Auth.passwordIssues(v).length === 0;
const PW_ERROR = 'Password must have at least 8 characters, one capital letter, one number and one special character';

function Msg({ msg, id }) {
  return <div className={'a-msg' + (msg ? ' show ' + msg.type : '')} id={id}>{msg ? msg.text : ''}</div>;
}
function AField({ label, icon, error, state, children, extra }) {
  return (
    <div className={'a-field' + (state === false ? ' bad' : state === true ? ' ok' : '')}>
      <label>{label}</label><div className="a-in"><i>{icon}</i>{children}</div>
      {extra}
      {error && <span className="err">{error}</span>}
    </div>
  );
}
function PasswordInput(props) {
  const [show, setShow] = useState(false);
  return <><input type={show ? 'text' : 'password'} {...props} /><button type="button" className="eye" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button></>;
}
function Rules({ value }) {
  return <ul className="pw-rules">{RULES.map(([key, test, label]) => <li key={key} className={test(value) ? 'ok' : value ? 'miss' : ''}>{label}</li>)}</ul>;
}
function Busy({ busy, text, children }) {
  return busy ? <><span className="spinner" /> {text}</> : children;
}

function GoogleButton({ role, done }) {
  const box = useRef(null);
  const roleRef = useRef(role);
  roleRef.current = role;
  useEffect(() => {
    const id = CFG.googleClientId;
    if (!id) return;
    const render = () => {
      if (!box.current || !window.google) return;
      box.current.textContent = '';
      window.google.accounts.id.initialize({ client_id: id, callback: async (resp) => { try { done(await G.Auth.googleLogin(resp.credential, roleRef.current)); } catch (err) { toast(err.message, '⚠️'); } } });
      window.google.accounts.id.renderButton(box.current, { theme: 'outline', size: 'large', width: Math.min(340, box.current.clientWidth || 340), text: 'continue_with' });
    };
    if (window.google) { render(); return; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
    script.onload = render;
    script.onerror = () => { if (box.current) box.current.textContent = 'Google sign-in could not load. Check your connection.'; };
    document.head.appendChild(script);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!CFG.googleClientId) return null;   // no client ID yet -> no dead button
  return <><div className="a-alt">or</div><div id="googleBtns" ref={box}><button type="button" className="a-ghost">🇬 Continue with Google</button></div></>;
}

export default function Auth({ route }) {
  const next = safeNext(new URLSearchParams(route.search).get('next'));
  const what = /^donate/i.test(next) ? 'donate' : /^volunteer/i.test(next) ? 'volunteer' : /^events/i.test(next) ? 'event' : '';
  const notice = what ? { type: 'info', text: '🔒 ' + t('auth.req.' + what + '.t') } : null;
  const wanted = route.page === 'signup' ? 'signup' : 'login';

  const [signedInAtStart] = useState(() => G.Auth.current());
  const [pane, setPane] = useState(wanted);
  const [mode, setMode] = useState('pw');
  const [role, setRole] = useState(what === 'volunteer' ? 'volunteer' : 'donor');
  const [loginMsg, setLoginMsg] = useState(notice);
  const [signupMsg, setSignupMsg] = useState(notice);
  const [forgotMsg, setForgotMsg] = useState(null);
  const [marks, setMarks] = useState({});
  const [busy, setBusy] = useState('');
  const [terms, setTerms] = useState(true);
  const [pw, setPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [otp, setOtp] = useState(null);       // { ticket, email }
  const [reset, setReset] = useState(null);   // { ticket, email }
  const first = useRef(null);

  useEffect(() => { setPane(wanted); setMarks({}); }, [wanted]);
  useEffect(() => {
    if (signedInAtStart) location.replace(/ADMIN/.test(signedInAtStart.role) ? 'admin.html' : '#dashboard');
  }, [signedInAtStart]);
  useEffect(() => {
    document.title = TITLES[pane][0] + ' | Green India Gokul Foundation';
    const timer = setTimeout(() => { const el = first.current && first.current.querySelector('.auth-pane.on input'); if (el) el.focus(); }, 250);
    return () => clearTimeout(timer);
  }, [pane]);

  const show = (name) => {
    setPane(name); setMarks({});
    if (name !== 'forgot') history.replaceState(null, '', '#' + name + route.search);
  };
  const done = (user) => {
    toast('Welcome, ' + user.name.split(' ')[0] + '!', '🙏');
    setTimeout(() => go(/ADMIN/.test(user.role) ? 'admin.html' : next || 'dashboard.html'), 700);
  };
  const mark = (results) => { setMarks((m) => ({ ...m, ...results })); return Object.values(results).every(Boolean); };

  const login = async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    if (!mark({ lEmail: V.email(f.email.value), lPw: f.password.value.length >= 6 })) return setLoginMsg({ type: 'error', text: 'Please fix the highlighted fields.' });
    setBusy('login');
    try { const user = await G.Auth.login(f.email.value, f.password.value); setLoginMsg({ type: 'success', text: 'Signed in! Redirecting…' }); done(user); } catch (err) { setLoginMsg({ type: 'error', text: err.message }); setBusy(''); }
  };
  const sendCode = async (e) => {
    const email = e.target.form.elements.mobile.value;
    if (!mark({ oEmail: V.email(email) })) return;
    setBusy('otp');
    try { const r = await G.Auth.codeSend('email', email, 'login'); setOtp({ ticket: r.ticket, email }); setLoginMsg({ type: 'info', text: r.devCode ? `LOCAL TEST MODE: code is ${r.devCode}` : 'We e-mailed a code to you. Check your inbox (and spam). It is valid for 10 minutes.' }); } catch (err) { setLoginMsg({ type: 'error', text: err.message }); }
    setBusy('');
  };
  const checkCode = async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    try { done(await G.Auth.otpLogin((otp && otp.email) || f.mobile.value, f.otp.value, otp && otp.ticket)); } catch (err) { setLoginMsg({ type: 'error', text: err.message }); }
  };
  const signup = async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    const ok = mark({ name: V.req(f.name.value), email: V.email(f.email.value), phone: V.phone(f.phone.value), password: strong(f.password.value), confirm: f.confirm.value === f.password.value && f.confirm.value.length > 0 });
    setTerms(f.terms.checked);
    if (!ok || !f.terms.checked) return setSignupMsg({ type: 'error', text: 'Please fix the highlighted fields.' });
    setBusy('signup');
    try {
      const user = await G.Auth.signup({ name: f.name.value.trim(), email: f.email.value, phone: f.phone.value.replace(/\D/g, '').slice(-10), password: f.password.value, role });
      if (!user) { setSignupMsg({ type: 'success', text: 'Almost done! We e-mailed you a confirmation link. Open it, then log in here.' }); setBusy(''); return; }
      setSignupMsg({ type: 'success', text: 'Account created! Redirecting…' }); done(user);
    } catch (err) { setSignupMsg({ type: 'error', text: err.message }); setBusy(''); }
  };
  const askReset = async (e) => {
    e.preventDefault();
    const email = e.target.elements.email.value;
    if (!mark({ fEmail: V.email(email) })) return;
    setBusy('forgot');
    try { const r = await G.Auth.codeSend('email', email, 'reset'); setReset({ ticket: r.ticket, email }); setForgotMsg({ type: 'info', text: r.devCode ? `LOCAL TEST MODE: code is ${r.devCode}` : 'We e-mailed a code to ' + email.trim() + '. Check your inbox (and spam). It is valid for 10 minutes.' }); } catch (err) { setForgotMsg({ type: 'error', text: err.message }); }
    setBusy('');
  };
  const doReset = async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    if (!mark({ fPw: strong(f.pw.value) })) return;
    try { await G.Auth.resetPassword(reset.email, f.code.value.trim(), reset.ticket, f.pw.value); toast('Password updated — please sign in.', '✅'); show('login'); } catch (err) { setForgotMsg({ type: 'error', text: err.message }); }
  };

  const main = pane === 'signup' ? 'signup' : 'login';
  const passed = RULES.filter(([, test]) => test(pw)).length;
  const level = pw ? Math.max(1, passed) : 0;
  const colour = ['#e5e7eb', '#ef4444', '#f59e0b', '#84cc16', '#16a34a'][level];
  const switchLink = (to, text, style) => <a href="#" onClick={(e) => { e.preventDefault(); show(to); }} style={style}>{text}</a>;

  return (
    <section className="auth-stage">
      {Array.from({ length: 14 }, (_, i) => <span key={i} className="leaf" style={{ left: ((i * 7.3) % 100) + '%', animationDuration: (9 + (i % 6) * 2) + 's', animationDelay: -(i * 1.7) + 's', fontSize: (1 + (i % 3) * 0.5) + 'rem' }}>{['🍃', '🌿', '🍀'][i % 3]}</span>)}
      <div className="auth-card" ref={first}>
        <img className="auth-logo" src="assets/logo-emblem.svg" alt="Green India Gokul Foundation emblem" />
        <h2 id="authTitle">{TITLES[pane][0]}</h2><p className="sub" id="authSub">{TITLES[pane][1]}</p>
        <div className={'auth-tabs' + (main === 'signup' ? ' signup' : '')} style={pane === 'forgot' ? { display: 'none' } : undefined}>
          <span className="glider" />
          <button type="button" data-t="login" className={main === 'login' ? 'on' : ''} onClick={() => show('login')}>🔑 Login</button>
          <button type="button" data-t="signup" className={main === 'signup' ? 'on' : ''} onClick={() => show('signup')}>✨ Sign Up</button>
        </div>

        <div className={'auth-pane' + (pane === 'login' ? ' on' : '')} id="paneLogin">
          <Msg msg={loginMsg} id="loginMsg" />
          <div className="mode-pills">
            <button type="button" className={mode === 'pw' ? 'on' : ''} data-m="pw" onClick={() => setMode('pw')}>🔒 Password</button>
            <button type="button" className={mode === 'otp' ? 'on' : ''} data-m="otp" onClick={() => setMode('otp')}>✉️ Email code</button>
          </div>
          <form id="loginPw" noValidate onSubmit={login} style={mode === 'pw' ? undefined : { display: 'none' }}>
            <AField label="Email" icon="✉️" error="Enter a valid email" state={marks.lEmail}><input name="email" type="email" placeholder="you@example.com" autoComplete="username" /></AField>
            <AField label="Password" icon="🔒" error="Password must be at least 6 characters" state={marks.lPw}><PasswordInput name="password" placeholder="Your password" autoComplete="current-password" /></AField>
            <div className="a-row"><label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" /> Remember me</label>{switchLink('forgot', 'Forgot password?')}</div>
            <button className="a-btn" type="submit" disabled={busy === 'login'}><Busy busy={busy === 'login'} text="Signing in…">Sign In →</Busy></button>
          </form>
          <form id="loginOtp" noValidate onSubmit={checkCode} style={mode === 'otp' ? undefined : { display: 'none' }}>
            <AField label="Email" icon="✉️" error="Enter a valid email" state={marks.oEmail}><input name="mobile" type="email" placeholder="you@example.com" /></AField>
            <button className="a-ghost" type="button" id="otpSend" disabled={busy === 'otp'} onClick={sendCode}><Busy busy={busy === 'otp'} text="Sending…">Email me a code</Busy></button>
            <div id="otpStep2" style={{ display: otp ? undefined : 'none', marginTop: 14 }}>
              <AField label="Code from your email" icon="🔢"><input name="otp" inputMode="numeric" maxLength={10} placeholder="••••••" /></AField>
              <button className="a-btn" type="submit">Verify & Sign In →</button>
            </div>
          </form>
          <GoogleButton role={role} done={done} />
          <p className="auth-foot">New here? {switchLink('signup', 'Create a free account', { color: '#ea580c', fontWeight: 700 })}</p>
        </div>

        <div className={'auth-pane' + (pane === 'signup' ? ' on' : '')} id="paneSignup">
          <Msg msg={signupMsg} id="signupMsg" />
          <form id="signupForm" noValidate onSubmit={signup}>
            <div className="a-field"><label>I want to join as</label><div className="roles">
              {[['donor', '💚', 'Donor'], ['volunteer', '🤝', 'Volunteer'], ['member', '🌱', 'Member']].map(([key, icon, text]) => <button type="button" key={key} className={'role' + (role === key ? ' on' : '')} data-r={key} onClick={() => setRole(key)}><b>{icon}</b>{text}</button>)}
            </div></div>
            <AField label="Full name" icon="👤" error="Please enter your name" state={marks.name}><input name="name" placeholder="Your full name" autoComplete="name" /></AField>
            <AField label="Email" icon="✉️" error="Enter a valid email" state={marks.email}><input name="email" type="email" placeholder="you@example.com" autoComplete="email" /></AField>
            <AField label="Mobile number" icon="📱" error="Enter a valid 10-digit mobile" state={marks.phone}><input name="phone" inputMode="tel" placeholder="9XXXXXXXXX" autoComplete="tel" /></AField>
            <AField label="Password" icon="🔒" error={PW_ERROR} state={marks.password} extra={<>
              <div className="pw-meter">{[0, 1, 2, 3].map((i) => <i key={i} style={{ background: i < level ? colour : '#e5e7eb' }} />)}</div>
              <div className="pw-hint" id="pwLabel" style={passed === 4 ? { color: '#16a34a' } : undefined}>{!pw ? 'Create a strong password' : passed === 4 ? '✔ Strong password' : ['', 'Weak', 'Fair', 'Almost there'][Math.max(1, passed)] + ' — meet all 4 rules below'}</div>
              <Rules value={pw} />
            </>}><PasswordInput id="suPw" name="password" placeholder="Create a password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></AField>
            <AField label="Confirm password" icon="🔁" error="Passwords do not match" state={marks.confirm}><input name="confirm" type="password" placeholder="Repeat password" autoComplete="new-password" /></AField>
            <label style={{ display: 'flex', gap: 8, fontSize: '.8rem', alignItems: 'flex-start', marginBottom: 4 }}><input type="checkbox" name="terms" style={{ marginTop: 3 }} /> <span>I agree to the <A to="terms.html" target="_blank" rel="noopener">Terms</A> & <A to="privacy.html" target="_blank" rel="noopener">Privacy Policy</A></span></label>
            <div id="termsErr" style={{ display: terms ? 'none' : 'block', color: '#dc2626', fontSize: '.74rem', marginBottom: 8 }}>Please accept to continue</div>
            <button className="a-btn orange" type="submit" style={{ marginTop: 10 }} disabled={busy === 'signup'}><Busy busy={busy === 'signup'} text="Creating account…">Create Account →</Busy></button>
          </form>
          <p className="auth-foot">Already registered? {switchLink('login', 'Sign in', { color: 'var(--primary)', fontWeight: 700 })}</p>
        </div>

        <div className={'auth-pane' + (pane === 'forgot' ? ' on' : '')} id="paneForgot">
          <Msg msg={forgotMsg} id="forgotMsg" />
          <form id="forgotReq" noValidate onSubmit={askReset}>
            <AField label="Registered email" icon="✉️" error="Enter a valid email" state={marks.fEmail}><input name="email" type="email" placeholder="you@example.com" /></AField>
            <button className="a-ghost" type="submit" disabled={busy === 'forgot'}><Busy busy={busy === 'forgot'} text="Sending…">Send reset code</Busy></button>
          </form>
          <form id="forgotConf" noValidate onSubmit={doReset}>
            <div id="forgotStep2" style={{ display: reset ? undefined : 'none', marginTop: 14 }}>
              <AField label="Reset code" icon="🔢"><input name="code" inputMode="numeric" maxLength={10} /></AField>
              <AField label="New password" icon="🔒" error={PW_ERROR} state={marks.fPw} extra={<Rules value={newPw} />}><input id="fgPw" name="pw" type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} /></AField>
              <button className="a-btn" type="submit">Update password</button>
            </div>
          </form>
          <p className="auth-foot">{switchLink('login', '← Back to sign in', { color: 'var(--primary)', fontWeight: 700 })}</p>
        </div>
      </div>
    </section>
  );
}
