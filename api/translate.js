'use strict';
// Vercel serverless function: POST /api/translate  (uses the same GROQ_API_KEY environment variable)
const { handleTranslate } = require('./_chat-core');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'method_not_allowed' }); }
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || 'unknown';
  const out = await handleTranslate({ body: req.body, ip, origin: req.headers.origin, env: process.env });
  res.setHeader('Cache-Control', 'no-store');
  return res.status(out.status).json(out.json);
};
