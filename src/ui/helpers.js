// ===== 畫面小工具 =====
import { tx } from '../core/i18n.js';
import * as G from '../core/index.js';
import { app } from './state.js';
import { slotIcon } from './icons.js';

export const $ = s => document.querySelector(s);
export const fmt = n => Math.round(n).toLocaleString('zh-TW');
export const pct = (a, b) => Math.max(0, Math.min(100, 100 * a / b));
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// 英雄名字（稀有度上色；傳說加稱號）
export const heroName = h => `<span class="c${h.rarity || 0}">${h.legend ? `${G.LEGENDS[h.cls].title}・` : ''}${h.name}</span>`;
export const rarityTag = h => `<span class="rtag r${h.rarity || 0}">${G.HERO_RARITY[h.rarity || 0].name}</span>`;
export const mmss = sec => `${Math.floor(Math.abs(sec) / 60)}:${String(Math.abs(sec) % 60).padStart(2, '0')}`;

export function toast(msg) {
  const el = $('#toast'); el.innerHTML = `<div class="toast">${msg}</div>`;
  clearTimeout(toast.t); toast.t = setTimeout(() => el.innerHTML = '', 2200);
}
export const hero = id => app.S.heroes.find(h => h.id === id);
export const cls = h => G.CLASSES[h.cls];
export const inParty = h => app.S.party.includes(h.id);
export function itemStatText(it) {
  const p = [tx('威力 {0}', G.itemPow(it)), tx('耐力 {0}', G.itemSta(it))];
  if (it.crit) p.push(tx('暴擊 +{0}%', Math.round(it.crit * 100)));
  return p.join(' · ');
}
export function itemName(it) {
  return `${slotIcon(it.slot, it.rarity)}${it.set ? '<span class="settag">T0</span>' : ''}<span class="c${it.rarity}">${it.name}</span>${it.up ? `<span class="up">+${it.up}</span>` : ''}`;
}
export function partyPower() { return G.partyHeroes(app.S).reduce((a, h) => a + G.heroPower(h, app.S.items), 0); }
export function avgPartyIlvl() { const p = G.partyHeroes(app.S); return p.length ? Math.round(p.reduce((a, h) => a + G.heroIlvl(h, app.S.items), 0) / p.length) : 0; }
export function avgPartyLv() { const p = G.partyHeroes(app.S); return p.length ? Math.round(p.reduce((a, h) => a + h.level, 0) / p.length) : 0; }
// 每日：首勝獎勵一行、每日卡是否展開（有可領的就預設展開）
export const firstWinLine = fw => fw ? tx('<div style="color:var(--brass)">🏆 今日首勝：+{0} 金、{1}</div>', fmt(fw.gold), itemName(fw.item)) : '';
export const dailyOpenNow = () => app.dailyOpen != null ? app.dailyOpen : G.dailyPending(app.S) > 0;
