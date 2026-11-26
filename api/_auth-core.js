'use strict';
/**
 * Real one-time codes by e-mail / SMS, and Google sign-in verification.
 * POST /api/auth   { action: 'otp-send' | 'otp-verify' | 'google', ... }
 *
 * Stateless: the server never stores codes. 'otp-send' returns a signed ticket (HMAC of target+expiry+code, keyed with AUTH_SECRET);
 * 'otp-verify' recomputes it. The code itself only ever travels inside the e-mail / SMS.
 *
 * Needs (see .env.example):  AUTH_SECRET  +  RESEND_API_KEY (e-mail)  and/or  TWILIO_* (SMS)  +  GOOGLE_CLIENT_ID (Google).
 */
const crypto = require('crypto');
const DEV_SECRET = crypto.randomBytes(32).toString('hex');   // only used when AUTH_SECRET is not set (local dev; codes then die on restart)
const hmac = (env, s) => crypto.createHmac('sha256', env.AUTH_SECRET || DEV_SECRET).update(s).digest('base64url');
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

const hits = new Map();
function limited(key, max, ms) {
  const n = Date.now(), a = (hits.get(key) || []).filter((t) => n - t < ms);
  if (a.length >= max) { hits.set(key, a); return true; }
  a.push(n); hits.set(key, a); if (hits.size > 5000) hits.clear(); return false;
}

const EMAIL = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[A-Za-z]{2,}$/;
const normTo = (channel, to) => {
  to = String(to || '').trim();
  if (channel === 'email') return EMAIL.test(to) && to.length <= 254 ? to.toLowerCase() : '';
  if (channel === 'sms') { const d = to.replace(/\D/g, '').slice(-10); return /^[6-9]\d{9}$/.test(d) ? d : ''; }
  return '';
};

async function sendEmail(env, to, code, purpose) {
  if (!env.RESEND_API_KEY) return null;
  const why = purpose === 'reset' ? 'reset your password' : 'sign in';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'Green India Gokul Foundation <onboarding@resend.dev>', to: [to], subject: 'Your verification code: ' + code,
      text: `Your Green India Gokul Foundation code to ${why} is ${code}. It is valid for 10 minutes. If you did not ask for it, ignore this e-mail.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:420px"><h2 style="color:#166534">Green India Gokul Foundation</h2><p>Your code to ${why}:</p><p style="font-size:30px;letter-spacing:6px;font-weight:700">${code}</p><p style="color:#555">Valid for 10 minutes. If you did not ask for it, ignore this e-mail.</p></div>`
    }), signal: AbortSignal.timeout(12000)
  }).catch(() => null);
  return !!(r && r.ok);
}
async function sendSms(env, tenDigits, code) {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !(env.TWILIO_FROM || env.TWILIO_MESSAGING_SERVICE_SID)) return null;
  const body = new URLSearchParams({ To: '+91' + tenDigits, Body: `${code} is your Green India Gokul Foundation verification code. Valid for 10 minutes. Do not share it.` });
  if (env.TWILIO_MESSAGING_SERVICE_SID) body.set('MessagingServiceSid', env.TWILIO_MESSAGING_SERVICE_SID); else body.set('From', env.TWILIO_FROM);
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(env.TWILIO_ACCOUNT_SID)}/Messages.json`, {
    method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(env.TWILIO_ACCOUNT_SID + ':' + env.TWILIO_AUTH_TOKEN).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body, signal: AbortSignal.timeout(12000)
  }).catch(() => null);
  return !!(r && r.ok);
}

async function handleAuth({ body, ip, origin, env, loopback }) {
  const J = (status, json) => ({ status, json });
  if (!body || typeof body !== 'object') return J(400, { error: 'bad_request' });
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (allowed.length && origin && !allowed.includes(origin)) return J(403, { error: 'forbidden' });
  if (env.VERCEL && !env.AUTH_SECRET) return J(503, { error: 'not_configured', detail: 'AUTH_SECRET is not set' });

  if (body.action === 'otp-send') {
    const channel = body.channel === 'sms' ? 'sms' : body.channel === 'email' ? 'email' : '', to = normTo(channel, body.to);
    const purpose = body.purpose === 'reset' ? 'reset' : 'login';
    if (!to) return J(400, { error: 'bad_target' });
    if (limited('s-ip:' + ip, 10, 600000) || limited('s-to:' + channel + to, 3, 600000)) return J(429, { error: 'too_many_requests' });
    // the endpoint is public (there is no server-side user list yet), so cap total sends to protect the mail quota
    if (limited('s-day', Number(env.AUTH_DAILY_CAP) || 200, 86400000)) return J(429, { error: 'too_many_requests' });
    const code = String(crypto.randomInt(100000, 1000000)), exp = Date.now() + 10 * 60000;
    const ticket = exp + '.' + hmac(env, [channel, to, exp, code].join('|'));
    const sent = channel === 'email' ? await sendEmail(env, to, code, purpose) : await sendSms(env, to, code);
    if (sent === true) return J(200, { ok: true, ticket });
    if (sent === null) {   // provider not configured
      if (env.AUTH_DEV_ECHO === '1' && loopback) return J(200, { ok: true, ticket, devCode: code });   // local testing only
      return J(503, { error: 'delivery_not_configured' });
    }
    return J(502, { error: 'delivery_failed' });
  }

  if (body.action === 'otp-verify') {
    const channel = body.channel === 'sms' ? 'sms' : body.channel === 'email' ? 'email' : '', to = normTo(channel, body.to);
    const code = String(body.code || '').trim(), [exp, sig] = String(body.ticket || '').split('.');
    if (!to || !/^\d{6}$/.test(code) || !exp || !sig) return J(400, { error: 'bad_request' });
    if (limited('v-ip:' + ip, 30, 600000) || limited('v-to:' + channel + to, 8, 600000)) return J(429, { error: 'too_many_requests' });
    if (Number(exp) < Date.now()) return J(400, { error: 'expired' });
    if (!same(sig, hmac(env, [channel, to, exp, code].join('|')))) return J(400, { error: 'wrong_code' });
    return J(200, { ok: true });
  }

  if (body.action === 'google') {
    if (!env.GOOGLE_CLIENT_ID) return J(503, { error: 'not_configured' });
    const cred = String(body.credential || '');
    if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(cred) || cred.length > 4000) return J(400, { error: 'bad_request' });
    if (limited('g-ip:' + ip, 20, 600000)) return J(429, { error: 'too_many_requests' });
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(cred), { signal: AbortSignal.timeout(10000) }).catch(() => null);
    const t = r && r.ok ? await r.json().catch(() => null) : null;
    if (!t || t.aud !== env.GOOGLE_CLIENT_ID || !/^(https:\/\/)?accounts\.google\.com$/.test(t.iss || '') || String(t.email_verified) !== 'true' || Number(t.exp) * 1000 < Date.now() || !t.email) return J(401, { error: 'invalid_token' });
    return J(200, { ok: true, email: String(t.email).toLowerCase(), name: String(t.name || t.email.split('@')[0]).slice(0, 80) });
  }
  return J(400, { error: 'bad_request' });
}
module.exports = { handleAuth };
