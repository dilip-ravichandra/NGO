/** Toasts and popups. openModal() works from anywhere, as G.modal() did. */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { G } from '../lib/gigf.js';
import { useData } from '../lib/store.js';

let state = { toasts: [], modals: [] };
const subs = new Set();
let seq = 0;
const set = (patch) => { state = { ...state, ...patch }; subs.forEach((f) => f()); };
const useUI = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state);

export function toast(message, icon) {
  const id = ++seq;
  set({ toasts: [...state.toasts, { id, message: String(message), icon: icon || '✅' }] });
  setTimeout(() => set({ toasts: state.toasts.filter((t) => t.id !== id) }), 4150);
}

/** render(close) returns the popup body. Returns { close }. */
export function openModal({ title, render, wide, onClose }) {
  const id = ++seq;
  const opener = document.activeElement;
  const close = () => {
    if (!state.modals.some((m) => m.id === id)) return;
    set({ modals: state.modals.filter((m) => m.id !== id) });
    if (opener && opener.focus) opener.focus();
    if (onClose) onClose();
  };
  set({ modals: [...state.modals, { id, title, render, wide, close }] });
  return { close };
}
export const closeAllModals = () => set({ modals: [] });
export const modalOpen = () => state.modals.length > 0;

G.toast = toast;
G.pendingToasts.splice(0).forEach(([m, i]) => toast(m, i));

function Toast({ message, icon }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const a = requestAnimationFrame(() => setShow(true));
    const b = setTimeout(() => setShow(false), 3800);
    return () => { cancelAnimationFrame(a); clearTimeout(b); };
  }, []);
  return <div className={'toast' + (show ? ' show' : '')} role="status"><span>{icon}</span><span>{message}</span></div>;
}

function Modal({ modal }) {
  const box = useRef(null);
  useEffect(() => {
    const first = box.current.querySelector('[data-autofocus]');
    if (first) first.focus();
  }, []);
  return (
    <div className="modal-backdrop show" onMouseDown={(e) => { if (e.target === e.currentTarget) modal.close(); }}>
      <div className="modal-box" role="dialog" aria-modal="true" ref={box} style={modal.wide ? { maxWidth: 860 } : undefined}>
        <div className="modal-header"><div className="modal-title">{modal.title}</div><button type="button" className="btn-close-modal" aria-label="Close" onClick={modal.close}>×</button></div>
        <div className="modal-body">{modal.render(modal.close)}</div>
      </div>
    </div>
  );
}

export function Feedback() {
  const { toasts, modals } = useUI();
  useData();   // popup contents follow the data
  useEffect(() => {
    document.body.style.overflow = modals.length ? 'hidden' : '';
    const esc = (e) => { if (e.key === 'Escape' && modals.length) modals[modals.length - 1].close(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [modals]);
  return (
    <>
      {modals.map((m) => <Modal key={m.id} modal={m} />)}
      <div id="toastContainer" className="toast-container">{toasts.map((x) => <Toast key={x.id} message={x.message} icon={x.icon} />)}</div>
    </>
  );
}
