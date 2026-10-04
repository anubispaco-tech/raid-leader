// 深淵秘境節奏：主線打完第 14 層後，輪流打第二章 7 個副本（每場前一鍵備戰＋詞綴）
//   node tools/sim-abyss.js [次數] [場數] [快取檔]
import fs from 'fs';
import * as G from '../src/core/index.js';
import { playthrough } from './sim-lib.js';
const [n = 2, runs = 300] = process.argv.slice(2, 4).map(Number), cache = process.argv[4];
const last = G.CHAPTERS[1].floors[1], start = new Date('2026-10-05T04:00:00Z');
function finished() {
  if (cache && fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, 'utf8'));
  const a = playthrough({ talents: true });
  const b = playthrough({ talents: true, s: a.s, stopAt: last, maxRuns: 3000 });
  if (cache) fs.writeFileSync(cache, JSON.stringify(b.s));
  return b.s;
}
const keys = [3, 5, 8, 10, 12, 15], agg = {}, ticks = {};
for (let k = 0; k < n; k++) {
  const s = finished(); G.migrate(s);
  const keyAt = {}; let timed = 0;
  for (let r = 0; r < runs; r++) {
    const date = new Date(start.getTime() + Math.floor(r / 15) * 864e5);
    for (const h of G.partyHeroes(s)) for (const sl of Object.keys(G.SLOTS)) { const id = h.gear[sl]; if (id && s.gold > 2000) G.upgrade(s, id); }
    for (const id of [...s.bag]) if (s.bag.length > 20) G.salvage(s, id);
    const d = G.CH1_TOP + 1 + (r % 7), lvl = s.mythic.key2;
    const o = G.mythicBattleOpts(d, lvl, date);
    G.prepare(s, [...G.mechHints(d), ...G.affixHints(o.mythic.affixes)]);
    const b = new G.Battle(G.partyHeroes(s), s.items, d, { ...o, autoHorn: true }).runToEnd();
    const res = G.applyMythicResult(s, b);
    if (res.inTime) timed++;
    if (r < 14) (ticks[d] = ticks[d] || []).push(b.win ? b.tick : 'X' + b.tick);
    for (let q = 2; q <= s.mythic.key2; q++) if (keyAt[q] === undefined) keyAt[q] = r + 1;
  }
  for (const q of keys) (agg[q] = agg[q] || []).push(keyAt[q]);
  const p = G.partyHeroes(s);
  console.log(`#${k} 最終 +${s.mythic.key2} 限時率 ${Math.round(100 * timed / runs)}% lv=${p.map(h => h.level).join('/')} ilvl=${p.map(h => G.heroIlvl(h, s.items)).join('/')}`);
}
console.log('前 14 場通關秒數：' + Object.entries(ticks).map(([d, v]) => `${G.ROMAN[d]}:${v.join(',')}`).join(' '));
console.log('達到深淵鑰石所需場數：' + keys.map(q => { const v = agg[q].filter(Boolean); return `+${q}:${v.length ? Math.round(v.reduce((a, b) => a + b) / v.length) : '—'}(${v.length}/${n})`; }).join(' '));
