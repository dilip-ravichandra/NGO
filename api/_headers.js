'use strict';
/**
 * Security headers. Single source of truth for dev-server.js; vercel.json repeats the same values for production
 * (and every page also carries the CSP as a <meta> tag so static hosts such as GitHub Pages get it too).
 *
 * If you add a third-party service you must allow it here AND in vercel.json / build.py, e.g. Razorpay checkout:
 *   script-src += https://checkout.razorpay.com      frame-src += https://api.razorpay.com
 * and if the API lives on another domain: connect-src += https://api.yourdomain.org
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://accounts.google.com/gsi/client",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.googleusercontent.com https://hbnwugmdivvjoebevbgv.supabase.co",
  "media-src 'self' blob: https://hbnwugmdivvjoebevbgv.supabase.co",
  "connect-src 'self' https://accounts.google.com/gsi/ https://hbnwugmdivvjoebevbgv.supabase.co",
  "frame-src https://www.google.com https://accounts.google.com/gsi/",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join('; ');

const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(self), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups'
};
module.exports = { CSP, SECURITY_HEADERS };
