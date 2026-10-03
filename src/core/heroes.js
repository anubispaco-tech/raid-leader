// ===== 英雄：屬性計算與升級 =====
import { CLASSES, HERO, SLOTS, GEAR } from './config.js';
import { pick, uid } from './rng.js';
import { itemPow, itemSta } from './items.js';
import { heroMods } from './talents.js';

export const xpNeed = L => Math.round(HERO.xpBase * Math.pow(L, HERO.xpExp));

export function makeHero(cls, level = 1) {
  return { id: uid(), cls, name: pick(HERO.names), level, xp: 0, spec: null, talents: {}, gear: { weapon: null, armor: null, trinket: null } };
}
const gearOf = (h, items) => Object.keys(SLOTS).map(s => h.gear[s] && items[h.gear[s]]).filter(Boolean);

// 最終屬性 = (職業基礎 + 等級成長 + 裝備) × 天賦
export function heroStats(h, items) {
  const c = CLASSES[h.cls], m = heroMods(h);
  let pow = c.pow + c.powL * (h.level - 1), hp = c.hp + c.hpL * (h.level - 1), crit = c.crit;
  for (const it of gearOf(h, items)) { pow += itemPow(it); hp += itemSta(it) * GEAR.staToHp; crit += it.crit; }
  pow *= m.powMult || 1; hp *= m.hpMult || 1; crit += m.critAdd || 0;
  return { pow: Math.round(pow), hp: Math.round(hp), crit: Math.min(0.5, crit), armor: c.armor };
}
export function heroIlvl(h, items) {
  return Math.round(gearOf(h, items).reduce((a, it) => a + it.ilvl, 0) / Object.keys(SLOTS).length);
}
export function heroPower(h, items) { // 戰力（顯示用）
  const s = heroStats(h, items);
  return Math.round(s.pow * 10 * (1 + s.crit) + s.hp * 0.5);
}
export function gainXp(h, xp) {
  if (h.level >= HERO.maxLevel) return 0;
  let ups = 0;
  h.xp += xp;
  while (h.level < HERO.maxLevel && h.xp >= xpNeed(h.level)) { h.xp -= xpNeed(h.level); h.level++; ups++; }
  if (h.level >= HERO.maxLevel) h.xp = 0;
  return ups;
}
