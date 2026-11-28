/**
 * The business and data layer is the same plain JavaScript the old site uses (one copy of the
 * donation, login and database rules). Order matters. Only the user interface is React.
 */
import '../../../js/config.js';
import '../../../js/fonts.js';
import '../../../js/data.js';
import '../../../js/md.js';
import '../../../js/cloud.js';
import '../../../js/look.js';
import '../../../js/i18n.js';
import '../../../js/i18n-extra.js';
import '../../../js/i18n-banner.js';
import './bridge.js';
import '../../../js/autotranslate.js';
import '../../../js/notify.js';

export const G = window.GIGF;
export const CFG = window.GIGF_CONFIG || {};
export const tr = (field) => G.tr(field);
export const t = (key) => G.t(key);
/** one of six strings, in the order en, kn, hi, ta, te, ml */
export const word = (w) => w[Math.max(0, ['en', 'kn', 'hi', 'ta', 'te', 'ml'].indexOf(G.lang()))] || w[0];
