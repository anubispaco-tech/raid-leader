// ===== 寶庫：每日 3 次、60 秒打寶藏哥布林換金幣（v0.22 起第二章樓層另產精華）=====
import { tx } from './i18n.js';
import { REWARD, VAULT } from './config.js';
import { buildWaves } from './dungeons.js';
import { dayKey } from './mythic.js';
import { gainXp } from './heroes.js';
import { leaderMods, leaderAlloc } from './leader.js';

export const vaultUnlocked = s => !!s.clears[VAULT.unlockAfter];
// 換日就重置今天的次數（台灣時間）
export function vaultToday(s) {
  const v = s.vault, today = dayKey();
  if (v.day !== today) { v.day = today; v.used = 0; }
  return v;
}
export const vaultDaily = s => VAULT.daily + (leaderMods(leaderAlloc(s)).vaultRuns || 0); // v0.23 後勤終極「巢穴熟客」
export const vaultLeft = s => Math.max(0, vaultDaily(s) - vaultToday(s).used);
// v0.22 寶庫延伸到第二章：可進入的樓層＝有 par 數值的已通關樓層
export const VAULT_TOP = VAULT.par.length - 1;
export const vaultFloors = s => Object.keys(s.clears).filter(k => s.clears[k]).map(Number).filter(f => f <= VAULT_TOP).sort((a, b) => a - b);
const floorGold = f => REWARD.goldBase + REWARD.goldPerTier * f;
export const vaultGoldPerKill = f => Math.round(floorGold(f) * VAULT.parRuns / VAULT.par[f]);
export const vaultMaxKills = f => Math.round(VAULT.par[f] * VAULT.capMult);
// v0.22 第二章樓層：打到 par 隻可得的精華（第一章 0）
export const vaultDustPar = f => (f >= VAULT.dust.from ? VAULT.dust.base + VAULT.dust.step * (f - VAULT.dust.from) : 0);
export const vaultDust = (f, kills) => Math.round(vaultDustPar(f) * Math.min(kills, vaultMaxKills(f)) / VAULT.par[f]);

// 一波 3 隻哥布林，越後面越硬；打不完的波數夠多，時間到就結算
// 只接受有寶庫數值的樓層，其他一律退回最高層，避免 VAULT.par[f] 不存在算出 NaN；any = 模擬工具量新樓層用
export const vaultFloorOk = f => Number.isInteger(f) && f >= 0 && f <= VAULT_TOP && VAULT.par[f] != null;
export function vaultBattleOpts(floor, any = false) {
  if (!any && !vaultFloorOk(floor)) floor = VAULT_TOP;
  const base = buildWaves(floor)[0][0];
  const waves = Array.from({ length: 40 }, (_, k) => Array.from({ length: 3 }, () => ({
    name: tx('寶藏哥布林'), boss: false, goblin: true,
    hp: Math.round(base.hp * VAULT.strength * (1 + VAULT.waveGrowth * k)), atk: base.atk * VAULT.goblinAtk })));
  return { vault: { floor, dur: VAULT.dur }, waves, maxTicks: VAULT.dur };
}
export function applyVaultResult(s, battle, partyHeroes) {
  const f = vaultFloorOk(battle.vault.floor) ? battle.vault.floor : VAULT_TOP, kills = battle.kills || 0, v = vaultToday(s);
  const L = leaderMods(leaderAlloc(s));
  const gold = Math.round(Math.min(kills, vaultMaxKills(f)) * vaultGoldPerKill(f) * (1 + (L.gold || 0)));
  const xp = Math.round(REWARD.xpBase * Math.pow(f + 1, REWARD.xpExp) * VAULT.xpMult * (1 + (L.xp || 0)));
  v.used++; v.runs++;
  const record = kills > (v.best[f] || 0); if (record) v.best[f] = kills;
  const dust = vaultDust(f, kills);
  s.gold += gold; s.dust = (s.dust || 0) + dust; s.stats.runs++;
  const lvUps = [];
  for (const h of partyHeroes(s)) if (gainXp(h, xp)) lvUps.push({ name: h.name, level: h.level, para: h.para || 0 });
  return { vault: true, kills, gold, dust, xp, record, lvUps, loot: [], kept: [], stashed: [], salvaged: 0, first: false, decayed: false };
}
