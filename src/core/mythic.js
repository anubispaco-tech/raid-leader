// ===== 傳奇秘境：鑰石、每日詞綴、敵人成長、結算 =====
import { tx } from './i18n.js';
import { DUNGEONS, DUNGEON, MYTHIC, REWARD, SLOTS, RARITY, CH1_TOP } from './config.js';
import { R, rnd, rint, pick } from './rng.js';
import { buildWaves, dropIlvl } from './dungeons.js';
import { makeItem, rollRarity } from './items.js';

// ---------- 詞綴 ----------
// hint：對應哪種首領機制（推薦天賦用）
export const AFFIXES = {
  fortified:  { name: tx('強韌'), desc: tx('小怪生命 +30%、攻擊 +20%'), test: tx('範圍輸出'), hint: 'summon' },
  tyrannical: { name: tx('暴君'), desc: tx('首領生命 +30%、攻擊 +15%'), test: tx('單體輸出'), hint: 'enrage' },
  raging:     { name: tx('暴怒'), desc: tx('小怪生命低於 30% 時傷害 +50%'), test: tx('快速收尾'), hint: 'enrage' },
  bolstering: { name: tx('繁盛'), desc: tx('小怪死亡時，其他小怪生命與攻擊 +15%'), test: tx('平均打血'), hint: 'summon' },
  volcanic:   { name: tx('火山'), desc: tx('每 8 秒隨機一名隊員受到魔法傷害'), test: tx('治療'), hint: 'pulse' },
  necrotic:   { name: tx('壞疽'), desc: tx('坦克每被攻擊一次，受到的治療 −2%，每波重置'), test: tx('坦克'), hint: 'buster' },
};
const BASE_AFFIX = ['fortified', 'tyrannical'], EXTRA_AFFIX = ['raging', 'bolstering', 'volcanic', 'necrotic'];

// 依日期決定當天詞綴（所有人同一天相同）：第 1 個是強韌或暴君，後兩個從其他四個抽
export function dayKey(date = new Date()) {
  const d = new Date(date.getTime() + 8 * 3600e3); // 以台灣時間換日
  return d.toISOString().slice(0, 10);
}
export function dailyAffixes(date = new Date()) {
  const k = dayKey(date);
  let seed = [...k].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const next = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;
  const extra = [...EXTRA_AFFIX].sort(() => next() - 0.5);
  return [BASE_AFFIX[Math.floor(next() * 2)], extra[0], extra[1]];
}
export const activeAffixes = (level, date) => dailyAffixes(date).filter((_, i) => level >= MYTHIC.affixAt[i]);
export const affixHints = list => list.map(a => AFFIXES[a].hint);

// ---------- 敵人 ----------
export const mythicTimer = dIdx => MYTHIC.timer[dIdx];
export function buildMythicWaves(dIdx, level, affixes) {
  // 以第 7 層的強度為基準，套用該副本自己的首領機制，再乘上秘境等級
  const top = CH1_TOP; // 秘境以第一章第 7 層為基準
  const base = buildWaves(top), own = buildWaves(dIdx);
  const sh = Math.pow(MYTHIC.hpGrowth, level), sa = Math.pow(MYTHIC.atkGrowth, level);
  const fort = affixes.includes('fortified'), tyr = affixes.includes('tyrannical');
  return base.map((wave, wi) => wave.map((e, ei) => {
    const o = own[wi][ei];
    const hp = e.hp * sh * (e.boss ? (tyr ? 1.3 : 1) : (fort ? 1.3 : 1));
    const atk = e.atk * sa * (e.boss ? (tyr ? 1.15 : 1) : (fort ? 1.2 : 1));
    return { ...e, name: o.name, mech: o.mech, hp: Math.round(hp), atk, addHp: e.addHp && Math.round(e.addHp * sh), addAtk: e.addAtk && e.addAtk * sa };
  }));
}
export function mythicBattleOpts(dIdx, level, date) {
  const affixes = activeAffixes(level, date);
  const top = CH1_TOP; // 秘境以第一章第 7 層為基準
  return { mythic: { dIdx, level, affixes, timer: mythicTimer(dIdx), volcanic: buildWaves(top)[0][0].atk * Math.pow(MYTHIC.atkGrowth, level) * 2.5 },
    waves: buildMythicWaves(dIdx, level, affixes), maxTicks: mythicTimer(dIdx) + MYTHIC.overtime };
}

// ---------- 結算 ----------
export function mythicRewards(level, inTime) {
  const top = CH1_TOP; // 秘境以第一章第 7 層為基準
  const gold = Math.round((REWARD.goldBase + REWARD.goldPerTier * top) * MYTHIC.goldMult * (1 + 0.05 * level) * rnd(0.9, 1.1));
  const xp = Math.round(REWARD.xpBase * Math.pow(top + 1, REWARD.xpExp) * MYTHIC.xpMult * (1 + 0.1 * level));
  const n = inTime ? 3 : 2, loot = []; // v0.9.2：6 個裝備格，掉落 +1
  const legend = level >= MYTHIC.legendFrom ? Math.min(MYTHIC.legendMax, MYTHIC.legendBase + MYTHIC.legendPerLevel * (level - MYTHIC.legendFrom)) : 0;
  for (let k = 0; k < n; k++) {
    const rar = R() < legend ? RARITY.length - 1 : rollRarity(1); // 秘境至少精良
    loot.push(makeItem(pick(Object.keys(SLOTS)), MYTHIC.dropBase + MYTHIC.dropPerLevel * level + rint(-1, 2), rar));
  }
  return { gold, xp, loot };
}
// 鑰石變化：限時 +1（用不到 80% 時間 +2）；超時或失敗 −1，最低 startKey
export function keyChange(level, battle, timer) {
  const inTime = battle.win && battle.tick <= timer;
  const delta = inTime ? (battle.tick <= timer * MYTHIC.bonusAt ? 2 : 1) : -1;
  return { inTime, delta, next: Math.max(MYTHIC.startKey, level + delta) };
}
