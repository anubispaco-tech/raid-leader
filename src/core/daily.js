// ===== 每日（v0.9.4）：每日任務、每日首勝、累積簽到 =====
// 只在有 s.daily 的存檔上運作（遊戲畫面會建立；模擬與回歸測試不會，所以不影響數值）
import { tx } from './i18n.js';
import { DAILY, REWARD, SLOTS, DUNGEONS, CH1_TOP } from './config.js';
import { dayKey, addStamina } from './mythic.js';
import { makeItem, makeSetItem, randomArmorSlot, rollRarity } from './items.js';
import { dungeonInfo } from './dungeons.js';
import { vaultUnlocked } from './vault.js';
import { partyHeroes, mythicUnlocked, grantItem } from './game.js';
import { R, pick } from './rng.js';

export const QUESTS = {
  win:     { name: tx('主線勝利 {0} 場'), n: 5 },
  idle:    { name: tx('掛機戰鬥獲勝 {0} 場（含離線）'), n: 10 },
  upgrade: { name: tx('強化或精煉 {0} 次'), n: 3 },
  salvage: { name: tx('分解 {0} 件裝備'), n: 5 },
  recruit: { name: tx('招募 {0} 名英雄'), n: 1 },
  mythic:  { name: tx('完成 {0} 場秘境挑戰'), n: 2, need: s => mythicUnlocked(s) },
  timed:   { name: tx('秘境限時通關 {0} 次'), n: 1, need: s => mythicUnlocked(s) },
  vault:   { name: tx('挑戰寶庫 {0} 次'), n: 2, need: s => vaultUnlocked(s) },
};
// 三格：戰鬥類／養成類／玩法類（玩法類沒解鎖就從前兩類補）
const GROUPS = [['win', 'idle'], ['upgrade', 'salvage', 'recruit'], ['mythic', 'timed', 'vault']];

const topCleared = s => Math.max(0, ...Object.keys(s.clears).filter(k => s.clears[k]).map(Number));
export const runGold = s => REWARD.goldBase + REWARD.goldPerTier * topCleared(s);
const topIlvl = s => dungeonInfo(topCleared(s)).dropIlvl;
const hash = str => [...str].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 17);

function rollQuests(s, day) {
  let seed = hash(day + ((s.player && s.player.pid) || ''));
  const rnd = n => { seed = (seed * 1103515245 + 12345) >>> 0; return seed % n; };
  const ok = id => !QUESTS[id].need || QUESTS[id].need(s);
  const picked = [];
  for (const g of GROUPS) { const c = g.filter(ok); if (c.length) picked.push(c[rnd(c.length)]); }
  const rest = Object.keys(QUESTS).filter(id => ok(id) && !picked.includes(id));
  while (picked.length < 3) picked.push(rest.splice(rnd(rest.length), 1)[0]);
  return picked.map(id => ({ id, n: 0, claimed: false }));
}
// 取得今天的每日狀態（換日就重抽任務、重置首勝與簽到）
export function dailyToday(s, now = Date.now()) {
  const day = dayKey(new Date(now));
  const d = s.daily || (s.daily = { day: '', q: [], firstWin: false, chest: false, signDays: 0, signed: false });
  if (d.day !== day) Object.assign(d, { day, q: rollQuests(s, day), firstWin: false, chest: false, signed: false });
  return d;
}
// 任務進度（沒有 s.daily 就不做事）
export function bump(s, id, n = 1) {
  if (!s.daily) return;
  for (const q of dailyToday(s).q) if (q.id === id && !q.claimed) q.n = Math.min(QUESTS[id].n, q.n + n);
}
export const questDone = q => q.n >= QUESTS[q.id].n;
export const questText = q => tx(QUESTS[q.id].name, QUESTS[q.id].n);
export const dailyPending = s => { const d = dailyToday(s); return d.q.filter(q => questDone(q) && !q.claimed).length + (!d.signed ? 1 : 0) + (canChest(s) ? 1 : 0); };

function giveItem(s, rarity, setChance = 0) {
  const ch2 = topCleared(s) > CH1_TOP, party = partyHeroes(s);
  const it = ch2 && party.length && R() < setChance ? makeSetItem(pick(party).cls, randomArmorSlot(), topIlvl(s) + 2)
    : makeItem(pick(Object.keys(SLOTS)), topIlvl(s) + 2, rollRarity(rarity));
  return { item: it, dest: grantItem(s, it) };
}
export function claimQuest(s, i) {
  const q = dailyToday(s).q[i]; if (!q || q.claimed || !questDone(q)) return null;
  q.claimed = true;
  const gold = runGold(s) * DAILY.questGoldRuns, dust = DAILY.questDust;
  s.gold += gold; s.dust = (s.dust || 0) + dust;
  return { gold, dust };
}
export const canChest = s => { const d = dailyToday(s); return !d.chest && d.q.length && d.q.every(q => q.claimed); };
export function claimChest(s) {
  if (!canChest(s)) return null;
  dailyToday(s).chest = true; s.stats.chests = (s.stats.chests || 0) + 1;
  return giveItem(s, DAILY.chestRarity, DAILY.chestSetChance);
}
// 累積簽到：每天一次，7 天一輪，斷簽不歸零
export const signinReward = n => DAILY.signin[(n - 1) % DAILY.signin.length];
export function claimSignin(s, now = Date.now()) {
  const d = dailyToday(s, now); if (d.signed) return null;
  d.signed = true; d.signDays++;
  const r = signinReward(d.signDays), out = { day: d.signDays, t: r.t };
  if (r.t === 'gold') { out.gold = runGold(s) * r.runs; s.gold += out.gold; }
  if (r.t === 'dust') { out.dust = r.n; s.dust = (s.dust || 0) + r.n; }
  if (r.t === 'sta') { out.sta = r.n; addStamina(s, r.n, DAILY.staminaOver, now); }
  if (r.t === 'item') Object.assign(out, giveItem(s, r.r, r.set ? 1 : 0));
  return out;
}
// 每日首勝：當天第一場勝利（主線、秘境、掛機都算；寶庫不算）
function firstWin(s) {
  const d = dailyToday(s); if (d.firstWin) return null;
  d.firstWin = true;
  const gold = runGold(s) * DAILY.firstWinGoldRuns; s.gold += gold;
  return { gold, ...giveItem(s, DAILY.firstWinRarity) };
}
// 戰鬥結算後呼叫（遊戲畫面）：更新任務、發首勝；首勝結果掛在 r.firstWin
export function dailyAfterBattle(s, b, r) {
  dailyToday(s);
  if (b.vault) { bump(s, 'vault'); return; }
  const win = b.win;
  if (b.mythicIdle) { if (win) bump(s, 'idle'); }
  else if (b.mythic) { bump(s, 'mythic'); if (r.inTime) bump(s, 'timed'); }
  else if (win) { bump(s, 'win'); if (s.idle === b.dIdx) bump(s, 'idle'); }
  if (win) r.firstWin = firstWin(s);
}
// 離線收益結算後呼叫
export function dailyAfterOffline(s, off, mythicIdle) {
  if (!off || !off.wins) return null;
  dailyToday(s);
  bump(s, 'idle', off.wins); if (!mythicIdle) bump(s, 'win', off.wins);
  return firstWin(s);
}
