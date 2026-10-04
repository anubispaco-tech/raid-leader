// ===== 寶庫：每日 3 次、60 秒打寶藏哥布林換金幣 =====
import { tx } from './i18n.js';
import { REWARD, VAULT } from './config.js';
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
export const vaultFloors = s => Object.keys(s.clears).filter(k => s.clears[k]).map(Number).sort((a, b) => a - b);
const floorGold = f => REWARD.goldBase + REWARD.goldPerTier * f;
export const vaultGoldPerKill = f => Math.round(floorGold(f) * VAULT.parRuns / VAULT.par[f]);
export const vaultMaxKills = f => Math.round(VAULT.par[f] * VAULT.capMult);

// 一波 3 隻哥布林，越後面越硬；打不完的波數夠多，時間到就結算
export function vaultBattleOpts(floor) {
  const base = buildWaves(floor)[0][0];
  const waves = Array.from({ length: 40 }, (_, k) => Array.from({ length: 3 }, () => ({
    name: tx('寶藏哥布林'), boss: false, goblin: true,
    hp: Math.round(base.hp * VAULT.strength * (1 + VAULT.waveGrowth * k)), atk: base.atk * VAULT.goblinAtk })));
  return { vault: { floor, dur: VAULT.dur }, waves, maxTicks: VAULT.dur };
}
export function applyVaultResult(s, battle, partyHeroes) {
  const f = battle.vault.floor, kills = battle.kills || 0, v = vaultToday(s);
  const gold = Math.min(kills, vaultMaxKills(f)) * vaultGoldPerKill(f);
  const xp = Math.round(REWARD.xpBase * Math.pow(f + 1, REWARD.xpExp) * VAULT.xpMult);
  v.used++; v.runs++;
  const record = kills > (v.best[f] || 0); if (record) v.best[f] = kills;
  s.gold += gold; s.stats.runs++;
  const lvUps = [];
  for (const h of partyHeroes(s)) if (gainXp(h, xp)) lvUps.push({ name: h.name, level: h.level, para: h.para || 0 });
  return { vault: true, kills, gold, xp, record, lvUps, loot: [], kept: [], stashed: [], salvaged: 0, first: false, decayed: false };
}
