// 第二章節奏：先照一般流程打到第 7 層，再從同一份存檔繼續推 VIII 以後（打不過就交替刷前一層）
//   node tools/sim-ch2.js [次數]
import * as G from '../src/core/index.js';
import { playthrough } from './sim-lib.js';
const n = +(process.argv[2] || 4), last = G.CHAPTERS[1].floors[1];
const agg = {};
for (let k = 0; k < n; k++) {
  const a = playthrough({ talents: true });
  const base = a.s.stats.runs;
  const b = playthrough({ talents: true, s: a.s, stopAt: last, maxRuns: 2000 });
  for (const [d, r] of Object.entries(b.first)) if (+d > G.CH1_TOP) (agg[d] = agg[d] || []).push(r);
  if (k === 0) console.log(b.log.filter(l => +l.match(/D(\d+)/)[1] > 7).join('\n'));
}
console.log('第 7 層之後的首通場次（平均）：' + Object.entries(agg).map(([d, v]) => `D${+d + 1}:${Math.round(v.reduce((x, y) => x + y) / v.length)}(${v.length}/${n})`).join(' '));
