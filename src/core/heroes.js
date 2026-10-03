// ===== 英雄：屬性計算與升級 =====
import { CLASSES, HERO, SLOTS, GEAR, HERO_RARITY, LEGENDS } from './config.js';
import { pick, uid } from './rng.js';
import { itemPow, itemSta } from './items.js';
import { heroMods } from './talents.js';

export const xpNeed = L => Math.round(HERO.xpBase * Math.pow(L, HERO.xpExp));

// rarity：0 普通 … 4 傳說（傳說用該職業固定的傳奇英雄名字）
export function makeHero(cls, level = 1, rarity = 0) {
  const legend = rarity === 4 ? LEGENDS[cls] : null;
  return { id: uid(), cls, name: legend ? legend.name : pick(HERO.names), level, xp: 0, rarity, legend: !!legend,
    spec: null, talents: {}, gear: { weapon: null, armor: null, trinket: null } };
}
// 稀有度帶來的戰鬥修正（battle.js 合併到 mods）
export function rarityMods(h) {
  const r = HERO_RARITY[h.rarity || 0], m = {};
  if (r.baseCdMult) m.baseCdMult = r.baseCdMult;
  if (h.legend) m.legend = LEGENDS[h.cls].passive;
  return m;
}
const gearOf = (h, items) => Object.keys(SLOTS).map(s => h.gear[s] && items[h.gear[s]]).filter(Boolean);

// 最終屬性 = (職業基礎 + 等級成長 + 裝備) × 天賦
export function heroStats(h, items) {
  const c = CLASSES[h.cls], m = heroMods(h), R = HERO_RARITY[h.rarity || 0];
  let pow = (c.pow + c.powL * (h.level - 1)) * R.mult, hp = (c.hp + c.hpL * (h.level - 1)) * R.mult, crit = c.crit + R.crit;
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
