/** Deployment config (safe to commit — contains NO secrets). */
window.GIGF_CONFIG = Object.assign({
  chatApi: '/api/chat',   // server-side Groq proxy. If it is not reachable the chatbot silently falls back to built-in answers.
  translateApi: '/api/translate',   // server-side Groq translator (auto-translate for Kannada / Hindi)
  extractApi: '/api/extract-event',   // admin-only: poster / text -> event draft
  triageApi: '/api/triage',           // admin-only: support-message triage
  authApi: '/api/auth',               // e-mail / SMS one-time codes + Google sign-in check
  googleClientId: '894616089411-24erpj1pl72eo7itj73j0aslnt6j2iss.apps.googleusercontent.com',                 // public Google OAuth Web client ID (ends .apps.googleusercontent.com). Empty = Google button explains it is not set up
  supabaseUrl: 'https://hbnwugmdivvjoebevbgv.supabase.co',   // accounts live in Supabase. Empty = browser-only demo accounts
  supabaseKey: 'sb_publishable_3xyaMHP7fwlAVmy62ndQgA_HaJN6CBR',   // publishable key: safe in the browser, access is limited by the database rules
  demoAdmin: false,                   // true = allow the DEMO admin portal on a public host (NOT safe; local use only)
  apiBase: '',            // future backend base URL (payments etc.)
  razorpayKey: ''         // public Razorpay key id (when merchant account is ready)
}, window.GIGF_CONFIG || {});
