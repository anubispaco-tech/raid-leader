// ===== 遊戲狀態操作：獎勵、隊伍、背包、掛機 =====
// 所有函式都接收存檔物件 s 並直接修改它；畫面層只呼叫這裡，不自己改存檔。
import { CLASSES, HERO, SLOTS, DUNGEONS, REWARD, ECONOMY, GEAR } from './config.js';
import { R, rnd, rint, pick } from './rng.js';
import { makeItem, rollRarity, itemScore, salvageValue, upgradeCost } from './items.js';
import { makeHero, gainXp } from './heroes.js';
import { dungeonInfo } from './dungeons.js';
import { Battle } from './battle.js';

export const SAVE_VERSION = 2;
export const hireCost = h => ECONOMY.hireBase + ECONOMY.hirePerLevel * h.level;

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
  return L => Math.max(REWARD.decayFloor, Math.min(1, 1 - REWARD.decayPerLevel * (L - (rec + REWARD.decayGrace))));
}

// ---------- 存檔 ----------
export function newGame() {
  const s = { v: SAVE_VERSION, gold: ECONOMY.startGold, heroes: [], items: {}, bag: [], party: [], unlocked: 1, clears: {},
    tavern: [], idle: null, lastSeen: Date.now(), stats: { runs: 0, wins: 0 }, autoSalvageBelow: 0, keepRarity: ECONOMY.defaultKeepRarity, stash: [], created: Date.now() };
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
  s.v = SAVE_VERSION;
  return s;
}

// ---------- 隊伍與酒館 ----------
export const partyHeroes = s => s.party.map(id => s.heroes.find(h => h.id === id)).filter(Boolean);
const avgLevel = list => list.length ? list.reduce((a, h) => a + h.level, 0) / list.length : 1;

export function rollTavern(s) {
  const L = Math.max(1, Math.round(avgLevel(s.heroes)) - 1);
  s.tavern = Array.from({ length: 3 }, () => makeHero(pick(Object.keys(CLASSES)), Math.max(1, L + rint(-1, 0))));
}
export function hire(s, heroId) {
  const h = s.tavern.find(x => x.id === heroId), cost = h && hireCost(h);
  if (!h || s.gold < cost || s.heroes.length >= ECONOMY.rosterMax) return null;
  s.gold -= cost; s.heroes.push(h); s.tavern = s.tavern.filter(x => x.id !== heroId);
  if (s.party.length < ECONOMY.partyMax) s.party.push(h.id);
  if (!s.tavern.length) rollTavern(s);
  return h;
}
export function refreshTavern(s) {
  if (s.gold < ECONOMY.refreshCost) return false;
  s.gold -= ECONOMY.refreshCost; rollTavern(s); return true;
}
export function joinParty(s, id) { if (s.party.length < ECONOMY.partyMax && !s.party.includes(id)) s.party.push(id); }
export function benchHero(s, id) { s.party = s.party.filter(x => x !== id); }
export function fireHero(s, id) {
  const h = s.heroes.find(x => x.id === id); if (!h) return null;
  for (const sl in h.gear) if (h.gear[sl]) s.bag.push(h.gear[sl]);
  s.heroes = s.heroes.filter(x => x.id !== id); benchHero(s, id);
  return h;
}

// ---------- 戰鬥結算 ----------
// 新掉落的去向：自動分解 → 背包 → 戰利品箱（只收 keepRarity 以上）→ 分解成金幣
function addLoot(s, it) {
  if (it.rarity < s.autoSalvageBelow) { s.gold += salvageValue(it); return 'salvaged'; }
  if (s.bag.length < ECONOMY.bagMax) { s.items[it.id] = it; s.bag.push(it.id); return 'bag'; }
  if (it.rarity >= s.keepRarity && s.stash.length < ECONOMY.stashMax) { s.items[it.id] = it; s.stash.push(it.id); return 'stash'; }
  s.gold += salvageValue(it); return 'salvaged';
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
  for (const h of party) { if (gainXp(h, Math.round(baseXp * decay(h.level)))) lvUps.push({ name: h.name, level: h.level }); }
  if (battle.win) {
    s.stats.wins++;
    s.clears[dIdx] = (s.clears[dIdx] || 0) + 1;
    if (dIdx + 1 >= s.unlocked && dIdx + 1 < DUNGEONS.length) s.unlocked = dIdx + 2;
  }
  const dest = rw.loot.map(it => addLoot(s, it));
  const kept = rw.loot.filter((_, i) => dest[i] === 'bag'), stashed = rw.loot.filter((_, i) => dest[i] === 'stash');
  return { ...rw, first, lvUps, kept, stashed, salvaged: dest.filter(d => d === 'salvaged').length };
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
export function salvage(s, itemId) {
  const it = s.items[itemId]; if (!it) return 0;
  s.bag = s.bag.filter(id => id !== itemId); s.stash = (s.stash || []).filter(id => id !== itemId); delete s.items[itemId];
  const v = salvageValue(it); s.gold += v; return v;
}
// 分解背包中品質 ≤ maxRarity 的裝備（0 = 普通，1 = 精良以下）
export function salvageUpTo(s, maxRarity) {
  const ids = s.bag.filter(i => s.items[i].rarity <= maxRarity);
  return { count: ids.length, gold: ids.reduce((g, i) => g + salvage(s, i), 0) };
}
// ---------- 戰利品箱 ----------
export function takeFromStash(s) {
  const room = ECONOMY.bagMax - s.bag.length;
  const ids = [...s.stash].sort((a, b) => itemScore(s.items[b]) - itemScore(s.items[a])).slice(0, Math.max(0, room));
  s.stash = s.stash.filter(id => !ids.includes(id)); s.bag.push(...ids);
  return ids.length;
}
export function salvageStash(s) {
  const gold = s.stash.reduce((g, id) => { const v = salvageValue(s.items[id]); delete s.items[id]; return g + v; }, 0);
  const count = s.stash.length; s.stash = []; s.gold += gold;
  return { count, gold };
}
export function upgrade(s, itemId) {
  const it = s.items[itemId]; if (!it || it.up >= GEAR.maxUp) return false;
  const c = upgradeCost(it); if (s.gold < c) return false;
  s.gold -= c; it.up++; return true;
}
// 一鍵配裝：替出戰隊員從背包挑分數最高的
export function autoEquip(s) {
  let changed = 0;
  for (const h of partyHeroes(s)) {
    for (const slot of Object.keys(SLOTS)) {
      const cur = h.gear[slot] && s.items[h.gear[slot]];
      let best = null;
      for (const id of s.bag) { const it = s.items[id]; if (it.slot === slot && (!best || itemScore(it) > itemScore(best))) best = it; }
      if (best && (!cur || itemScore(best) > itemScore(cur))) { equip(s, h.id, best.id); changed++; }
    }
  }
  return changed;
}

// ---------- 掛機與離線收益 ----------
export function offlineProgress(s, now = Date.now()) {
  if (s.idle == null || !s.clears[s.idle]) { s.lastSeen = now; return null; }
  const sec = Math.min(ECONOMY.offlineCapHours * 3600, Math.max(0, (now - s.lastSeen) / 1000));
  s.lastSeen = now;
  if (sec < 60 || !partyHeroes(s).length) return null;
  let t = 0, runs = 0, wins = 0, gold = 0, items = 0, stashed = 0, lv = 0;
  while (runs < 400) {
    const b = new Battle(partyHeroes(s), s.items, s.idle).runToEnd();
    t += b.tick + 5; if (t > sec) break;
    const r = applyResult(s, s.idle, b);
    runs++; if (b.win) wins++; gold += r.gold; items += r.kept.length; stashed += r.stashed.length; lv += r.lvUps.length;
  }
  return { sec: Math.round(sec), runs, wins, gold, items, stashed, lv };
}
