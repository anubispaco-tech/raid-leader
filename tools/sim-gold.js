// 金幣收支模擬：node tools/sim-gold.js [次數] [秘境場數] [返還比例]
// 比較分解返還強化花費（GEAR.salvageRefund）對主線進度、秘境鑰石與持有金幣的影響
import * as G from '../src/core/index.js';
import { playthrough } from './sim-lib.js';
const [n = 4, runs = 300, refund = G.GEAR.salvageRefund] = process.argv.slice(2).map(Number);
G.GEAR.salvageRefund = refund;
const res = [];
for (let i = 0; i < n; i++) {
  const { s, first } = playthrough({ talents: true });
  const goldCh1 = s.gold; let earned = 0, spentUp = 0, refunded = 0;
  for (let r = 0; r < runs; r++) {
    for (const h of G.partyHeroes(s)) for (const sl of Object.keys(G.SLOTS)) { const id = h.gear[sl]; if (id && s.gold > 500) { const c = G.upgradeCost(s.items[id]); if (G.upgrade(s, id)) spentUp += c; } }
    G.autoEquip(s);
    for (const id of [...s.bag]) if (s.bag.length > 20) { const it = s.items[id]; refunded += Math.floor(G.upSpent(it) * refund); G.salvage(s, id); }
    const d = r % (G.CH1_TOP + 1), o = G.mythicBattleOpts(d, s.mythic.key, new Date(Date.UTC(2026, 9, 5) + Math.floor(r / 15) * 864e5));
    for (const h of G.partyHeroes(s)) G.applyRecommend(h, [...G.mechHints(d), ...G.affixHints(o.mythic.affixes)]);
    const g0 = s.gold; G.applyMythicResult(s, new G.Battle(G.partyHeroes(s), s.items, d, { ...o, autoHorn: true }).runToEnd()); earned += s.gold - g0;
  }
  res.push({ ch1: first[G.CH1_TOP], goldCh1, perRun: Math.round(earned / runs), spentUp, refunded, key: s.mythic.key, il: Math.round(G.partyIlvl(s)), gold: s.gold });
}
const avg = k => Math.round(res.reduce((a, r) => a + r[k], 0) / n);
console.log(`返還 ${refund}｜第 7 層首通 ${avg('ch1')} 場｜當下金幣 ${avg('goldCh1')}｜秘境每場收入 ${avg('perRun')}｜強化花費 ${avg('spentUp')}｜返還金幣 ${avg('refunded')}｜最終鑰石 +${avg('key')}｜裝等 ${avg('il')}｜持有金幣 ${avg('gold')}`);
