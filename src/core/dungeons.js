// ===== 副本：難度曲線與敵人生成 =====
import { DUNGEONS, DUNGEON } from './config.js';

export const dropIlvl = i => Math.round(DUNGEON.dropBase * Math.pow(DUNGEON.dropGrowth, i));

export function dungeonInfo(i) {
  return { ...DUNGEONS[i], tier: i + 1, dropIlvl: dropIlvl(i), recIlvl: i === 0 ? 0 : dropIlvl(i - 1), recLevel: DUNGEON.recLevel[i] };
}
// 回傳三波敵人：小怪、小怪、首領
export function buildWaves(i) {
  const d = DUNGEONS[i], diff = DUNGEON.difficulty[i];
  const sh = Math.pow(DUNGEON.hpGrowth, i) * diff, sa = Math.pow(DUNGEON.atkGrowth, i) * Math.sqrt(diff);
  const T = DUNGEON.trash, B = DUNGEON.boss;
  const trash = () => Array.from({ length: T.count }, () => ({ name: d.trash, hp: Math.round(T.hp * sh), atk: T.atk * sa, boss: false }));
  return [trash(), trash(), [{ name: d.boss, hp: Math.round(B.hp * sh), atk: B.atk * sa, boss: true, mech: d.mech,
    addHp: Math.round(B.addHp * sh), addAtk: B.addAtk * sa }]];
}
