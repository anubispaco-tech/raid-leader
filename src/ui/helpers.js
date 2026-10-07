// ===== 畫面小工具 =====
import { tx } from '../core/i18n.js';
import * as G from '../core/index.js';
import { app } from './state.js';
import { itemIcon } from './icons.js';

export const $ = s => document.querySelector(s);
export const fmt = n => Math.round(n).toLocaleString('zh-TW');
export const pct = (a, b) => Math.max(0, Math.min(100, 100 * a / b));
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// 英雄名字（稀有度上色；傳說加稱號）
const lockMark = x => (x.locked ? '<span class="lockic" aria-label="locked">🔒</span>' : '');
export const heroName = h => `${lockMark(h)}<span class="c${h.rarity || 0}">${h.legend ? `${G.LEGENDS[h.cls].title}・` : ''}${h.name}</span>`;
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
// v0.19 甲類小標籤（布／皮／鎧）
export const armorTag = it => { const a = G.armorOf(it); return a ? `<span class="atag at-${a}" title="${G.ARMOR_TYPES[a].name}">${G.ARMOR_TYPES[a].short}</span>` : ''; };
// 可以穿的職業（說明用）
export function whoCan(it) {
  if (it.set) return tx('{0}專屬', G.CLASSES[it.set].name);
  const all = Object.keys(G.CLASSES), ok = all.filter(c => G.canEquip(c, it));
  return ok.length === all.length ? tx('全職業') : ok.map(c => G.CLASSES[c].name).join(tx('、'));
}
// 對出戰隊員的提升：best = 目前強化等級下提升最多的人；pot = 背包這件強化到和身上一樣時提升最多的人
export function gainFor(it) {
  let best = null, pot = null, any = false;
  for (const h of G.partyHeroes(app.S)) {
    if (!G.canEquip(h, it)) continue; any = true;
    const cur = h.gear[it.slot] && app.S.items[h.gear[it.slot]];
    if (!cur) { if (!best || best.pct !== Infinity) best = { h, pct: Infinity }; continue; }
    const base = G.heroItemScore(h, cur), g = G.heroItemScore(h, it) / base - 1;
    if (g > 0.005 && (!best || g > best.pct)) best = { h, pct: g };
    if ((cur.up || 0) > (it.up || 0)) { const p = G.heroItemScoreAt(h, it, cur.up) / base - 1; if (p > 0.005 && (!pot || p > pot.pct)) pot = { h, pct: p, up: cur.up }; }
  }
  return { best, pot, any };
}
export const pctText = g => (g === Infinity ? tx('空位') : `+${Math.round(g * 100)}%`);
export function itemName(it) {
  return `${itemIcon(it)}${it.set ? `<span class="settag${it.t5 ? ' t5' : ''}">${it.t5 ? 'T0.5' : 'T0'}</span>` : ''}<span class="c${it.rarity}">${it.name}</span>${it.up ? `<span class="up">+${it.up}</span>` : ''}${armorTag(it)}${lockMark(it)}`;
}
export function partyPower() { return G.partyHeroes(app.S).reduce((a, h) => a + G.heroPower(h, app.S.items), 0); }
export function avgPartyIlvl() { const p = G.partyHeroes(app.S); return p.length ? Math.round(p.reduce((a, h) => a + G.heroIlvl(h, app.S.items), 0) / p.length) : 0; }
export function avgPartyLv() { const p = G.partyHeroes(app.S); return p.length ? Math.round(p.reduce((a, h) => a + h.level, 0) / p.length) : 0; }
// 每日：首勝獎勵一行、每日卡是否展開（有可領的就預設展開）
export const firstWinLine = fw => fw ? tx('<div style="color:var(--brass)">🏆 今日首勝：+{0} 金、{1}</div>', fmt(fw.gold), itemName(fw.item)) : '';
export const dailyOpenNow = () => app.dailyOpen != null ? app.dailyOpen : G.dailyPending(app.S) > 0;
// v0.19 裝備職業限制說明卡：舊存檔有被卸下的裝備時，首頁和背包都顯示；新玩家只在背包第一次顯示
export function gearRuleCard(where) {
  const n = app.S.gearFix || 0;
  if (!n && (where !== 'bag' || G.seenCard(app.S, 'gear19'))) return '';
  const body = tx('每個職業只能用自己的武器；護甲有布甲、皮甲、鎧甲三種：鎧甲只有守護騎士能穿，皮甲加上盜賊、德魯伊、薩滿，布甲全職業都能穿。穿自己本職的甲類，屬性 +{0}%。掉落也會偏向出戰隊員用得到的裝備。', Math.round(G.GEAR.fitBonus * 100));
  return `<div class="mguide"><b class="mgt">${tx('裝備職業限制')}</b><p class="sub" style="margin:0">${body}${n ? tx('<br><b>已把 {0} 件穿不上的裝備卸回背包</b>，按下面的按鈕重新配裝。', n) : ''}</p><div class="row"><button class="btn sm main" data-act="gearfixok">${n ? tx('一鍵配裝') : tx('知道了')}</button></div></div>`;
}
