/**
 * Friendly addresses: .../#home, .../#volunteer, .../#events/<id>, .../#event?e=<id>  instead of *.html.
 * The pages stay separate files. The address is tidied the moment a page starts, and links on the page use the # form.
 * Page code must read GIGF_SEARCH / GIGF_HASH / GIGF_FILE here, not location.*, because the address has already changed.
 * The admin page is deliberately not part of this: no address leads to it.
 */
(function () {
  var PAGES = ['programs', 'events', 'event', 'gallery', 'awareness', 'article', 'environment', 'contact', 'volunteer', 'donate', 'login', 'signup', 'dashboard', 'reports', 'terms', 'privacy'];
  var ALIAS = { volunteers: 'volunteer', donations: 'donate', blog: 'awareness' };
  var file = location.pathname.split('/').pop();
  var current = file || 'index.html';
  var dir = location.pathname.slice(0, location.pathname.length - file.length);

  /** the real page a friendly hash points to, or '' */
  function target() {
    var m = location.hash.match(/^#([a-z]+)(\?[^/]*)?(?:\/(.*))?$/); if (!m) return '';
    var name = ALIAS[m[1]] || m[1];
    if (name === 'home') return 'index.html' + (m[3] ? '#' + m[3] : '');
    return PAGES.indexOf(name) < 0 ? '' : name + '.html' + (m[2] || '') + (m[3] ? '#' + m[3] : '');
  }
  /** "volunteer.html?x=1#y"  ->  "#volunteer?x=1/y" (null when the address is not one of our pages) */
  function friendly(href) {
    var m = String(href).match(/^(?:\.\/)?([a-z]+)\.html(\?[^#]*)?(?:#(.*))?$/); if (!m) return null;
    var name = m[1] === 'index' ? 'home' : m[1];
    if (name !== 'home' && PAGES.indexOf(name) < 0) return null;
    return '#' + name + (m[2] || '') + (m[3] ? '/' + m[3] : '');
  }

  // opened (or reloaded) as .../#volunteer  ->  load that page
  var t = current === 'index.html' ? target() : '';
  if (t && t.split('#')[0] !== 'index.html') { location.replace(t); return; }

  window.GIGF_FILE = current;
  window.GIGF_SEARCH = location.search;
  window.GIGF_HASH = t ? (t.split('#')[1] ? '#' + t.split('#')[1] : '') : location.hash;

  // tidy the address straight away
  if (current === 'index.html' && /^#admin/.test(window.GIGF_HASH)) window.GIGF_HASH = '';
  var now = friendly(current + location.search + window.GIGF_HASH);
  if (now) history.replaceState(null, '', dir + now);

  // links on the page show and use the friendly form (including ones added later by scripts)
  function tidy(root) {
    var list = root.querySelectorAll ? root.querySelectorAll('a[href]') : [];
    for (var i = 0; i < list.length; i++) one(list[i]);
    if (root.matches && root.matches('a[href]')) one(root);
  }
  function one(a) { var f = friendly(a.getAttribute('href')); if (f) { a.setAttribute('data-page-file', a.getAttribute('href').split(/[?#]/)[0]); a.setAttribute('href', dir + f); } }
  if (current !== 'admin.html') {
    new MutationObserver(function (changes) {
      changes.forEach(function (c) { if (c.type === 'attributes') one(c.target); else c.addedNodes.forEach(function (n) { if (n.nodeType === 1) tidy(n); }); });
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
  }

  // a friendly link was clicked, or a #page typed into the address bar
  addEventListener('hashchange', function () { var next = target(); if (next) location.assign(dir + next); });
  addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]'); if (!a || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || a.target === '_blank') return;
    var m = a.getAttribute('href').match(/#([a-z]+)(\?[^/]*)?(?:\/(.*))?$/), name = m && (ALIAS[m[1]] || m[1]);
    if (!m || a.getAttribute('href').indexOf(dir + '#') !== 0 || (name !== 'home' && PAGES.indexOf(name) < 0)) return;
    e.preventDefault();
    location.assign(dir + (name === 'home' ? 'index.html' : name + '.html') + (m[2] || '') + (m[3] ? '#' + m[3] : ''));
  });
})();
