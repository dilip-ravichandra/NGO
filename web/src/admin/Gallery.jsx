/** Gallery manager: upload photos and videos, captions, categories, ordering, bulk changes. */
import { useRef, useState } from 'react';
import { G, CFG, tr } from '../lib/gigf.js';
import { toast } from '../ui/feedback.jsx';
import { Empty } from '../ui/common.jsx';
import { Btn, CATEGORIES, eventOptions, useSticky, aiPost, aiMsg, compressImage, toBlob, openEditor } from './shared.jsx';

const Options = ({ list }) => list.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>);
const catName = (k) => (CATEGORIES.find((o) => o[0] === k) || [k, k])[1];
const removeMedia = (id) => {
  const m = G.DB.get('gallery', id);
  if (!m) return;
  const src = m.src;
  G.DB.remove('gallery', id);
  if (G.cloud) G.cloud.deleteMedia(src);
};

function move(shown, id, step) {
  const i = shown.findIndex((m) => m.id === id), other = shown[i + step];
  if (i < 0 || !other) return;
  const all = G.sortMedia(G.DB.all('gallery')), a = all.findIndex((m) => m.id === id), b = all.findIndex((m) => m.id === other.id);
  [all[a], all[b]] = [all[b], all[a]];
  all.forEach((m, k) => { if (m.order !== k + 1) G.DB.update('gallery', m.id, { order: k + 1 }); });
}

const editMedia = (id) => openEditor({
  title: 'Edit media', item: G.DB.get('gallery', id),
  fields: [{ k: 'title', label: 'Caption', type: 'i18n' }, { k: 'eventId', label: 'Event these belong to', type: 'select', opts: eventOptions() }, { k: 'category', label: 'Category', type: 'select', opts: CATEGORIES }, { k: 'date', label: 'Date', type: 'date' }, { k: 'featured', label: 'Show in the home video section (videos)', type: 'checkbox' }],
  onSave: (o) => { G.DB.update('gallery', id, o); G.audit('GALLERY_UPDATE', 'gallery', id); }
});

const addByLink = () => openEditor({
  title: 'Add video', item: { type: 'VIDEO', category: 'community', date: G.today() },
  fields: [{ k: 'title', label: 'Title', type: 'i18n' }, { k: 'eventId', label: 'Event it belongs to', type: 'select', opts: eventOptions() }, { k: 'src', label: 'Video file path or URL (.mp4)', full: true, req: true }, { k: 'category', label: 'Category', type: 'select', opts: CATEGORIES }, { k: 'date', label: 'Date', type: 'date' }, { k: 'featured', label: 'Show in the home video section (videos)', type: 'checkbox' }],
  onSave: (o) => {
    o.type = 'VIDEO'; o.src = G.safeUrl(o.src, '');
    if (!o.src) return toast('That video address is not allowed. Use a file path like assets/gallery/x.mp4 or an https:// link.', '⚠️');
    G.DB.add('gallery', o); G.audit('GALLERY_ADD', 'gallery');
  }
});

export default function Gallery() {
  const [f, setF] = useSticky('gal', { q: '', type: 'ALL', cat: 'ALL', ev: 'ALL', upCat: 'community', upEv: '', ai: false });
  const [selected, setSelected] = useState(() => new Set());
  const [note, setNote] = useState('');
  const [over, setOver] = useState(false);
  const input = useRef(null);
  const change = (patch) => setF((x) => ({ ...x, ...patch }));
  const q = f.q.toLowerCase();
  const rows = G.sortMedia(G.DB.all('gallery')).filter((m) => (f.type === 'ALL' || m.type === f.type) && (f.cat === 'ALL' || m.category === f.cat) && (f.ev === 'ALL' || (m.eventId || '') === f.ev) && (!q || (Object.values(m.title || {}).join(' ') + ' ' + m.date).toLowerCase().includes(q)));

  const add = async (files) => {
    const list = Array.from(files).filter((x) => /^(image\/(jpeg|png|webp)|video\/(mp4|webm))$/.test(x.type));
    if (!list.length) return toast('Choose photos (JPG, PNG, WebP) or videos (MP4, WebM).', '⚠️');
    const real = !!(G.cloud && G.cloud.canWrite());
    let done = 0, skipped = 0, failed = 0, i = 0;
    let order = Math.min(0, ...G.DB.all('gallery').map((m) => (m.order == null ? 0 : m.order))) - list.length - 1;
    for (const file of list) {
      setNote(`Adding ${++i} of ${list.length}…`);
      const video = /^video\//.test(file.type);
      let src = '', title = file.name.replace(/\.\w+$/, '').replace(/[_-]+/g, ' ').slice(0, 90);
      try {
        if (video) { if (!real) { skipped++; continue; } src = await G.cloud.uploadMedia(file); }
        else {
          const data = await compressImage(file, 1280, 0.78, 260000);
          if (f.ai) { const r = await aiPost(CFG.captionApi || '/api/caption-photo', { image: data }); if (r.status === 200 && r.caption) title = r.caption; else setNote('AI caption not available: ' + aiMsg(r)); }
          src = real ? await G.cloud.uploadMedia(toBlob(data)) : data;
        }
      } catch { failed++; continue; }
      const before = localStorage.getItem('gigf_db_v2');
      const item = G.DB.add('gallery', { eventId: f.upEv, type: video ? 'VIDEO' : 'PHOTO', src, category: f.upCat, date: G.today(), featured: false, order: ++order, title: { en: title, kn: '', hi: '' } });
      if (localStorage.getItem('gigf_db_v2') === before) { G.DB.remove('gallery', item.id); toast('This browser is full. Delete some pictures, or sign in with your real admin account.', '⚠️'); break; }
      done++;
    }
    setNote('');
    if (input.current) input.current.value = '';
    if (done) G.audit('GALLERY_UPLOAD', 'gallery', '', done + ' file(s)');
    toast(`${done} added` + (skipped ? `. ${skipped} video(s) need your real admin account to upload` : '') + (failed ? `. ${failed} failed` : ''), done ? '✅' : 'ℹ️');
  };

  const toggle = (id, on) => setSelected((s) => { const next = new Set(s); if (on) next.add(id); else next.delete(id); return next; });
  const bulk = (patch) => { selected.forEach((id) => G.DB.update('gallery', id, patch)); G.audit('GALLERY_BULK', 'gallery', '', selected.size + ' item(s)'); toast(selected.size + ' updated', '✅'); };
  const star = () => {
    const on = !Array.from(selected).every((id) => (G.DB.get('gallery', id) || {}).featured);
    selected.forEach((id) => G.DB.update('gallery', id, { featured: on }));
    toast(on ? 'Shown first in the home video section (videos only)' : 'Removed from the home video section', '⭐');
  };
  const bulkDelete = () => {
    if (!confirm(`Delete ${selected.size} item(s)? This cannot be undone.`)) return;
    selected.forEach(removeMedia); G.audit('GALLERY_DELETE', 'gallery', '', selected.size + ' item(s)'); setSelected(new Set());
  };
  const removeOne = (id) => { if (confirm('Delete this media?')) { removeMedia(id); toggle(id, false); G.audit('GALLERY_DELETE', 'gallery', id); } };
  const select = (id, key, list, width) => <select id={id} className="search" style={{ flex: '0 1 ' + width + 'px' }} value={f[key]} onChange={(e) => change({ [key]: e.target.value })}><Options list={list} /></select>;

  return (
    <>
      <div className="toolbar"><h3 style={{ flex: 1 }}>Gallery manager</h3><Btn onClick={addByLink}>🔗 Add video by link</Btn></div>
      <div className="card card-body" id="galDrop" style={{ border: '2px dashed #86efac', marginBottom: 14, background: over ? '#f0fdf4' : undefined }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}>
        <b>⬇ Add photos and videos</b> <small>(drop them here or choose)</small>
        <div className="toolbar" style={{ marginTop: 8 }}>
          <label style={{ flex: '0 1 220px' }}>Programme<select id="galCat" className="search" value={f.upCat} onChange={(e) => change({ upCat: e.target.value })}><Options list={CATEGORIES} /></select></label>
          <label style={{ flex: '0 1 260px' }}>Event<select id="galEvent" className="search" value={f.upEv} onChange={(e) => change({ upEv: e.target.value })}><Options list={eventOptions()} /></select></label>
          <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer', alignSelf: 'end' }}>Choose files<input id="galUp" ref={input} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" multiple hidden onChange={(e) => add(e.target.files)} /></label>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '.86rem' }}><input type="checkbox" id="galAi" checked={f.ai} onChange={(e) => change({ ai: e.target.checked })} /> ✨ Suggest captions with AI</label>
        <small style={{ color: '#6b7280' }}>AI sends each photo to an outside service: leave it off for children or anyone who has not agreed. <span id="galStatus">{note}</span></small>
      </div>
      <div className="toolbar">
        <input className="search" id="galQ" placeholder="Search caption or date" value={f.q} onChange={(e) => change({ q: e.target.value })} />
        {select('galType', 'type', [['ALL', 'All types'], ['PHOTO', 'Photos'], ['VIDEO', 'Videos']], 130)}
        {select('galFcat', 'cat', [['ALL', 'All programmes']].concat(CATEGORIES), 190)}
        {select('galFev', 'ev', [['ALL', 'All events']].concat(eventOptions()), 220)}
        <Btn onClick={() => setSelected(new Set([...selected, ...rows.map((m) => m.id)]))}>Select all shown</Btn>
      </div>
      <div id="galBulk">
        {selected.size > 0 && (
          <div className="note gal-bulk"><b>{selected.size + ' selected'}</b>
            <select id="bulkCat" value="" onChange={(e) => { if (e.target.value) bulk({ category: e.target.value }); }}><Options list={[['', 'Move to programme…']].concat(CATEGORIES)} /></select>
            <select id="bulkEv" value="-" onChange={(e) => { if (e.target.value !== '-') bulk({ eventId: e.target.value }); }}><Options list={[['-', 'Set event…']].concat(eventOptions())} /></select>
            <Btn onClick={star}>⭐ Home video section on/off</Btn><Btn kind="btn-danger" onClick={bulkDelete}>Delete selected</Btn><Btn onClick={() => setSelected(new Set())}>Clear</Btn>
          </div>
        )}
      </div>
      <div id="galList">
        {rows.length ? (
          <div className="gal-admin">{rows.map((m) => {
            const ev = m.eventId && G.DB.get('events', m.eventId);
            return (
              <figure key={m.id} className={'gal-item ' + (selected.has(m.id) ? 'on' : '')}>
                <label><input type="checkbox" data-sel={m.id} checked={selected.has(m.id)} onChange={(e) => toggle(m.id, e.target.checked)} /> {(m.type === 'VIDEO' ? '🎬' : '📷') + (m.featured ? ' ⭐' : '')}</label>
                {m.type === 'VIDEO' ? <video src={G.mediaUrl(m.src) + '#t=0.6'} preload="metadata" muted playsInline /> : <img src={G.mediaUrl(m.src)} alt="" loading="lazy" />}
                <figcaption><b>{tr(m.title)}</b><small>{catName(m.category) + (ev ? ' · ' + tr(ev.title) : '')}</small></figcaption>
                <div className="gal-act"><Btn onClick={() => move(rows, m.id, -1)}>←</Btn><Btn onClick={() => move(rows, m.id, 1)}>→</Btn><Btn onClick={() => editMedia(m.id)}>✏️</Btn><Btn onClick={() => removeOne(m.id)}>🗑️</Btn></div>
              </figure>
            );
          })}</div>
        ) : <Empty icon="🖼️">Nothing matches.</Empty>}
      </div>
    </>
  );
}
