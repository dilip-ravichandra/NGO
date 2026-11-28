/** Scroll-in animation for every .reveal element, including ones React adds or re-draws later. */
const SELECTOR = '.reveal, .reveal-l, .reveal-r, .reveal-z';
const shown = new WeakSet();

export function startReveal() {
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { shown.add(e.target); e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.12 })
    : null;
  const handle = (el) => {
    if (el.classList.contains('in')) return;
    if (shown.has(el) || !io) el.classList.add('in');   // React re-wrote the class list: keep it visible
    else io.observe(el);
  };
  const scan = (node) => {
    if (node.nodeType !== 1) return;
    if (node.matches(SELECTOR)) handle(node);
    node.querySelectorAll(SELECTOR).forEach(handle);
  };
  scan(document.body);
  new MutationObserver((changes) => changes.forEach((c) => {
    if (c.type === 'attributes') { if (c.target.matches(SELECTOR)) handle(c.target); } else c.addedNodes.forEach(scan);
  })).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
}

/** only one video plays at a time; all stop when the tab is hidden */
export function startVideoManners() {
  const pauseAll = (except) => document.querySelectorAll('video').forEach((v) => { if (v !== except && !v.paused) v.pause(); });
  document.addEventListener('play', (e) => { if (e.target && e.target.tagName === 'VIDEO' && !e.target.muted) pauseAll(e.target); }, true);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseAll(); });
  addEventListener('pagehide', () => pauseAll());
}

/**
 * The automatic translator watches for added elements; React often only changes text, so nudge it.
 * Only for plain English text: the translator's own writes contain Indian letters and must not nudge it again,
 * or Tamil/Telugu/Malayalam text with words like "UPI" would be sent for translation over and over.
 */
const ENGLISH = /[A-Za-z]{2}/;
const OTHER_LETTER = /(?!\p{Script=Latin})\p{L}/u;
export function nudgeTranslator() {
  new MutationObserver((changes) => {
    if (!changes.some((c) => ENGLISH.test(c.target.nodeValue) && !OTHER_LETTER.test(c.target.nodeValue))) return;
    const c = document.createComment(''); document.body.appendChild(c); c.remove();
  }).observe(document.getElementById('root'), { characterData: true, subtree: true });
}
