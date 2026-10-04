// ===== 職業包共用工具（不可 import config / talents，避免循環引用）=====
import { tx } from '../i18n.js';
export const ready = (b, u, key) => (u.cd[key] || 0) <= b.tick;
export const specCd = (u, s) => Math.round(s.cd * (u.mods.specCd || 1));
export const fx = u => u.mods.specFx || 1;
export const spec = (pack, u) => u.spec && pack.specs[u.spec];
// 基礎技能冷卻：天賦改的秒數 × 史詩/傳說的冷卻倍率 × 傳說被動的冷卻倍率
export const baseCd = (u, def) => Math.max(1, Math.round((u.mods.baseCd || def) * (u.mods.baseCdMult || 1) * (u.legendCd || 1)));
// Lv25 天賦列：四職業共用
export const SPEC_ROW = {
  a: { name: tx('專精精通'), desc: tx('專精技能冷卻 −30%'), mods: { specCd: 0.7 } },
  b: { name: tx('專精強化'), desc: tx('專精技能效果 +30%'), mods: { specFx: 1.3 } },
};
