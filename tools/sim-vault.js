// v0.22 寶庫樓層模擬：量「剛通關某層的隊伍」在該層寶庫 60 秒的擊殺數（＝ VAULT.par）
// 做法：一路玩到每層首通的當下，先「寶庫備戰」，再在該層寶庫打 reps 場取中位數；用 seeds 個種子平均
//   node tools/sim-vault.js [種子數=3] [每層場數=15]
import * as G from '../src/core/index.js';
import { playthrough } from './sim-lib.js';
import { setSeed } from '../src/core/rng.js';

const [seeds = 3, reps = 15] = process.argv.slice(2).map(Number);
const last = G.CHAPTERS[1].floors[1];
const table = Array.from({ length: last + 1 }, () => []);
const med = a => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
for (let k = 0; k < seeds; k++) {
  setSeed(7000 + k);
  let s = G.newGame();
  for (let f = 0; f <= last; f++) {
    ({ s } = playthrough({ talents: true, s, stopAt: f, maxRuns: 3000 }));
    if (!s.clears[f]) { console.log(`種子 ${k}：第 ${f + 1} 層沒有通關，略過之後的樓層`); break; }
    const snap = JSON.parse(JSON.stringify(s)); // 備戰會改天賦與裝備，量完還原
    G.prepare(snap, ['summon']);
    const kills = [];
    for (let r = 0; r < reps; r++) kills.push(new G.Battle(G.partyHeroes(snap), snap.items, f, G.vaultBattleOpts(f, true)).runToEnd().kills || 0);
    table[f].push(med(kills));
  }
}
console.log('層\t各種子中位數\t平均（建議 par）\t目前 par');
const out = table.map((a, f) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null));
table.forEach((a, f) => console.log(`${f + 1}\t${a.join(',')}\t${out[f]}\t${G.VAULT.par[f] ?? '—'}`));
console.log('par = ' + JSON.stringify(out));
