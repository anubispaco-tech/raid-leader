// 難度探針：名冊 6 人（2 坦、補、盜、法、盜，普通稀有度），給定等級與裝等，用「一鍵備戰」排陣容，看各層勝率
//   node tools/probe.js [起始層 index] [結束層 index]
import * as G from '../src/core/index.js';
G.setSeed(11);
const [from = 6, to = G.DUNGEONS.length - 1] = process.argv.slice(2).map(Number);
const mk = (L, ilvl) => {
  const s = G.newGame(); s.heroes = []; s.items = {};
  for (const c of ['guardian', 'guardian', 'cleric', 'rogue', 'mage', 'rogue']) {
    const h = G.makeHero(c, L, 0);
    for (const sl of Object.keys(G.SLOTS)) { const it = G.makeItem(sl, ilvl, 2); it.up = 5; s.items[it.id] = it; h.gear[sl] = it.id; }
    s.heroes.push(h);
  }
  return s;
};
const floors = []; for (let d = from; d <= to; d++) floors.push(d);
console.log('等級/裝等 → ' + floors.map(d => G.ROMAN[d].padStart(5)).join(''));
const grid = [[20, 50], [25, 65], [30, 75], [35, 85], [40, 95], [45, 105], [50, 115], [55, 125], [60, 140]];
for (const [L, il] of grid) {
  const s = mk(L, il);
  const row = floors.map(d => {
    G.prepare(s, G.mechHints(d));
    let w = 0; for (let i = 0; i < 20; i++) if (new G.Battle(G.partyHeroes(s), s.items, d, { autoHorn: true }).runToEnd().win) w++;
    return String(w * 5).padStart(4) + '%';
  });
  console.log(`Lv${L} 裝${il}`.padEnd(11) + row.join(''));
}
G.setSeed(null);
