'use strict';
// Vercel serverless function: POST /api/auth  (e-mail / SMS one-time codes + Google sign-in verification)
const { handleAuth } = require('./_auth-core');
module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'method_not_allowed' }); }
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || 'unknown';
  const out = await handleAuth({ body: req.body, ip, origin: req.headers.origin, env: process.env, loopback: false });
  res.setHeader('Cache-Control', 'no-store');
  return res.status(out.status).json(out.json);
};
