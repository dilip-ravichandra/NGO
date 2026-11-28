import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHash, fromLegacy, toHref, safeNext, friendlyFromLocation } from '../../src/lib/routes.js';
import { V, check, isOk } from '../../src/lib/validate.js';
import { csvText, donationSummary, filterDonations, parseImpact, slugBase, keepIfSame } from '../../src/lib/adminLogic.js';

test('addresses: friendly hashes', () => {
  assert.deepEqual(parseHash(''), { page: 'home', search: '', anchor: '' });
  assert.deepEqual(parseHash('#donate?program=cow'), { page: 'donate', search: '?program=cow', anchor: '' });
  assert.deepEqual(parseHash('#events/ev-1'), { page: 'events', search: '', anchor: 'ev-1' });
  assert.deepEqual(parseHash('#volunteers'), { page: 'volunteer', search: '', anchor: '' });
  assert.deepEqual(parseHash('#about'), { page: null, search: '', anchor: 'about' });
});

test('addresses: old page.html links keep working', () => {
  assert.equal(fromLegacy('index.html'), '#home');
  assert.equal(fromLegacy('programs.html#cow-protection'), '#programs/cow-protection');
  assert.equal(fromLegacy('donate.html?program=cow'), '#donate?program=cow');
  assert.equal(fromLegacy('admin.html#issues'), 'admin.html#issues');
  assert.equal(fromLegacy('https://example.com/a.html'), null);
  assert.equal(fromLegacy('javascript:alert(1)'), null);
  assert.equal(toHref('donate.html', true), 'index.html#donate');
  assert.equal(toHref('donate.html', false), '#donate');
  assert.equal(toHref('mailto:a@b.co', false), 'mailto:a@b.co');
});

test('login "next" only accepts our own pages', () => {
  assert.equal(safeNext('donate.html?program=cow'), 'donate.html?program=cow');
  for (const bad of ['https://evil.example', '//evil.example', 'javascript:alert(1)', 'login.html', '../x.html', '']) assert.equal(safeNext(bad), '', bad);
});

test('form rules', () => {
  assert.ok(V.phone('+91 98765 43210'));
  assert.ok(!V.phone('12345'));
  assert.ok(V.pan(''));
  assert.ok(V.pan('abcde1234f'));
  assert.ok(!V.pan('ABC'));
  assert.ok(V.utr('1234 5678 9012'));
  assert.ok(!V.utr('12345678901'));
  const bad = check({ name: 'A', email: 'x@y.in' }, { name: V.req, email: V.email });
  assert.deepEqual(bad, { name: true });
  assert.ok(!isOk(bad));
});

test('CSV cannot smuggle a spreadsheet formula', () => {
  const csv = csvText([['a', 'A'], ['b', 'B']], [{ a: '=HYPERLINK("x")', b: '+91 98765 43210' }, { a: '@cmd', b: '-5' }]);
  assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`));
  assert.ok(csv.includes(`"'@cmd"`));
  assert.ok(csv.includes('"+91 98765 43210"'));
  assert.ok(csv.includes('"-5"'));
});

const donations = [
  { donorName: 'Asha', donorEmail: 'a@x.in', receiptNo: 'R1', paymentId: 'p1', program: 'Cow', method: 'UPI', status: 'CAPTURED', amount: 500, createdAt: '2026-10-02T00:00:00Z' },
  { donorName: 'Ravi', donorEmail: 'r@x.in', receiptNo: 'R2', paymentId: 'p2', program: 'Tree', method: 'Card', status: 'CAPTURED', amount: 900, createdAt: '2026-11-05T00:00:00Z' },
  { donorName: 'Meena', donorEmail: 'm@x.in', receiptNo: '', paymentId: '', program: 'Cow', method: 'UPI', status: 'FAILED', amount: 100, createdAt: '2026-11-06T00:00:00Z' }
];

test('donation reports count only confirmed money', () => {
  assert.deepEqual(donationSummary(donations, 'month').map((r) => [r.key, r.total]), [['2026-11', 900], ['2026-10', 500]]);
  assert.deepEqual(donationSummary(donations, 'program').map((r) => [r.key, r.total, r.count]), [['Tree', 900, 1], ['Cow', 500, 1]]);
});

test('donation ledger filters', () => {
  const all = { q: '', st: 'ALL', pg: 'ALL', md: 'ALL', from: '', to: '' };
  assert.equal(filterDonations(donations, all).length, 3);
  assert.equal(filterDonations(donations, { ...all, st: 'FAILED' }).length, 1);
  assert.equal(filterDonations(donations, { ...all, pg: 'Cow', md: 'UPI' }).length, 2);
  assert.equal(filterDonations(donations, { ...all, q: 'ravi' })[0].receiptNo, 'R2');
  assert.equal(filterDonations(donations, { ...all, from: '2026-11-01', to: '2026-11-05' }).length, 1);
});

test('settings and content helpers', () => {
  assert.deepEqual(parseImpact('40 | students\nbroken line\n | none'), [{ value: '40', label: 'students' }]);
  assert.equal(slugBase('Tree Walk, 2026!', 'event'), 'tree-walk-2026');
  assert.equal(slugBase('ಮರ', 'event'), 'event');
  assert.deepEqual(keepIfSame({ en: 'A', kn: 'ಅ' }, 'A'), { en: 'A', kn: 'ಅ' });
  assert.deepEqual(keepIfSame({ en: 'A', kn: 'ಅ' }, 'B'), { en: 'B' });
});

test('addresses: opening an old page file', () => {
  assert.equal(friendlyFromLocation('/NGO/donate.html', '?program=cow', ''), '/NGO/#donate?program=cow');
  assert.equal(friendlyFromLocation('/programs.html', '', '#cow-protection'), '/#programs/cow-protection');
  assert.equal(friendlyFromLocation('/index.html', '', '#privacy'), '');
  assert.equal(friendlyFromLocation('/', '', ''), '');
});
