// ===== v0.23 團長系統：團長等級＋天賦（三系全域＋之後各大陸的地區戰法）=====
// 團長經驗不另外存：挑戰總場數（stats.runs，含掛機、離線、秘境、寶庫）＋首通層數 × xpFirst → 舊存檔一上線就補齊
// 每升一級得 1 點；上限＝基本 30 級＋每打通一個大陸區域 +5（地區戰法用，見 LEADER_TREE 的 region）
import { tx } from './i18n.js';

export const LEADER = {
  xpFirst: 20,
  curve: { a: 1.99, p: 2.4 },   // 累積經驗 = a × 等級^p：Lv10 ≈ 500、Lv14 ≈ 1,100（約打完第二章）、Lv20 ≈ 2,600、Lv30 ≈ 7,000
  baseMax: 30, perRegion: 5,
  ultNeed: 8,                    // 同一系投入 8 點後才能點終極（兩個終極選一個）
  resetGold: 500,                // 重置費用 = 500 × 團長等級
  caps: { dmg: 0.08, hp: 0.08 }, // 全隊被動加成上限（不含號角）
};
// 地區：目前只有龍眠島；之後大陸各區打通最終首領後解鎖該區的戰法、團長上限 +5
export const REGIONS = { island: { name: tx('龍眠島') } };
export const dungeonRegion = () => 'island';
export const regionsCleared = () => []; // 之後依各區最終首領首通回傳 ['coast', …]

export const leaderXpFor = lv => (lv <= 0 ? 0 : Math.round(LEADER.curve.a * Math.pow(lv, LEADER.curve.p)));
export const leaderMax = s => LEADER.baseMax + LEADER.perRegion * regionsCleared(s).length;
export const leaderXp = s => ((s.stats && s.stats.runs) || 0) + LEADER.xpFirst * Object.keys(s.clears || {}).filter(k => s.clears[k]).length;
export function leaderLevel(s) {
  const xp = typeof s === 'number' ? s : leaderXp(s), max = typeof s === 'number' ? LEADER.baseMax : leaderMax(s);
  let lv = 0; while (lv < max && xp >= leaderXpFor(lv + 1)) lv++; return lv;
}

// 節點：ranks 可點幾格、per 每格效果、ult 終極（同系兩選一）、soon 之後才開放
// region：'global'＝到處有效；之後的地區戰法填區域代號，只在該區副本生效、該區打通才能點
export const LEADER_TREE = {
  tactics: { name: tx('戰術'), region: 'global', icon: 'horn', nodes: [
    { id: 'hornDur', name: tx('長鳴'), ranks: 2, per: { hornDur: 2 }, desc: tx('號角持續 +{0} 秒') },
    { id: 'hornPow', name: tx('激昂'), ranks: 2, per: { hornBonus: 0.04 }, desc: tx('號角效果 +{0}%') },
    { id: 'kick', name: tx('果斷'), ranks: 1, per: { kickCd: 0.2 }, desc: tx('打斷冷卻 −{0}%') },
    { id: 'breaker', name: tx('攻堅'), ranks: 1, per: { shieldDmg: 0.15 }, desc: tx('打首領護盾時傷害 +{0}%') },
    { id: 'bossDmg', name: tx('首領剋星'), ranks: 2, per: { bossDmg: 0.02 }, desc: tx('對首領傷害 +{0}%') },
    { id: 'scatter', name: tx('散開'), ranks: 1, per: {}, desc: tx('團長指令：讀條預警時讓隊員散開（站位玩法開放後啟用）'), soon: true },
    { id: 'rally', name: tx('集結號角'), ult: true, ranks: 1, per: { rallyHeal: 0.15 }, desc: tx('吹號角時全隊回復 {0}% 生命') },
    { id: 'shatter', name: tx('破陣號角'), ult: true, ranks: 1, per: { hornBreak: 1 }, desc: tx('吹號角時打斷首領讀條、護盾減半') },
  ] },
  morale: { name: tx('士氣'), region: 'global', icon: 'banner', nodes: [
    { id: 'grit', name: tx('堅毅'), ranks: 3, per: { hp: 0.015 }, desc: tx('全隊生命 +{0}%') },
    { id: 'wall', name: tx('鐵壁'), ranks: 2, per: { tankTaken: 0.02 }, desc: tx('坦克受到傷害 −{0}%') },
    { id: 'mend', name: tx('鼓舞'), ranks: 2, per: { heal: 0.02 }, desc: tx('治療量 +{0}%') },
    { id: 'unity', name: tx('齊心'), ranks: 2, per: { dmg: 0.015 }, desc: tx('全隊傷害 +{0}%') },
    { id: 'hold', name: tx('不屈'), ranks: 1, per: { lastStand: 1 }, desc: tx('每場第一次致命傷保留 1 點生命') },
    { id: 'revive', name: tx('戰地救援'), ult: true, ranks: 1, per: { revive: 0.3 }, desc: tx('每場一次，第一位陣亡隊員以 {0}% 生命復活') },
    { id: 'aegis', name: tx('堅守陣線'), ult: true, ranks: 1, per: { lowTaken: 0.1 }, desc: tx('生命低於 30% 的隊員受到傷害 −{0}%') },
  ] },
  logistics: { name: tx('後勤'), region: 'global', icon: 'chest', nodes: [
    { id: 'gold', name: tx('戰利品'), ranks: 3, per: { gold: 0.05 }, desc: tx('金幣 +{0}%') },
    { id: 'xp', name: tx('歷練'), ranks: 2, per: { xp: 0.05 }, desc: tx('英雄經驗 +{0}%') },
    { id: 'march', name: tx('長征'), ranks: 2, per: { offlineH: 1 }, desc: tx('離線收益上限 +{0} 小時') },
    { id: 'stamina', name: tx('補給'), ranks: 1, per: { stamina: 1 }, desc: tx('秘境體力上限 +{0}') },
    { id: 'dust', name: tx('精煉'), ranks: 2, per: { dust: 0.1 }, desc: tx('分解得到的精華 +{0}%') },
    { id: 'haul', name: tx('滿載而歸'), ult: true, ranks: 1, per: { extraLoot: 0.15 }, desc: tx('掛機勝利時 {0}% 多掉 1 件裝備') },
    { id: 'vaultx', name: tx('巢穴熟客'), ult: true, ranks: 1, per: { vaultRuns: 1 }, desc: tx('寶庫每天 +{0} 次') },
  ] },
};
const PCT = new Set(['hornBonus', 'kickCd', 'shieldDmg', 'bossDmg', 'rallyHeal', 'hp', 'tankTaken', 'heal', 'dmg', 'revive', 'lowTaken', 'gold', 'xp', 'dust', 'extraLoot']);
// 節點說明（點了 n 格的效果；n 省略＝滿格）
export function nodeText(n, r = n.ranks) {
  const [k, v] = Object.entries(n.per)[0] || [];
  if (k == null) return n.desc;
  const x = v * Math.max(1, r);
  return n.desc.replace('{0}', PCT.has(k) ? +(x * 100).toFixed(1) : x);
}
export const NODE = {}; for (const [b, br] of Object.entries(LEADER_TREE)) for (const n of br.nodes) NODE[n.id] = { ...n, branch: b };

export const leaderAlloc = s => (s.leader && s.leader.alloc) || {};
export const spentPts = a => Object.entries(a).reduce((t, [id, r]) => t + (NODE[id] ? r : 0), 0);
export const leaderPoints = s => Math.max(0, leaderLevel(s) - spentPts(leaderAlloc(s)));
export const branchPts = (a, b) => LEADER_TREE[b].nodes.filter(n => !n.ult).reduce((t, n) => t + (a[n.id] || 0), 0);
export const branchOpen = (s, b) => { const r = LEADER_TREE[b].region; return r === 'global' || regionsCleared(s).includes(r); };
// 能不能在 a 的基礎上再點一格 id（level＝可用總點數）
export function canAdd(a, id, level, s) {
  const n = NODE[id]; if (!n || n.soon) return false;
  if (s && !branchOpen(s, n.branch)) return false;
  if ((a[id] || 0) >= n.ranks || spentPts(a) >= level) return false;
  if (n.ult) {
    if (branchPts(a, n.branch) < LEADER.ultNeed) return false;
    if (LEADER_TREE[n.branch].nodes.some(o => o.ult && o.id !== id && a[o.id])) return false;
  }
  return true;
}
// 拿掉一格後，終極的前置條件還要成立
export function canRemove(a, id) {
  const n = NODE[id]; if (!n || !(a[id] > 0)) return false;
  if (n.ult) return true;
  const b = { ...a, [id]: a[id] - 1 };
  return !LEADER_TREE[n.branch].nodes.some(o => o.ult && b[o.id]) || branchPts(b, n.branch) >= LEADER.ultNeed;
}
// 整份配點是否合法（存檔載入、確認配點時檢查）
export function validAlloc(a, level, s) {
  const clean = {};
  for (const [id, r] of Object.entries(a || {})) if (NODE[id] && !NODE[id].soon && Number.isInteger(r) && r > 0) clean[id] = Math.min(r, NODE[id].ranks);
  if (spentPts(clean) > level) return false;
  for (const [b, br] of Object.entries(LEADER_TREE)) {
    const ults = br.nodes.filter(n => n.ult && clean[n.id]);
    if (ults.length > 1 || (ults.length && branchPts(clean, b) < LEADER.ultNeed)) return false;
    if (s && !branchOpen(s, b) && br.nodes.some(n => clean[n.id])) return false;
  }
  return clean;
}
// 確認配點：只能加點（減點要重置）；回傳是否成功
export function commitAlloc(s, a) {
  if (!s.leader) s.leader = { alloc: {} };
  const cur = leaderAlloc(s), v = validAlloc(a, leaderLevel(s), s);
  if (!v) return false;
  for (const [id, r] of Object.entries(cur)) if ((v[id] || 0) < r) return false;
  s.leader.alloc = v; return true;
}
export const resetCost = s => LEADER.resetGold * leaderLevel(s);
export function resetLeader(s) {
  const c = resetCost(s); if (!spentPts(leaderAlloc(s)) || s.gold < c) return false;
  s.gold -= c; s.leader.alloc = {}; s.leader.resets = (s.leader.resets || 0) + 1; return true;
}

// 配點 → 合計效果；region 給了就只算全域＋該區的戰法
export function leaderMods(alloc = {}, region = null) {
  const m = {};
  for (const br of Object.values(LEADER_TREE)) {
    if (region && br.region !== 'global' && br.region !== region) continue;
    for (const n of br.nodes) {
      const r = Math.min(n.ranks, alloc[n.id] || 0); if (!r || n.soon) continue;
      for (const [k, v] of Object.entries(n.per)) m[k] = (m[k] || 0) + v * r;
    }
  }
  if (m.dmg) m.dmg = Math.min(m.dmg, LEADER.caps.dmg);
  if (m.hp) m.hp = Math.min(m.hp, LEADER.caps.hp);
  return m;
}
// 某場戰鬥要帶的效果（dIdx 決定地區）
export const leaderModsOf = (s, dIdx = 0) => leaderMods(leaderAlloc(s), dungeonRegion(dIdx));
// 升級提示：回傳這次新到的等級（沒有就 0），並記下已看過
export function leaderLevelUp(s) {
  const lv = leaderLevel(s), L = s.leader || (s.leader = { alloc: {} });
  if (L.seen == null) { L.seen = lv; return 0; } // 第一次（舊存檔補發）不逐級提示
  if (lv > L.seen) { L.seen = lv; return lv; }
  return 0;
}
