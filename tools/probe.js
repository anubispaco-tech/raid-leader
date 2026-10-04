// 難度探針：固定隊伍（坦補盜法盜、普通稀有度），給定等級與裝等，看各層勝率
//   node tools/probe.js
import * as G from '../src/core/index.js';
G.setSeed(11);
const mkParty = (L, ilvl) => {
  const items = {}, party = ['guardian', 'cleric', 'rogue', 'mage', 'rogue'].map(c => {
    const h = G.makeHero(c, L, 0);
    for (const sl of Object.keys(G.SLOTS)) { const it = G.makeItem(sl, ilvl, 2); it.up = 5; items[it.id] = it; h.gear[sl] = it.id; }
    return h;
  });
  return { party, items };
};
const floors = [6, 7, 8, 9];
console.log('等級/裝等 → ' + floors.map(d => 'D' + (d + 1)).join('   '));
for (const [L, il] of [[20, 50], [25, 60], [25, 70], [30, 70], [30, 80], [35, 85], [35, 95], [40, 95], [40, 105], [45, 110]]) {
  const { party, items } = mkParty(L, il);
  const row = floors.map(d => {
    for (const h of party) G.applyRecommend(h, G.DUNGEONS[d].mech.map(m => m.t));
    let w = 0; for (let i = 0; i < 20; i++) if (new G.Battle(party, items, d, { autoHorn: true }).runToEnd().win) w++;
    return String(w * 5).padStart(3) + '%';
  });
  console.log(`Lv${L} 裝${il}  ` + row.join('  '));
}
G.setSeed(null);
