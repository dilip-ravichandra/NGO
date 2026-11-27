// Supabase Edge Function: sends the e-mails waiting in public.notification_queue through Resend.
// Secrets (Dashboard -> Edge Functions -> Secrets): RESEND_API_KEY, MAIL_FROM, ADMIN_ALERT_EMAIL, CRON_SECRET.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase. Plain text only, so nothing typed by a person is ever HTML.
const env = (k) => Deno.env.get(k) || '';

async function db(path, init = {}) {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const r = await fetch(env('SUPABASE_URL') + '/rest/v1/' + path, { ...init, headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  if (!r.ok) throw new Error('database ' + r.status);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
const clean = (s, n) => String(s || '').replace(/[\u0000-\u0008\u000B-\u001F]/g, ' ').slice(0, n);
const okMail = (m) => /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[A-Za-z]{2,}$/.test(m) && !/@(example\.com|invalid)$/i.test(m);

Deno.serve(async (req) => {
  if (!env('CRON_SECRET') || req.headers.get('x-cron-secret') !== env('CRON_SECRET')) return new Response('forbidden', { status: 403 });
  if (!env('RESEND_API_KEY')) return new Response('mail not configured', { status: 503 });
  const rows = await db('notification_queue?select=*&sent_at=is.null&attempts=lt.3&order=id.asc&limit=20');
  let sent = 0, failed = 0;
  for (const n of rows) {
    const to = n.to_email === 'ADMIN' ? env('ADMIN_ALERT_EMAIL') : n.to_email;
    let ok = false, why = 'no valid address';
    if (okMail(to)) {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: 'Bearer ' + env('RESEND_API_KEY'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env('MAIL_FROM') || 'onboarding@resend.dev', to: [to], subject: clean(n.subject, 150).replace(/\s+/g, ' '), text: clean(n.body, 4000) + '\n\nGreen India Gokul Foundation' })
      });
      ok = r.ok; why = ok ? '' : 'mail service ' + r.status;
    }
    await db('notification_queue?id=eq.' + Number(n.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(ok ? { sent_at: new Date().toISOString(), attempts: n.attempts + 1, last_error: null } : { attempts: n.attempts + 1, last_error: why }) });
    ok ? sent++ : failed++;
  }
  return new Response(JSON.stringify({ sent, failed }), { headers: { 'Content-Type': 'application/json' } });
});
