// ===== 技能、專精、天賦（資料定義）=====
// 天賦只用「修正值 mods」描述效果，戰鬥邏輯在 battle.js 讀取。改數字只需改這個檔。

import { PACKS } from './classes/index.js';
// 技能、專精、天賦的資料都在各職業包（classes/），這裡整理成舊的查表格式
export const BASE_SKILLS = Object.fromEntries(Object.entries(PACKS).map(([k, p]) => [k, p.base]));
export const SPECS = Object.fromEntries(Object.entries(PACKS).map(([k, p]) => [k, p.specs]));
export const TALENTS = Object.fromEntries(Object.entries(PACKS).map(([k, p]) => [k, p.talents]));
export const SPEC_LEVEL = 10;
export const TALENT_ROWS = [5, 15, 20, 25, 30, 40];

// ---------- 英雄的天賦狀態 ----------
export const unlockedRows = h => TALENT_ROWS.filter(lv => h.level >= lv);
export const canPickSpec = h => h.level >= SPEC_LEVEL;
// 還沒選的天賦列數＋專精（用於紅點提示）
export function pendingPicks(h) {
  const t = h.talents || {};
  return unlockedRows(h).filter(lv => !t[lv]).length + (canPickSpec(h) && !h.spec ? 1 : 0);
}
// 把已選天賦合併成一個修正值物件
export function heroMods(h) {
  const m = {}, t = h.talents || {};
  PACKS[h.cls].talents.forEach((row, i) => {
    const lv = TALENT_ROWS[i], pick = h.level >= lv && t[lv];
    if (pick && row[pick]) Object.assign(m, row[pick].mods);
  });
  return m;
}
export function setSpec(h, spec) { if (canPickSpec(h) && PACKS[h.cls].specs[spec]) h.spec = spec; }
export function setTalent(h, lv, pick) {
  if (!TALENT_ROWS.includes(lv) || h.level < lv || !['a', 'b'].includes(pick)) return;
  h.talents = { ...(h.talents || {}), [lv]: pick };
}

// ---------- 推薦配置（依副本機制）----------
// 每個專精對應一種首領機制；天賦依機制挑防禦或輸出。模擬工具與「推薦」按鈕共用。
export function recommend(cls, mechTypes, hero) {
  const has = t => mechTypes.includes(t);
  return PACKS[cls].recommend(has, hero);
}
export function applyRecommend(h, mechTypes) {
  const r = recommend(h.cls, mechTypes, h);
  if (canPickSpec(h)) h.spec = r.spec;
  const t = {};
  TALENT_ROWS.forEach((lv, i) => { if (h.level >= lv) t[lv] = r.t[i]; });
  h.talents = t;
}
