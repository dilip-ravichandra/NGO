/** The two things the shared scripts expect from the user interface, before it exists. */
const G = window.GIGF;
const queue = [];
let ready = false;
G.boot = (fn) => (ready ? fn() : queue.push(fn));
G.runBoot = () => { if (ready) return; ready = true; queue.splice(0).forEach((fn) => fn()); };

/* toasts asked for before React has mounted are kept and shown by it */
G.pendingToasts = [];
G.toast = (msg, icon) => G.pendingToasts.push([msg, icon]);
window.showToast = (m, i) => G.toast(m, i);
