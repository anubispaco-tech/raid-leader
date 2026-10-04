// ===== 遊戲狀態操作：獎勵、隊伍、背包、掛機 =====
// 所有函式都接收存檔物件 s 並直接修改它；畫面層只呼叫這裡，不自己改存檔。
import { CLASSES, HERO, SLOTS, DUNGEONS, REWARD, ECONOMY, GEAR, BAG_MILESTONES, BAG_PER_MILESTONE, HERO_RARITY, LEGENDS, RECRUIT } from './config.js';
import { R, rnd, rint, pick } from './rng.js';
import { makeItem, rollRarity, itemScore, salvageValue, salvageDust, upgradeCost, dustCost } from './items.js';
import { makeHero, gainXp, heroPower, roleOf } from './heroes.js';
import { dungeonInfo } from './dungeons.js';
import { SPECS, TALENT_ROWS, SPEC_LEVEL, applyRecommend } from './talents.js';
import { MYTHIC } from './config.js';
import { mythicRewards, keyChange, mythicBattleOpts } from './mythic.js';
import { Battle } from './battle.js';

export const SAVE_VERSION = 6;
const newPlayer = () => ({ pid: Array.from({ length: 12 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join(''), name: '', asked: false, playSec: 0 });
export const hireCost = h => Math.round((ECONOMY.hireBase + ECONOMY.hirePerLevel * h.level) * HERO_RARITY[h.rarity || 0].hire);

// ---------- 獎勵 ----------
export function rewards(dIdx, win, firstClear) {
  const info = dungeonInfo(dIdx), m = win ? 1 : REWARD.loseMult;
  const gold = Math.round((REWARD.goldBase + REWARD.goldPerTier * dIdx) * m * rnd(0.9, 1.1));
  const xp = Math.round(REWARD.xpBase * Math.pow(dIdx + 1, REWARD.xpExp) * m);
  const loot = [];
  if (win) {
    const n = R() < REWARD.doubleDropChance ? 2 : 1;
    for (let k = 0; k < n; k++) {
      loot.push(makeItem(pick(Object.keys(SLOTS)), info.dropIlvl + rint(-1, 2), rollRarity(firstClear && k === 0 ? REWARD.firstClearMinRarity : 0)));
    }
  }
  return { gold, xp, loot };
}
// 等級壓制：等級高於建議 decayGrace 級後，經驗與金幣遞減
function decayFor(dIdx) {
  const rec = dungeonInfo(dIdx).recLevel;
  const floor = dIdx === DUNGEONS.length - 1 ? REWARD.decayFloorTop : REWARD.decayFloor;
  return L => Math.max(floor, Math.min(1, 1 - REWARD.decayPerLevel * (L - (rec + REWARD.decayGrace))));
}

// ---------- 存檔 ----------
export function newGame() {
  const s = { v: SAVE_VERSION, gold: ECONOMY.startGold, heroes: [], items: {}, bag: [], party: [], unlocked: 1, clears: {},
    tavern: [], idle: null, lastSeen: Date.now(), stats: { runs: 0, wins: 0 }, autoSalvageBelow: 0, keepRarity: ECONOMY.defaultKeepRarity, stash: [], created: Date.now(),
    mythic: { key: MYTHIC.startKey, best: {}, runs: 0, timed: 0 }, failStreak: 0, player: newPlayer(), bagSeen: [],
    recruit: { sinceEpic: 0, sinceLegend: 0, total: 0 }, vault: { day: '', used: 0, runs: 0, best: {} }, dust: 0, idleMythic: null };
  for (const c of HERO.starters) { const h = makeHero(c); s.heroes.push(h); s.party.push(h.id); }
  rollTavern(s);
  return s;
}
// 舊存檔補欄位（之後加天賦等新欄位時在這裡升級）
export function migrate(s) {
  s.stats = s.stats || { runs: 0, wins: 0 };
  // v1 → v2：自動分解改成品質門檻、加入戰利品箱
  if (s.autoSalvageBelow == null) s.autoSalvageBelow = s.autoSalvageCommon ? 1 : 0;
  delete s.autoSalvageCommon;
  if (s.keepRarity == null) s.keepRarity = ECONOMY.defaultKeepRarity;
  s.stash = s.stash || [];
  // v2 → v3：英雄加入專精與天賦（舊英雄先留空，等玩家自己選）
  for (const h of [...s.heroes, ...(s.tavern || [])]) { if (h.spec === undefined) h.spec = null; h.talents = h.talents || {}; }
  // v3 → v4：傳奇秘境、連敗紀錄
  s.mythic = s.mythic || { key: MYTHIC.startKey, best: {}, runs: 0, timed: 0 };
  s.failStreak = s.failStreak || 0;
  // v4 → v5：玩家識別（隨機 ID、暱稱、累計遊玩秒數），用於遊玩數據與排行榜
  s.player = s.player || newPlayer();
  // v0.6：背包擴充里程碑（已通知過的清單；舊存檔把已達成的視為已通知，避免一次跳一堆提示）
  if (!s.bagSeen) { s.bagSeen = []; newBagMilestones(s); }
  // v5 → v6：英雄稀有度（舊英雄一律普通）、招募保底計數、寶庫
  for (const h of [...s.heroes, ...(s.tavern || [])]) { if (h.rarity == null) h.rarity = 0; if (h.legend == null) h.legend = false; }
  s.recruit = s.recruit || { sinceEpic: 0, sinceLegend: 0, total: 0 };
  s.vault = s.vault || { day: '', used: 0, runs: 0, best: {} };
  // v0.7.4：精華（精煉材料）、秘境掛機
  if (s.dust == null) s.dust = 0;
  if (s.idleMythic === undefined) s.idleMythic = null;
  s.v = SAVE_VERSION;
  return s;
}

// ---------- 隊伍與酒館 ----------
export const partyHeroes = s => s.party.map(id => s.heroes.find(h => h.id === id)).filter(Boolean);
const avgLevel = list => list.length ? list.reduce((a, h) => a + h.level, 0) / list.length : 1;

// ---------- 招募：稀有度與保底 ----------
const ownsLegend = (s, cls) => [...s.heroes, ...(s.tavern || [])].some(h => h.legend && h.cls === cls);
export const legendsAvailable = s => Object.keys(CLASSES).filter(c => CLASSES[c].legend).filter(c => !ownsLegend(s, c));
// 抽一次稀有度（酒館名單與招募令共用，都算進保底）
function rollHeroRarity(s) {
  const P = s.recruit || (s.recruit = { sinceEpic: 0, sinceLegend: 0, total: 0 });
  const canLegend = legendsAvailable(s).length > 0;
  let r;
  if (P.sinceLegend >= RECRUIT.pityLegend && canLegend) r = 4;
  else if (P.sinceEpic >= RECRUIT.pityEpic) r = 3;
  else { let x = R(), i = HERO_RARITY.length - 1; for (; i > 0; i--) { x -= HERO_RARITY[i].weight; if (x < 0) break; } r = Math.max(0, i); }
  if (r === 4 && !canLegend) r = 3;
  P.total++;
  P.sinceEpic = r >= 3 ? 0 : P.sinceEpic + 1;
  P.sinceLegend = r === 4 ? 0 : P.sinceLegend + 1;
  return r;
}
function newRecruit(s, level) {
  const r = rollHeroRarity(s);
  const cls = r === 4 ? pick(legendsAvailable(s)) : pick(Object.keys(CLASSES));
  const h = makeHero(cls, level, r);
  // 高等級的新英雄自帶隨機專精與天賦（招募後可以自己改）
  if (h.level >= SPEC_LEVEL) h.spec = pick(Object.keys(CLASSES[h.cls].specs));
  for (const lv of TALENT_ROWS) if (h.level >= lv) h.talents[lv] = pick(['a', 'b']);
  return h;
}
const recruitLevel = s => Math.max(1, Math.round(avgLevel(s.heroes)) - 1);
export function rollTavern(s) {
  const L = recruitLevel(s);
  s.tavern = [];
  for (let i = 0; i < 3; i++) s.tavern.push(newRecruit(s, Math.max(1, L + rint(-1, 0))));
}
// 招募令：直接抽進名冊；十連 9 折
export const scrollCost = (s, n = 1) => Math.round((RECRUIT.scrollBase + RECRUIT.scrollPerLevel * avgLevel(s.heroes)) * n * (n >= 10 ? RECRUIT.tenDiscount : 1));
export function recruitScroll(s, n = 1) {
  const cost = scrollCost(s, n);
  if (s.heroes.length + n > ECONOMY.rosterMax) return { error: 'roster' };
  if (s.gold < cost) return { error: 'gold' };
  s.gold -= cost;
  const got = Array.from({ length: n }, () => newRecruit(s, recruitLevel(s)));
  for (const h of got) { s.heroes.push(h); if (!partyLocked(s) && s.party.length < ECONOMY.partyMax) s.party.push(h.id); }
  return { heroes: got, cost };
}
export function hire(s, heroId) {
  const h = s.tavern.find(x => x.id === heroId), cost = h && hireCost(h);
  if (!h || s.gold < cost || s.heroes.length >= ECONOMY.rosterMax) return null;
  s.gold -= cost; s.heroes.push(h); s.tavern = s.tavern.filter(x => x.id !== heroId);
  if (!partyLocked(s) && s.party.length < ECONOMY.partyMax) s.party.push(h.id);
  if (!s.tavern.length) rollTavern(s);
  return h;
}
// 換一批 = 招募令單抽價的一半（一次 3 位、也算保底；避免便宜刷保底）
export const refreshCost = s => Math.round(scrollCost(s, 1) / 2);
export function refreshTavern(s) {
  const c = refreshCost(s); if (s.gold < c) return false;
  s.gold -= c; rollTavern(s); return true;
}
// 掛機中鎖定陣容：不能加入、移出、解雇出戰中的英雄，備戰只調天賦與裝備
export const partyLocked = s => s.idle != null || s.idleMythic != null;
export function joinParty(s, id) { if (partyLocked(s)) return false; if (s.party.length < ECONOMY.partyMax && !s.party.includes(id)) s.party.push(id); }
export function benchHero(s, id) { if (partyLocked(s)) return false; s.party = s.party.filter(x => x !== id); }
// 解雇：身上裝備自動卸下 → 背包 → 背包滿放戰利品箱 → 都滿就分解成金幣（不會弄丟裝備）
export function fireHero(s, id, gear = { bag: 0, stash: 0, salvaged: 0, gold: 0 }) {
  const h = s.heroes.find(x => x.id === id); if (!h || (partyLocked(s) && s.party.includes(id))) return null;
  for (const sl in h.gear) {
    const iid = h.gear[sl]; if (!iid) continue; h.gear[sl] = null;
    if (s.bag.length < bagMax(s)) { s.bag.push(iid); gear.bag++; }
    else if (s.stash.length < ECONOMY.stashMax) { s.stash.push(iid); gear.stash++; }
    else { s.bag.push(iid); gear.gold += salvage(s, iid); gear.salvaged++; }
  }
  s.heroes = s.heroes.filter(x => x.id !== id); s.party = s.party.filter(x => x !== id);
  const refund = Math.round(hireCost(h) * RECRUIT.fireRefund); s.gold += refund;
  return { ...h, refund, gear };
}
// 一鍵解雇：只動待命英雄，品質 ≤ maxRarity，傳說永遠不會被一鍵解雇；dry = 只試算
export function fireTargets(s, maxRarity) {
  const list = s.heroes.filter(h => !s.party.includes(h.id) && !h.legend && (h.rarity || 0) <= Math.min(maxRarity, 3));
  return list.length >= s.heroes.length ? list.slice(0, s.heroes.length - 1) : list; // 至少留一位英雄
}
export function fireMany(s, maxRarity, dry = false) {
  const list = fireTargets(s, maxRarity);
  if (dry) return { count: list.length, refund: list.reduce((g, h) => g + Math.round(hireCost(h) * RECRUIT.fireRefund), 0) };
  const gear = { bag: 0, stash: 0, salvaged: 0, gold: 0 }; let refund = 0;
  for (const h of list) refund += fireHero(s, h.id, gear).refund;
  return { count: list.length, refund, gear };
}

// ---------- 戰鬥結算 ----------
// ---------- 背包容量 ----------
export const bagMax = s => ECONOMY.bagMax + BAG_PER_MILESTONE * BAG_MILESTONES.filter(m => m.test(s)).length;
// 回傳新達成（還沒通知過）的里程碑，並記錄為已通知
export function newBagMilestones(s) {
  s.bagSeen = s.bagSeen || [];
  const fresh = BAG_MILESTONES.filter(m => m.test(s) && !s.bagSeen.includes(m.id));
  s.bagSeen.push(...fresh.map(m => m.id));
  return fresh;
}
// 新掉落的去向：自動分解 → 背包 → 戰利品箱（只收 keepRarity 以上）→ 分解成金幣
function addLoot(s, it) {
  if (it.rarity < s.autoSalvageBelow) { s.gold += salvageValue(it); s.dust = (s.dust || 0) + salvageDust(it); return 'salvaged'; }
  if (s.bag.length < bagMax(s)) { s.items[it.id] = it; s.bag.push(it.id); return 'bag'; }
  if (it.rarity >= s.keepRarity && s.stash.length < ECONOMY.stashMax) { s.items[it.id] = it; s.stash.push(it.id); return 'stash'; }
  s.gold += salvageValue(it); s.dust = (s.dust || 0) + salvageDust(it); return 'salvaged';
}
export function applyResult(s, dIdx, battle) {
  const first = battle.win && !s.clears[dIdx];
  const rw = rewards(dIdx, battle.win, first);
  const party = partyHeroes(s), decay = decayFor(dIdx), avgL = avgLevel(party);
  s.stats.runs++;
  rw.gold = Math.max(1, Math.round(rw.gold * decay(avgL)));
  s.gold += rw.gold;
  rw.decayed = decay(avgL) < 1;
  const baseXp = rw.xp; rw.xp = Math.round(baseXp * decay(avgL));
  const lvUps = [];
  for (const h of party) { if (gainXp(h, Math.round(baseXp * decay(h.level)))) lvUps.push({ name: h.name, level: h.level, para: h.para || 0 }); }
  if (dIdx === s.unlocked - 1) s.failStreak = battle.win ? 0 : (s.failStreak || 0) + 1;
  if (battle.win) {
    s.stats.wins++;
    s.clears[dIdx] = (s.clears[dIdx] || 0) + 1;
    if (dIdx + 1 >= s.unlocked && dIdx + 1 < DUNGEONS.length) s.unlocked = dIdx + 2;
  }
  const dest = rw.loot.map(it => addLoot(s, it));
  const kept = rw.loot.filter((_, i) => dest[i] === 'bag'), stashed = rw.loot.filter((_, i) => dest[i] === 'stash');
  return { ...rw, first, lvUps, kept, stashed, salvaged: dest.filter(d => d === 'salvaged').length };
}

// ---------- 傳奇秘境 ----------
export const mythicUnlocked = s => !!s.clears[MYTHIC.unlockAfter];
// 精煉（+6 以上）在通關第 7 層後開放
export const maxUpFor = s => mythicUnlocked(s) ? GEAR.maxUp : GEAR.refineFrom;
export function applyMythicResult(s, battle) {
  const M = battle.mythic, kc = keyChange(M.level, battle, M.timer);
  const rw = mythicRewards(M.level, kc.inTime);
  s.stats.runs++; if (battle.win) s.stats.wins++;
  s.mythic.runs++; if (kc.inTime) s.mythic.timed++;
  s.gold += rw.gold;
  const lvUps = [];
  for (const h of partyHeroes(s)) if (gainXp(h, rw.xp)) lvUps.push({ name: h.name, level: h.level, para: h.para || 0 });
  const prevKey = s.mythic.key; s.mythic.key = kc.next;
  const best = s.mythic.best[M.dIdx], record = kc.inTime && (!best || M.level > best.level || (M.level === best.level && battle.tick < best.time));
  if (record) s.mythic.best[M.dIdx] = { level: M.level, time: battle.tick };
  const dest = rw.loot.map(it => addLoot(s, it));
  const kept = rw.loot.filter((_, i) => dest[i] === 'bag'), stashed = rw.loot.filter((_, i) => dest[i] === 'stash');
  return { ...rw, mythic: true, inTime: kc.inTime, prevKey, nextKey: kc.next, record, lvUps, kept, stashed,
    salvaged: dest.filter(d => d === 'salvaged').length, first: false, decayed: false };
}
// ---------- 秘境掛機 ----------
// 可掛機的等級 = 該副本限時最高 −2（至少起始等級）；該副本還沒限時通關過就不能掛機
export function mythicIdleLevel(s, dIdx) {
  const b = s.mythic.best && s.mythic.best[dIdx];
  return b ? Math.max(MYTHIC.startKey, b.level - MYTHIC.idleBelow) : 0;
}
export const canMythicIdle = s => Object.keys(s.mythic.best || {}).length > 0;
export function applyMythicIdleResult(s, battle) {
  const M = battle.mythic, win = battle.win;
  const rw = mythicRewards(M.level, true), m = win ? MYTHIC.idleMult : MYTHIC.idleMult * REWARD.loseMult;
  rw.gold = Math.round(rw.gold * m); rw.xp = Math.round(rw.xp * m); rw.loot = win ? rw.loot.slice(0, 1) : [];
  s.stats.runs++; if (win) s.stats.wins++;
  s.gold += rw.gold;
  const lvUps = [];
  for (const h of partyHeroes(s)) if (gainXp(h, rw.xp)) lvUps.push({ name: h.name, level: h.level, para: h.para || 0 });
  const dest = rw.loot.map(it => addLoot(s, it));
  const kept = rw.loot.filter((_, i) => dest[i] === 'bag'), stashed = rw.loot.filter((_, i) => dest[i] === 'stash');
  return { ...rw, mythic: true, mythicIdle: true, inTime: win, prevKey: s.mythic.key, nextKey: s.mythic.key, record: false, lvUps, kept, stashed,
    salvaged: dest.filter(d => d === 'salvaged').length, first: false, decayed: false };
}

// ---------- 背包與裝備 ----------
export function equip(s, heroId, itemId) {
  const h = s.heroes.find(x => x.id === heroId), it = s.items[itemId]; if (!h || !it) return;
  const prev = h.gear[it.slot];
  for (const o of s.heroes) if (o.gear[it.slot] === itemId) o.gear[it.slot] = null; // 從別人身上拿過來
  s.bag = s.bag.filter(id => id !== itemId); s.stash = (s.stash || []).filter(id => id !== itemId);
  h.gear[it.slot] = itemId;
  if (prev && prev !== itemId) s.bag.push(prev);
}
export function unequip(s, heroId, slot) {
  const h = s.heroes.find(x => x.id === heroId); if (!h || !h.gear[slot]) return;
  s.bag.push(h.gear[slot]); h.gear[slot] = null;
}
// 一鍵卸下：放回背包；背包放不下的放進戰利品箱；兩邊都滿就停
export function unequipAll(s, heroId) {
  const h = s.heroes.find(x => x.id === heroId); if (!h) return { moved: 0, stashed: 0, left: 0 };
  let moved = 0, stashed = 0, left = 0;
  for (const slot of Object.keys(SLOTS)) {
    const id = h.gear[slot]; if (!id) continue;
    if (s.bag.length < bagMax(s)) { s.bag.push(id); moved++; }
    else if (s.stash.length < ECONOMY.stashMax) { s.stash.push(id); stashed++; }
    else { left++; continue; }
    h.gear[slot] = null;
  }
  return { moved, stashed, left };
}
// 一鍵強化：每次挑最便宜的一件強化，直到金幣不夠或全部滿級；dry=true 只試算不扣錢
export function upgradeAll(s, heroId, dry = false) {
  const h = s.heroes.find(x => x.id === heroId); if (!h) return { count: 0, spent: 0, maxed: true };
  const items = Object.keys(SLOTS).map(sl => h.gear[sl] && s.items[h.gear[sl]]).filter(Boolean);
  const ups = new Map(items.map(it => [it, it.up]));
  let gold = s.gold, dust = s.dust || 0, count = 0, spent = 0, dustSpent = 0;
  for (;;) {
    const cand = items.filter(it => ups.get(it) < maxUpFor(s))
      .map(it => ({ it, cost: upgradeCost({ ...it, up: ups.get(it) }), dust: dustCost({ ...it, up: ups.get(it) }) }))
      .filter(c => c.dust <= dust).sort((a, b) => a.cost - b.cost)[0];
    if (!cand || cand.cost > gold) break;
    gold -= cand.cost; dust -= cand.dust; spent += cand.cost; dustSpent += cand.dust; count++; ups.set(cand.it, ups.get(cand.it) + 1);
  }
  const maxed = items.length > 0 && items.every(it => ups.get(it) >= maxUpFor(s));
  if (!dry) { s.gold = gold; s.dust = dust; for (const [it, up] of ups) it.up = up; }
  return { count, spent, dustSpent, maxed, empty: !items.length };
}
export function salvage(s, itemId) {
  const it = s.items[itemId]; if (!it) return 0;
  s.bag = s.bag.filter(id => id !== itemId); s.stash = (s.stash || []).filter(id => id !== itemId); delete s.items[itemId];
  const v = salvageValue(it); s.gold += v; s.dust = (s.dust || 0) + salvageDust(it); return v;
}
// 分解背包中品質 ≤ maxRarity 的裝備（0 = 普通，1 = 精良以下）
export function salvageUpTo(s, maxRarity) {
  const ids = s.bag.filter(i => s.items[i].rarity <= maxRarity);
  return { count: ids.length, gold: ids.reduce((g, i) => g + salvage(s, i), 0) };
}
// ---------- 推薦陣容 ----------
// 依副本機制（hints：pulse / buster / summon / enrage）從名冊挑 5 人：
// 坦克 1；有脈衝（全隊傷害）帶 2 補，否則 1 補；其餘輸出依機制偏好（召喚 → 法師、狂暴 → 盜賊）再比戰力
export function recommendParty(s, hints) {
  const has = t => hints.includes(t), pw = h => heroPower(h, s.items);
  const byRole = r => s.heroes.filter(h => roleOf(h) === r).sort((a, b) => pw(b) - pw(a));
  const pick = [...byRole('tank').slice(0, 1), ...byRole('heal').slice(0, has('pulse') ? 2 : 1)];
  // 職業包的 prefers：遇到這些機制時戰力 ×1.25 優先挑選
  const pref = h => (CLASSES[h.cls].prefers || []).reduce((m, t) => m * (has(t) ? 1.25 : 1), 1);
  const rest = s.heroes.filter(h => !pick.includes(h)).sort((a, b) => (roleOf(b) === 'dps') - (roleOf(a) === 'dps') || pw(b) * pref(b) - pw(a) * pref(a));
  pick.push(...rest.slice(0, Math.max(0, ECONOMY.partyMax - pick.length)));
  s.party = pick.slice(0, ECONOMY.partyMax).map(h => h.id);
  return partyHeroes(s);
}
// 一鍵備戰：推薦陣容 → 推薦天賦 → 一鍵配裝
// 掛機中（partyLocked）保留目前陣容，只套用天賦與裝備
export function prepare(s, hints) {
  const locked = partyLocked(s), party = locked ? partyHeroes(s) : recommendParty(s, hints);
  for (const h of party) applyRecommend(h, hints);
  const swapped = autoEquip(s);
  const roles = { tank: 0, heal: 0, dps: 0 }; party.forEach(h => roles[roleOf(h)]++);
  return { roles, swapped, locked };
}
// ---------- 戰利品箱 ----------
export function takeFromStash(s) {
  const room = bagMax(s) - s.bag.length;
  const ids = [...s.stash].sort((a, b) => itemScore(s.items[b]) - itemScore(s.items[a])).slice(0, Math.max(0, room));
  s.stash = s.stash.filter(id => !ids.includes(id)); s.bag.push(...ids);
  return ids.length;
}
export function salvageStash(s) {
  const gold = s.stash.reduce((g, id) => { const v = salvageValue(s.items[id]); s.dust = (s.dust || 0) + salvageDust(s.items[id]); delete s.items[id]; return g + v; }, 0);
  const count = s.stash.length; s.stash = []; s.gold += gold;
  return { count, gold };
}
export function upgrade(s, itemId) {
  const it = s.items[itemId]; if (!it || it.up >= maxUpFor(s)) return false;
  const c = upgradeCost(it), d = dustCost(it); if (s.gold < c || (s.dust || 0) < d) return false;
  s.gold -= c; s.dust = (s.dust || 0) - d; it.up++; return true;
}
// 背包裡是否有比出戰隊員身上更好的裝備（下一步建議用）
export function hasUpgrade(s) {
  return partyHeroes(s).some(h => Object.keys(SLOTS).some(slot => {
    const cur = h.gear[slot] && s.items[h.gear[slot]];
    return s.bag.some(id => { const it = s.items[id]; return it.slot === slot && (!cur || itemScore(it) > itemScore(cur)); });
  }));
}
// 一鍵配裝：替出戰隊員從背包挑分數最高的
// heroId 有給就只配這位英雄（待命英雄也可以）；dry = 只計算會換幾件
export function autoEquip(s, heroId, dry) {
  let changed = 0;
  const list = heroId ? s.heroes.filter(h => h.id === heroId) : partyHeroes(s);
  for (const h of list) {
    for (const slot of Object.keys(SLOTS)) {
      const cur = h.gear[slot] && s.items[h.gear[slot]];
      let best = null;
      for (const id of s.bag) { const it = s.items[id]; if (it.slot === slot && (!best || itemScore(it) > itemScore(best))) best = it; }
      if (best && (!cur || itemScore(best) > itemScore(cur))) { if (!dry) equip(s, h.id, best.id); changed++; }
    }
  }
  return changed;
}

// ---------- 掛機與離線收益 ----------
export function offlineProgress(s, now = Date.now()) {
  const myth = s.idleMythic != null && mythicIdleLevel(s, s.idleMythic);
  if (!myth && (s.idle == null || !s.clears[s.idle])) { s.lastSeen = now; return null; }
  const sec = Math.min(ECONOMY.offlineCapHours * 3600, Math.max(0, (now - s.lastSeen) / 1000));
  s.lastSeen = now;
  if (sec < 60 || !partyHeroes(s).length) return null;
  let t = 0, runs = 0, wins = 0, gold = 0, items = 0, stashed = 0, lv = 0;
  while (runs < 400) {
    const d = myth ? s.idleMythic : s.idle;
    const b = new Battle(partyHeroes(s), s.items, d, { ...(myth ? mythicBattleOpts(d, myth) : {}), autoHorn: true }).runToEnd();
    t += b.tick + 5; if (t > sec) break;
    const r = myth ? applyMythicIdleResult(s, b) : applyResult(s, d, b);
    runs++; if (b.win) wins++; gold += r.gold; items += r.kept.length; stashed += r.stashed.length; lv += r.lvUps.length;
  }
  return { sec: Math.round(sec), runs, wins, gold, items, stashed, lv };
}
