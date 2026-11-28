/** Event card, event registration popup, poster popup and the picture/video lightbox. */
import { useEffect, useRef, useState } from 'react';
import { G, t, tr } from '../lib/gigf.js';
import { V, check, isOk, formValues } from '../lib/validate.js';
import { openModal, toast } from './feedback.jsx';
import { A, requireLogin } from './nav.jsx';
import { Field, progById, programTitle, safePoster } from './common.jsx';

const registrationsFor = (id) => G.DB.all('registrations').filter((r) => r.eventId === id);

function RegisterForm({ id, close }) {
  const e = G.DB.get('events', id), u = G.Auth.current() || {};
  const [bad, setBad] = useState({});
  const volLeft = Math.max(0, (e.volSlots == null ? 10 : e.volSlots) - registrationsFor(id).filter((r) => r.asVolunteer).length);
  const submit = (ev) => {
    ev.preventDefault();
    const f = formValues(ev.target);
    const wrong = check(f, { name: V.req, phone: V.phone, email: V.email });
    setBad(wrong);
    if (!isOk(wrong)) return;
    if (G.DB.all('registrations').some((r) => r.eventId === id && r.email.toLowerCase() === f.email.toLowerCase())) { toast('You are already registered for this event.', 'ℹ️'); return; }
    if (e.capacity - registrationsFor(id).length < Number(f.guests)) { toast('Not enough spots left for that many guests.', '⚠️'); return; }
    G.DB.add('registrations', { eventId: id, name: f.name, phone: f.phone, email: f.email, guests: Number(f.guests), asVolunteer: !!f.vol, attended: false });
    close();
    toast('Registered! See you at ' + tr(e.title), '🎉');
  };
  return (
    <>
      <p style={{ fontSize: '.84rem', color: '#4b5563', marginBottom: 12 }}>{G.fmtDate(e.date) + ' · ' + e.time + ' · ' + e.location}</p>
      <form id="regForm" noValidate className="f-grid" onSubmit={submit}>
        <Field label={t('f.name') + ' *'} error="Required" bad={bad.name}><input name="name" defaultValue={u.name || ''} /></Field>
        <Field label={t('f.phone') + ' *'} error="Enter a valid 10-digit mobile" bad={bad.phone}><input name="phone" inputMode="tel" defaultValue={u.phone || ''} placeholder="9XXXXXXXXX" /></Field>
        <Field label={t('f.email') + ' *'} error="Enter a valid email" bad={bad.email} full><input name="email" type="email" defaultValue={u.email || ''} /></Field>
        <Field label="Guests (incl. you)"><select name="guests">{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></Field>
        <div className="field" style={{ alignSelf: 'end' }}><label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}><input type="checkbox" name="vol" style={{ width: 'auto' }} disabled={!volLeft} /> {`Book a volunteer slot (${volLeft} left)`}</label></div>
        <button className="btn btn-primary f-full" type="submit">{t('btn.register') + ' →'}</button>
      </form>
    </>
  );
}

export function openRegister(id) {
  if (!requireLogin('event', 'events.html?reg=' + id)) return;
  const e = G.DB.get('events', id);
  if (!e) return;
  openModal({ title: '📅 ' + tr(e.title), render: (close) => <RegisterForm id={id} close={close} /> });
}

const openPoster = (e) => openModal({ wide: true, title: '🖼️ ' + tr(e.title), render: () => <img src={safePoster(e.poster)} alt="Event poster" style={{ width: '100%', borderRadius: 12 }} /> });

export function EventCard({ e, compact }) {
  const d = new Date(e.date), regs = registrationsFor(e.id).length, left = Math.max(0, e.capacity - regs), pct = Math.min(100, Math.round((regs / e.capacity) * 100));
  const prog = progById(e.program), poster = safePoster(e.poster);
  return (
    <article className="card lift ev-card reveal" id={e.slug}>
      <div className="ev-date"><b>{d.getDate()}</b><span>{d.toLocaleString('en', { month: 'short' })}</span><span>{d.getFullYear()}</span></div>
      <div className="ev-body">
        <h4><A to={'event.html?e=' + e.slug}>{tr(e.title)}</A></h4>
        <div className="ev-meta"><span>{'🕒 ' + e.time}</span><span>{'📍 ' + e.location}</span>{prog && <span>{prog.icon + ' ' + tr(prog.title)}</span>}</div>
        {!compact && <p style={{ fontSize: '.86rem', color: '#4b5563' }}>{tr(e.desc)}</p>}
        {!compact && poster && <img className="ev-poster" src={poster} alt={'Poster: ' + tr(e.title)} loading="lazy" onClick={() => openPoster(e)} />}
        {e.status === 'UPCOMING' ? (
          <>
            <div className="bar" title={pct + '% booked'}><i style={{ width: pct + '%' }} /></div>
            <div style={{ fontSize: '.74rem', color: '#6b7280', marginBottom: 8 }}>{left > 0 ? left + ' spots left' : 'Fully booked'}{e.tentative && <> · <span className="chip warn">Tentative</span></>}</div>
            <button type="button" className="btn btn-primary btn-sm" data-reg={e.id} disabled={!left} onClick={() => openRegister(e.id)}>{t('btn.register')}</button>
          </>
        ) : (
          <><span className="chip gray">Completed</span> <A className="link-more" to={'event.html?e=' + e.slug}>{'📸 ' + t('nav.gallery')}</A></>
        )}
      </div>
    </article>
  );
}

function Lightbox({ items, start, close }) {
  const [i, setI] = useState(start);
  const touch = useRef(null);
  const step = (d) => setI((x) => (x + d + items.length) % items.length);
  useEffect(() => {
    const key = (e) => { if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'ArrowRight') step(1); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  });
  const g = items[i];
  const ev = g.eventId && G.DB.get('events', g.eventId);
  return (
    <div className="lb" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) close(); }}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (touch.current == null) return; const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1); touch.current = null; }}>
      <button type="button" className="lb-btn lb-x" aria-label="Close" onClick={close} autoFocus>×</button>
      <button type="button" className="lb-btn lb-prev" aria-label="Previous" onClick={() => step(-1)}>‹</button>
      <div className="lb-stage">
        {g.type === 'VIDEO'
          ? <video key={g.id} src={G.mediaUrl(g.src)} controls autoPlay playsInline />
          : <img key={g.id} src={G.mediaUrl(g.src)} alt={tr(g.title)} />}
      </div>
      <button type="button" className="lb-btn lb-next" aria-label="Next" onClick={() => step(1)}>›</button>
      <div className="lb-cap">
        {tr(g.title)}<small>{G.fmtDate(g.date) + ' · ' + programTitle(g.category) + ' · ' + (i + 1) + '/' + items.length}</small>
        {ev && <div className="lb-event">{'📅 ' + tr(ev.title) + (ev.location ? ' · 📍 ' + ev.location : '')}</div>}
      </div>
    </div>
  );
}

/** the open lightbox lives next to the gallery grid */
export function useLightbox() {
  const [open, setOpen] = useState(null);
  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = 'hidden';
    const esc = (e) => { if (e.key === 'Escape') setOpen(null); };
    document.addEventListener('keydown', esc);
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', esc); };
  }, [open]);
  return {
    show: (items, start) => setOpen({ items, start }),
    node: open && <Lightbox items={open.items} start={open.start} close={() => setOpen(null)} />
  };
}
