// 秘境節奏模擬：node tools/sim-mythic.js [次數] [場數]
import { mythicRun } from './sim-lib.js';
const [n = 4, runs = 300] = process.argv.slice(2).map(Number);
const all = Array.from({ length: n }, () => mythicRun({ runs }));
const keys = [3, 5, 8, 10, 12, 15, 20];
console.log('達到鑰石等級所需秘境場數（每天 15 場）：');
for (const k of keys) { const v = all.map(r => r.keyAt[k]).filter(Boolean); console.log(`  +${String(k).padStart(2)}：${v.length ? Math.round(v.reduce((a, b) => a + b) / v.length) + ' 場' : '—'}（${v.length}/${n}）`); }
console.log(`最終鑰石：${all.map(r => '+' + r.final).join(' ')}｜限時率：${all.map(r => r.timedRate + '%').join(' ')}｜等級：${all[0].lv.join('/')}｜裝等：${all[0].il.join('/')}`);
