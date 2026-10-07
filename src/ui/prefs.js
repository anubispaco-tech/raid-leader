// ===== v0.20 裝置偏好（戰鬥特效、立體視角、音效）=====
// 跟著裝置走，不寫進存檔：換手機或匯入存檔不會帶過去
const KEY = 'raid-leader-prefs';
export const FX_LEVELS = ['full', 'lite', 'off'];
export const prefs = { fx: 'full', iso: false, sound: true };
try {
  const v = JSON.parse(localStorage.getItem(KEY) || '{}');
  if (FX_LEVELS.includes(v.fx)) prefs.fx = v.fx;
  if (typeof v.iso === 'boolean') prefs.iso = v.iso;
  if (typeof v.sound === 'boolean') prefs.sound = v.sound;
} catch (e) { /* 沒有或壞掉就用預設 */ }
export function setPref(k, v) {
  if (k === 'fx' && !FX_LEVELS.includes(v)) return;
  if ((k === 'iso' || k === 'sound') && typeof v !== 'boolean') return;
  if (!(k in prefs)) return;
  prefs[k] = v;
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* 無痕模式等存不了就算了 */ }
}
