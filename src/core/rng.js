// ===== 亂數工具（集中在這裡；setSeed 讓模擬與回歸測試可重現）=====
let rand = Math.random;
export const R = () => rand();
// 固定種子（mulberry32）；傳 null 恢復 Math.random
export function setSeed(seed) {
  if (seed == null) { rand = Math.random; return; }
  let a = seed >>> 0;
  rand = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const rnd = (a, b) => a + R() * (b - a);
export const rint = (a, b) => Math.floor(rnd(a, b + 1));
export const pick = arr => arr[Math.floor(R() * arr.length)];
export const uid = () => R().toString(36).slice(2, 9);
