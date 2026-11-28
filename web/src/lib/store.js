/** Re-draws React whenever the saved data or the signed-in person changes. */
import { useSyncExternalStore } from 'react';
import { G } from './gigf.js';

let version = 0;
let queued = false;
const subscribers = new Set();

export function bump() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => { queued = false; version += 1; subscribers.forEach((f) => f()); });
}
const subscribe = (f) => { subscribers.add(f); return () => subscribers.delete(f); };
export const useData = () => useSyncExternalStore(subscribe, () => version);

const after = (obj, name) => {
  const original = obj[name];
  obj[name] = function wrapped(...args) { const result = original.apply(obj, args); bump(); return result; };
};
['add', 'update', 'remove', 'saveSettings', 'reset', 'reload'].forEach((n) => after(G.DB, n));
['_start', 'logout'].forEach((n) => after(G.Auth, n));
addEventListener('storage', () => G.DB.reload());   // changed in another tab
