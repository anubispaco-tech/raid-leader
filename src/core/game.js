// ===== 遊戲狀態操作：獎勵、隊伍、背包、掛機 =====
// 所有函式都接收存檔物件 s 並直接修改它；畫面層只呼叫這裡，不自己改存檔。
import { CLASSES, HERO, SLOTS, DUNGEONS, REWARD, ECONOMY, GEAR, BAG_MILESTONES, BAG_PER_MILESTONE, HERO_RARITY, LEGENDS, RECRUIT } from './config.js';
import { R, rnd, rint, pick } from './rng.js';
import { makeItem, rollLoot, canEquip, rollRarity, itemScore, heroItemScore, makeSetItem, setDropSlot, salvageValue, salvageDust, upgradeCost, dustCost, codexKey, codexAllKeys, setCodexKeys, guessBase } from './items.js';
import { CODEX_REWARDS } from './config.js';
import { makeHero, gainXp, heroPower, roleOf, heroIlvl } from './heroes.js';
import { getLang } from './i18n.js';
import { dungeonInfo } from './dungeons.js';
import { SPECS, TALENT_ROWS, SPEC_LEVEL, applyRecommend } from './talents.js';
import { MYTHIC, CH1_TOP, SET_DROP, SET_T5, RARITY, mythicBestLevel } from './config.js';
import { leaderModsOf, leaderMods, leaderAlloc, validAlloc, leaderLevel, migrateLeader } from './leader.js';
import { bump } from './daily.js';
import { mythicRewards, keyChange, mythicBattleOpts, keyOf, setKey, mythicTier } from './mythic.js';
import { Battle } from './battle.js';

export const SAVE_VERSION = 6;
const newPlayer = () => ({ pid: Array.from({ length: 12 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join(''), name: '', asked: false, playSec: 0 });
// v0.23 團長後勤：經濟加成（不分地區）
const LM = s => leaderMods(leaderAlloc(s));
export const salvDust = (s, it) => { const d = LM(s).dust; return d ? Math.round(salvageDust(it) * (1 + d)) : salvageDust(it); };
export const offlineCap = s => ECONOMY.offlineCapHours + (LM(s).offlineH || 0);
export const hireCost = h => Math.round((ECONOMY.hireBase + ECONOMY.hirePerLevel * h.level) * HERO_RARITY[h.rarity || 0].hire);

// ---------- 獎勵 ----------
export function rewards(dIdx, win, firstClear, classes) { // classes：出戰隊員職業（v0.19 掉落加權）
  const info = dungeonInfo(dIdx), m = win ? 1 : REWARD.loseMult;
  const gold = Math.round((REWARD.goldBase + REWARD.goldPerTier * dIdx) * m * rnd(0.9, 1.1));
  const xp = Math.round(REWARD.xpBase * Math.pow(dIdx + 1, REWARD.xpExp) * m);
  const loot = [];
  if (win) {
    const n = REWARD.baseDrops + (R() < REWARD.doubleDropChance ? 1 : 0);
    for (let k = 0; k < n; k++) {
      loot.push(rollLoot(classes, info.dropIlvl + rint(-1, 2), rollRarity(firstClear && k === 0 ? REWARD.firstClearMinRarity : 0)));
    }
  }
  return { gold, xp, loot };
}
// 等級壓制：等級高於建議 decayGrace 級後，經驗與金幣遞減
function decayFor(dIdx) {
  const rec = dungeonInfo(dIdx).recLevel;
  const floor = dIdx >= CH1_TOP ? REWARD.decayFloorTop : REWARD.decayFloor; // 第 7 層與第二章：後期仍可掛機
  return L => Math.max(floor, Math.min(1, 1 - REWARD.decayPerLevel * (L - (rec + REWARD.decayGrace))));
}

// ---------- 存檔 ----------
export function newGame() {
  const s = { v: SAVE_VERSION, gold: ECONOMY.startGold, heroes: [], items: {}, bag: [], party: [], unlocked: 1, clears: {},
    tavern: [], idle: null, lastSeen: Date.now(), stats: { runs: 0, wins: 0 }, autoSalvageBelow: 0, keepRarity: ECONOMY.defaultKeepRarity, stash: [], created: Date.now(),
    mythic: { key: MYTHIC.startKey, key2: MYTHIC.startKey, best: {}, runs: 0, timed: 0 }, failStreak: 0, player: newPlayer(), bagSeen: [],
    tut: { step: 0, done: false }, cards: [],
    recruit: { sinceEpic: 0, sinceLegend: 0, total: 0 }, vault: { day: '', used: 0, runs: 0, best: {} }, dust: 0, idleMythic: null, salvageIlvlGap: 0, story: { seen: [] }, leader: { alloc: {}, cmds: [] } };
  for (const c of HERO.starters) { const h = makeHero(c); h.name = uniqueName(s); s.heroes.push(h); s.party.push(h.id); }
  rollTavern(s);
  return s;
}
// 舊存檔補欄位（之後加天賦等新欄位時在這裡升級）
export function migrate(s) {
  s.stats = s.stats || { runs: 0, wins: 0 };
  s.bagBought = Math.max(0, Math.min(ECONOMY.bagBuy.max, Math.floor(Number(s.bagBought) || 0))); // v0.15
  // v0.17 教學：已經玩過的舊存檔直接視為完成
  if (!s.tut || typeof s.tut !== 'object') s.tut = { step: 0, done: (s.stats.runs || 0) > 0 };
  s.tut.step = Math.max(0, Math.min(4, Math.floor(Number(s.tut.step) || 0)));
  if (s.clears && s.clears[1]) s.tut.done = true; // 已經通關第 2 層：不需要教學
  if (!Array.isArray(s.cards)) s.cards = [];
  // v0.16 舊裝備補上基底代號；圖鑑登錄目前持有的裝備
  if (!s.codex || typeof s.codex !== 'object' || Array.isArray(s.codex)) s.codex = {};
  if (!Array.isArray(s.codexClaimed)) s.codexClaimed = [];
  for (const it of Object.values(s.items || {})) { if (it && typeof it === 'object') { const b = guessBase(it); if (b) it.base = b; codexAdd(s, it); } }
  // v1 → v2：自動分解改成品質門檻、加入戰利品箱
  if (s.autoSalvageBelow == null) s.autoSalvageBelow = s.autoSalvageCommon ? 1 : 0;
  delete s.autoSalvageCommon;
  if (s.keepRarity == null) s.keepRarity = ECONOMY.defaultKeepRarity;
  s.stash = s.stash || [];
  // v2 → v3：英雄加入專精與天賦（舊英雄先留空，等玩家自己選）
  for (const h of [...s.heroes, ...(s.tavern || [])]) { if (h.spec === undefined) h.spec = null; h.talents = h.talents || {}; }
  // v3 → v4：傳奇秘境、連敗紀錄
  s.mythic = s.mythic || { key: MYTHIC.startKey, best: {}, runs: 0, timed: 0 };
  if (s.mythic.key2 == null) s.mythic.key2 = MYTHIC.startKey; // v0.9.3 深淵秘境
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
  // v0.23 團長天賦配點（團長經驗由場數推算，不用另存）；v0.24 改成天賦樹，舊配點退回
  migrateLeader(s);
  // v0.9.2：護甲拆成頭胸手腿 → 舊的「護甲」變成胸甲
  for (const it of Object.values(s.items)) if (it.slot === 'armor') it.slot = 'chest';
  for (const h of [...s.heroes, ...(s.tavern || [])]) {
    if ('armor' in h.gear) { h.gear.chest = h.gear.chest || h.gear.armor; delete h.gear.armor; }
    for (const sl of ['head', 'hands', 'legs']) if (h.gear[sl] === undefined) h.gear[sl] = null;
  }
  // v0.9.0：依裝等自動分解、劇情進度
  if (s.salvageIlvlGap == null) s.salvageIlvlGap = 0;
  s.story = s.story || { seen: [] };
  normalizeTypes(s);
  // v0.19 職業限制：穿不上的裝備卸回背包（滿了先進戰利品箱，再滿也放背包，不會消失）；件數給畫面顯示一次說明
  { let n = 0;
    for (const h of s.heroes) for (const sl of Object.keys(h.gear || {})) {
      const id = h.gear[sl], it = id && s.items[id]; if (!it || canEquip(h, it)) continue;
      h.gear[sl] = null; n++;
      if (s.bag.length >= bagMax(s) && s.stash.length < ECONOMY.stashMax) s.stash.push(id); else s.bag.push(id);
    }
    s.gearFix = int(s.gearFix, 0, 999) + n; }
  s.v = SAVE_VERSION;
  return s;
}
// v0.10.1：數值欄位強制成合法數字、未知職業／部位移除（防止被竄改的存檔讓畫面壞掉或注入）
const int = (v, lo, hi, d = lo) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
function normalizeTypes(s) {
  const R = HERO_RARITY.length - 1, IR = RARITY.length - 1;
  s.gold = int(s.gold, 0, 1e12); s.dust = int(s.dust, 0, 1e9); s.unlocked = int(s.unlocked, 1, DUNGEONS.length);
  if (s.leader) { s.leader.alloc = validAlloc(s.leader.alloc, leaderLevel(s), s) || {}; if (s.leader.seen != null) s.leader.seen = int(s.leader.seen, 0, 999); s.leader.cmds = (Array.isArray(s.leader.cmds) ? s.leader.cmds : []).filter(c => typeof c === 'string').slice(0, 4); }
  const okHero = h => h && typeof h === 'object' && CLASSES[h.cls] && h.gear && typeof h.gear === 'object';
  s.heroes = s.heroes.filter(okHero); s.tavern = (s.tavern || []).filter(okHero);
  for (const h of [...s.heroes, ...s.tavern]) {
    h.rarity = int(h.rarity, 0, R); h.level = int(h.level, 1, HERO.maxLevel); h.xp = int(h.xp, 0, 1e12);
    if (h.spec != null && !CLASSES[h.cls].specs[h.spec]) h.spec = null;
    if (typeof h.name !== 'string') h.name = '?';
  }
  for (const [id, it] of Object.entries(s.items)) {
    if (!it || typeof it !== 'object' || !SLOTS[it.slot]) { delete s.items[id]; continue; }
    it.rarity = int(it.rarity, 0, IR); it.ilvl = int(it.ilvl, 1, 9999); it.up = int(it.up, 0, GEAR.maxUp);
    if (typeof it.name !== 'string') it.name = '?';
    if (it.t5 && it.set) { it.t5 = 1; it.rarity = SET_T5.rarity; } else delete it.t5;
  }
  const ids = new Set(s.heroes.map(h => h.id));
  s.party = (s.party || []).filter(id => ids.has(id));
  s.bag = (s.bag || []).filter(id => s.items[id]); s.stash = (s.stash || []).filter(id => s.items[id]);
  for (const h of s.heroes) for (const sl of Object.keys(h.gear)) if (h.gear[sl] && !s.items[h.gear[sl]]) h.gear[sl] = null;
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
  if (!h.legend) h.name = uniqueName(s);
  // 高等級的新英雄自帶隨機專精與天賦（招募後可以自己改）
  if (h.level >= SPEC_LEVEL) h.spec = pick(Object.keys(CLASSES[h.cls].specs));
  for (const lv of TALENT_ROWS) if (h.level >= lv) h.talents[lv] = pick(['a', 'b']);
  return h;
}
// 名字・稱號，避開名冊與酒館已有的名字
function uniqueName(s) {
  const taken = new Set([...s.heroes, ...(s.tavern || [])].map(h => h.name)), sep = getLang() === 'en' ? ' ' : '・';
  let n = '';
  for (let i = 0; i < 30; i++) { n = pick(HERO.names) + sep + pick(HERO.titles); if (!taken.has(n)) break; }
  return n;
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
  bump(s, 'recruit', n);
  return { heroes: got, cost };
}
export function hire(s, heroId) {
  const h = s.tavern.find(x => x.id === heroId), cost = h && hireCost(h);
  if (!h || s.gold < cost || s.heroes.length >= ECONOMY.rosterMax) return null;
  s.gold -= cost; s.heroes.push(h); s.tavern = s.tavern.filter(x => x.id !== heroId); bump(s, 'recruit');
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
  const h = s.heroes.find(x => x.id === id); if (!h || h.locked || (partyLocked(s) && s.party.includes(id))) return null;
  for (const sl in h.gear) {
    const iid = h.gear[sl]; if (!iid) continue; h.gear[sl] = null;
    if (s.bag.length < bagMax(s) || (s.items[iid] && s.items[iid].locked)) { s.bag.push(iid); gear.bag++; } // 鎖定的裝備一定放回背包（可超過上限）
    else if (s.stash.length < ECONOMY.stashMax) { s.stash.push(iid); gear.stash++; }
    else { s.bag.push(iid); gear.gold += salvage(s, iid); gear.salvaged++; }
  }
  s.heroes = s.heroes.filter(x => x.id !== id); s.party = s.party.filter(x => x !== id);
  const refund = Math.round(hireCost(h) * RECRUIT.fireRefund); s.gold += refund;
  return { ...h, refund, gear };
}
// 一鍵解雇：只動待命英雄，品質 ≤ maxRarity，傳說永遠不會被一鍵解雇；dry = 只試算
export function fireTargets(s, maxRarity) {
  const list = s.heroes.filter(h => !s.party.includes(h.id) && !h.legend && !h.locked && (h.rarity || 0) <= Math.min(maxRarity, 3));
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
export const bagMax = s => ECONOMY.bagMax + BAG_PER_MILESTONE * BAG_MILESTONES.filter(m => m.test(s)).length + ECONOMY.bagBuy.slots * (s.bagBought || 0);
// v0.15 金幣擴充背包：第 n 次（0 起）價格 = base × mult^n，取整到百
export const bagBuyCost = s => ((s.bagBought || 0) >= ECONOMY.bagBuy.max ? null : Math.round(ECONOMY.bagBuy.base * ECONOMY.bagBuy.mult ** (s.bagBought || 0) / 100) * 100);
export function buyBag(s) {
  const c = bagBuyCost(s); if (c == null || s.gold < c) return false;
  s.gold -= c; s.bagBought = (s.bagBought || 0) + 1; return c;
}
// 回傳新達成（還沒通知過）的里程碑，並記錄為已通知
export function newBagMilestones(s) {
  s.bagSeen = s.bagSeen || [];
  const fresh = BAG_MILESTONES.filter(m => m.test(s) && !s.bagSeen.includes(m.id));
  s.bagSeen.push(...fresh.map(m => m.id));
  return fresh;
}
// 新掉落的去向：自動分解 → 背包 → 戰利品箱（只收 keepRarity 以上）→ 分解成金幣
// 出戰隊員的平均裝等（依裝等自動分解用）
export const partyIlvl = s => { const p = partyHeroes(s); return p.length ? p.reduce((a, h) => a + heroIlvl(h, s.items), 0) / p.length : 0; };
// 分解背包裡比平均裝等低 gap 以上的裝備（傳說除外）
export function salvageLowIlvl(s, gap, dry = false) {
  const lim = partyIlvl(s) - gap, ids = s.bag.filter(i => s.items[i].rarity < 4 && !s.items[i].set && !s.items[i].locked && s.items[i].ilvl < lim);
  if (dry) return { count: ids.length };
  return { count: ids.length, gold: ids.reduce((g, i) => g + salvage(s, i), 0) };
}
export function addLoot(s, it) {
  codexAdd(s, it); // 自動分解的也算「獲得過」
  const auto = () => { s.gold += salvageValue(it); s.dust = (s.dust || 0) + salvDust(s, it); s.stats.salvaged = (s.stats.salvaged || 0) + 1; return 'salvaged'; };
  if (s.salvageIlvlGap && it.rarity < 4 && it.ilvl < partyIlvl(s) - s.salvageIlvlGap) return auto();
  if (it.rarity < s.autoSalvageBelow) return auto();
  if (s.bag.length < bagMax(s)) { s.items[it.id] = it; s.bag.push(it.id); return 'bag'; }
  if (it.rarity >= s.keepRarity && s.stash.length < ECONOMY.stashMax) { s.items[it.id] = it; s.stash.push(it.id); return 'stash'; }
  s.gold += salvageValue(it); s.dust = (s.dust || 0) + salvDust(s, it); return 'salvaged';
}
export function applyResult(s, dIdx, battle) {
  const first = battle.win && !s.clears[dIdx];
  const rw = rewards(dIdx, battle.win, first, partyHeroes(s).map(h => h.cls));
  const party = partyHeroes(s), decay = decayFor(dIdx), avgL = avgLevel(party), L = LM(s);
  s.stats.runs++;
  rw.gold = Math.max(1, Math.round(rw.gold * decay(avgL) * (1 + (L.gold || 0))));
  s.gold += rw.gold;
  rw.decayed = decay(avgL) < 1;
  const baseXp = L.xp ? Math.round(rw.xp * (1 + L.xp)) : rw.xp; rw.xp = Math.round(baseXp * decay(avgL));
  const lvUps = [];
  for (const h of party) { if (gainXp(h, Math.round(baseXp * decay(h.level)))) lvUps.push({ name: h.name, level: h.level, para: h.para || 0 }); }
  if (dIdx === s.unlocked - 1) s.failStreak = battle.win ? 0 : (s.failStreak || 0) + 1;
  if (battle.win) {
    s.stats.wins++;
    s.clears[dIdx] = (s.clears[dIdx] || 0) + 1;
    if (dIdx + 1 >= s.unlocked && dIdx + 1 < DUNGEONS.length) s.unlocked = dIdx + 2;
    if (!battle.charms && (DUNGEONS[dIdx].mech || []).some(m => m.t === 'charm') && dIdx === 16) s.stats.nocharm = 1; // v0.25 成就「不為歌聲所動」
  }
  // 第二章：T0 套裝部件（出戰隊員其中一人的職業）
  if (battle.win && dIdx > CH1_TOP && party.length && R() < SET_DROP.chance) rw.loot.push(makeSetDrop(s, pick(party).cls, dungeonInfo(dIdx).dropIlvl + 2));
  // v0.23 後勤終極「滿載而歸」：掛機勝利有機率多掉 1 件（沒點就不抽亂數）
  if (L.extraLoot && battle.win && s.idle === dIdx && R() < L.extraLoot) { rw.loot.push(rewards(dIdx, true, false, party.map(h => h.cls)).loot[0]); rw.extra = 1; }
  const dest = rw.loot.map(it => (it.set ? addSetLoot(s, it) : addLoot(s, it)));
  const kept = rw.loot.filter((_, i) => dest[i] === 'bag'), stashed = rw.loot.filter((_, i) => dest[i] === 'stash');
  return { ...rw, first, lvUps, kept, stashed, salvaged: dest.filter(d => d === 'salvaged').length };
}
// 任務／簽到等獎勵給裝備：套裝走套裝規則，其餘走一般掉落規則
export const grantItem = (s, it) => (it.set ? addSetLoot(s, it) : addLoot(s, it));
// 套裝部件不會被自動分解：背包滿就進戰利品箱
export function addSetLoot(s, it) {
  codexAdd(s, it);
  s.items[it.id] = it;
  if (s.bag.length < bagMax(s)) { s.bag.push(it.id); return 'bag'; }
  if (s.stash.length < ECONOMY.stashMax) { s.stash.push(it.id); return 'stash'; }
  delete s.items[it.id]; s.gold += salvageValue(it); s.dust = (s.dust || 0) + salvDust(s, it); return 'salvaged';
}

// ---------- 傳奇秘境 ----------
export const mythicUnlocked = s => !!s.clears[MYTHIC.unlockAfter];
// 精煉（+6 以上）在通關第 7 層後開放
export const maxUpFor = s => mythicUnlocked(s) ? GEAR.maxUp : GEAR.refineFrom;
export function applyMythicResult(s, battle) {
  const M = battle.mythic, kc = keyChange(M.level, battle, M.timer);
  const rw = mythicRewards(M.level, kc.inTime, M.dIdx, partyHeroes(s).map(h => h.cls)), L = LM(s);
  if (L.gold) rw.gold = Math.round(rw.gold * (1 + L.gold)); if (L.xp) rw.xp = Math.round(rw.xp * (1 + L.xp));
  // 深淵秘境限時通關：和第二章主線一樣有機會掉職業套裝
  const party = partyHeroes(s);
  if (kc.inTime && mythicTier(M.dIdx) === 2 && party.length && R() < SET_DROP.chance)
    rw.loot.push(makeSetDrop(s, pick(party).cls, rw.loot[0].ilvl));
  s.stats.runs++; if (battle.win) s.stats.wins++;
  s.mythic.runs++; if (kc.inTime) s.mythic.timed++; if (kc.delta === 2) s.stats.fast = (s.stats.fast || 0) + 1;
  s.gold += rw.gold;
  const lvUps = [];
  for (const h of partyHeroes(s)) if (gainXp(h, rw.xp)) lvUps.push({ name: h.name, level: h.level, para: h.para || 0 });
  const prevKey = keyOf(s, M.dIdx); setKey(s, M.dIdx, kc.next);
  const best = s.mythic.best[M.dIdx], record = kc.inTime && (!best || M.level > best.level || (M.level === best.level && battle.tick < best.time));
  if (record) s.mythic.best[M.dIdx] = { level: M.level, time: battle.tick };
  const dest = rw.loot.map(it => (it.set ? addSetLoot(s, it) : addLoot(s, it)));
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
  const rw = mythicRewards(M.level, true, M.dIdx, partyHeroes(s).map(h => h.cls)), m = win ? MYTHIC.idleMult : MYTHIC.idleMult * REWARD.loseMult;
  const L = LM(s);
  rw.gold = Math.round(rw.gold * m * (1 + (L.gold || 0))); rw.xp = Math.round(rw.xp * m * (1 + (L.xp || 0))); rw.loot = win ? rw.loot.slice(0, 2) : [];
  if (L.extraLoot && win && R() < L.extraLoot) { rw.loot.push(mythicRewards(M.level, true, M.dIdx, partyHeroes(s).map(h => h.cls)).loot[0]); rw.extra = 1; }
  // v0.21.2 深淵秘境掛機勝利也能掉職業套裝（機率比手動限時低），裝等跟著秘境掉落
  const party = partyHeroes(s);
  if (win && mythicTier(M.dIdx) === 2 && party.length && rw.loot.length && R() < SET_DROP.idle)
    rw.loot.push(makeSetDrop(s, pick(party).cls, rw.loot[0].ilvl));
  s.stats.runs++; if (win) s.stats.wins++;
  s.gold += rw.gold;
  const lvUps = [];
  for (const h of partyHeroes(s)) if (gainXp(h, rw.xp)) lvUps.push({ name: h.name, level: h.level, para: h.para || 0 });
  const dest = rw.loot.map(it => addLoot(s, it));
  const kept = rw.loot.filter((_, i) => dest[i] === 'bag'), stashed = rw.loot.filter((_, i) => dest[i] === 'stash');
  return { ...rw, mythic: true, mythicIdle: true, inTime: win, prevKey: keyOf(s, M.dIdx), nextKey: keyOf(s, M.dIdx), record: false, lvUps, kept, stashed,
    salvaged: dest.filter(d => d === 'salvaged').length, first: false, decayed: false };
}

// ---------- 背包與裝備 ----------
export function equip(s, heroId, itemId) {
  const h = s.heroes.find(x => x.id === heroId), it = s.items[itemId]; if (!h || !it) return false;
  if (!canEquip(h, it)) return false; // v0.19 職業限制
  const prev = h.gear[it.slot];
  for (const o of s.heroes) if (o.gear[it.slot] === itemId) o.gear[it.slot] = null; // 從別人身上拿過來
  s.bag = s.bag.filter(id => id !== itemId); s.stash = (s.stash || []).filter(id => id !== itemId);
  h.gear[it.slot] = itemId;
  if (prev && prev !== itemId) s.bag.push(prev);
  return true;
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
  const it = s.items[itemId]; if (!it || it.locked) return 0;
  s.bag = s.bag.filter(id => id !== itemId); s.stash = (s.stash || []).filter(id => id !== itemId); delete s.items[itemId];
  const v = salvageValue(it); s.gold += v; s.dust = (s.dust || 0) + salvDust(s, it); s.stats.salvaged = (s.stats.salvaged || 0) + 1; bump(s, 'salvage'); return v;
}
// v0.20.1 多選分解：只處理背包裡、沒鎖定的；dry=true 只試算（金幣、精華、是否含史詩以上或套裝）
export function salvageMany(s, ids, dry = false) {
  const list = [...new Set(ids)].filter(id => s.bag.includes(id) && s.items[id] && !s.items[id].locked);
  const r = { count: list.length, gold: 0, dust: 0, precious: list.some(id => s.items[id].rarity >= 3 || s.items[id].set) };
  for (const id of list) { r.dust += salvDust(s, s.items[id]); r.gold += dry ? salvageValue(s.items[id]) : salvage(s, id); }
  return r;
}
// 分解背包中品質 ≤ maxRarity 的裝備（0 = 普通，1 = 精良以下）
export function salvageUpTo(s, maxRarity) {
  const ids = s.bag.filter(i => s.items[i].rarity <= maxRarity && !s.items[i].set && !s.items[i].locked); // 套裝、鎖定不會被批次分解
  return { count: ids.length, gold: ids.reduce((g, i) => g + salvage(s, i), 0) };
}
// ---------- 推薦陣容 ----------
// 依副本機制（hints：pulse / buster / summon / enrage）從名冊挑 5 人：
// 坦克 1；有脈衝（全隊傷害）帶 2 補，否則 1 補；其餘輸出依機制偏好（召喚 → 法師、狂暴 → 盜賊）再比戰力
export function recommendParty(s, hints) {
  const has = t => hints.includes(t), pw = h => heroPower(h, s.items);
  const byRole = r => s.heroes.filter(h => roleOf(h) === r).sort((a, b) => pw(b) - pw(a));
  const pick = [...byRole('tank').slice(0, has('twin') ? 2 : 1), ...byRole('heal').slice(0, has('pulse') ? 2 : 1)]; // 雙首領帶 2 坦
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
  const ids = s.stash.filter(id => !s.items[id].locked); // 鎖定的留在戰利品箱
  const gold = ids.reduce((g, id) => { const v = salvageValue(s.items[id]); s.dust = (s.dust || 0) + salvDust(s, s.items[id]); delete s.items[id]; return g + v; }, 0);
  s.stash = s.stash.filter(id => !ids.includes(id)); s.gold += gold;
  return { count: ids.length, gold };
}
// ---------- v0.21 套裝：防重複掉落、T0.5 升級 ----------
export const makeSetDrop = (s, cls, ilvl) => makeSetItem(cls, setDropSlot(s, cls), ilvl);
// 能不能升 T0.5：回傳 { ok, why }（why：notset／done／key／dust）
export function setT5Check(s, id) {
  const it = s.items[id];
  if (!it || !it.set) return { ok: false, why: 'notset' };
  if (it.t5) return { ok: false, why: 'done' };
  if (mythicBestLevel(s, 1) < SET_T5.key) return { ok: false, why: 'key' };
  if ((s.dust || 0) < SET_T5.dust) return { ok: false, why: 'dust' };
  return { ok: true };
}
// 升級：保留裝等、強化等級；名稱不變（顯示 T0.5 標籤），稀有度變傳說
export function upgradeSetT5(s, id) {
  if (!setT5Check(s, id).ok) return false;
  const it = s.items[id];
  s.dust -= SET_T5.dust; it.t5 = 1; it.rarity = SET_T5.rarity; codexAdd(s, it); bump(s, 'upgrade');
  return true;
}
// 已投入的 T0.5 精華（分解時照精煉的比例退）
export const t5Spent = it => (it && it.t5 ? SET_T5.dust : 0);
// ---------- v0.16 圖鑑 ----------
export function codexAdd(s, it) { const k = codexKey(it); if (k && s.codex && !s.codex[k]) s.codex[k] = 1; }
export function setCodexStats(s) {
  const all = setCodexKeys(), got = all.filter(k => s.codex && s.codex[k]).length;
  return { got, total: all.length };
}
export function codexStats(s) {
  const all = codexAllKeys(), got = all.filter(k => s.codex && s.codex[k]).length;
  return { got, total: all.length, pct: Math.floor((got / all.length) * 100) };
}
// 領取里程碑獎勵：達到收集率且還沒領過
export function claimCodex(s, pct) {
  const r = CODEX_REWARDS.find(x => x.pct === pct); if (!r || s.codexClaimed.includes(pct) || codexStats(s).pct < pct) return null;
  s.codexClaimed.push(pct); s.gold += r.gold; s.dust = (s.dust || 0) + r.dust; return r;
}
// v0.15 秘境推薦副本：該階層裡最佳限時等級最低的（沒限時過的優先），同分取前面的
export function mythicSuggest(s, f0, f1) {
  let pick = f0, lv = Infinity;
  for (let i = f0; i <= f1; i++) { const b = s.mythic.best[i], l = b ? b.level : 0; if (l < lv) { lv = l; pick = i; } }
  return pick;
}
// v0.14 直接結算限制：首次挑戰的副本、該副本秘境還沒限時過的鑰石等級，要完整觀戰（寶庫、秘境掛機不受限）
export function skipAllowed(s, b) {
  if (!b || b.vault || b.mythicIdle) return true;
  if (b.mythic) { const best = s.mythic.best && s.mythic.best[b.dIdx]; return !!best && b.mythic.level <= best.level; }
  return !!s.clears[b.dIdx];
}
// v0.14 鎖定：鎖住的英雄不能解雇、鎖住的裝備不會被任何方式分解
export function toggleLock(s, kind, id) {
  const x = kind === 'hero' ? s.heroes.find(h => h.id === id) : s.items[id];
  if (!x) return null;
  x.locked = !x.locked; return x.locked;
}
export function upgrade(s, itemId) {
  const it = s.items[itemId]; if (!it || it.up >= maxUpFor(s)) return false;
  const c = upgradeCost(it), d = dustCost(it); if (s.gold < c || (s.dust || 0) < d) return false;
  s.gold -= c; s.dust = (s.dust || 0) - d; it.up++; bump(s, 'upgrade'); return true;
}
// v0.18.1 一次強化多級（例如 +5）：剩不到 n 級就強化到上限；金幣或精華不夠就整批不做（dry 只試算）
export function upgradeMany(s, itemId, n, dry = false) {
  const it = s.items[itemId]; if (!it) return null;
  const steps = Math.min(n, maxUpFor(s) - it.up); if (steps <= 0) return { steps: 0, gold: 0, dust: 0, ok: false };
  let gold = 0, dust = 0;
  for (let k = 0; k < steps; k++) { const t = { ...it, up: it.up + k }; gold += upgradeCost(t); dust += dustCost(t); }
  const ok = s.gold >= gold && (s.dust || 0) >= dust, r = { steps, gold, dust, ok, to: it.up + steps };
  if (dry || !ok) return r;
  s.gold -= gold; s.dust = (s.dust || 0) - dust; it.up += steps; bump(s, 'upgrade', steps);
  return r;
}
// 背包裡是否有比出戰隊員身上更好的裝備（下一步建議用）
export function hasUpgrade(s) {
  return partyHeroes(s).some(h => Object.keys(SLOTS).some(slot => {
    const cur = h.gear[slot] && s.items[h.gear[slot]];
    return s.bag.some(id => { const it = s.items[id]; return it.slot === slot && canEquip(h, it) && (!cur || heroItemScore(h, it) > heroItemScore(h, cur)); });
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
      for (const id of s.bag) { const it = s.items[id]; if (it.slot === slot && canEquip(h, it) && (!best || heroItemScore(h, it) > heroItemScore(h, best))) best = it; }
      if (best && (!cur || heroItemScore(h, best) > heroItemScore(h, cur))) { if (!dry) equip(s, h.id, best.id); changed++; }
    }
  }
  return changed;
}

// ---------- 掛機與離線收益 ----------
export function offlineProgress(s, now = Date.now()) {
  const myth = s.idleMythic != null && mythicIdleLevel(s, s.idleMythic);
  if (!myth && (s.idle == null || !s.clears[s.idle])) { s.lastSeen = now; return null; }
  const sec = Math.min(offlineCap(s) * 3600, Math.max(0, (now - s.lastSeen) / 1000));
  s.lastSeen = now;
  if (sec < 60 || !partyHeroes(s).length) return null;
  let t = 0, runs = 0, wins = 0, gold = 0, items = 0, stashed = 0, lv = 0;
  while (runs < 400) {
    const d = myth ? s.idleMythic : s.idle;
    const b = new Battle(partyHeroes(s), s.items, d, { ...(myth ? mythicBattleOpts(d, myth) : {}), autoHorn: true, leader: leaderModsOf(s, d), actives: 'auto', autoCmd: true }).runToEnd();
    t += b.tick + 5; if (t > sec) break;
    const r = myth ? applyMythicIdleResult(s, b) : applyResult(s, d, b);
    runs++; if (b.win) wins++; gold += r.gold; items += r.kept.length; stashed += r.stashed.length; lv += r.lvUps.length;
  }
  return { sec: Math.round(sec), runs, wins, gold, items, stashed, lv };
}

// ---------- 存檔安全（v0.10.1）----------
// 存檔裡的文字會被顯示在畫面上；匯入別人給的存檔碼時，先把可能變成 HTML 的字元拿掉，並限制長度與型別，避免藏惡意程式碼
const UNSAFE = /[<>"'`&\\]/g;
export function sanitizeSave(s, depth = 0) {
  if (depth > 12) return null;
  if (typeof s === 'string') return s.replace(UNSAFE, '').slice(0, 200);
  if (typeof s === 'number') return Number.isFinite(s) ? s : 0;
  if (typeof s === 'boolean' || s == null) return s;
  if (Array.isArray(s)) return s.slice(0, 5000).map(x => sanitizeSave(x, depth + 1));
  if (typeof s === 'object') {
    const o = {};
    for (const k of Object.keys(s)) { if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue; o[k.replace(UNSAFE, '')] = sanitizeSave(s[k], depth + 1); }
    return o;
  }
  return null; // 函式等其他型別直接丟掉
}
