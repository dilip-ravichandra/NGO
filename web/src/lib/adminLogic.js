/** Admin calculations with no browser or page needed - covered by unit tests. */

/** CSV text for Excel. A visitor-typed value starting with = + - @ would run as a formula, so it is prefixed with '. */
export function csvText(cols, rows) {
  const safe = (v) => { v = String(v == null ? '' : v); return /^\s*[=@]/.test(v) || /^[\t\r]/.test(v) || /^\s*[+-](?![\d\s]*$)/.test(v) ? "'" + v : v; };
  const q = (v) => '"' + safe(v).replace(/"/g, '""') + '"';
  return '﻿' + [cols.map((c) => q(c[1])).join(',')].concat(rows.map((r) => cols.map((c) => q(typeof c[0] === 'function' ? c[0](r) : r[c[0]])).join(','))).join('\n');
}

/** confirmed donations grouped by 'month' | 'program' | 'method' */
export function donationSummary(donations, kind) {
  const m = new Map();
  donations.filter((d) => d.status === 'CAPTURED').forEach((d) => {
    const key = kind === 'month' ? String(d.createdAt).slice(0, 7) : kind === 'program' ? d.program : d.method;
    const x = m.get(key) || { key, count: 0, total: 0 };
    x.count++; x.total += d.amount; m.set(key, x);
  });
  return Array.from(m.values()).sort((a, b) => (kind === 'month' ? b.key.localeCompare(a.key) : b.total - a.total));
}

/** donation ledger filter: status, programme, method, text and date range */
export function filterDonations(list, f) {
  return list.filter((d) => (f.st === 'ALL' || d.status === f.st) && (f.pg === 'ALL' || d.program === f.pg) && (f.md === 'ALL' || d.method === f.md) &&
    (!f.q || (d.donorName + d.donorEmail + d.receiptNo + d.paymentId + (d.utr || '')).toLowerCase().includes(f.q.toLowerCase())) &&
    (!f.from || d.createdAt.slice(0, 10) >= f.from) && (!f.to || d.createdAt.slice(0, 10) <= f.to));
}

/** "value | label" lines -> [{value,label}] */
export const parseImpact = (text) => String(text).split('\n').map((l) => l.split('|')).filter((p) => p.length === 2 && p[0].trim()).map((p) => ({ value: p[0].trim(), label: p[1].trim() }));

export const slugBase = (text, fallback) => (String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || fallback).slice(0, 40);

/** a translation is dropped when its English text changed, so it is translated afresh */
export const keepIfSame = (old, english) => (old && old.en === english ? { ...old } : { en: english });
