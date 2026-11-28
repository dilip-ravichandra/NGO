/** Notifications bell. What is "new" is worked out by the shared notify.js from records the person can already see. */
import { useEffect, useRef, useState } from 'react';
import { G } from '../lib/gigf.js';
import { bump } from '../lib/store.js';
import { A } from './nav.jsx';
import { toast } from './feedback.jsx';

const seenKey = (u) => 'gigf_seen_' + (u.id || u.email);
const readSeen = (u) => { try { return JSON.parse(localStorage.getItem(seenKey(u))) || []; } catch { return []; } };
const writeSeen = (u, ids) => { try { localStorage.setItem(seenKey(u), JSON.stringify(Array.from(new Set(ids)).slice(-600))); } catch { /* private mode */ } };

export default function Bell() {
  const u = G.Auth.current();
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);
  const [seenAtOpen, setSeenAtOpen] = useState([]);
  const box = useRef(null);
  const known = useRef(null);

  useEffect(() => {
    if (!u) return undefined;
    known.current = new Set(G.notify.list(u).map((n) => n.id));
    const check = () => {
      setTick((x) => x + 1);
      const fresh = G.notify.list(u).filter((n) => !known.current.has(n.id));
      fresh.forEach((n) => known.current.add(n.id));
      if (fresh.length && /ADMIN/.test(u.role) && document.body.dataset.page === 'admin' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(fresh.length === 1 ? 'Green India Gokul Foundation' : fresh.length + ' new items', { body: fresh.slice(0, 3).map((n) => n.text).join('\n'), tag: 'gigf-admin' });
      }
    };
    const quick = setInterval(check, 8000);
    const slow = setInterval(async () => { if (document.body.dataset.page === 'admin' && G.cloud && G.cloud.canWrite()) { try { await G.cloud.pull(); bump(); } catch { /* offline */ } } check(); }, 45000);
    return () => { clearInterval(quick); clearInterval(slow); };
  }, [u && u.id]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('click', away);
    return () => document.removeEventListener('click', away);
  }, [open]);

  if (!u) return null;
  const items = G.notify.list(u);
  const unread = G.notify.unread(u).length;
  const toggle = (e) => {
    e.stopPropagation();
    if (!open) { const seen = readSeen(u); setSeenAtOpen(seen); writeSeen(u, seen.concat(items.map((n) => n.id))); }
    setOpen(!open);
  };
  const allow = () => Notification.requestPermission().then((p) => { toast(p === 'granted' ? 'Pop-up alerts are on while the admin portal is open' : 'Your browser blocked the alerts', '🔔'); setTick((x) => x + 1); });
  const count = open ? 0 : unread;
  return (
    <div id="bellWrap" className="bell-wrap" data-notr="" ref={box}>
      <button type="button" id="bellBtn" className="bell-btn" aria-haspopup="true" aria-label={`Notifications, ${count} unread`} onClick={toggle}>🔔<span id="bellCount" hidden={!count}>{count > 9 ? '9+' : count}</span></button>
      <div id="bellMenu" className="bell-menu" hidden={!open}>
        <b>Notifications</b>
        {/ADMIN/.test(u.role) && 'Notification' in window && Notification.permission !== 'granted' && <button type="button" className="btn btn-ghost btn-sm" id="bellAllow" onClick={allow}>🔔 Turn on pop-up alerts</button>}
        {!items.length && <p>Nothing new.</p>}
        {items.map((n) => <A key={n.id} to={n.link} className={seenAtOpen.includes(n.id) ? '' : 'new'} onClick={() => setOpen(false)}>{n.icon + ' ' + n.text}</A>)}
      </div>
    </div>
  );
}
