// ===== 畫面小工具 =====
import * as G from '../core/index.js';
import { app } from './state.js';

export const $ = s => document.querySelector(s);
export const fmt = n => Math.round(n).toLocaleString('zh-TW');
export const pct = (a, b) => Math.max(0, Math.min(100, 100 * a / b));
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const mmss = sec => `${Math.floor(Math.abs(sec) / 60)}:${String(Math.abs(sec) % 60).padStart(2, '0')}`;

export function toast(msg) {
  const el = $('#toast'); el.innerHTML = `<div class="toast">${msg}</div>`;
  clearTimeout(toast.t); toast.t = setTimeout(() => el.innerHTML = '', 2200);
}
export const hero = id => app.S.heroes.find(h => h.id === id);
export const cls = h => G.CLASSES[h.cls];
export const inParty = h => app.S.party.includes(h.id);
export function itemStatText(it) {
  const p = [`威力 ${G.itemPow(it)}`, `耐力 ${G.itemSta(it)}`];
  if (it.crit) p.push(`暴擊 +${Math.round(it.crit * 100)}%`);
  return p.join(' · ');
}
export function itemName(it) {
  return `<span class="c${it.rarity}">${it.name}</span>${it.up ? `<span class="up">+${it.up}</span>` : ''}`;
}
export function partyPower() { return G.partyHeroes(app.S).reduce((a, h) => a + G.heroPower(h, app.S.items), 0); }
export function avgPartyIlvl() { const p = G.partyHeroes(app.S); return p.length ? Math.round(p.reduce((a, h) => a + G.heroIlvl(h, app.S.items), 0) / p.length) : 0; }
export function avgPartyLv() { const p = G.partyHeroes(app.S); return p.length ? Math.round(p.reduce((a, h) => a + h.level, 0) / p.length) : 0; }
