/**
 * Address rules (pure functions, no browser needed - covered by unit tests).
 * The addresses are the same as on the old site: #home, #donate?program=cow, #events/<id>, #dashboard/donations.
 */
export const PAGES = ['home', 'programs', 'events', 'event', 'gallery', 'awareness', 'article', 'environment', 'contact', 'volunteer', 'donate', 'login', 'signup', 'dashboard', 'reports', 'terms', 'privacy'];
const ALIAS = { index: 'home', volunteers: 'volunteer', donations: 'donate', blog: 'awareness' };
const nameOf = (n) => (ALIAS[n] || n);

/** "#donate?program=cow/x" -> { page, search, anchor }. A bare "#about" has page null: it is a place on the current page. */
export function parseHash(hash) {
  const h = String(hash || '');
  if (!h || h === '#') return { page: 'home', search: '', anchor: '' };
  const m = h.match(/^#([a-z]+)(\?[^/]*)?(?:\/(.*))?$/);
  if (m && PAGES.includes(nameOf(m[1]))) return { page: nameOf(m[1]), search: m[2] || '', anchor: m[3] || '' };
  return { page: null, search: '', anchor: h.slice(1) };
}

/** "donate.html?program=cow#x" -> "#donate?program=cow/x"; admin keeps its own file; anything else -> null */
export function fromLegacy(href) {
  const m = String(href || '').match(/^(?:\.\/)?([a-z]+)\.html(\?[^#]*)?(?:#(.*))?$/);
  if (!m) return null;
  if (m[1] === 'admin') return 'admin.html' + (m[3] ? '#' + m[3] : '');
  const name = nameOf(m[1]);
  if (!PAGES.includes(name)) return null;
  return '#' + name + (m[2] || '') + (m[3] ? '/' + m[3] : '');
}

/** opened as ".../donate.html?program=cow#x": the friendly address to show instead, or '' */
export function friendlyFromLocation(pathname, search, hash) {
  const file = pathname.split('/').pop();
  const m = file.match(/^([a-z]+)\.html$/);
  if (!m || m[1] === 'index' || !PAGES.includes(m[1])) return '';
  return pathname.slice(0, pathname.length - file.length) + '#' + m[1] + search + (hash ? '/' + hash.slice(1) : '');
}

/** the href to put on a link, from inside the public app or the admin app */
export function toHref(to, inAdmin) {
  const friendly = fromLegacy(to);
  if (friendly == null) return to;
  if (friendly.startsWith('#')) return inAdmin ? 'index.html' + friendly : friendly;
  return friendly;
}

/** where to go after logging in; only our own pages are accepted */
export function safeNext(value) {
  const n = String(value || '');
  return /^[a-z0-9_-]+\.html(\?[\w=&%.~-]*)?(#[\w-]*)?$/i.test(n) && !/^(login|signup)\.html/i.test(n) ? n : '';
}
