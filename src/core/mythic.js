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

// ---------- 秘境分級 ----------
// tier 1 傳奇秘境：第一章副本，以第 7 層為基準；tier 2 深淵秘境：第二章副本，以第 14 層為基準
export const mythicTier = dIdx => (dIdx > CH1_TOP ? 2 : 1);
export const mythicBase = dIdx => (mythicTier(dIdx) === 2 ? MYTHIC.ch2.base : CH1_TOP);
export const tierFloors = tier => (tier === 2 ? [CH1_TOP + 1, MYTHIC.ch2.base] : [0, CH1_TOP]);
export const tierUnlocked = (s, tier) => !!s.clears[tier === 2 ? MYTHIC.ch2.unlockAfter : MYTHIC.unlockAfter];
// 鑰石：兩種秘境各自一顆
export const keyOf = (s, dIdx) => (mythicTier(dIdx) === 2 ? s.mythic.key2 : s.mythic.key);
export const tierKey = (s, tier) => (tier === 2 ? s.mythic.key2 : s.mythic.key);
export function setKey(s, dIdx, k) { if (mythicTier(dIdx) === 2) s.mythic.key2 = k; else s.mythic.key = k; }

// ---------- 秘境體力 ----------
// 手動挑戰每場 1 點；每 regenMin 分鐘回 1 點，上限 max。掛機不耗體力
const STA_MS = () => MYTHIC.stamina.regenMin * 60000;
export function stamina(s, now = Date.now()) {
  const max = MYTHIC.stamina.max;
  const st = s.mythic.sta || (s.mythic.sta = { pts: max, at: now });
  if (st.pts >= max) { st.at = now; return st; } // 獎勵給的體力可以暫時超過上限
  const n = Math.floor((now - st.at) / STA_MS());
  if (n > 0) { st.pts = Math.min(max, st.pts + n); st.at = st.pts >= max ? now : st.at + n * STA_MS(); }
  return st;
}
export function addStamina(s, n, cap, now = Date.now()) { const st = stamina(s, now); st.pts = Math.min(cap, st.pts + n); return st.pts; }
// 距離下一點還要幾毫秒（滿了回 0）
export const staminaNext = (s, now = Date.now()) => { const st = stamina(s, now); return st.pts >= MYTHIC.stamina.max ? 0 : Math.max(0, st.at + STA_MS() - now); };
export function spendStamina(s, now = Date.now()) {
  const st = stamina(s, now);
  if (st.pts < 1) return false;
  st.pts--; // 滿的時候 stamina() 已把計時起點設成現在，不滿則沿用原本的回復進度
  return true;
}

// ---------- 敵人 ----------
export const mythicTimer = dIdx => (mythicTier(dIdx) === 2 ? MYTHIC.ch2.timer[dIdx - CH1_TOP - 1] : MYTHIC.timer[dIdx]);
export function buildMythicWaves(dIdx, level, affixes) {
  const sh = Math.pow(MYTHIC.hpGrowth, level), sa = Math.pow(MYTHIC.atkGrowth, level);
  const fort = affixes.includes('fortified'), tyr = affixes.includes('tyrannical');
  const scale = (e, rh, ra) => {
    const hp = e.hp * rh * sh * (e.boss ? (tyr ? 1.3 : 1) : (fort ? 1.3 : 1));
    const atk = e.atk * ra * sa * (e.boss ? (tyr ? 1.15 : 1) : (fort ? 1.2 : 1));
    return { ...e, hp: Math.round(hp), atk, addHp: e.addHp && Math.round(e.addHp * rh * sh), addAtk: e.addAtk && e.addAtk * ra * sa };
  };
  if (mythicTier(dIdx) === 2) {
    // 深淵秘境：保留該副本自己的波次（含雙首領），依 norm 往第 14 層的強度拉近（以小怪生命／攻擊為比例）
    const base = buildWaves(MYTHIC.ch2.base), own = buildWaves(dIdx);
    const C = MYTHIC.ch2, rh = C.hp * Math.pow(base[0][0].hp / own[0][0].hp, C.norm), ra = C.atk * Math.pow(base[0][0].atk / own[0][0].atk, C.norm);
    return own.map(wave => wave.map(e => scale(e, rh, ra)));
  }
  // 傳奇秘境：以第 7 層的強度為基準，套用該副本自己的首領機制，再乘上秘境等級
  const base = buildWaves(CH1_TOP), own = buildWaves(dIdx);
  return base.map((wave, wi) => wave.map((e, ei) => {
    const o = own[wi][ei];
    return { ...scale(e, 1, 1), name: o.name, mech: o.mech };
  }));
}
export function mythicBattleOpts(dIdx, level, date) {
  const affixes = activeAffixes(level, date);
  const top = mythicBase(dIdx);
  return { mythic: { dIdx, level, affixes, tier: mythicTier(dIdx), timer: mythicTimer(dIdx), volcanic: buildWaves(top)[0][0].atk * Math.pow(MYTHIC.atkGrowth, level) * 2.5 },
    waves: buildMythicWaves(dIdx, level, affixes), maxTicks: mythicTimer(dIdx) + MYTHIC.overtime };
}

// ---------- 結算 ----------
export function mythicRewards(level, inTime, dIdx = 0) {
  const top = mythicBase(dIdx), t2 = mythicTier(dIdx) === 2;
  const gold = Math.round((REWARD.goldBase + REWARD.goldPerTier * top) * MYTHIC.goldMult * (1 + 0.05 * level) * rnd(0.9, 1.1));
  const xp = Math.round(REWARD.xpBase * Math.pow(top + 1, REWARD.xpExp) * MYTHIC.xpMult * (1 + 0.1 * level));
  const n = inTime ? 3 : 2, loot = []; // v0.9.2：6 個裝備格，掉落 +1
  const legend = level >= MYTHIC.legendFrom ? Math.min(MYTHIC.legendMax, MYTHIC.legendBase + MYTHIC.legendPerLevel * (level - MYTHIC.legendFrom)) : 0;
  const ilvl = t2 ? MYTHIC.ch2.dropBase + MYTHIC.ch2.dropPerLevel * level : MYTHIC.dropBase + MYTHIC.dropPerLevel * level;
  for (let k = 0; k < n; k++) {
    const rar = R() < legend ? RARITY.length - 1 : rollRarity(1); // 秘境至少精良
    loot.push(makeItem(pick(Object.keys(SLOTS)), ilvl + rint(-1, 2), rar));
  }
  return { gold, xp, loot };
}
// 鑰石變化：限時 +1（用不到 80% 時間 +2）；超時或失敗 −1，最低 startKey
export function keyChange(level, battle, timer) {
  const inTime = battle.win && battle.tick <= timer;
  const delta = inTime ? (battle.tick <= timer * MYTHIC.bonusAt ? 2 : 1) : -1;
  return { inTime, delta, next: Math.max(MYTHIC.startKey, level + delta) };
}
