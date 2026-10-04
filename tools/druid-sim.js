// 德魯伊平衡：把隊伍裡的專職職業換成同等級、同裝備的德魯伊（對應專精），比較勝率與輸出／治療
//   node tools/druid-sim.js [每層場數]
import * as G from '../src/core/index.js';
import { playthrough } from './sim-lib.js';
const N = +(process.argv[2] || 30);
G.setSeed(4242);
const { s } = playthrough({ talents: true });
const party = G.partyHeroes(s);
const swap = (role, specKey, legend) => {
  const old = party.find(h => G.roleOf(h) === role);
  const d = G.makeHero('druid', old.level, legend ? 4 : old.rarity || 0);
  d.gear = { ...old.gear }; d.spec = specKey;
  return { p: party.map(h => (h === old ? d : h)), idx: party.indexOf(old) };
};
const run = (p, dIdx, idx, opts = {}) => {
  let w = 0, ticks = 0, val = 0;
  for (let i = 0; i < N; i++) {
    const hints = G.mechHints(dIdx);
    for (const h of p) G.applyRecommend(h, hints);
    const b = new G.Battle(p, s.items, dIdx, { autoHorn: true, ...opts }).runToEnd();
    if (b.win) w++; ticks += b.tick;
    const u = b.units[idx]; val += (u.role === 'heal' ? u.healDone : u.role === 'tank' ? u.taken : u.dmgDone) / b.tick / N;
  }
  return { win: Math.round(100 * w / N), t: Math.round(ticks / N), val };
};
const top = 6;
console.log(`隊伍 Lv${party[0].level}，每層 ${N} 場（第 ${top - 1}、${top} 層 + 秘境 +4）`);
for (const [role, sp] of [['tank', 'bear'], ['heal', 'resto'], ['dps', 'feral']]) {
  for (const legend of [false, true]) {
    const { p: p2, idx } = swap(role, sp, legend);
    const rows = [];
    for (const d of [top - 2, top - 1, top]) {
      const a = run(party, d, idx), b = run(p2, d, idx);
      rows.push(`D${d + 1} ${a.win}→${b.win}%  ${role === 'heal' ? 'HPS' : role === 'tank' ? '承傷/秒' : 'DPS'} ${Math.round(a.val)}→${Math.round(b.val)}（${Math.round(100 * b.val / a.val)}%）`);
    }
    console.log(`${sp}${legend ? '（傳說）' : ''}：` + rows.join('｜'));
  }
}
G.setSeed(null);
