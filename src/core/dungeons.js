// ===== 副本：難度曲線與敵人生成 =====
import { DUNGEONS, DUNGEON } from './config.js';

import { CH1_TOP } from './config.js';
const ch1Drop = i => Math.round(DUNGEON.dropBase * Math.pow(DUNGEON.dropGrowth, i));
export const dropIlvl = i => (i <= CH1_TOP ? ch1Drop(i) : Math.round(ch1Drop(CH1_TOP) * Math.pow(DUNGEON.ch2.dropGrowth, i - CH1_TOP)));

export function dungeonInfo(i) {
  return { ...DUNGEONS[i], tier: i + 1, dropIlvl: dropIlvl(i), recIlvl: i === 0 ? 0 : dropIlvl(i - 1), recLevel: DUNGEON.recLevel[i] };
}
// 回傳三波敵人：小怪、小怪、首領
export function buildWaves(i) {
  const d = DUNGEONS[i], diff = DUNGEON.difficulty[i];
  const k = Math.min(i, CH1_TOP), c2 = i > CH1_TOP ? i - CH1_TOP - 1 : -1; // 第二章：第 7 層 × 章節倍率表
  const sh = Math.pow(DUNGEON.hpGrowth, k) * (c2 >= 0 ? DUNGEON.ch2.hp[c2] : 1) * diff, sa = Math.pow(DUNGEON.atkGrowth, k) * (c2 >= 0 ? DUNGEON.ch2.atk[c2] : 1) * Math.sqrt(diff);
  const T = DUNGEON.trash, B = DUNGEON.boss;
  const trash = () => Array.from({ length: T.count }, () => ({ name: d.trash, hp: Math.round(T.hp * sh), atk: T.atk * sa, boss: false }));
  const boss = (name, mech, hpK = 1, atkK = 1) => ({ name, hp: Math.round(B.hp * sh * hpK), atk: B.atk * sa * atkK, boss: true, mech,
    addHp: Math.round(B.addHp * sh), addAtk: B.addAtk * sa });
  // 雙首領：各 60% 生命、80% 攻擊
  const last = d.twin ? d.twin.map(t => boss(t.name, t.mech, 0.6, 0.8)) : [boss(d.boss, d.mech)];
  return [trash(), trash(), last];
}
// 備戰用的機制提示：雙首領加上 'twin'，並合併兩隻首領的機制
export const mechHints = i => {
  const d = DUNGEONS[i];
  return d.twin ? ['twin', ...new Set(d.twin.flatMap(t => t.mech.map(m => m.t)))] : d.mech.map(m => m.t);
};
