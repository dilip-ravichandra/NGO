/** What a guest typed is kept (this tab only, never the PAN or a file) while they log in, then put back. */
const key = (kind) => 'gigf_draft_' + kind;
export function loadDraft(kind) {
  try { return JSON.parse(sessionStorage.getItem(key(kind)) || '{}') || {}; } catch { return {}; }
}
export function saveDraft(kind, data) {
  const d = Object.assign({}, data);
  delete d.pan; delete d.password;
  try { sessionStorage.setItem(key(kind), JSON.stringify(d)); } catch { /* private mode */ }
}
export function clearDraft(kind) {
  try { sessionStorage.removeItem(key(kind)); } catch { /* private mode */ }
}
