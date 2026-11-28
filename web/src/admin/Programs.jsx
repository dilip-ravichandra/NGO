/** Programmes: list, ordering, and the add / edit form (by hand, voice or AI). */
import { useRef, useState } from 'react';
import { G, CFG, tr } from '../lib/gigf.js';
import { keepIfSame, slugBase } from '../lib/adminLogic.js';
import { openModal, toast } from '../ui/feedback.jsx';
import { INLINE_IMG } from '../ui/common.jsx';
import { Table, Btn, Chip, Mic, VoicePicker, aiPost, aiMsg, compressImage, ensureTranslations } from './shared.jsx';

const picUrl = (u) => (INLINE_IMG.test(u || '') ? u : G.safeUrl(u, ''));
const en = (v) => (v && v.en) || '';
const sorted = () => G.DB.all('programs').slice().sort((a, b) => a.order - b.order);

function move(id, step) {
  const list = sorted(), i = list.findIndex((p) => p.id === id), j = i + step;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  list.forEach((p, k) => { if (p.order !== k + 1) G.DB.update('programs', p.id, { order: k + 1 }); });
  G.audit('PROGRAM_ORDER', 'program', id);
}

function ProgramForm({ id, close }) {
  const p = (id && G.DB.get('programs', id)) || { icon: '🌿', active: true };
  const [library] = useState(() => G.DB.all('gallery').filter((g) => g.type === 'VIDEO'));
  const chosen = p.videos || [];
  const [cover, setCover] = useState(p.img || '');
  const [photos, setPhotos] = useState(() => (p.photos || []).slice());
  const [status, setStatus] = useState('');
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bad, setBad] = useState({});
  const form = useRef(null), say = useRef(null), flyer = useRef('');
  const refs = { title: useRef(null), tagline: useRef(null), desc: useRef(null), initiatives: useRef(null) };

  const read = async () => {
    const text = say.current.value.trim();
    if (!text && !flyer.current) return toast('Say or type something about the programme first.', 'ℹ️');
    setReading(true); setStatus('✨ Writing…');
    const r = await aiPost(CFG.extractProgramApi || '/api/extract-program', { text, image: flyer.current });
    setReading(false);
    if (r.status !== 200 || !r.draft) return setStatus('⚠️ ' + aiMsg(r) + ' You can still fill the form yourself.');
    const d = r.draft, put = (n, v) => { if (v && form.current) form.current.elements[n].value = v; };
    put('title', d.title); put('tagline', d.tagline); put('desc', d.description); put('icon', d.icon);
    put('initiatives', (d.initiatives || []).join('\n')); put('impact', (d.impact || []).map((x) => x.value + ' | ' + x.label).join('\n'));
    setStatus('✔ Filled in. Please check, then Save.' + ((r.warnings || []).length ? ' ⚠️ ' + r.warnings.join(' · ') : ''));
  };
  const pickCover = async (e) => { try { setCover(await compressImage(e.target.files[0], 900, 0.78, 180000)); } catch { toast('Could not open that picture.', '⚠️'); } };
  const pickPhotos = async (e) => {
    const files = Array.from(e.target.files), next = photos.slice();
    e.target.value = '';
    for (const file of files) {
      if (next.length >= 6) { toast('Six photos at most.', 'ℹ️'); break; }
      try { next.push(await compressImage(file, 800, 0.72, 120000)); } catch { toast('Skipped a file that is not a picture.', '⚠️'); }
    }
    setPhotos(next);
  };
  const pickFlyer = async (e) => {
    const file = e.target.files[0];
    try {
      flyer.current = await compressImage(file, 1500, 0.82, 2600000);
      setStatus('📎 ' + file.name + ' attached');
      if (!cover) setCover(await compressImage(file, 900, 0.78, 180000));
    } catch { toast('Could not open that picture.', '⚠️'); }
  };

  const submit = async (e) => {
    e.preventDefault();
    const f = e.target;
    if (saving) return;
    const v = (n) => String(f.elements[n].value || '').trim(), lines = (n) => v(n).split('\n').map((x) => x.trim()).filter(Boolean);
    const wrong = { title: v('title').length < 3, desc: v('desc').length < 10 };
    setBad(wrong);
    if (wrong.title || wrong.desc) return toast('Please fill the highlighted fields.', '⚠️');
    const videos = Array.from(f.querySelectorAll('[data-vid]:checked')).map((x) => library[Number(x.dataset.vid)].src);
    for (const u of lines('videos')) { if (!G.safeUrl(u, '')) return toast('This video address is not allowed: ' + u, '⚠️'); videos.push(u); }
    setSaving(true);
    const item = { title: keepIfSame(p.title, v('title')), tagline: keepIfSame(p.tagline, v('tagline')), desc: keepIfSame(p.desc, v('desc')) };
    const initiatives = lines('initiatives').slice(0, 10).map((text) => keepIfSame((p.initiatives || []).find((x) => en(x) === text), text));
    const box = { ...item };
    initiatives.forEach((x, i) => { box['i' + i] = x; });
    try { await ensureTranslations(box, Object.keys(box)); } catch { /* save without translations */ }
    Object.assign(item, {
      initiatives, icon: v('icon').replace(/[<>"'&`]/g, '').slice(0, 8) || '🌿', active: f.elements.active.checked,
      impact: lines('impact').slice(0, 4).map((l) => { const [value, ...rest] = l.split('|'); return { value: value.trim().slice(0, 20), label: rest.join('|').trim().slice(0, 60) }; }).filter((x) => x.value && x.label),
      img: cover || 'assets/about_natural_sprout.jpg', photos, videos
    });
    const before = localStorage.getItem('gigf_db_v2');
    if (id) G.DB.update('programs', id, item);
    else {
      const slug = slugBase(v('title'), 'programme') + '-' + Date.now().toString(36).slice(-3);
      G.DB.add('programs', Object.assign(item, { id: slug, slug, order: Math.max(0, ...G.DB.all('programs').map((x) => x.order || 0)) + 1 }));
    }
    if (localStorage.getItem('gigf_db_v2') === before) toast('This browser is out of space: use fewer or smaller photos.', '⚠️'); else toast('Programme saved', '✅');
    G.audit(id ? 'PROGRAM_UPDATE' : 'PROGRAM_ADD', 'program', id || v('title'));
    close();
  };

  return (
    <>
      <div className="pg-ai"><b>Let the AI fill it in</b>
        <p style={{ fontSize: '.82rem', color: '#4b5563' }}>{`Say or type what the programme does, in any language${id ? ' (this replaces the text below)' : ''}. You check everything before saving.`}</p>
        <textarea id="pgSay" ref={say} rows="3" maxLength={6000} placeholder="e.g. We run free computer classes for village youth every weekend in Ramamurthy Nagar. We teach basics, typing and online forms. 40 students so far." />
        <Mic target={say} onDone={(text) => { if (text.length >= 15 && !reading) read(); }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
          <VoicePicker />
          <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>📷 Flyer picture<input type="file" id="pgFlyer" accept="image/jpeg,image/png,image/webp" hidden onChange={pickFlyer} /></label>
          <button type="button" className="btn btn-primary btn-sm" id="pgRead" disabled={reading} onClick={read}>✨ Fill the form</button>
          <span id="pgStatus" className="ai-status">{status}</span>
        </div>
      </div>
      <form id="pgForm" className="f-grid" noValidate ref={form} onSubmit={submit}>
        <div className={'field f-full' + (bad.title ? ' bad' : '')}><label>Name *</label><input name="title" ref={refs.title} maxLength={80} defaultValue={en(p.title)} /><Mic target={refs.title} /><span className="err">Please give the programme a name</span></div>
        <div className="field"><label>Icon (one emoji)</label><input name="icon" maxLength={8} defaultValue={p.icon || '🌿'} /></div>
        <div className="field"><label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" name="active" style={{ width: 'auto' }} defaultChecked={p.active !== false} /> Visible on the website</label></div>
        <div className="field f-full"><label>Short line</label><input name="tagline" ref={refs.tagline} maxLength={140} defaultValue={en(p.tagline)} /><Mic target={refs.tagline} /></div>
        <div className={'field f-full' + (bad.desc ? ' bad' : '')}><label>Description *</label><textarea name="desc" ref={refs.desc} rows="4" maxLength={900} defaultValue={en(p.desc)} /><Mic target={refs.desc} /><span className="err">Please add a description</span></div>
        <div className="field f-full"><label>Initiatives (one per line)</label><textarea name="initiatives" ref={refs.initiatives} rows="4" defaultValue={(p.initiatives || []).map((x) => (typeof x === 'string' ? x : en(x))).join('\n')} /><Mic target={refs.initiatives} /></div>
        <div className="field f-full"><label>Impact figures (one per line, as number | what it counts)</label><textarea name="impact" rows="3" placeholder="40 | students trained" defaultValue={(p.impact || []).map((x) => x.value + ' | ' + x.label).join('\n')} /></div>
        <div className="field f-full"><label>Cover picture</label><input type="file" id="pgCover" accept="image/jpeg,image/png,image/webp" onChange={pickCover} />
          <div className="look-prev" id="pgCoverPrev">{picUrl(cover) ? <img src={picUrl(cover)} alt="Cover" /> : <span style={{ color: '#9ca3af' }}>A default picture will be used</span>}</div></div>
        <div className="field f-full"><label>More photos (up to 6)</label><input type="file" id="pgPhotos" accept="image/jpeg,image/png,image/webp" multiple onChange={pickPhotos} />
          <div className="pg-thumbs" id="pgThumbs">{photos.map((u, i) => <span key={i}><img src={picUrl(u)} alt="" /><button type="button" aria-label="Remove photo" onClick={() => setPhotos(photos.filter((_, k) => k !== i))}>×</button></span>)}</div></div>
        <div className="field f-full"><label>Videos</label>
          {library.map((g, i) => <label key={g.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 500 }}><input type="checkbox" data-vid={i} style={{ width: 'auto' }} defaultChecked={chosen.includes(g.src)} /> {tr(g.title)}</label>)}
          <textarea name="videos" rows="2" placeholder="Or paste links, one per line (a YouTube link, or a video file in assets/)" defaultValue={chosen.filter((v) => !library.some((g) => g.src === v)).join('\n')} /></div>
        <div className="f-full" style={{ display: 'flex', gap: 8 }}><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save programme'}</button><button type="button" className="btn btn-ghost" onClick={close}>Cancel</button></div>
      </form>
    </>
  );
}

const openForm = (id) => openModal({ wide: true, title: id ? '✏️ Edit programme' : '✨ New programme', render: (close) => <ProgramForm id={id} close={close} /> });

export default function Programs() {
  const remove = (p) => {
    const used = G.DB.all('events').filter((e) => e.program === p.id).length;
    if (!confirm(`Delete “${tr(p.title)}”?` + (used ? ` ${used} event(s) belong to it and will no longer show a programme.` : '') + ' This cannot be undone.')) return;
    G.DB.remove('programs', p.id); G.audit('PROGRAM_DELETE', 'program', p.id);
  };
  return (
    <>
      <div className="toolbar"><h3 style={{ flex: 1 }}>Programmes</h3><Btn kind="btn-orange" onClick={() => openForm(null)}>✨ New programme</Btn></div>
      <p style={{ color: '#4b5563', fontSize: '.86rem', marginBottom: 10 }}>Speak, type or drop a flyer and the AI fills the form, or fill it yourself.</p>
      <Table
        cols={[[(r) => r.icon, ''], [(r) => tr(r.title), 'Title'], [(r) => <Chip s={r.active ? 'PUBLISHED' : 'DRAFT'} />, 'Visible'], [(r) => (r.initiatives || []).length, 'Initiatives'], [(r) => (r.photos || []).length + ' / ' + (r.videos || []).length, 'Photos / videos'], [(r) => (r.impact || []).length, 'Figures']]}
        rows={sorted()}
        actions={(r) => <><Btn onClick={() => move(r.id, -1)}>↑</Btn><Btn onClick={() => move(r.id, 1)}>↓</Btn><Btn onClick={() => openForm(r.id)}>✏️ Edit</Btn><Btn onClick={() => remove(r)}>🗑️</Btn></>}
      />
    </>
  );
}
