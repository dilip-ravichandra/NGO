/**
 * Article text with simple formatting:  ## heading,  - list,  1. numbered list,  **bold**,  [words](address).
 * SAFE BY CONSTRUCTION: every character is escaped first; only the tags below are ever added, and link addresses pass GIGF.safeUrl.
 */
(function () {
  const G = window.GIGF;
  /** the stored body in one language, as one text (older articles stored a list of paragraphs) */
  G.articleBody = (a, lang) => {
    let b = a && a.body;
    if (b && !Array.isArray(b) && typeof b === 'object') b = lang ? b[lang] || '' : b.en;
    else if (lang && lang !== 'en') return '';
    return Array.isArray(b) ? b.join('\n\n') : String(b || '');
  };
  const inline = (s) => G.esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, words, address) => { const u = G.safeUrl(address.replace(/&amp;/g, '&'), ''); return u && u !== '#' ? `<a href="${G.esc(u)}"${/^https?:/i.test(u) ? ' target="_blank" rel="noopener nofollow"' : ''}>${words}</a>` : words; });
  G.md = (text) => String(text || '').replace(/\r/g, '').split(/\n\s*\n/).map((block) => {
    const lines = block.split('\n').filter((l) => l.trim()); if (!lines.length) return '';
    const out = []; let list = '', para = [];
    const flush = () => { if (para.length) out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; };
    const close = () => { if (list) out.push(`</${list}>`); list = ''; };
    lines.forEach((l) => {
      const h = l.match(/^\s*(#{2,3})\s+(.*)/), ul = l.match(/^\s*[-•]\s+(.*)/), ol = l.match(/^\s*\d+[.)]\s+(.*)/);
      if (h) { flush(); close(); const tag = h[1].length === 2 ? 'h3' : 'h4'; out.push(`<${tag}>${inline(h[2])}</${tag}>`); return; }
      if (ul || ol) { flush(); const want = ul ? 'ul' : 'ol'; if (list !== want) { close(); out.push(`<${want}>`); list = want; } out.push('<li>' + inline((ul || ol)[1]) + '</li>'); return; }
      close(); para.push(l);
    });
    flush(); close(); return out.join('');
  }).join('');
  G.slugify = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
})();
