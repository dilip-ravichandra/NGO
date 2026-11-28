/** Form rules shared by the public forms (pure, unit tested). */
export const V = {
  req: (v) => String(v).trim().length > 1,
  email: (v) => /^\S+@\S+\.\S+$/.test(String(v).trim()),
  phone: (v) => /^[6-9]\d{9}$/.test(String(v).replace(/\D/g, '').slice(-10)),
  msg: (v) => String(v).trim().length >= 10,
  pan: (v) => !String(v).trim() || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(String(v).trim().toUpperCase()),
  utr: (v) => /^\d{12}$/.test(String(v).replace(/\s/g, ''))
};

/** rules: { field: ruleFn }. Returns { field: true } for every field that is wrong. */
export function check(values, rules) {
  const bad = {};
  Object.keys(rules).forEach((n) => { if (!rules[n](values[n] == null ? '' : values[n])) bad[n] = true; });
  return bad;
}
export const isOk = (bad) => Object.keys(bad).length === 0;

/** the current values of a <form> */
export const formValues = (form) => Object.fromEntries(new FormData(form).entries());
