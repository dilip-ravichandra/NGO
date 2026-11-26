/**
 * Automatic translation (English -> Kannada / Hindi) powered by Groq through the server-side /api/translate proxy.
 *
 *  1. G.translate(texts, to, onEach)  - translate strings, cached per language in localStorage.
 *  2. Page engine - when the site language is Kannada or Hindi, every piece of visible English text that the
 *     built-in dictionaries do not cover is translated automatically (visible text first), including content
 *     that is added to the page later. Nobody has to write translations in HTML or JS.
 *
 *  If the proxy is not reachable (no server / no key) nothing happens and the page simply stays in English.
 */
(function () {
  const G = window.GIGF, cfg = window.GIGF_CONFIG || {}, lang = G.lang();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const KEY = 'gigf_tr1_', caches = {};
  const getCache = (to) => caches[to] || (caches[to] = (() => { try { return JSON.parse(localStorage.getItem(KEY + to) || '{}'); } catch (e) { return {}; } })());
  let saveT; const persist = (to) => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY + to, JSON.stringify(getCache(to))); } catch (e) { caches[to] = {}; try { localStorage.removeItem(KEY + to); } catch (_) { } } }, 400); };
  let down = false;
  G.autoTranslateAvailable = () => !!cfg.translateApi && !down;

  /** Translates `texts` into `to` ('kn' | 'hi' | 'ta' | 'te'). onEach(index, translation) fires as soon as each one is known. Resolves to the array (null entries = failed). */
  G.translate = async function (texts, to, onEach) {
    const out = texts.map(() => null);
    if (!cfg.translateApi || down) return out;
    const cache = getCache(to), need = [];
    texts.forEach((t, i) => { if (cache[t]) { if (cache[t] !== t) { out[i] = cache[t]; onEach && onEach(i, cache[t]); } } else if (String(t).trim()) need.push(i); });
    const chunks = []; let cur = [], chars = 0;
    need.forEach((i) => { const l = texts[i].length; if (cur.length >= 20 || (cur.length && chars + l > 3000)) { chunks.push(cur); cur = []; chars = 0; } cur.push(i); chars += l; });
    if (cur.length) chunks.push(cur);
    for (const ch of chunks) {
      let res = null;
      for (let attempt = 0; attempt < 4 && !res && !down; attempt++) {
        try {
          const r = await fetch(cfg.translateApi, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texts: ch.map((i) => texts[i]), to }) });
          if (r.status === 429) { await sleep(5000 * (attempt + 1)); continue; }          // rate-limited: wait and retry
          if ([404, 405, 503].includes(r.status)) { down = true; break; }                  // no proxy / no key on this server
          if (!r.ok) { await sleep(1500); continue; }
          res = await r.json();
        } catch (e) { await sleep(1500); }
      }
      if (down) break;
      if (!res || !Array.isArray(res.translations)) continue;
      ch.forEach((i, k) => { const v = res.translations[k]; if (typeof v === 'string' && v.trim()) { cache[texts[i]] = v; if (v !== texts[i]) { out[i] = v; onEach && onEach(i, v); } } });   // unchanged results are cached too, so they are never asked for again
      persist(to);
    }
    return out;
  };

  /* ---------------------------------- page engine ---------------------------------- */
  if (lang === 'en' || !cfg.translateApi || document.body.dataset.page === 'admin') return;

  const SKIP = 'script,style,noscript,textarea,code,pre,svg,.chat-window,.chat-launcher-btn,#toastContainer,.lang-menu,.lang-switch,[data-i18n],[data-notr],[contenteditable],.autotr-note';
  const TARGET_SCRIPT = /[ಀ-೿ऀ-ॿ]/;
  const candidate = (raw) => { const t = raw.trim(); return t.length >= 2 && t.length <= 400 && /[A-Za-z]{2}/.test(t) && !TARGET_SCRIPT.test(t) && !/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(t) && !/^(https?:\/\/|www\.)/i.test(t) && !/^[\w./-]+\.(html|pdf|png|jpe?g|svg|mp4)$/i.test(t); };
  const inflight = new Set();
  let running = false, again = false, shown = false;

  function collect() {
    const groups = new Map();   // text -> [{node|el+attr}]
    const add = (text, ref, top) => { let g = groups.get(text); if (!g) groups.set(text, (g = { refs: [], top })); g.refs.push(ref); g.top = Math.min(g.top, top); };
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement && !n.parentElement.closest(SKIP) && candidate(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    for (let n = tw.nextNode(); n; n = tw.nextNode()) { const r = n.parentElement.getBoundingClientRect(); add(n.nodeValue.trim(), { node: n }, r.top); }
    document.querySelectorAll('[placeholder],[title],[aria-label]').forEach((el) => {
      if (el.closest('.chat-window,[data-notr],.lang-switch,.lang-menu')) return;
      ['placeholder', 'title', 'aria-label'].forEach((a) => { if (el.hasAttribute(a) && !el.hasAttribute('data-i18n-ph') && candidate(el.getAttribute(a))) add(el.getAttribute(a).trim(), { el, a }, 1e9); });
    });
    return groups;
  }
  function apply(g, tr) {
    g.refs.forEach((ref) => {
      if (ref.node) { if (!ref.node.isConnected) return; const v = ref.node.nodeValue; ref.node.nodeValue = v.replace(v.trim(), tr); }
      else if (ref.el && ref.el.isConnected) ref.el.setAttribute(ref.a, tr);
    });
    if (!shown) { shown = true; note(); }
  }
  function note() {
    const fb = document.querySelector('.footer-bottom'); if (!fb || fb.querySelector('.autotr-note')) return;
    const MSG = { kn: 'ಕೆಲವು ಪಠ್ಯವನ್ನು AI ಮೂಲಕ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಅನುವಾದಿಸಲಾಗಿದೆ — ತಪ್ಪುಗಳಿರಬಹುದು.', hi: 'कुछ पाठ AI द्वारा स्वतः अनुवादित है — त्रुटियाँ हो सकती हैं।', ta: 'சில உரைகள் AI மூலம் தானாக மொழிபெயர்க்கப்பட்டவை — பிழைகள் இருக்கலாம்.', te: 'కొన్ని పాఠ్యాలు AI ద్వారా స్వయంచాలకంగా అనువదించబడ్డాయి — తప్పులు ఉండవచ్చు.' };
    const msg = MSG[lang] || MSG.hi;
    const el = document.createElement('div'); el.className = 'autotr-note'; el.innerHTML = '🌐 ' + msg + ' <button type="button">Show English</button>'; el.querySelector('button').onclick = () => G.setLang('en'); fb.appendChild(el);
  }
  async function run() {
    if (running) { again = true; return; }
    running = true;
    try {
      do {
        again = false;
        const groups = collect(), texts = [];
        const list = [...groups.entries()].filter(([t]) => !inflight.has(t)).sort((a, b) => ((a[1].top >= -50 && a[1].top < innerHeight ? 0 : 1) - (b[1].top >= -50 && b[1].top < innerHeight ? 0 : 1)) || a[1].top - b[1].top);
        list.forEach(([t]) => { texts.push(t); inflight.add(t); });
        if (!texts.length) break;
        await G.translate(texts, lang, (i, tr) => apply(groups.get(texts[i]), tr));
        texts.forEach((t) => inflight.delete(t));
      } while (again);
    } finally { running = false; }
  }
  let t; const schedule = () => { clearTimeout(t); t = setTimeout(run, 250); };
  G.boot(() => {
    schedule();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  });
})();
