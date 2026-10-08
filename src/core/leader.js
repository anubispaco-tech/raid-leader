// ===== 團長系統：團長等級＋天賦樹（v0.23 起；v0.24 改成「一格一點、連著樹枝往上長」的樹）=====
// 團長經驗不另外存：挑戰總場數（stats.runs，含掛機、離線、秘境、寶庫）＋首通層數 × xpFirst → 舊存檔一上線就補齊
// 每升一級得 1 點；上限＝基本 30 級＋每打通一個大陸區域 +5（地區戰法用，見 LEADER_TREE 的 region）
// v0.24：每格只能點一次（1 點）；pre＝前置（任一格亮著就能點）；fork＝同組只能點一格；t:'a'＝團長指令（戰鬥中按，每場一次）
import { tx } from './i18n.js';

export const LEADER = {
  xpFirst: 20,
  curve: { a: 1.99, p: 2.4 },   // 累積經驗 = a × 等級^p：Lv10 ≈ 500、Lv14 ≈ 1,100（約打完第二章）、Lv20 ≈ 2,600、Lv30 ≈ 7,000
  baseMax: 30, perRegion: 5,
  resetGold: 500,                // 重置費用 = 500 × 團長等級
  maxCmds: 2,                    // 戰鬥中最多帶幾個團長指令（號角另外固定）
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

// 團長指令（戰鬥中按，每場一次；掛機自動）。效果在 battle.js 的 useCommand
export const COMMANDS = {
  rally:   { name: tx('集結號令'), icon: 'rally-the-troops', desc: tx('全隊立即回復 15% 生命') },
  shatter: { name: tx('破陣號令'), icon: 'shield-disabled', desc: tx('打斷所有讀條、首領護盾減半') },
  assault: { name: tx('總攻號令'), icon: 'charging-bull', desc: tx('10 秒內全隊傷害 +15%') },
  inspire: { name: tx('激勵號令'), icon: 'sun', desc: tx('全隊立即回復 20% 生命') },
  bulwark: { name: tx('堅守號令'), icon: 'shield-reflect', desc: tx('6 秒內全隊受到傷害 −30%') },
  scatter: { name: tx('散開'), icon: 'divert', desc: tx('首領讀條預警時讓隊員散開，躲開範圍攻擊') },
  gather:  { name: tx('集中'), icon: 'convergence-target', desc: tx('讓隊員靠攏，分攤傷害、吃到範圍治療') },
};

// 天賦樹：c 欄（0–4，畫面左到右）、r 列（0 樹根，往上長）；per 效果；cmd 學會的指令；soon 之後才開放
export const LEADER_TREE = {
  tactics: { name: tx('戰術'), region: 'global', nodes: [
    { id: 't0', c: 2, r: 0, n: tx('號角手'), icon: 'hunting-horn', per: { hornDur: 2 }, desc: tx('英勇號角持續 +2 秒') },
    { id: 't1', c: 1.1, r: 1, n: tx('激昂'), icon: 'shouting', per: { hornBonus: 0.04 }, desc: tx('英勇號角效果 +4%'), pre: ['t0'] },
    { id: 't2', c: 2.9, r: 1, n: tx('果斷'), icon: 'interdiction', per: { kickCd: 0.2 }, desc: tx('打斷冷卻 −20%'), pre: ['t0'] },
    { id: 't3', c: 0.35, r: 2, n: tx('長鳴'), icon: 'sonic-shout', per: { hornDur: 2 }, desc: tx('英勇號角再 +2 秒'), pre: ['t1'] },
    { id: 't4', c: 2, r: 2.05, n: tx('首領剋星'), icon: 'crossed-swords', per: { bossDmg: 0.02 }, desc: tx('對首領傷害 +2%'), pre: ['t1', 't2'] },
    { id: 't5', c: 3.65, r: 2, n: tx('攻堅'), icon: 'shield-bash', per: { shieldDmg: 0.15 }, desc: tx('打首領護盾時傷害 +15%'), pre: ['t2'] },
    { id: 't6', c: 0.15, r: 3.1, n: tx('集結號令'), icon: 'rally-the-troops', cmd: 'rally', desc: tx('團長指令：全隊立即回復 15% 生命（每場一次）'), pre: ['t3'] },
    { id: 't7', c: 2, r: 3.1, n: tx('首領剋星 II'), icon: 'dragon-head', per: { bossDmg: 0.02 }, desc: tx('對首領傷害再 +2%'), pre: ['t4'] },
    { id: 't8', c: 3.85, r: 3.1, n: tx('破陣號令'), icon: 'shield-disabled', cmd: 'shatter', desc: tx('團長指令：打斷所有讀條、首領護盾減半（每場一次）'), pre: ['t5'] },
    { id: 't9', c: 0.75, r: 4.15, n: tx('餘音'), icon: 'echo-ripples', per: { cmdDur: 3 }, desc: tx('團長指令的持續時間 +3 秒'), pre: ['t6'] },
    { id: 't10', c: 2, r: 4.15, n: tx('總攻號令'), icon: 'charging-bull', cmd: 'assault', desc: tx('團長指令：10 秒內全隊傷害 +15%（每場一次）'), pre: ['t7'] },
    { id: 't11', c: 3.25, r: 4.15, n: tx('震懾'), icon: 'stun-grenade', per: { shatterVuln: 0.1 }, desc: tx('破陣號令後 5 秒內首領受到傷害 +10%'), pre: ['t8'] },
    { id: 't12', c: 1.35, r: 5.2, n: tx('散開'), icon: 'divert', cmd: 'scatter', desc: tx('團長指令：首領讀條預警時讓隊員散開（站位玩法開放後啟用）'), pre: ['t10'], soon: true },
    { id: 't13', c: 2.65, r: 5.2, n: tx('集中'), icon: 'convergence-target', cmd: 'gather', desc: tx('團長指令：讓隊員靠攏分攤傷害（站位玩法開放後啟用）'), pre: ['t10'], soon: true },
  ] },
  morale: { name: tx('士氣'), region: 'global', nodes: [
    { id: 'm0', c: 2, r: 0, n: tx('堅毅'), icon: 'muscle-up', per: { hp: 0.015 }, desc: tx('全隊生命 +1.5%') },
    { id: 'm1', c: 1.1, r: 1, n: tx('鼓舞'), icon: 'heart-plus', per: { heal: 0.02 }, desc: tx('治療量 +2%'), pre: ['m0'] },
    { id: 'm2', c: 2.9, r: 1, n: tx('鐵壁'), icon: 'stone-wall', per: { tankTaken: 0.02 }, desc: tx('坦克受到傷害 −2%'), pre: ['m0'] },
    { id: 'm3', c: 0.35, r: 2, n: tx('鼓舞 II'), icon: 'healing', per: { heal: 0.02 }, desc: tx('治療量再 +2%'), pre: ['m1'] },
    { id: 'm4', c: 2, r: 2.05, n: tx('齊心'), icon: 'team-upgrade', per: { dmg: 0.015 }, desc: tx('全隊傷害 +1.5%'), pre: ['m1', 'm2'] },
    { id: 'm5', c: 3.65, r: 2, n: tx('鐵壁 II'), icon: 'castle', per: { tankTaken: 0.02 }, desc: tx('坦克受到傷害再 −2%'), pre: ['m2'] },
    { id: 'm6', c: 0.15, r: 3.1, n: tx('激勵號令'), icon: 'sun', cmd: 'inspire', desc: tx('團長指令：全隊立即回復 20% 生命（每場一次）'), pre: ['m3'] },
    { id: 'm7', c: 2, r: 3.1, n: tx('堅毅 II'), icon: 'heart-bottle', per: { hp: 0.015 }, desc: tx('全隊生命再 +1.5%'), pre: ['m4'] },
    { id: 'm8', c: 3.85, r: 3.1, n: tx('堅守號令'), icon: 'shield-reflect', cmd: 'bulwark', desc: tx('團長指令：6 秒內全隊受到傷害 −30%（每場一次）'), pre: ['m5'] },
    { id: 'm9', c: 2, r: 4.15, n: tx('不屈'), icon: 'broken-shield', per: { lastStand: 1 }, desc: tx('每場第一次致命傷保留 1 點生命'), pre: ['m7'] },
    { id: 'm10', c: 1.2, r: 5.2, n: tx('戰地救援'), icon: 'angel-wings', per: { revive: 0.3 }, desc: tx('每場一次，第一位陣亡隊員以 30% 生命復活'), pre: ['m9'], fork: 'mf' },
    { id: 'm11', c: 2.8, r: 5.2, n: tx('堅守陣線'), icon: 'barbed-wire', per: { lowTaken: 0.1 }, desc: tx('生命低於 30% 的隊員受到傷害 −10%'), pre: ['m9'], fork: 'mf' },
  ] },
  logistics: { name: tx('後勤'), region: 'global', nodes: [
    { id: 'l0', c: 2, r: 0, n: tx('戰利品'), icon: 'coins', per: { gold: 0.05 }, desc: tx('金幣 +5%') },
    { id: 'l1', c: 1.1, r: 1, n: tx('歷練'), icon: 'open-book', per: { xp: 0.05 }, desc: tx('英雄經驗 +5%'), pre: ['l0'] },
    { id: 'l2', c: 2.9, r: 1, n: tx('精煉'), icon: 'crystal-shine', per: { dust: 0.1 }, desc: tx('分解得到的精華 +10%'), pre: ['l0'] },
    { id: 'l3', c: 0.35, r: 2, n: tx('歷練 II'), icon: 'bookmarklet', per: { xp: 0.05 }, desc: tx('英雄經驗再 +5%'), pre: ['l1'] },
    { id: 'l4', c: 2, r: 2.05, n: tx('戰利品 II'), icon: 'two-coins', per: { gold: 0.05 }, desc: tx('金幣再 +5%'), pre: ['l1', 'l2'] },
    { id: 'l5', c: 3.65, r: 2, n: tx('精煉 II'), icon: 'crystal-growth', per: { dust: 0.1 }, desc: tx('分解得到的精華再 +10%'), pre: ['l2'] },
    { id: 'l6', c: 0.2, r: 3.1, n: tx('長征'), icon: 'walking-boot', per: { offlineH: 1 }, desc: tx('離線收益上限 +1 小時'), pre: ['l3'] },
    { id: 'l9', c: 2, r: 3.6, n: tx('戰利品 III'), icon: 'chest', per: { gold: 0.05 }, desc: tx('金幣再 +5%'), pre: ['l4'] },
    { id: 'l7', c: 3.8, r: 3.1, n: tx('補給'), icon: 'meal', per: { stamina: 1 }, desc: tx('秘境體力上限 +1'), pre: ['l5'] },
    { id: 'l8', c: 0.65, r: 4.15, n: tx('長征 II'), icon: 'mountain-road', per: { offlineH: 1 }, desc: tx('離線收益上限再 +1 小時'), pre: ['l6'] },
    { id: 'l10', c: 3.35, r: 4.15, n: tx('補給 II'), icon: 'hourglass', per: { staRegen: 0.1 }, desc: tx('秘境體力回復速度 +10%'), pre: ['l7'] },
    { id: 'l11', c: 1.2, r: 5.2, n: tx('滿載而歸'), icon: 'wheelbarrow', per: { extraLoot: 0.15 }, desc: tx('掛機勝利時 15% 多掉 1 件裝備'), pre: ['l8', 'l9'], fork: 'lf' },
    { id: 'l12', c: 2.8, r: 5.2, n: tx('巢穴熟客'), icon: 'goblin-head', per: { vaultRuns: 1 }, desc: tx('寶庫每天 +1 次'), pre: ['l10', 'l9'], fork: 'lf' },
  ] },
};
export const NODE = {}; for (const [b, br] of Object.entries(LEADER_TREE)) for (const n of br.nodes) NODE[n.id] = { ...n, branch: b };
export const nodeText = n => n.desc;

export const leaderAlloc = s => (s.leader && s.leader.alloc) || {};
const on = (a, id) => !!a[id];
export const spentPts = a => Object.keys(a).filter(id => NODE[id] && a[id]).length;
export const leaderPoints = s => Math.max(0, leaderLevel(s) - spentPts(leaderAlloc(s)));
export const branchPts = (a, b) => LEADER_TREE[b].nodes.filter(n => on(a, n.id)).length;
export const branchOpen = (s, b) => { const r = LEADER_TREE[b].region; return r === 'global' || regionsCleared(s).includes(r); };
const preOk = (a, n) => !n.pre || n.pre.some(p => on(a, p));
const forkTaken = (a, n) => !!n.fork && Object.values(NODE).some(o => o.fork === n.fork && o.id !== n.id && on(a, o.id));
// 不能點的原因（空字串＝可以點）；level＝目前總點數
export function whyNot(a, id, level, s) {
  const n = NODE[id]; if (!n) return '?';
  if (on(a, id)) return 'on';
  if (n.soon) return 'soon';
  if (s && !branchOpen(s, n.branch)) return 'region';
  if (!preOk(a, n)) return 'pre';
  if (forkTaken(a, n)) return 'fork';
  if (spentPts(a) >= level) return 'points';
  return '';
}
export const canAdd = (a, id, level, s) => whyNot(a, id, level, s) === '';
// 拿掉一格：不能讓已經亮著的子節點失去全部前置
export function canRemove(a, id) {
  if (!on(a, id)) return false;
  const b = { ...a }; delete b[id];
  return !Object.values(NODE).some(n => on(b, n.id) && n.pre && n.pre.includes(id) && !preOk(b, n));
}
// 整份配點是否合法（存檔載入、確認配點時檢查）：回傳乾淨的配點或 false
export function validAlloc(a, level, s) {
  const clean = {};
  for (const [id, v] of Object.entries(a || {})) if (NODE[id] && !NODE[id].soon && v) clean[id] = 1;
  if (spentPts(clean) > level) return false;
  for (const id of Object.keys(clean)) {
    const n = NODE[id];
    if (!preOk(clean, n) || forkTaken(clean, n)) return false;
    if (s && !branchOpen(s, n.branch)) return false;
  }
  return clean;
}
// 確認配點：只能加點（減點要重置）；回傳是否成功
export function commitAlloc(s, a) {
  if (!s.leader) s.leader = { alloc: {} };
  const cur = leaderAlloc(s), v = validAlloc(a, leaderLevel(s), s);
  if (!v) return false;
  for (const id of Object.keys(cur)) if (!v[id]) return false;
  s.leader.alloc = v; s.leader.cmds = equippedCmds(s); return true;
}
export const resetCost = s => LEADER.resetGold * leaderLevel(s);
export function resetLeader(s) {
  const c = resetCost(s); if (!spentPts(leaderAlloc(s)) || s.gold < c) return false;
  s.gold -= c; s.leader.alloc = {}; s.leader.cmds = []; s.leader.resets = (s.leader.resets || 0) + 1; return true;
}
// 學會的指令（已點、且已開放）
export const learnedCmds = s => Object.keys(leaderAlloc(s)).filter(id => NODE[id] && NODE[id].cmd && !NODE[id].soon).map(id => NODE[id].cmd);
// 戰鬥中要帶的指令：玩家選的（最多 maxCmds 個、要學會）；沒選就自動帶最先學會的
export function equippedCmds(s) {
  const L = learnedCmds(s), pick = ((s.leader && s.leader.cmds) || []).filter(c => L.includes(c));
  for (const c of L) if (pick.length < LEADER.maxCmds && !pick.includes(c)) pick.push(c);
  return pick.slice(0, LEADER.maxCmds);
}
export function toggleCmd(s, c) {
  const L = learnedCmds(s); if (!L.includes(c)) return false;
  let cur = (s.leader.cmds || []).filter(x => L.includes(x));
  if (cur.includes(c)) cur = cur.filter(x => x !== c);
  else { if (cur.length >= LEADER.maxCmds) cur.shift(); cur.push(c); }
  s.leader.cmds = cur; s.leader.cmdsSet = 1; return true;
}

// 配點 → 合計效果；region 給了就只算全域＋該區的戰法
export function leaderMods(alloc = {}, region = null) {
  const m = {};
  for (const br of Object.values(LEADER_TREE)) {
    if (region && br.region !== 'global' && br.region !== region) continue;
    for (const n of br.nodes) {
      if (!on(alloc, n.id) || n.soon || !n.per) continue;
      for (const [k, v] of Object.entries(n.per)) m[k] = (m[k] || 0) + v;
    }
  }
  if (m.dmg) m.dmg = Math.min(m.dmg, LEADER.caps.dmg);
  if (m.hp) m.hp = Math.min(m.hp, LEADER.caps.hp);
  return m;
}
// 某場戰鬥要帶的效果（dIdx 決定地區）＋要帶的指令
export const leaderModsOf = (s, dIdx = 0) => ({ ...leaderMods(leaderAlloc(s), dungeonRegion(dIdx)), cmds: s.leader ? equippedCmds(s) : [] });
// 升級提示：回傳這次新到的等級（沒有就 0），並記下已看過
export function leaderLevelUp(s) {
  const lv = leaderLevel(s), L = s.leader || (s.leader = { alloc: {} });
  if (L.seen == null) { L.seen = lv; return 0; } // 第一次（舊存檔補發）不逐級提示
  if (lv > L.seen) { L.seen = lv; return lv; }
  return 0;
}
// v0.24 改版：v0.23 的配點（多格節點）全部免費退回，並記一個旗標讓畫面提示一次
export function migrateLeader(s) {
  if (!s.leader || typeof s.leader !== 'object') s.leader = { alloc: {} };
  const L = s.leader;
  if (!L.alloc || typeof L.alloc !== 'object') L.alloc = {};
  if (Object.keys(L.alloc).some(id => !NODE[id])) { L.alloc = {}; L.cmds = []; L.refunded = 1; }
  if (!Array.isArray(L.cmds)) L.cmds = [];
}
