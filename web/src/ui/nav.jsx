/** Links, navigation and the "please log in first" popup. */
import { G, t } from '../lib/gigf.js';
import { fromLegacy, toHref, parseHash } from '../lib/routes.js';
import { openModal } from './feedback.jsx';

export const inAdmin = () => document.documentElement.dataset.app === 'admin';

/** <A to="donate.html?program=cow"> */
export function A({ to, children, ...rest }) {
  return <a href={toHref(to, inAdmin())} {...rest}>{children}</a>;
}

export function go(to) {
  const href = toHref(to, inAdmin());
  if (href.startsWith('#')) location.hash = href; else location.assign(href);
}

function Gate({ kind, next, close }) {
  const nx = encodeURIComponent(next);
  return (
    <>
      <div className="gate" role="alertdialog" aria-labelledby="gateT">
        <div className="gate-ico" aria-hidden="true">🔒</div>
        <h3 id="gateT">{t('auth.req.' + kind + '.t')}</h3><p>{t('auth.req.' + kind + '.b')}</p>
        <div className="gate-actions">
          <A className="btn btn-primary gate-login" to={'login.html?next=' + nx} onClick={close} data-autofocus>{'🔑 ' + t('nav.login')}</A>
          <A className="btn btn-orange gate-signup" to={'signup.html?next=' + nx} onClick={close}>{'✨ ' + t('auth.req.signup')}</A>
        </div>
        <small>{'🔐 ' + t('auth.req.note')}</small>
      </div>
      <button type="button" className="gate-later" onClick={close}>{t('auth.req.later')}</button>
    </>
  );
}

/** true when signed in; otherwise shows the popup and returns false */
export function requireLogin(kind, next) {
  if (G.Auth.current()) return true;
  openModal({ title: '🔒 ' + t('nav.login') + ' / ' + t('nav.signup'), render: (close) => <Gate kind={kind} next={next} close={close} /> });
  return false;
}

/**
 * One listener for every link on the page, including links inside article text and chat answers:
 * old "page.html" addresses are turned into app addresses, and guests are asked to log in before donating/volunteering.
 */
export function startLinkHandling() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || a.target === '_blank') return;
    const raw = a.getAttribute('href');
    const href = fromLegacy(raw) ? toHref(raw, inAdmin()) : raw;
    const friendly = href.replace(/^index\.html/, '');
    const route = friendly.startsWith('#') ? parseHash(friendly) : null;
    const page = document.body.dataset.page;
    if (route && (route.page === 'donate' || route.page === 'volunteer') && !G.Auth.current() && page !== 'login' && page !== 'signup') {
      e.preventDefault();
      requireLogin(route.page, route.page + '.html' + route.search + (route.anchor ? '#' + route.anchor : ''));
      return;
    }
    if (href !== raw) { e.preventDefault(); go(raw); return; }
    // clicking the address you are already on: scroll to the place again
    if (!inAdmin() && href === location.hash) { e.preventDefault(); dispatchEvent(new HashChangeEvent('hashchange')); }
  });
}
