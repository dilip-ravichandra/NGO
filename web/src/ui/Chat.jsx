/**
 * "Gokul Sewa Mitra": answers through the server-side AI when it is reachable, otherwise from built-in answers
 * made from the site's own data. Payment questions never go to the AI.
 */
import { useEffect, useRef, useState } from 'react';
import { G, CFG, t, tr } from '../lib/gigf.js';
import { upcoming } from './common.jsx';

const PAYMENT_WORDS = ['payment', 'failed', 'deducted', 'not received', 'ಪಾವತಿ', 'भुगतान', 'paid but', 'refund', 'money back', 'charged twice', 'complaint', 'ಮರುಪಾವತಿ', 'रिफंड', 'वापसी'];
const has = (s, words) => words.some((w) => s.includes(w));
const Tx = (en, kn, hi) => ({ en, kn, hi }[G.lang()] || en);
const PAGES = /\b(donate|volunteer|events|gallery|programs|contact|awareness|environment)\.html\b/g;

/** AI text -> safe HTML: everything is escaped first, then only bold, line breaks and our own page links are added */
const formatReply = (txt) => G.esc(String(txt)
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/(?:https?:\/\/|www\.)\S+/gi, '')
  .replace(/^\s{0,3}#{1,6}\s*(.+)$/gm, '**$1**')
  .replace(/^\s*[-*•]\s+/gm, '• ')
  .replace(/`([^`]+)`/g, '$1').replace(/\|/g, ' '))
  .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(PAGES, '<a href="$1.html">$1.html</a>').replace(/\n{3,}/g, '\n\n').replace(/\n/g, '<br>');

/** built-in answers. Returns { html?, ticket?: prefill, delay? }. Every inserted value is escaped. */
function builtInAnswer(text, key) {
  const s = (key || text).toLowerCase(), o = G.ORG, esc = G.esc;
  const call = `<a href="tel:${o.phones[0].tel}">${o.phones[0].display}</a>`;
  if (key === 'admin') return { ticket: '' };
  if (!key && /^\s*(hi+|hello|hey|namaste|good (morning|afternoon|evening)|ನಮಸ್ಕಾರ|नमस्ते|வணக்கம்|నమస్కారం)[\s!.?]*$/i.test(text)) return { html: Tx('Hello! 👋 I can help you find upcoming events, donate, volunteer, or learn about our programs. What would you like to know?', 'ನಮಸ್ಕಾರ! 👋 ಕಾರ್ಯಕ್ರಮಗಳು, ದೇಣಿಗೆ, ಸ್ವಯಂಸೇವೆ ಅಥವಾ ನಮ್ಮ ಯೋಜನೆಗಳ ಬಗ್ಗೆ ನಾನು ಸಹಾಯ ಮಾಡಬಲ್ಲೆ. ಏನು ತಿಳಿಯಬೇಕು?', 'नमस्ते! 👋 मैं आयोजन, दान, स्वयंसेवा या हमारे कार्यक्रमों में मदद कर सकता हूँ। आप क्या जानना चाहेंगे?') };
  if (key === 'payment' || has(s, PAYMENT_WORDS)) {
    if (G.Auth.current()) {
      const mine = G.Donations.mine().slice(0, 3);
      if (!mine.length) return { ticket: '' };
      return { html: Tx('Your latest donations:', 'ನಿಮ್ಮ ಇತ್ತೀಚಿನ ದೇಣಿಗೆಗಳು:', 'आपके हाल के दान:') + '<ul class="chat-list">' + mine.map((d) => `<li>${G.inr(d.amount)} · ${esc(d.program)} · <b>${esc(d.status)}</b>${d.receiptNo ? ' · ' + esc(d.receiptNo) : ''}</li>`).join('') + '</ul>' + Tx('If something looks wrong you can raise a ticket from My Dashboard, or talk to our team:', 'ಏನಾದರೂ ತಪ್ಪಾಗಿದ್ದರೆ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ನಲ್ಲಿ ಟಿಕೆಟ್ ರಚಿಸಿ ಅಥವಾ ತಂಡವನ್ನು ಸಂಪರ್ಕಿಸಿ:', 'कुछ गलत लगे तो डैशबोर्ड से टिकट बनाएँ या टीम से बात करें:') };
    }
    return { html: Tx('Please <a href="login.html">log in</a> so I can check your donations securely. If the money was debited but you got no receipt, tap below and our team will resolve it.', 'ದಯವಿಟ್ಟು <a href="login.html">ಲಾಗಿನ್</a> ಮಾಡಿ. ಹಣ ಕಡಿತವಾಗಿ ರಸೀದಿ ಬಂದಿಲ್ಲದಿದ್ದರೆ ಕೆಳಗೆ ಒತ್ತಿ.', 'कृपया <a href="login.html">लॉग इन</a> करें ताकि मैं आपके दान सुरक्षित रूप से देख सकूँ। राशि कटी पर रसीद नहीं मिली तो नीचे दबाएँ।'), ticket: 'Payment issue: ', delay: 700 };
  }
  if (has(s, ['80g', 'tax', 'receipt', 'ರಸೀದಿ', 'रसीद', 'कर'])) {
    const st = G.DB.settings();
    return { html: Tx(`A receipt with a sequential number is generated for every successful donation. Add your PAN while donating so it can be printed on the receipt. ${st.reg80G ? 'Our 80G registration: <b>' + esc(st.reg80G) + '</b>.' : 'Our 80G/12A registration details will be shown here once configured by the Foundation — please confirm with our team before claiming a deduction.'}`,
      'ಪ್ರತಿ ಯಶಸ್ವಿ ದೇಣಿಗೆಗೆ ಕ್ರಮಸಂಖ್ಯೆಯ ರಸೀದಿ ರಚನೆಯಾಗುತ್ತದೆ. ರಸೀದಿಯಲ್ಲಿ PAN ಬರಲು ದೇಣಿಗೆ ಸಮಯದಲ್ಲಿ ನಮೂದಿಸಿ. 80G ವಿವರಗಳಿಗಾಗಿ ನಮ್ಮ ತಂಡವನ್ನು ಸಂಪರ್ಕಿಸಿ.',
      'हर सफल दान पर क्रमांक वाली रसीद बनती है। रसीद पर PAN के लिए दान करते समय दर्ज करें। 80G विवरण के लिए कृपया हमारी टीम से पुष्टि करें।') };
  }
  if (has(s, ['donat', 'ದೇಣಿಗೆ', 'दान', 'money', 'upi', 'sponsor'])) return { html: Tx('You can donate one-time or monthly by UPI, card or net-banking from the <a href="donate.html">Donate page</a>. Choose a program or “Where needed most”.', '<a href="donate.html">ದೇಣಿಗೆ ಪುಟ</a>ದಲ್ಲಿ UPI, ಕಾರ್ಡ್ ಅಥವಾ ನೆಟ್‌ಬ್ಯಾಂಕಿಂಗ್ ಮೂಲಕ ಒಂದು ಬಾರಿ ಅಥವಾ ಮಾಸಿಕ ದೇಣಿಗೆ ನೀಡಬಹುದು.', '<a href="donate.html">दान पृष्ठ</a> से UPI, कार्ड या नेटबैंकिंग द्वारा एक बार या मासिक दान कर सकते हैं।') };
  if (has(s, ['event', 'ಕಾರ್ಯಕ್ರಮ', 'आयोजन', 'camp', 'drive'])) {
    const ev = upcoming().slice(0, 3);
    return { html: ev.length ? Tx('Upcoming events:', 'ಮುಂಬರುವ ಕಾರ್ಯಕ್ರಮಗಳು:', 'आगामी आयोजन:') + '<ul class="chat-list">' + ev.map((e) => `<li><a href="events.html#${esc(e.slug)}">${esc(tr(e.title))}</a> — ${G.fmtDate(e.date)}</li>`).join('') + '</ul>' : Tx('No events are scheduled right now.', 'ಈಗ ಯಾವುದೇ ಕಾರ್ಯಕ್ರಮ ನಿಗದಿಯಾಗಿಲ್ಲ.', 'अभी कोई आयोजन निर्धारित नहीं है।') };
  }
  if (has(s, ['volunteer', 'ಸ್ವಯಂ', 'स्वयं', 'join'])) return { html: Tx('Register on the <a href="volunteer.html">Volunteer page</a> with a government ID. After admin approval you get a digital badge, tasks and a certificate.', '<a href="volunteer.html">ಸ್ವಯಂಸೇವಕ ಪುಟ</a>ದಲ್ಲಿ ಗುರುತಿನ ಚೀಟಿಯೊಂದಿಗೆ ನೋಂದಾಯಿಸಿ. ಅನುಮೋದನೆಯ ನಂತರ ಬ್ಯಾಡ್ಜ್, ಕಾರ್ಯಗಳು ಮತ್ತು ಪ್ರಮಾಣಪತ್ರ ಸಿಗುತ್ತದೆ.', '<a href="volunteer.html">स्वयंसेवक पृष्ठ</a> पर सरकारी ID के साथ पंजीकरण करें। स्वीकृति के बाद बैज, कार्य और प्रमाणपत्र मिलेगा।') };
  if (has(s, ['goshala', 'cow', 'visit', 'ಗೋ', 'गौ', 'timing', 'hours'])) return { html: Tx(`Please call us to confirm goshala visit timings: ${call}.`, `ಗೋಶಾಲೆ ಭೇಟಿ ಸಮಯ ದೃಢೀಕರಿಸಲು ಕರೆ ಮಾಡಿ: ${call}.`, `गौशाला भ्रमण का समय जानने के लिए कॉल करें: ${call}।`) };
  if (has(s, ['contact', 'phone', 'address', 'email', 'whatsapp', 'ಸಂಪರ್ಕ', 'संपर्क', 'where', 'location'])) return { html: `📍 ${o.address}<br>📞 ${o.phones.map((p) => `<a href="tel:${p.tel}">${p.display}</a>`).join(', ')}<br>✉️ <a href="mailto:${o.email}">${o.email}</a><br><a href="${o.waLink()}" target="_blank" rel="noopener" class="chat-wa">💬 WhatsApp</a>` };
  if (has(s, ['program', 'tree', 'yoga', 'women', 'ಕಾರ್ಯಕ್ರಮಗಳು', 'कार्यक्रम'])) return { html: Tx('See all our <a href="programs.html">programs</a>: ', 'ನಮ್ಮ <a href="programs.html">ಕಾರ್ಯಕ್ರಮಗಳು</a>: ', 'हमारे <a href="programs.html">कार्यक्रम</a>: ') + G.DB.all('programs').map((p) => esc(p.icon + ' ' + tr(p.title))).join(', ') };
  return { html: Tx("I'm not sure about that one. I can help with events, donating, volunteering and our programs — or type “talk to admin” and our team will follow up.", 'ಇದರ ಬಗ್ಗೆ ಖಚಿತವಿಲ್ಲ. ಕಾರ್ಯಕ್ರಮಗಳು, ದೇಣಿಗೆ, ಸ್ವಯಂಸೇವೆ ಬಗ್ಗೆ ಸಹಾಯ ಮಾಡಬಲ್ಲೆ — ಅಥವಾ “admin” ಎಂದು ಬರೆಯಿರಿ, ನಮ್ಮ ತಂಡ ಸಂಪರ್ಕಿಸುತ್ತದೆ.', 'इस बारे में पक्का नहीं। मैं आयोजन, दान, स्वयंसेवा में मदद कर सकता हूँ — या “admin” लिखें, हमारी टीम संपर्क करेगी।'), ticket: has(s, ['admin', 'human', 'support', 'agent', 'person', 'team']) ? text : undefined };
}

const sessionId = () => {
  let s = sessionStorage.getItem('gigf_chat');
  if (!s) { s = G.uid('chat'); sessionStorage.setItem('gigf_chat', s); }
  return s;
};
function logChat(role, text) {
  const id = sessionId();
  let s = G.DB.all('chats').find((x) => x.id === id);
  if (!s) s = G.DB.add('chats', { id, messages: [], escalated: false });
  s.messages.push({ role, text, at: new Date().toISOString() });
  G.DB.update('chats', id, { messages: s.messages });
}

function TicketForm({ prefill }) {
  const u = G.Auth.current();
  const [done, setDone] = useState(null);
  if (done) {
    return <>{'✅ ' + Tx(`Ticket ${done} created. Our team will contact you.`, `ಟಿಕೆಟ್ ${done} ರಚಿಸಲಾಗಿದೆ. ನಮ್ಮ ತಂಡ ಶೀಘ್ರ ಉತ್ತರಿಸುತ್ತದೆ.`, `टिकट ${done} बन गया है। हमारी टीम जल्द उत्तर देगी।`)}<br /><a href={G.ORG.waLink('Hello, my ticket is ' + done)} target="_blank" rel="noopener" className="chat-wa">{'💬 WhatsApp ' + G.ORG.phones[0].display}</a></>;
  }
  const submit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target), contact = f.get('contact'), isMail = /@/.test(contact);
    const ticket = G.Tickets.create({ category: 'CHAT_ESCALATION', name: f.get('name'), email: isMail ? contact : '', phone: isMail ? '' : contact, subject: 'Chat escalation', message: f.get('msg') });
    G.DB.update('chats', sessionId(), { escalated: true, ticket: ticket.no });
    setDone(ticket.no);
  };
  return (
    <>
      <b>{t('chat.admin')}</b>
      <form className="chat-form" onSubmit={submit}>
        <input name="name" required placeholder={t('f.name')} defaultValue={u ? u.name : ''} />
        <input name="contact" required placeholder={t('f.email') + ' / ' + t('f.phone')} defaultValue={u ? u.email : ''} />
        <textarea name="msg" required rows="3" placeholder={t('f.message')} defaultValue={prefill || ''} />
        <button type="submit">{t('btn.send')}</button>
      </form>
    </>
  );
}

export default function Chat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => [{ id: 0, kind: 'text', text: t('chat.hello') }]);
  const [text, setText] = useState('');
  const box = useRef(null), input = useRef(null);
  const mem = useRef({ next: 1, history: [], down: false, busy: false });

  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [messages]);
  useEffect(() => { if (open) input.current.focus(); }, [open]);

  const push = (msg) => { const id = mem.current.next++; setMessages((m) => [...m, { id, ...msg }]); return id; };
  const replace = (id, msg) => setMessages((m) => m.map((x) => (x.id === id ? { id, ...msg } : x)));
  const remove = (id) => setMessages((m) => m.filter((x) => x.id !== id));
  const escalate = (prefill, delay) => setTimeout(() => push({ kind: 'ticket', prefill }), delay || 0);

  const answer = (q, key) => {
    const a = builtInAnswer(q, key);
    if (a.html) { const id = push({ kind: 'text', text: '…' }); setTimeout(() => replace(id, { kind: 'html', html: a.html }), 450); }
    if (a.ticket !== undefined) escalate(a.ticket, a.delay || (a.html ? 500 : 0));
  };

  async function askAI() {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 20000);
    const context = {
      programs: G.DB.all('programs').filter((p) => p.active).map((p) => tr(p.title) + ': ' + tr(p.tagline) + ' ' + tr(p.desc) + ' Initiatives: ' + (p.initiatives || []).map((i) => tr(i)).join(', ')),
      events: upcoming().slice(0, 6).map((e) => ({ title: tr(e.title), date: e.date, location: e.location, tentative: !!e.tentative }))
    };
    try {
      const r = await fetch(CFG.chatApi, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: mem.current.history.slice(-10), lang: G.lang(), context }), signal: ctl.signal });
      if (!r.ok) { if ([404, 405, 503].includes(r.status)) mem.current.down = true; return null; }
      const j = await r.json();
      return j && j.reply ? j : null;
    } catch { return null; } finally { clearTimeout(timer); }
  }

  async function send(value, key) {
    const q = String(value || '').trim();
    if (!q || mem.current.busy) return;
    push({ kind: 'user', text: q }); logChat('user', q); setText('');
    if (!CFG.chatApi || mem.current.down || key === 'admin' || key === 'payment' || has(q.toLowerCase(), PAYMENT_WORDS)) { answer(q, key); return; }
    mem.current.history.push({ role: 'user', content: q });
    mem.current.busy = true;
    const typing = push({ kind: 'typing' });
    const j = await askAI();
    mem.current.busy = false;
    if (!j) { remove(typing); mem.current.history.pop(); answer(q, key); return; }
    replace(typing, { kind: 'html', html: formatReply(j.reply) });
    mem.current.history.push({ role: 'assistant', content: j.reply }); logChat('bot', j.reply);
    if (j.escalate) escalate(q, 500);
  }

  const chips = [[Tx('How to donate?', 'ದೇಣಿಗೆ ಹೇಗೆ?', 'दान कैसे करें?'), 'donate'], [Tx('80G receipt', '80G ರಸೀದಿ', '80G रसीद'), '80g'], [Tx('Upcoming events', 'ಮುಂಬರುವ ಕಾರ್ಯಕ್ರಮ', 'आगामी आयोजन'), 'events'], [Tx('Volunteer', 'ಸ್ವಯಂಸೇವಕ', 'स्वयंसेवक'), 'volunteer'], [Tx('Payment problem', 'ಪಾವತಿ ಸಮಸ್ಯೆ', 'भुगतान समस्या'), 'payment']];
  return (
    <>
      <button type="button" className="chat-launcher-btn" id="chatLauncher" aria-label="Open chat" title={t('chat.title')} onClick={() => setOpen(!open)}>💬</button>
      <div className={'chat-window' + (open ? ' open' : '')} id="chatWindow" role="dialog" aria-label={t('chat.title')}>
        <div className="chat-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><img src="assets/logo-emblem.svg" alt="" width="30" height="30" style={{ width: 30, height: 30, borderRadius: '50%', background: '#fff' }} /><div><div style={{ fontWeight: 700, fontSize: '.88rem' }}>{t('chat.title')}</div><div style={{ fontSize: '.68rem', opacity: 0.85 }}>{'● ' + t('chat.sub')}</div></div></div>
          <button type="button" id="closeChat" aria-label="Close" onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.3rem', cursor: 'pointer' }}>×</button>
        </div>
        <div className="chat-messages" id="chatMessages" ref={box}>
          {messages.map((m) => {
            if (m.kind === 'user') return <div key={m.id} className="chat-msg user">{m.text}</div>;
            if (m.kind === 'typing') return <div key={m.id} className="chat-msg bot typing"><span className="dots"><i /><i /><i /></span></div>;
            if (m.kind === 'ticket') return <div key={m.id} className="chat-msg bot"><TicketForm prefill={m.prefill} /></div>;
            if (m.kind === 'html') return <div key={m.id} className="chat-msg bot" dangerouslySetInnerHTML={{ __html: m.html }} />;
            return <div key={m.id} className="chat-msg bot">{m.text}</div>;
          })}
        </div>
        <div className="chat-quick-chips" id="chatChips">
          {chips.map(([label, key]) => <button type="button" key={key} className="chip-btn" onClick={() => send(label, key)}>{label}</button>)}
          <button type="button" className="chip-btn chip-admin" onClick={() => send('🙋 ' + t('chat.admin'), 'admin')}>{'🙋 ' + t('chat.admin')}</button>
        </div>
        <div className="chat-input-row">
          <input className="chat-input" id="chatInput" ref={input} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(text); }} placeholder={t('chat.ph')} aria-label={t('chat.ph')} />
          <button type="button" className="btn-send-chat" id="sendChatBtn" aria-label="Send" onClick={() => send(text)}>➤</button>
        </div>
      </div>
    </>
  );
}
