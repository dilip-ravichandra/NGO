/** Awareness articles: AI draft / voice / by hand, simple formatting, preview, cover, six languages, scheduling. */
import { useRef, useState } from 'react';
import { G, CFG, tr } from '../lib/gigf.js';
import { openModal, toast } from '../ui/feedback.jsx';
import { Table, Btn, Chip, Mic, VoicePicker, LANGS, OTHER_LANGS, useSticky, aiPost, aiMsg, compressImage, ensureTranslations, toBlob, download } from './shared.jsx';

const CATS = [['environment', 'Environment'], ['yoga', 'Yoga'], ['health', 'Health & Nutrition'], ['women', 'Women Empowerment'], ['stories', 'NGO Stories'], ['schemes', 'Govt Schemes']];
const FIELDS = ['title', 'summary', 'body'];

const uniqueSlug = (wanted, ownId) => {
  const base = G.slugify(wanted) || 'article';
  let slug = base, n = 2;
  while (G.DB.all('articles').some((x) => x.id !== ownId && (x.slug === slug || x.id === slug))) slug = base + '-' + n++;
  return slug;
};
/** translate line by line so headings and lists keep their markers */
async function translateBody(english, to) {
  const lines = english.split('\n').map((l) => { const m = l.match(/^(\s*(?:#{2,3}\s+|[-•]\s+|\d+[.)]\s+)?)(.*)$/); return { mark: m[1], text: m[2] }; });
  const jobs = lines.filter((l) => l.text.trim());
  if (!jobs.length) return '';
  const out = await G.translate(jobs.map((l) => l.text.slice(0, 1900)), to);
  if (!out || out.some((x) => !x)) return '';
  let i = 0;
  return lines.map((l) => (l.text.trim() ? l.mark + out[i++] : '')).join('\n');
}

function ArticleForm({ id, close }) {
  const [a] = useState(() => (id ? G.DB.get('articles', id) : { status: 'DRAFT', date: G.today(), category: 'stories' }));
  const [text, setText] = useState(() => ({ title: { ...a.title }, summary: { ...a.summary }, body: Object.fromEntries(LANGS.map(([l]) => [l, G.articleBody(a, l)])) }));
  const [before] = useState(() => ({ title: (a.title || {}).en || '', summary: (a.summary || {}).en || '', body: G.articleBody(a, 'en') }));
  const [lang, setLang] = useState('en');
  const [cover, setCover] = useState(a.cover || '');
  const [preview, setPreview] = useState(false);
  const [status, setStatus] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bad, setBad] = useState({});
  const notes = useRef(null), body = useRef(null), form = useRef(null);
  const set = (key, value) => setText((x) => ({ ...x, [key]: { ...x[key], [lang]: value } }));
  const value = (key) => text[key][lang] || '';
  const placeholder = lang === 'en' ? '' : 'Empty = translated automatically when you save';

  const format = (kind) => {
    setPreview(false);
    const el = body.current, from = el.selectionStart, to = el.selectionEnd, sel = el.value.slice(from, to);
    let put;
    if (kind === 'b') put = '**' + (sel || 'bold words') + '**';
    else if (kind === 'a') {
      const address = prompt('Address (a page such as donate.html, or https://…)');
      if (!address) return;
      if (!G.safeUrl(address, '')) return toast('That address is not allowed.', '⚠️');
      put = '[' + (sel || 'link words') + '](' + address + ')';
    } else {
      const mark = (i) => (kind === 'h' ? '## ' : kind === 'ul' ? '- ' : i + 1 + '. ');
      put = (from && el.value[from - 1] !== '\n' ? '\n' : '') + (sel || (kind === 'h' ? 'Heading' : 'list item')).split('\n').map((l, i) => mark(i) + l).join('\n');
    }
    set('body', el.value.slice(0, from) + put + el.value.slice(to));
    el.focus();
  };

  const draft = async () => {
    const value_ = notes.current.value.trim();
    if (value_.length < 15) return toast('Add a few sentences of notes first.', 'ℹ️');
    setDrafting(true); setStatus('✨ Writing…');
    const category = form.current.elements.category;
    const r = await aiPost(CFG.draftApi || '/api/draft-article', { notes: value_, category: category.selectedOptions[0].textContent });
    setDrafting(false);
    if (r.status !== 200 || !r.draft) return setStatus('⚠️ ' + aiMsg(r) + ' You can still write it yourself.');
    setText((x) => ({ title: { ...x.title, en: r.draft.title }, summary: { ...x.summary, en: r.draft.summary }, body: { ...x.body, en: r.draft.body } }));
    setLang('en'); setPreview(false);
    setStatus('✔ Drafted. Read it all before publishing.' + ((r.warnings || []).length ? ' ⚠️ ' + r.warnings.join(' · ') : ''));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const f = e.target.elements, v = (n) => String(f[n].value || '').trim();
    const wrong = { title: (text.title.en || '').trim().length < 3, summary: !(text.summary.en || '').trim(), body: (text.body.en || '').trim().length < 20, publishAt: v('status') === 'SCHEDULED' && !v('publishAt') };
    setBad(wrong);
    if (Object.values(wrong).some(Boolean)) { setLang('en'); return toast('Please fill the highlighted fields.', '⚠️'); }
    setSaving(true);
    const next = { title: { ...text.title }, summary: { ...text.summary }, body: { ...text.body } };
    // an old translation is dropped when its English text changed, so it is translated afresh
    FIELDS.forEach((k) => { if ((next[k].en || '') !== before[k] && before[k]) OTHER_LANGS.forEach((l) => { const old = k === 'body' ? G.articleBody(a, l) : (a[k] || {})[l]; if (next[k][l] === old) next[k][l] = ''; }); });
    if (G.auto().autoTranslate && G.autoTranslateAvailable && G.autoTranslateAvailable()) {
      try {
        await ensureTranslations({ title: next.title, summary: next.summary }, ['title', 'summary']);
        for (const l of OTHER_LANGS) if (!next.body[l]) next.body[l] = await translateBody(next.body.en, l);
      } catch { /* save without translations */ }
    }
    const bodies = Object.fromEntries(Object.entries(next.body).filter(([, t]) => t));
    let picture = cover;
    if (G.cloud && G.cloud.canWrite() && /^data:/.test(picture)) { try { picture = await G.cloud.uploadMedia(toBlob(picture)); } catch (x) { toast('Cover kept inside the article: ' + x.message, 'ℹ️'); } }
    const item = { title: next.title, summary: next.summary, body: bodies, category: v('category'), date: v('date') || G.today(), status: v('status'), publishAt: v('status') === 'SCHEDULED' ? v('publishAt') : '', cover: picture, seo: v('seo'), slug: uniqueSlug(v('slug') || next.title.en, id) };
    const snapshot = localStorage.getItem('gigf_db_v2');
    if (id) G.DB.update('articles', id, item); else G.DB.add('articles', { id: item.slug + '-' + Date.now().toString(36).slice(-3), ...item });
    if (localStorage.getItem('gigf_db_v2') === snapshot) toast('This browser is out of space: use a smaller cover picture.', '⚠️'); else toast(item.status === 'PUBLISHED' ? 'Published' : 'Saved as ' + item.status.toLowerCase(), '✅');
    G.audit('ARTICLE_' + item.status, 'article', id || item.slug);
    close();
  };

  const coverUrl = cover ? G.mediaUrl(cover) : '';
  const cls = (key, extra) => 'field ' + extra + (bad[key] ? ' bad' : '');
  return (
    <>
      <div className="pg-ai"><b>Let the AI draft it</b><p style={{ fontSize: '.82rem', color: '#4b5563' }}>{`Say or type your notes in any language${id ? ' (this replaces the English text below)' : ''}. Check every fact before publishing.`}</p>
        <textarea id="aNotes" ref={notes} rows="3" maxLength={6000} placeholder="e.g. On Sunday 25 volunteers planted 120 saplings near the lake in Ramamurthy Nagar. School children helped water them." /><Mic target={notes} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}><VoicePicker /><button type="button" className="btn btn-primary btn-sm" id="aDraft" disabled={drafting} onClick={draft}>✨ Draft the article</button><span id="aStatus" className="ai-status">{status}</span></div></div>
      <form id="aForm" className="f-grid" noValidate ref={form} onSubmit={submit}>
        <div className="f-full lang-tabs">{LANGS.map(([l, n]) => <button type="button" key={l} className={'btn btn-sm ' + (l === lang ? 'btn-primary' : 'btn-ghost')} data-lg={l} onClick={() => { setLang(l); setPreview(false); }}>{n}</button>)}</div>
        <div className={cls('title', 'f-full')}><label>Title *</label><input name="title" maxLength={120} value={value('title')} placeholder={placeholder} onChange={(e) => set('title', e.target.value)} /><span className="err">Give it a title</span></div>
        <div className={cls('summary', 'f-full')}><label>Short summary *</label><textarea name="summary" rows="2" maxLength={250} value={value('summary')} placeholder={placeholder} onChange={(e) => set('summary', e.target.value)} /><span className="err">Add a summary</span></div>
        <div className={cls('body', 'f-full')}><label>Article *</label>
          <div className="md-bar">{[['h', 'Heading'], ['b', 'Bold'], ['ul', '• List'], ['ol', '1. List'], ['a', '🔗 Link']].map(([k, n]) => <button type="button" key={k} className="btn btn-ghost btn-sm" data-md={k} onClick={() => format(k)}>{n}</button>)}<button type="button" className="btn btn-ghost btn-sm" id="aPrevBtn" onClick={() => setPreview(!preview)}>{preview ? '✏️ Back to writing' : '👁️ Preview'}</button></div>
          <textarea name="body" ref={body} rows="10" maxLength={12000} value={value('body')} placeholder={placeholder} hidden={preview} onChange={(e) => set('body', e.target.value)} /><Mic target={body} />
          {/* G.md escapes every character first (js/md.js) */}
          {preview && <div className="art-body md-prev" id="aPrev" dangerouslySetInnerHTML={{ __html: G.md(value('body')) || '<p style="color:#9ca3af">Nothing to show yet.</p>' }} />}
          <span className="err">Write the article</span></div>
        <div className="field"><label>Category</label><select name="category" defaultValue={a.category}>{CATS.map((c) => <option key={c[0]} value={c[0]}>{c[1]}</option>)}</select></div>
        <div className="field"><label>Date</label><input type="date" name="date" defaultValue={a.date || G.today()} /></div>
        <div className="field"><label>Status</label><select name="status" defaultValue={a.status}>{['DRAFT', 'SCHEDULED', 'PUBLISHED'].map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className={cls('publishAt', '')}><label>Publish at (if scheduled, India time)</label><input type="datetime-local" name="publishAt" defaultValue={a.publishAt || ''} /><span className="err">Choose when</span></div>
        <div className="field f-full"><label>Cover picture</label><input type="file" id="aCover" accept="image/jpeg,image/png,image/webp" onChange={async (e) => { try { setCover(await compressImage(e.target.files[0], 1100, 0.78, 200000)); } catch { toast('Could not open that picture.', '⚠️'); } }} />
          <div className="look-prev" id="aCoverPrev">{coverUrl && coverUrl !== '#' ? <><img src={coverUrl} alt="" /> <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCover('')}>Remove</button></> : <span style={{ color: '#9ca3af' }}>A picture for the category is used</span>}</div></div>
        <div className="field"><label>Web address (letters, numbers, dashes)</label><input name="slug" maxLength={60} defaultValue={a.slug || a.id || ''} placeholder="made from the title" /></div>
        <div className="field"><label>Search description (up to 160 letters)</label><input name="seo" maxLength={160} defaultValue={a.seo || ''} placeholder="the summary is used if empty" /></div>
        <button className="btn btn-primary f-full" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save article'}</button>
      </form>
    </>
  );
}

const openForm = (id) => openModal({ wide: true, title: id ? '✏️ Edit article' : '✨ New article', render: (close) => <ArticleForm id={id} close={close} /> });

function view(a) {
  const cover = a.cover ? G.mediaUrl(a.cover) : '';
  openModal({
    wide: true, title: '👁️ ' + tr(a.title),
    render: () => <>{cover && cover !== '#' && <img className="detail-img" src={cover} alt="" />}<p style={{ color: '#6b7280' }}>{tr(a.summary)}</p><div className="art-body" dangerouslySetInnerHTML={{ __html: G.md(G.articleBody(a, G.lang()) || G.articleBody(a)) }} /></>
  });
}

function sitemap() {
  const base = CFG.siteUrl || location.origin + location.pathname.replace(/[^/]*$/, '');
  const pages = ['', 'programs.html', 'events.html', 'gallery.html', 'awareness.html', 'environment.html', 'volunteer.html', 'donate.html', 'contact.html', 'reports.html', 'terms.html', 'privacy.html'];
  const now = new Date(), live = G.DB.all('articles').filter((a) => a.status === 'PUBLISHED' || (a.status === 'SCHEDULED' && new Date(a.publishAt) <= now));
  const urls = pages.concat(live.map((a) => 'article.html?a=' + encodeURIComponent(a.slug || a.id)), G.DB.all('events').filter((e) => e.status !== 'DRAFT').map((e) => 'event.html?e=' + encodeURIComponent(e.slug)));
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.map((u) => '  <url><loc>' + G.esc(base + u) + '</loc></url>').join('\n') + '\n</urlset>\n';
  download('sitemap.xml', xml, 'application/xml');
  toast(urls.length + ' pages. Replace sitemap.xml in the project with this file, then push.', '🗺️');
}

export default function Articles() {
  const [f, setF] = useSticky('art', { q: '', st: 'ALL' });
  const q = f.q.toLowerCase();
  const rows = G.DB.all('articles').filter((a) => (f.st === 'ALL' || a.status === f.st) && (!q || (tr(a.title) + ' ' + tr(a.summary) + ' ' + a.category).toLowerCase().includes(q))).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return (
    <>
      <div className="toolbar"><h3 style={{ flex: 1 }}>Awareness articles / blog</h3><Btn onClick={sitemap}>⬇ Sitemap</Btn><Btn kind="btn-orange" onClick={() => openForm(null)}>✨ New article</Btn></div>
      <div className="toolbar"><input className="search" id="artQ" placeholder="Search articles" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <select id="artSt" className="search" style={{ flex: '0 1 170px' }} value={f.st} onChange={(e) => setF({ ...f, st: e.target.value })}>{['ALL', 'DRAFT', 'SCHEDULED', 'PUBLISHED'].map((x) => <option key={x}>{x}</option>)}</select></div>
      <div id="artList">
        <Table
          cols={[[(r) => tr(r.title), 'Title'], ['category', 'Category'], ['date', 'Date'], [(r) => <><Chip s={r.status} />{r.status === 'SCHEDULED' && <><br /><small>{String(r.publishAt || '').replace('T', ' ')}</small></>}</>, 'Status'], [(r) => <code>{r.slug || r.id}</code>, 'Address']]}
          rows={rows}
          actions={(r) => <><Btn onClick={() => openForm(r.id)}>✏️ Edit</Btn><Btn onClick={() => view(r)}>👁️</Btn><Btn onClick={() => { if (confirm('Delete?')) G.DB.remove('articles', r.id); }}>🗑️</Btn></>}
        />
      </div>
    </>
  );
}
