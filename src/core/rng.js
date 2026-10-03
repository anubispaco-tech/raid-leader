// ===== 亂數工具（集中在這裡，之後要做可重現的種子亂數只改這檔）=====
export const R = Math.random;
export const rnd = (a, b) => a + R() * (b - a);
export const rint = (a, b) => Math.floor(rnd(a, b + 1));
export const pick = arr => arr[Math.floor(R() * arr.length)];
export const uid = () => Math.random().toString(36).slice(2, 9);
