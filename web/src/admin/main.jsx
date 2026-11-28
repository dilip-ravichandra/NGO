/** Admin portal. Gate: a real admin (database role + e-mailed code) anywhere; the practice admin on this computer only. */
import '../../../css/style.css';
import '../../../css/site.css';
import '../../../css/motion.css';
import '../../../css/gallery-grow.css';
import '../../../css/pop.css';
import '../../../css/env.css';
import '../lib/gigf.js';
import '../lib/store.js';
import '../lib/pdf.js';
import '../lib/upi.js';
import { createRoot } from 'react-dom/client';
import AdminApp from './AdminApp.jsx';
import { startLinkHandling } from '../ui/nav.jsx';
import { startReveal, startVideoManners } from '../lib/reveal.js';
import { Feedback } from '../ui/feedback.jsx';

const G = window.GIGF;

async function start() {
  const root = document.getElementById('root');
  await G.Auth.ensureDemoAdmin();
  if (G.cloud) await G.cloud.pull();
  const state = G.cloud ? await G.cloud.adminState() : 'no';
  if (state === 'code' || state === 'password') {
    G.cloud.gate(root, state);
    const messages = document.body.appendChild(document.createElement('div'));
    createRoot(messages).render(<Feedback />);   // so that "that code did not work" can be seen
    return;
  }
  // not an admin: leave at once
  if (state !== 'ok' && !(G.demoAdminAllowed() && G.Auth.isAdmin())) { location.replace('index.html'); return; }
  G.applyI18n();
  startLinkHandling();
  createRoot(root).render(<AdminApp />);
  startReveal();
  startVideoManners();
}
start();
