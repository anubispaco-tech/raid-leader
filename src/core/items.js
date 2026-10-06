// ===== 裝備 =====
import { RARITY, SLOTS, SLOT_STATS, SLOT_NAMES, PREFIX, GEAR, SETS, SET_PIECE, ARMOR_SLOTS } from './config.js';
import { R, rnd, pick, uid } from './rng.js';
import { getLang } from './i18n.js';

export function makeItem(slot, ilvl, rarity) {
  const B = ilvl * RARITY[rarity].mult, w = SLOT_STATS[slot];
  const v = () => rnd(0.9, 1.1);
  const crit = slot === 'trinket' && rarity >= 2 ? 0.01 * rarity + 0.01 : 0;
  const pre = PREFIX[Math.min(PREFIX.length - 1, Math.floor(ilvl / 6))];
  return { id: uid(), slot, ilvl, rarity, up: 0, pow: Math.round(B * w.pow * v()), sta: Math.round(B * w.sta * v()), crit,
    name: pre + pick(SLOT_NAMES[slot]) };
}
// 由高到低累積機率抽稀有度
export function rollRarity(minR = 0) {
  let x = R(), r = 0;
  for (let i = RARITY.length - 1; i >= 0; i--) { x -= RARITY[i].weight; if (x < 0) { r = i; break; } }
  return Math.max(r, minR);
}
// T0 套裝部件：固定史詩、屬性比一般史詩高 10%
export function makeSetItem(cls, slot, ilvl) {
  const it = makeItem(slot, ilvl, 3);
  it.set = cls; it.pow = Math.round(it.pow * 1.1); it.sta = Math.round(it.sta * 1.1);
  it.name = SETS[cls].name + (getLang() === 'en' ? ' ' : '') + SET_PIECE[slot];
  return it;
}
export const randomArmorSlot = () => pick(ARMOR_SLOTS);
// 套裝件數與啟動的效果
export function setMods(h, items) {
  const set = SETS[h.cls]; if (!set) return {};
  const n = ARMOR_SLOTS.filter(sl => h.gear[sl] && items[h.gear[sl]] && items[h.gear[sl]].set === h.cls).length;
  return n >= 4 ? set.b4 : n >= 2 ? set.b2 : {};
}
export const setCount = (h, items) => ARMOR_SLOTS.filter(sl => h.gear[sl] && items[h.gear[sl]] && items[h.gear[sl]].set === h.cls).length;
// 給某位英雄看的裝備分數：同職業套裝件 +20%（讓一鍵配裝願意保留套裝）
export const heroItemScore = (h, it) => itemScore(it) * (it.set && it.set === h.cls ? 1.2 : 1);
export const upMult = it => 1 + GEAR.upBonus * (it.up || 0);
export const itemPow = it => Math.round(it.pow * upMult(it));
export const itemSta = it => Math.round(it.sta * upMult(it));
export const itemScore = it => it.ilvl * RARITY[it.rarity].mult * upMult(it);
// 分解金幣 = 基本值 + 強化花費 × salvageRefund（v0.15）
export const upSpent = it => { let g = 0; for (let u = 0; u < (it.up || 0); u++) g += Math.round(GEAR.upCostBase * (u + 1) * (1 + it.ilvl / 10)); return g; };
export const salvageValue = it => Math.round(it.ilvl * RARITY[it.rarity].mult * GEAR.salvageMult) + Math.floor(upSpent(it) * (GEAR.salvageRefund ?? 0));
export const dustCost = it => it.up >= GEAR.refineFrom ? (it.up - GEAR.refineFrom + 1) * GEAR.dustPerStep : 0;
// 分解精華 = 品質基本值 + 精煉投入 × salvageRefund（v0.15 由一半提高到 80%）
export const salvageDust = it => {
  let spent = 0; for (let u = GEAR.refineFrom; u < (it.up || 0); u++) spent += (u - GEAR.refineFrom + 1) * GEAR.dustPerStep;
  return (GEAR.salvageDust[it.rarity] || 0) + Math.floor(spent * (GEAR.salvageRefund ?? 0.5));
};
export const upgradeCost = it => Math.round(GEAR.upCostBase * (it.up + 1) * (1 + it.ilvl / 10));
export const slotKeys = () => Object.keys(SLOTS);
