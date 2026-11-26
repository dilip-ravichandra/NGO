'use strict';
// Vercel serverless function: POST /api/chat   (set GROQ_API_KEY in the Vercel project's Environment Variables)
const { handleChat } = require('./_chat-core');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'method_not_allowed' }); }
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || 'unknown';
  const out = await handleChat({ body: req.body, ip, origin: req.headers.origin, env: process.env });
  res.setHeader('Cache-Control', 'no-store');
  return res.status(out.status).json(out.json);
};
