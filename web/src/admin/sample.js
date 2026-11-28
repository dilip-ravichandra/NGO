/** Sample data so the admin screens can be learnt (this browser only; nothing is sent anywhere). */
import { G, tr } from '../lib/gigf.js';

export function removeSample() {
  const ids = new Set(G.DB.all('donations').filter((d) => d.sample).map((d) => d.id));
  ['donations', 'users', 'tickets', 'volunteers', 'registrations'].forEach((c) => G.DB.all(c).filter((x) => x.sample || (c === 'tickets' && ids.has(x.donationId))).map((x) => x.id).forEach((id) => G.DB.remove(c, id)));
}

export function loadSample() {
  removeSample();   // pressing twice never duplicates
  const names = ['Asha Rao', 'Ravi Kumar', 'Meena Iyer', 'Suresh Gowda', 'Fatima Khan', 'John Mathew', 'Lakshmi Devi', 'Arjun Shetty', 'Priya Nair', 'Vikram Singh'];
  const people = names.map((name, i) => ({ name, email: name.split(' ')[0].toLowerCase() + '@example.com', phone: '90000000' + String(i + 1).padStart(2, '0') }));
  const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
  people.forEach((p, i) => G.DB.add('users', { role: i % 3 === 0 ? 'VOLUNTEER' : 'DONOR', hash: '', salt: '', sample: true, createdAt: ago(3000 - i * 100), ...p }));
  const programs = G.DB.all('programs').map((x) => tr(x.title));
  // [person, amount, method, outcome, minutes ago, frequency]
  const pays = [[0, 1000, 'UPI', 'CAPTURED', 2900, 'ONE_TIME'], [1, 500, 'Card', 'CAPTURED', 2400, 'MONTHLY'], [2, 2500, 'Netbanking', 'CAPTURED', 1500, 'ONE_TIME'], [3, 250, 'UPI', 'FAILED', 900, 'ONE_TIME'], [4, 5000, 'Card', 'CAPTURED', 600, 'ONE_TIME'], [5, 750, 'UPI', 'PENDING', 90, 'ONE_TIME'], [6, 1500, 'Netbanking', 'FAILED', 60, 'ONE_TIME'], [7, 100, 'UPI', 'CAPTURED', 30, 'MONTHLY'], [8, 3000, 'Card', 'PENDING', 5, 'ONE_TIME'], [9, 2000, 'UPI', 'FAILED', 3, 'ONE_TIME']];
  pays.forEach(([n, amount, method, status, min, frequency], i) => {
    const p = people[n], key = Date.now().toString(36) + i;
    const d = G.DB.add('donations', { donorName: p.name, donorEmail: p.email, donorPhone: p.phone, donorPan: '', program: programs[i % programs.length], amount, frequency, method, userEmail: p.email, orderId: 'demo_order_' + key, paymentId: status === 'CAPTURED' ? 'demo_pay_' + key : '', status, receiptNo: '', demo: true, sample: true, createdAt: ago(min) });
    G.audit('PAYMENT_' + status, 'donation', d.id, 'sample data · ' + G.inr(amount) + ' · ' + method);
    if (status === 'CAPTURED') G.Donations.issueReceipt(d.id);
    if (status === 'FAILED' && i !== 9) { const t = G.Tickets.create({ category: 'PAYMENT_ISSUE', name: p.name, email: p.email, phone: p.phone, subject: 'Payment FAILED', message: i === 3 ? 'Money was debited from my account but the page said failed. Please check.' : 'My net-banking payment of ' + G.inr(amount) + ' failed. Can I try again?', donationId: d.id }); G.DB.update('tickets', t.id, { sample: true }); }
  });
  [[0, 'APPROVED'], [3, 'PENDING'], [6, 'PENDING']].forEach(([n, status]) => { const p = people[n]; const v = G.Volunteers.apply({ name: p.name, email: p.email, phone: p.phone, city: 'Bengaluru', domain: 'Tree plantation', idType: 'Aadhaar', idFile: 'sample-id.jpg' }); G.DB.update('volunteers', v.id, { sample: true, status }); });
  const ev = G.DB.all('events').find((e) => e.status === 'UPCOMING');
  if (ev) [1, 2, 4, 8].forEach((n) => G.DB.add('registrations', { eventId: ev.id, guests: 1, asVolunteer: false, sample: true, ...people[n] }));
  [[2, 'Volunteering', 'How can I volunteer on weekends?'], [4, '80G certificate', 'Please send me an 80G certificate for my donation.']].forEach(([n, subject, message]) => { const p = people[n]; const t = G.Tickets.create({ category: 'CONTACT', name: p.name, email: p.email, phone: p.phone, subject, message }); G.DB.update('tickets', t.id, { sample: true }); });
  G.Donations.reconcile();   // the 90-minute-old pending payment gets flagged automatically
}
