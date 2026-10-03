// ===== 裝備 =====
import { RARITY, SLOTS, SLOT_STATS, SLOT_NAMES, PREFIX, GEAR } from './config.js';
import { R, rnd, pick, uid } from './rng.js';

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
export const upMult = it => 1 + GEAR.upBonus * (it.up || 0);
export const itemPow = it => Math.round(it.pow * upMult(it));
export const itemSta = it => Math.round(it.sta * upMult(it));
export const itemScore = it => it.ilvl * RARITY[it.rarity].mult * upMult(it);
export const salvageValue = it => Math.round(it.ilvl * RARITY[it.rarity].mult * GEAR.salvageMult);
export const upgradeCost = it => Math.round(GEAR.upCostBase * (it.up + 1) * (1 + it.ilvl / 10));
export const slotKeys = () => Object.keys(SLOTS);
