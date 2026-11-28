import '../../css/style.css';
import '../../css/site.css';
import '../../css/motion.css';
import '../../css/gallery-grow.css';
import '../../css/pop.css';
import '../../css/env.css';
import './lib/gigf.js';
import './lib/store.js';
import './lib/pdf.js';
import './lib/upi.js';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { startLinkHandling } from './ui/nav.jsx';
import { startReveal, startVideoManners, nudgeTranslator } from './lib/reveal.js';
import { friendlyFromLocation } from './lib/routes.js';

const G = window.GIGF;

// an old address such as donate.html?program=cow: show the friendly form, as the old site did
const friendly = friendlyFromLocation(location.pathname, location.search, location.hash);
if (friendly) history.replaceState(null, '', friendly);

async function start() {
  await G.Auth.ensureDemoAdmin();
  if (G.cloud) await G.cloud.pull();   // shared events and news, before anything is drawn
  G.applyI18n();
  startLinkHandling();
  createRoot(document.getElementById('root')).render(<App />);
  startReveal();
  startVideoManners();
  nudgeTranslator();
}
start();
