// ===== 英雄：屬性計算與升級 =====
import { CLASSES, HERO, SLOTS, GEAR, HERO_RARITY, LEGENDS } from './config.js';
import { pick, uid } from './rng.js';
import { itemPow, itemSta } from './items.js';
import { heroMods } from './talents.js';
export { roleOf } from './classes/index.js';

export const xpNeed = L => Math.round(HERO.xpBase * Math.pow(L, HERO.xpExp));

// rarity：0 普通 … 4 傳說（傳說用該職業固定的傳奇英雄名字）
export function makeHero(cls, level = 1, rarity = 0) {
  const legend = rarity === 4 ? CLASSES[cls].legend : null;
  return { id: uid(), cls, name: legend ? legend.name : pick(HERO.names), level, xp: 0, rarity, legend: !!legend,
    spec: null, talents: {}, gear: { weapon: null, armor: null, trinket: null } };
}
// 稀有度帶來的戰鬥修正（battle.js 合併到 mods）
export function rarityMods(h) {
  const r = HERO_RARITY[h.rarity || 0], m = {};
  if (r.baseCdMult) m.baseCdMult = r.baseCdMult;
  if (h.legend) m.legend = CLASSES[h.cls].legend.passive;
  return m;
}
const gearOf = (h, items) => Object.keys(SLOTS).map(s => h.gear[s] && items[h.gear[s]]).filter(Boolean);

// 最終屬性 = (職業基礎 + 等級成長 + 裝備) × 天賦
export function heroStats(h, items) {
  const c = CLASSES[h.cls], m = heroMods(h), R = HERO_RARITY[h.rarity || 0];
  let pow = (c.pow + c.powL * (h.level - 1)) * R.mult, hp = (c.hp + c.hpL * (h.level - 1)) * R.mult, crit = c.crit + R.crit;
  for (const it of gearOf(h, items)) { pow += itemPow(it); hp += itemSta(it) * GEAR.staToHp; crit += it.crit; }
  const para = 1 + HERO.paragon.bonus * (h.para || 0);
  pow *= (m.powMult || 1) * para; hp *= (m.hpMult || 1) * para; crit += m.critAdd || 0;
  return { pow: Math.round(pow), hp: Math.round(hp), crit: Math.min(0.5, crit), armor: c.armor };
}
export function heroIlvl(h, items) {
  return Math.round(gearOf(h, items).reduce((a, it) => a + it.ilvl, 0) / Object.keys(SLOTS).length);
}
export function heroPower(h, items) { // 戰力（顯示用）
  const s = heroStats(h, items);
  return Math.round(s.pow * 10 * (1 + s.crit) + s.hp * 0.5);
}
export const paraNeed = p => Math.round(HERO.paragon.need * (1 + HERO.paragon.growth * p));
// 滿級後的經驗進巔峰：h.para = 巔峰等級，h.paraXp = 目前進度
export function gainXp(h, xp) {
  let ups = 0;
  if (h.level < HERO.maxLevel) {
    h.xp += xp; xp = 0;
    while (h.level < HERO.maxLevel && h.xp >= xpNeed(h.level)) { h.xp -= xpNeed(h.level); h.level++; ups++; }
    if (h.level >= HERO.maxLevel) { xp = h.xp; h.xp = 0; }
  }
  if (h.level >= HERO.maxLevel && xp > 0) {
    h.para = h.para || 0; h.paraXp = (h.paraXp || 0) + xp;
    while (h.paraXp >= paraNeed(h.para)) { h.paraXp -= paraNeed(h.para); h.para++; ups++; }
  }
  return ups;
}
