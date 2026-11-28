/**
 * "Pay directly by UPI": the donor pays the Foundation's UPI ID and types the 12-digit reference; staff verify it before
 * a receipt exists. Until real details are saved in Admin -> Settings, a DUMMY id and an unpayable picture are shown.
 */
import { G } from './gigf.js';

export const UPI_IMG = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
export const UPI_ID = /^[\w.-]{2,64}@[a-zA-Z]{2,32}$/;
// neither address can receive money: 'yourbank' and 'invalid' are not UPI handles
const dummy = () => (G.present ? { id: 'greenindiagokul@yourbank', name: 'Green India Gokul Foundation', qr: '', dummy: true } : { id: 'dummy.gigf@invalid', name: 'Green India Gokul Foundation (DUMMY)', qr: '', dummy: true });

export function upiDetails() {
  const u = G.DB.settings().upi;
  return u && UPI_ID.test(u.id || '') ? { id: u.id, name: String(u.name || G.ORG.name).slice(0, 80), qr: UPI_IMG.test(u.qr || '') ? u.qr : '', dummy: false } : dummy();
}

/** a picture that looks like "no QR yet" and cannot be scanned */
export function placeholderQr() {
  const c = document.createElement('canvas'); c.width = c.height = 320;
  const g = c.getContext('2d');
  g.fillStyle = '#f9fafb'; g.fillRect(0, 0, 320, 320); g.strokeStyle = '#d1d5db'; g.lineWidth = 6; g.setLineDash([14, 10]); g.strokeRect(10, 10, 300, 300);
  g.textAlign = 'center';
  if (G.present) { g.fillStyle = '#6b7280'; g.font = 'bold 34px Arial'; g.fillText('UPI QR', 160, 150); g.font = '22px Arial'; g.fillText('Scan and pay', 160, 190); return c.toDataURL('image/png'); }
  g.fillStyle = '#b91c1c'; g.font = 'bold 46px Arial'; g.fillText('DUMMY', 160, 140); g.font = 'bold 24px Arial'; g.fillText('not a real QR', 160, 180); g.fillText('do not pay', 160, 212);
  return c.toDataURL('image/png');
}

G.upi = { details: upiDetails, ID: UPI_ID, IMG: UPI_IMG };
