import { useState } from 'react';
import { G, t } from '../lib/gigf.js';
import { V, check, isOk, formValues } from '../lib/validate.js';
import { toast } from '../ui/feedback.jsx';
import { PageHero, Field } from '../ui/common.jsx';

const SUBJECTS = ['General enquiry', 'CSR / corporate partnership', 'Goshala visit', 'Organise a plantation in my area', 'Volunteer opportunities'];

export default function Contact() {
  const o = G.ORG, u = G.Auth.current();
  const [bad, setBad] = useState({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);
  const submit = (e) => {
    e.preventDefault();
    const form = e.target, f = formValues(form);
    const wrong = check(f, { name: V.req, email: V.email, phone: (v) => !v.trim() || V.phone(v), message: V.msg });
    setBad(wrong);
    if (!isOk(wrong)) { toast('Please fix the highlighted fields.', '⚠️'); return; }
    setBusy(true);
    setTimeout(() => {
      const ticket = G.Tickets.create({ category: 'CONTACT', name: f.name, email: f.email, phone: f.phone, subject: f.subject, message: f.message });
      setSent({ no: ticket.no, email: ticket.email }); setBusy(false); form.reset(); toast('Message sent', '✉️');
    }, 600);
  };
  const hello = encodeURIComponent('Hello, I would like to know more about Green India Gokul Foundation');
  return (
    <>
      <PageHero title={t('page.contact')} lead="We would love to hear from you." />
      <section className="section"><div className="wrap"><div className="grid g4" id="contactTiles">
        <div className="card contact-tile reveal"><span className="e">📞</span><h4>Helpline</h4>{o.phones.map((p) => <div key={p.tel}><a href={'tel:' + p.tel}>{p.display}</a></div>)}</div>
        <div className="card contact-tile reveal"><span className="e">✉️</span><h4>Email</h4><a href={'mailto:' + o.email} style={{ wordBreak: 'break-all' }}>{o.email}</a></div>
        <div className="card contact-tile reveal"><span className="e">💬</span><h4>WhatsApp</h4>{o.phones.map((p) => <div key={p.wa}><a target="_blank" rel="noopener" href={`https://wa.me/${p.wa}?text=${hello}`}>{'Chat on ' + p.display}</a></div>)}</div>
        <div className="card contact-tile reveal"><span className="e">📍</span><h4>Office</h4><div style={{ fontSize: '.84rem' }}>{o.address}</div><a href={o.mapLink} target="_blank" rel="noopener">Open in Google Maps ↗</a></div>
      </div></div></section>
      <section className="section alt"><div className="wrap"><div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card card-body reveal">
          <h3 style={{ color: 'var(--primary-dark)', marginBottom: 12 }}>{t('btn.send')}</h3>
          <form id="contactForm" className="f-grid" noValidate onSubmit={submit}>
            <Field label={t('f.name') + ' *'} error="Please enter your name" bad={bad.name}><input name="name" defaultValue={u ? u.name : ''} /></Field>
            <Field label={t('f.phone')} error="Enter a valid 10-digit mobile" bad={bad.phone}><input name="phone" inputMode="tel" defaultValue={u ? u.phone || '' : ''} /></Field>
            <Field label={t('f.email') + ' *'} error="Enter a valid email" bad={bad.email} full><input name="email" type="email" defaultValue={u ? u.email : ''} /></Field>
            <Field label={t('f.subject')} full><select name="subject">{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label={t('f.message') + ' *'} error="Please write at least 10 characters" bad={bad.message} full><textarea name="message" rows="4" /></Field>
            <button className="btn btn-primary f-full" type="submit" disabled={busy}>{busy ? <span className="spinner" /> : t('btn.send')}</button>
          </form>
          <div id="contactResult" style={{ marginTop: 12 }}>
            {sent && <div className="note green"><b>Thank you!</b> Your message is logged as <b>{sent.no}</b>. We will reply on {sent.email}.<br /><a target="_blank" rel="noopener" href={o.waLink('Hello, my enquiry reference is ' + sent.no)}>Need it faster? WhatsApp us →</a></div>}
          </div>
        </div>
        <iframe id="map" className="map" title="Office location map" src={o.mapEmbed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
      </div></div></section>
    </>
  );
}
