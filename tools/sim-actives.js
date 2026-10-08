// v0.24 英雄主動技能＋團長指令模擬：比較主線首通場數與秘境鑰石
//   node tools/sim-actives.js [種子數=8]
import * as G from '../src/core/index.js';
import { playthrough, mythicRun } from './sim-lib.js';
import { setSeed } from '../src/core/rng.js';
const [seeds = 8] = process.argv.slice(2).map(Number);
const last = G.CHAPTERS[1].floors[1];
const xpOf = (s, run) => run + G.LEADER.xpFirst * Object.keys(s.clears).filter(k => s.clears[k]).length;
// 依當下團長等級照順序點（戰鬥兩系優先），並帶兩個指令
const ORDER = ['t0', 'm0', 't1', 'm1', 't2', 'm2', 't4', 'm4', 't3', 'm3', 't6', 'm7', 't7', 'm6', 't10', 'm5', 'm8', 't5', 't8', 'm9', 'm10', 't9', 't11', 'l0', 'l1', 'l2', 'l4', 'l3', 'l9', 'l5'];
function leaderAt(lv) {
  const a = {}; for (const id of ORDER) { if (G.spentPts(a) >= lv) break; if (G.canAdd(a, id, lv)) a[id] = 1; }
  const s = { leader: { alloc: a, cmds: [] }, stats: { runs: 0 }, clears: {} };
  return { ...G.leaderMods(a), cmds: G.equippedCmds(s) };
}
const scen = {
  '現況（v0.23 不點天賦、無主動技能）': {},
  '只加英雄主動技能（自動）': { actives: 'auto' },
  '只加團長天賦樹＋指令（依當下等級）': { leaderFn: true },
  '兩者都有': { actives: 'auto', leaderFn: true },
};
const avg = a => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
const rows = [];
for (const [name, o] of Object.entries(scen)) {
  const d7 = [], d14 = [], keys = [];
  for (let k = 0; k < seeds; k++) {
    setSeed(9100 + k);
    const lead = o.leaderFn ? (s, run) => leaderAt(G.leaderLevel(xpOf(s, run))) : null;
    const a = playthrough({ talents: true, horn: true, leader: lead, actives: o.actives || null, autoCmd: !!o.leaderFn, maxRuns: 3000 });
    const b = playthrough({ talents: true, horn: true, leader: lead && ((s, run) => lead(s, run + a.first[G.CH1_TOP])), actives: o.actives || null, autoCmd: !!o.leaderFn, s: a.s, stopAt: last, maxRuns: 4000 });
    d7.push(a.first[G.CH1_TOP] ?? 3000); d14.push((a.first[G.CH1_TOP] ?? 3000) + (b.first[last] ?? 4000));
    setSeed(500 + k);
    keys.push(mythicRun({ runs: 300, actives: o.actives || null, leader: o.leaderFn ? leaderAt(16) : null, autoCmd: !!o.leaderFn }).final);
  }
  rows.push({ name, d7: avg(d7), d14: avg(d14), key: (keys.reduce((x, y) => x + y, 0) / keys.length).toFixed(1) });
}
const b0 = rows[0];
console.log('情境\t第 VII 層首通\t第 XIV 層首通\t秘境 300 場後鑰石');
for (const r of rows) console.log(`${r.name}\t${r.d7}（${Math.round(100 * (r.d7 / b0.d7 - 1))}%）\t${r.d14}（${Math.round(100 * (r.d14 / b0.d14 - 1))}%）\t+${r.key}`);
