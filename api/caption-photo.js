'use strict';
// Vercel serverless function: POST /api/caption-photo  (admin-only: needs header x-admin-token = ADMIN_API_TOKEN)
const { handleCaption } = require('./_admin-ai');
module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'method_not_allowed' }); }
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || 'unknown';
  const out = await handleCaption({ body: req.body, ip, origin: req.headers.origin, env: process.env, headers: req.headers, loopback: false });
  res.setHeader('Cache-Control', 'no-store');
  return res.status(out.status).json(out.json);
};
