// 專精檢查：每層在「推薦配置勝率約 60~80%」的等級下，比較 推薦 / 相反專精 / 沒有天賦 的勝率
// 用法：node tools/specs.js
import * as G from '../src/core/index.js';
const COMP = ['guardian', 'cleric', 'rogue', 'mage', 'mage'];
const other = { prot: 'ret', ret: 'prot', disc: 'holy', holy: 'disc', assa: 'combat', combat: 'assa', fire: 'frost', frost: 'fire' };
function party(lv, ilvl, mode, mech) {
  const items = {};
  const heroes = COMP.map(c => {
    const h = G.makeHero(c, lv);
    for (const sl of Object.keys(G.SLOTS)) { const it = G.makeItem(sl, ilvl, 1); items[it.id] = it; h.gear[sl] = it.id; }
    if (mode !== 'none') { G.applyRecommend(h, mech); if (mode === 'wrong' && h.spec) h.spec = other[h.spec]; }
    return h;
  });
  return { heroes, items };
}
const wr = (d, lv, il, mode, n = 200) => {
  const mech = G.DUNGEONS[d].mech.map(m => m.t); let w = 0;
  for (let i = 0; i < n; i++) { const p = party(lv, il, mode, mech); if (new G.Battle(p.heroes, p.items, d).runToEnd().win) w++; }
  return Math.round(100 * w / n);
};
for (let d = 0; d < G.DUNGEONS.length; d++) {
  const il = d ? G.dungeonInfo(d - 1).dropIlvl : 0;
  let lv = 1; while (lv < 40 && wr(d, lv, il, 'right', 60) < 65) lv++;
  const right = wr(d, lv, il, 'right'), wrong = wr(d, lv, il, 'wrong'), none = wr(d, lv, il, 'none');
  console.log(`D${d + 1} ${G.DUNGEONS[d].tip.split('→')[1].trim().padEnd(10)} Lv${String(lv).padStart(2)} 裝${String(il).padStart(2)}｜推薦 ${right}%  相反專精 ${wrong}%  無天賦 ${none}%  差距 ${right - wrong}${lv >= 10 ? '' : '（未到 Lv10，無專精）'}`);
}
