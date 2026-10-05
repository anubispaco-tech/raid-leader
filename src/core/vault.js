// ===== 寶庫：每日 3 次、60 秒打寶藏哥布林換金幣 =====
import { tx } from './i18n.js';
import { REWARD, VAULT, CH1_TOP } from './config.js';
import { buildWaves } from './dungeons.js';
import { dayKey } from './mythic.js';
import { gainXp } from './heroes.js';

export const vaultUnlocked = s => !!s.clears[VAULT.unlockAfter];
// 換日就重置今天的次數（台灣時間）
export function vaultToday(s) {
  const v = s.vault, today = dayKey();
  if (v.day !== today) { v.day = today; v.used = 0; }
  return v;
}
export const vaultLeft = s => Math.max(0, VAULT.daily - vaultToday(s).used);
export const vaultFloors = s => Object.keys(s.clears).filter(k => s.clears[k]).map(Number).filter(f => f <= CH1_TOP).sort((a, b) => a - b);
const floorGold = f => REWARD.goldBase + REWARD.goldPerTier * f;
export const vaultGoldPerKill = f => Math.round(floorGold(f) * VAULT.parRuns / VAULT.par[f]);
export const vaultMaxKills = f => Math.round(VAULT.par[f] * VAULT.capMult);

// 一波 3 隻哥布林，越後面越硬；打不完的波數夠多，時間到就結算
// 只接受有寶庫數值的樓層（第一章），其他一律退回可進入的最高層，避免 VAULT.par[f] 不存在算出 NaN
export const vaultFloorOk = f => Number.isInteger(f) && f >= 0 && f <= CH1_TOP && VAULT.par[f] != null;
export function vaultBattleOpts(floor) {
  if (!vaultFloorOk(floor)) floor = CH1_TOP;
  const base = buildWaves(floor)[0][0];
  const waves = Array.from({ length: 40 }, (_, k) => Array.from({ length: 3 }, () => ({
    name: tx('寶藏哥布林'), boss: false, goblin: true,
    hp: Math.round(base.hp * VAULT.strength * (1 + VAULT.waveGrowth * k)), atk: base.atk * VAULT.goblinAtk })));
  return { vault: { floor, dur: VAULT.dur }, waves, maxTicks: VAULT.dur };
}
export function applyVaultResult(s, battle, partyHeroes) {
  const f = vaultFloorOk(battle.vault.floor) ? battle.vault.floor : CH1_TOP, kills = battle.kills || 0, v = vaultToday(s);
  const gold = Math.min(kills, vaultMaxKills(f)) * vaultGoldPerKill(f);
  const xp = Math.round(REWARD.xpBase * Math.pow(f + 1, REWARD.xpExp) * VAULT.xpMult);
  v.used++; v.runs++;
  const record = kills > (v.best[f] || 0); if (record) v.best[f] = kills;
  s.gold += gold; s.stats.runs++;
  const lvUps = [];
  for (const h of partyHeroes(s)) if (gainXp(h, xp)) lvUps.push({ name: h.name, level: h.level, para: h.para || 0 });
  return { vault: true, kills, gold, xp, record, lvUps, loot: [], kept: [], stashed: [], salvaged: 0, first: false, decayed: false };
}
