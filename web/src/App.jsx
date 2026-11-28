import { useEffect, useLayoutEffect, useState } from 'react';
import { G } from './lib/gigf.js';
import { parseHash } from './lib/routes.js';
import { useData } from './lib/store.js';
import Layout from './ui/Layout.jsx';
import { Feedback, closeAllModals } from './ui/feedback.jsx';
import { PageHero, scrollToId } from './ui/common.jsx';
import Home from './pages/Home.jsx';
import Programs from './pages/Programs.jsx';
import Events, { EventDetail } from './pages/Events.jsx';
import Gallery from './pages/Gallery.jsx';
import { Awareness, Article, Reports } from './pages/Articles.jsx';
import Environment from './pages/Environment.jsx';
import Contact from './pages/Contact.jsx';
import Donate from './pages/Donate.jsx';
import Volunteer from './pages/Volunteer.jsx';
import Auth from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import TermsText from './content/Terms.jsx';
import PrivacyText from './content/Privacy.jsx';

const legal = (title, Text) => function Legal() {
  return <><PageHero title={title} badge={false} /><section className="section"><div className="wrap"><Text /></div></section></>;
};

const PAGES = {
  home: Home, programs: Programs, events: Events, event: EventDetail, gallery: Gallery, awareness: Awareness, article: Article,
  environment: Environment, contact: Contact, donate: Donate, volunteer: Volunteer, login: Auth, signup: Auth, dashboard: Dashboard,
  reports: Reports, terms: legal('Terms of Use', TermsText), privacy: legal('Privacy Policy', PrivacyText)
};
const TITLES = {
  home: 'Nature • Cow Welfare • Health • Rural Prosperity', programs: 'Our Programs', events: 'Events & Registration', event: 'Event', gallery: 'Photo & Video Gallery',
  awareness: 'Awareness & Blog', article: 'Article', environment: 'Save Environment — There is only one Earth', contact: 'Contact Us', donate: 'Donate',
  volunteer: 'Become a Volunteer', login: 'Welcome back', signup: 'Join the movement', dashboard: 'My Dashboard', reports: 'Annual Reports', terms: 'Terms of Use', privacy: 'Privacy Policy'
};

function useRoute() {
  const [state, setState] = useState(() => { const r = parseHash(location.hash); return { ...r, page: r.page || 'home', n: 0 }; });
  useEffect(() => {
    const change = () => setState((old) => {
      const r = parseHash(location.hash);
      return { ...r, page: r.page || old.page, n: old.n + 1 };
    });
    addEventListener('hashchange', change);
    return () => removeEventListener('hashchange', change);
  }, []);
  return state;
}

export default function App() {
  const route = useRoute();
  useData();
  const Page = PAGES[route.page];
  // a different page (or different "?..." on the same page) starts fresh, as a page load did before
  const key = (route.page === 'login' || route.page === 'signup' ? 'auth' : route.page) + route.search;

  document.body.dataset.page = route.page;
  // a layout effect runs before the page's own effects, so an article or event can set a more exact title
  useLayoutEffect(() => {
    closeAllModals();
    document.title = (TITLES[route.page] || '') + ' | Green India Gokul Foundation';
    // private records and fresh public content, as each page load used to fetch them
    if (route.n > 0 && G.cloud) G.cloud.pull().catch(() => { });
  }, [key]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [key]);
  useEffect(() => {
    // anchors that no page handles itself (for example #about on the home page)
    if (route.anchor && !['dashboard', 'events', 'programs', 'awareness'].includes(route.page)) scrollToId(route.anchor, 150);
  }, [route]);
  useEffect(() => { G.runBoot(); }, []);

  return (
    <>
      <Layout page={route.page}><Page key={key} route={route} /></Layout>
      <Feedback />
    </>
  );
}
