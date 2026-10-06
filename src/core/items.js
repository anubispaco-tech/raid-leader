// ===== 裝備 =====
import { RARITY, SLOTS, SLOT_STATS, SLOT_NAMES, PREFIX, GEAR, SETS, SET_PIECE, ARMOR_SLOTS, ITEM_BASES, BASE_INFO, ITEM_TIERS, GEAR_AFFIX, CLASSES } from './config.js';
import { tx } from './i18n.js';
import { roleOf } from './classes/index.js';
import { R, rnd, pick, uid } from './rng.js';
import { getLang } from './i18n.js';

// v0.16 裝備 = 基底（base）＋詞綴（affix）＋裝等＋稀有度；名稱在顯示時由 itemLabel() 組出（存檔只存代號）
export function makeItem(slot, ilvl, rarity) {
  const B = ilvl * RARITY[rarity].mult, w = SLOT_STATS[slot];
  const v = () => rnd(0.9, 1.1);
  const base = pick(ITEM_BASES[slot])[0], affix = rollAffix(rarity), A = GEAR_AFFIX[affix];
  const crit = (slot === 'trinket' && rarity >= 2 ? 0.01 * rarity + 0.01 : 0) + A.crit;
  const it = { id: uid(), slot, ilvl, rarity, up: 0, base, affix, pow: Math.round(B * w.pow * v() * A.pow), sta: Math.round(B * w.sta * v() * A.sta), crit: Math.round(crit * 1000) / 1000 };
  it.name = itemLabel(it); return it;
}
export function rollAffix(rarity) {
  const ks = Object.keys(GEAR_AFFIX), tot = ks.reduce((a, k) => a + GEAR_AFFIX[k].w[rarity], 0);
  let x = R() * tot; for (const k of ks) { x -= GEAR_AFFIX[k].w[rarity]; if (x < 0) return k; }
  return 'balanced';
}
export const itemTier = it => Math.min(ITEM_TIERS.length - 1, Math.floor(it.ilvl / 6));
// 顯示名稱：套裝 =「套裝名＋部位」；一般 =「詞綴＋材質＋基底」（英文加空格）；沒有基底的舊資料用存的名字
export function itemLabel(it) {
  const en = getLang() === 'en', sp = en ? ' ' : '';
  if (it.set && SETS[it.set]) return SETS[it.set].name + sp + SET_PIECE[it.slot];
  if (!it.base || !BASE_INFO[it.base]) return it.name;
  const a = it.affix && GEAR_AFFIX[it.affix] ? GEAR_AFFIX[it.affix].name : '', t = ITEM_TIERS[itemTier(it)];
  return (a ? tx(a) : '') + (t ? tx(t) + sp : '') + tx(BASE_INFO[it.base].name);
}
// 舊存檔：從名稱找回基底（中英文都比對，取最長的符合）
export function guessBase(it) {
  if (it.base || it.set || !it.name) return it.base;
  let best = null, len = 0;
  for (const [k, b] of Object.entries(BASE_INFO)) if (b.slot === it.slot) for (const n of [b.name, tx(b.name)]) if (n && it.name.endsWith(n) && n.length > len) { best = k; len = n.length; }
  return best;
}
// v0.16 圖鑑：一般裝備以「基底＋稀有度」為一格，套裝以「職業＋部位」為一格
export const codexKey = it => (it.set ? `set:${it.set}:${it.slot}` : it.base ? `${it.base}:${it.rarity}` : null);
export const codexAllKeys = () => [
  ...Object.keys(BASE_INFO).flatMap(b => RARITY.map((_, r) => `${b}:${r}`)),
  ...Object.keys(SETS).flatMap(c => ARMOR_SLOTS.map(sl => `set:${c}:${sl}`)),
];
// 詞綴對英雄的價值：坦克看耐力、其他看威力；暴擊對非坦克加分
export const affixFit = (role, it) => {
  const A = GEAR_AFFIX[it.affix]; if (!A) return 1;
  return role === 'tank' ? 0.5 + 0.5 * A.sta : 0.5 + 0.5 * A.pow + A.crit * 5;
};
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
  delete it.base; delete it.affix; it.pow = Math.round(it.pow); it.name = itemLabel(it);
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
