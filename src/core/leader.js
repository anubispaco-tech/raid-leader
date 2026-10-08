// ===== v0.23 團長系統（原型）：團長等級＋三系天賦 =====
// 團長經驗：每場戰鬥 1 點（含掛機、離線、秘境、寶庫），首通 +20；舊存檔依 stats.runs 補發
// 每升一級得 1 點天賦點；需要經驗 = round(a × 等級^p)（累積），p 讓前期升得快、後期慢
import { tx } from './i18n.js';

export const LEADER = {
  xpRun: 1, xpFirst: 20,
  curve: { a: 1.99, p: 2.4 },   // 累積經驗：Lv10 ≈ 500、Lv14 ≈ 1,100（約打完第二章）、Lv20 ≈ 2,600、Lv30 ≈ 7,000
  maxLevel: 30,
  ultNeed: 8,                    // 同系投入 8 點才能點終極
  resetGold: lv => 500 * lv,     // 重置費用
  caps: { dmg: 0.08, hp: 0.08 }, // 全隊被動加成上限（不含號角）
};
export const leaderXpFor = lv => (lv <= 0 ? 0 : Math.round(LEADER.curve.a * Math.pow(lv, LEADER.curve.p)));
export function leaderLevel(xp) { let lv = 0; while (lv < LEADER.maxLevel && xp >= leaderXpFor(lv + 1)) lv++; return lv; }

// 節點：ranks＝可點幾次；每點效果寫在 per；ult＝終極（每系兩選一）
export const LEADER_TREE = {
  tactics: { name: tx('戰術'), nodes: [
    { id: 'hornDur', name: tx('長鳴'), ranks: 2, per: { hornDur: 2 }, desc: tx('號角持續 +{0} 秒') },
    { id: 'hornPow', name: tx('激昂'), ranks: 2, per: { hornBonus: 0.04 }, desc: tx('號角效果 +{0}%') },
    { id: 'kick', name: tx('果斷'), ranks: 1, per: { kickCd: 0.2 }, desc: tx('打斷冷卻 −{0}%') },
    { id: 'breaker', name: tx('攻堅'), ranks: 1, per: { shieldDmg: 0.15 }, desc: tx('對首領護盾傷害 +{0}%') },
    { id: 'bossDmg', name: tx('首領剋星'), ranks: 2, per: { bossDmg: 0.02 }, desc: tx('對首領傷害 +{0}%') },
    { id: 'scatter', name: tx('散開'), ranks: 1, per: {}, desc: tx('團長指令（v0.24 站位玩法開放）'), soon: true },
    { id: 'rally', name: tx('集結號角'), ult: 'tactics', ranks: 1, per: { rallyHeal: 0.15 }, desc: tx('吹號角時全隊回復 {0}% 生命') },
    { id: 'shatter', name: tx('破陣號角'), ult: 'tactics', ranks: 1, per: { hornBreak: 1 }, desc: tx('吹號角時打斷首領讀條、護盾 −50%') },
  ] },
  morale: { name: tx('士氣'), nodes: [
    { id: 'grit', name: tx('堅毅'), ranks: 3, per: { hp: 0.015 }, desc: tx('全隊生命 +{0}%') },
    { id: 'wall', name: tx('鐵壁'), ranks: 2, per: { tankTaken: 0.02 }, desc: tx('坦克受到傷害 −{0}%') },
    { id: 'mend', name: tx('鼓舞'), ranks: 2, per: { heal: 0.02 }, desc: tx('治療量 +{0}%') },
    { id: 'unity', name: tx('齊心'), ranks: 2, per: { dmg: 0.015 }, desc: tx('全隊傷害 +{0}%') },
    { id: 'hold', name: tx('不屈'), ranks: 1, per: { lastStand: 1 }, desc: tx('每場第一次致命傷保留 1 點生命') },
    { id: 'revive', name: tx('戰地救援'), ult: 'morale', ranks: 1, per: { revive: 0.3 }, desc: tx('每場一次，第一位陣亡隊員以 {0}% 生命復活') },
    { id: 'aegis', name: tx('堅守陣線'), ult: 'morale', ranks: 1, per: { lowTaken: 0.1 }, desc: tx('生命低於 30% 的隊員受到傷害 −{0}%') },
  ] },
  logistics: { name: tx('後勤'), nodes: [
    { id: 'gold', name: tx('戰利品'), ranks: 3, per: { gold: 0.05 }, desc: tx('金幣 +{0}%') },
    { id: 'xp', name: tx('歷練'), ranks: 2, per: { xp: 0.05 }, desc: tx('經驗 +{0}%') },
    { id: 'march', name: tx('長征'), ranks: 2, per: { offlineH: 1 }, desc: tx('離線收益上限 +{0} 小時') },
    { id: 'stamina', name: tx('補給'), ranks: 1, per: { stamina: 1 }, desc: tx('秘境體力上限 +{0}') },
    { id: 'dust', name: tx('精煉'), ranks: 2, per: { dust: 0.1 }, desc: tx('分解精華 +{0}%') },
    { id: 'haul', name: tx('滿載而歸'), ult: 'logistics', ranks: 1, per: { extraLoot: 0.15 }, desc: tx('掛機勝利 {0}% 多掉 1 件裝備') },
    { id: 'vaultx', name: tx('巢穴熟客'), ult: 'logistics', ranks: 1, per: { vaultRuns: 1 }, desc: tx('寶庫每天 +{0} 次') },
  ] },
};

// 分配（{ 節點 id: 點數 }）→ 合計效果
export function leaderMods(alloc = {}) {
  const m = {};
  for (const br of Object.values(LEADER_TREE)) for (const n of br.nodes) {
    const r = Math.min(n.ranks, alloc[n.id] || 0); if (!r || n.soon) continue;
    for (const [k, v] of Object.entries(n.per)) m[k] = (m[k] || 0) + v * r;
  }
  if (m.dmg) m.dmg = Math.min(m.dmg, LEADER.caps.dmg);
  if (m.hp) m.hp = Math.min(m.hp, LEADER.caps.hp);
  return m;
}
