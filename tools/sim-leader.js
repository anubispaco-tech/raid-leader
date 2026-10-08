// v0.23 團長天賦模擬：比較不同配點對主線進度（第 VII、XIV 層首通場數）的影響
//   node tools/sim-leader.js [種子數=6]
import * as G from '../src/core/index.js';
import { playthrough } from './sim-lib.js';
import { setSeed } from '../src/core/rng.js';

const [seeds = 6] = process.argv.slice(2).map(Number);
const last = G.CHAPTERS[1].floors[1];
const order = { // 點的順序（點數不夠時由前往後點）
  morale: ['grit', 'grit', 'grit', 'unity', 'unity', 'mend', 'mend', 'wall', 'wall', 'hold', 'revive'],
  tactics: ['hornPow', 'hornPow', 'hornDur', 'hornDur', 'bossDmg', 'bossDmg', 'kick', 'breaker', 'rally'],
  logistics: ['xp', 'xp', 'gold', 'gold', 'gold', 'march', 'march', 'stamina', 'dust', 'dust', 'haul'],
};
// 玩家當下的團長經驗：場數＋首通加給
const xpOf = (s, run) => run + G.LEADER.xpFirst * Object.keys(s.clears).filter(k => s.clears[k]).length;
function allocFor(points, plan) {
  const a = {}; let p = points;
  const take = id => { if (p <= 0) return; a[id] = (a[id] || 0) + 1; p--; };
  // plan：依序輪流從各系清單拿點（模擬「平均分配」或「專精一系」）
  const qs = plan.map(k => [...order[k]]);
  while (p > 0 && qs.some(q => q.length)) for (const q of qs) if (q.length) take(q.shift());
  return a;
}
const scen = {
  '不點（目前）': null,
  '戰鬥兩系平均': (s, run) => G.leaderMods(allocFor(G.leaderLevel(xpOf(s, run)), ['morale', 'tactics'])),
  '三系平均': (s, run) => G.leaderMods(allocFor(G.leaderLevel(xpOf(s, run)), ['morale', 'tactics', 'logistics'])),
  '戰鬥兩系全滿（上限）': () => G.leaderMods(allocFor(99, ['morale', 'tactics'])),
};
const rows = [];
for (const [name, leader] of Object.entries(scen)) {
  const d7 = [], d14 = [], lv7 = [], lv14 = [];
  for (let k = 0; k < seeds; k++) {
    setSeed(9100 + k);
    const a = playthrough({ talents: true, horn: true, leader, maxRuns: 3000 });
    const b = playthrough({ talents: true, horn: true, leader: leader && ((s, run) => leader(s, run + a.first[G.CH1_TOP])), s: a.s, stopAt: last, maxRuns: 4000 });
    d7.push(a.first[G.CH1_TOP] ?? 3000); d14.push((a.first[G.CH1_TOP] ?? 3000) + (b.first[last] ?? 4000));
    lv7.push(G.leaderLevel(xpOf(a.s, a.first[G.CH1_TOP] ?? 3000)));
    lv14.push(G.leaderLevel(xpOf(b.s, d14.at(-1))));
  }
  const avg = a => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
  rows.push({ name, d7: avg(d7), d14: avg(d14), lv7: avg(lv7), lv14: avg(lv14) });
}
const base = rows[0];
console.log('配點\t第 VII 層首通\t第 XIV 層首通（累計）\t當時團長等級（VII／XIV）');
for (const r of rows) console.log(`${r.name}\t${r.d7}（${Math.round(100 * (r.d7 / base.d7 - 1))}%）\t${r.d14}（${Math.round(100 * (r.d14 / base.d14 - 1))}%）\tLv${r.lv7}／Lv${r.lv14}`);
const m = G.leaderMods(allocFor(99, ['morale', 'tactics']));
console.log('全滿的戰鬥效果：', JSON.stringify(m));
console.log('等級曲線：', [1, 2, 3, 5, 10, 15, 20, 25, 30].map(l => `Lv${l}=${G.leaderXpFor(l)}`).join(' '));
