import { useEffect, useState } from 'react';
import { G } from '../lib/gigf.js';
import { useData } from '../lib/store.js';
import Layout from '../ui/Layout.jsx';
import { Feedback, modalOpen, toast } from '../ui/feedback.jsx';
import Dashboard from './Dashboard.jsx';
import Programs from './Programs.jsx';
import { Events, News, Testimonials, Users } from './Events.jsx';
import Articles from './Articles.jsx';
import Gallery from './Gallery.jsx';
import Volunteers from './Volunteers.jsx';
import Donations from './Donations.jsx';
import { Issues, Outbox, runTriage } from './Desk.jsx';
import { Look, Settings, Audit } from './Settings.jsx';

const NAV = [['dash', '📊', 'Dashboard', Dashboard], ['outbox', '📨', 'Messages to send', Outbox], ['issues', '🎫', 'Payment issues & inquiries', Issues], ['donations', '💚', 'Donations', Donations], ['volunteers', '🤝', 'Volunteers', Volunteers], ['events', '📅', 'Events', Events], ['news', '📰', 'News & updates', News], ['articles', '✍️', 'Articles', Articles], ['programs', '🌳', 'Programs', Programs], ['gallery', '🖼️', 'Gallery', Gallery], ['look', '🎨', 'Appearance', Look], ['testimonials', '💬', 'Testimonials', Testimonials], ['users', '👥', 'Users', Users], ['audit', '🔒', 'Audit log', Audit], ['settings', '⚙️', 'Settings', Settings]];
const sectionFromAddress = () => { const h = location.hash.slice(1); return NAV.some((n) => n[0] === h) ? h : 'dash'; };

/** what is shared with the database, and the one-time "copy the starter content" button */
function CloudNote() {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!G.cloud) return null;
  const on = G.cloud.canWrite();
  if (!on && G.present) return null;   // no practice-mode note while presenting
  const share = async () => {
    setBusy(true);
    try { await G.cloud.shareStarter(); toast('Copied to the database', '☁️'); setCopied(true); } catch (e) { toast('Could not copy: ' + e.message, '⚠️'); }
    setBusy(false);
  };
  return (
    <div id="cloudNote" className="note" style={{ margin: '10px 16px' }}>
      {on ? <>☁️ <b>Programmes, Events, News, Articles, Gallery, Volunteers, UPI and offline donations</b> are shared. Card test payments, messages and the other sections are still kept in this browser only. {!copied && <button type="button" className="btn btn-primary btn-sm" id="shareBtn" disabled={busy} onClick={share}>Copy the current programmes, events and news to the database</button>}</>
        : '💻 Practice mode: nothing you change here reaches other visitors.'}
    </div>
  );
}

export default function AdminApp() {
  useData();
  const [section, setSection] = useState(sectionFromAddress);
  const goTo = (key) => { setSection(key); history.replaceState(null, '', '#' + key); window.scrollTo({ top: 0 }); };

  useEffect(() => {
    const change = () => setSection(sectionFromAddress());
    addEventListener('hashchange', change);
    G.runBoot();
    // AUTOMATION LOOP: receipts + stuck-payment tickets + (optionally) AI answers to simple questions
    const tick = async () => { if (modalOpen()) return; G.Donations.reconcile(); if (G.auto().autoReplyRoutine) await runTriage(false); };
    tick();
    const timer = setInterval(tick, 30000);
    return () => { removeEventListener('hashchange', change); clearInterval(timer); };
  }, []);

  const open = G.DB.all('tickets').filter((t) => t.status !== 'RESOLVED').length;
  const Section = NAV.find((n) => n[0] === section)[3];
  return (
    <>
      <Layout page="admin">
        <div id="adminRoot">
          <CloudNote />
          <div className="admin-shell">
            <aside className="side">{NAV.map(([key, icon, label]) => <button type="button" key={key} data-sec={key} className={key === section ? 'on' : ''} onClick={() => goTo(key)}>{icon + ' ' + label}{key === 'issues' && open > 0 && <span className="cnt">{open}</span>}</button>)}</aside>
            <section className="admin-main"><Section goTo={goTo} /></section>
          </div>
        </div>
      </Layout>
      <Feedback />
    </>
  );
}
