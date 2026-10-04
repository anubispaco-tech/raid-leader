// 薩滿平衡：把隊伍裡的輸出（法師）或治療換成同等級、同裝備的薩滿，比較勝率、通關秒數、本人輸出／治療與全隊 DPS
//   node tools/shaman-sim.js [每層場數] [第二章存檔快取（sim-abyss 產生）]
import fs from 'fs';
import * as G from '../src/core/index.js';
import { playthrough } from './sim-lib.js';
const N = +(process.argv[2] || 30);
G.setSeed(4242);
const cache = process.argv[3], s = cache ? JSON.parse(fs.readFileSync(cache, 'utf8')) : playthrough({ talents: true }).s;
const party = G.partyHeroes(s);
const swap = (pred, specKey, legend) => {
  const old = party.find(pred);
  const d = G.makeHero('shaman', old.level, legend ? 4 : old.rarity || 0);
  d.gear = { ...old.gear }; d.spec = specKey;
  return { p: party.map(h => (h === old ? d : h)), idx: party.indexOf(old) };
};
const run = (p, dIdx, idx, opts = {}) => {
  let w = 0, ticks = 0, val = 0, team = 0;
  for (let i = 0; i < N; i++) {
    const hints = [...G.mechHints(dIdx), ...(opts.mythic ? G.affixHints(opts.mythic.affixes) : [])];
    for (const h of p) G.applyRecommend(h, hints);
    const b = new G.Battle(p, s.items, dIdx, { autoHorn: true, ...opts }).runToEnd();
    if (b.win && (!opts.mythic || b.tick <= opts.mythic.timer)) w++; ticks += b.tick;
    const u = b.units[idx]; val += (u.role === 'heal' ? u.healDone : u.dmgDone) / b.tick / N;
    team += b.units.reduce((a, x) => a + x.dmgDone, 0) / b.tick / N;
  }
  return { win: Math.round(100 * w / N), t: Math.round(ticks / N), val, team };
};
const top = cache ? 13 : 6, my = cache ? G.mythicBattleOpts(12, 4, new Date('2026-10-06T04:00:00Z')) : G.mythicBattleOpts(3, 2, new Date('2026-10-06T04:00:00Z'));
console.log(`隊伍 Lv${party[0].level}，每層 ${N} 場`);
for (const [label, pred, sp] of [['法師→元素', h => h.cls === 'mage', 'elemental'], ['牧師→恢復', h => h.cls === 'cleric', 'resto']]) {
  for (const legend of [false, true]) {
    const { p: p2, idx } = swap(pred, sp, legend);
    const rows = [];
    for (const [tag, d, o] of [[`D${top - 1}`, top - 2, {}], [`D${top}`, top - 1, {}], [`D${top + 1}`, top, {}], ['秘境', my.mythic.dIdx, my]]) {
      const a = run(party, d, idx, o), b = run(p2, d, idx, o);
      rows.push(`${tag} 勝${a.win}→${b.win}% ${a.t}→${b.t}s 本人${Math.round(100 * b.val / a.val)}% 全隊DPS${Math.round(100 * b.team / a.team)}%`);
    }
    console.log(`${label}${legend ? '（傳說）' : ''}：\n  ` + rows.join('\n  '));
  }
}
G.setSeed(null);
