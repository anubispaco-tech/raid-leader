// 回歸測試：固定種子跑一大批戰鬥，把每場結果做成指紋。重構前後指紋要一模一樣。
//   node tools/regress.js          → 和 tools/regress-baseline.json 比對
//   node tools/regress.js --save   → 存成新的基準
import fs from 'fs';
import crypto from 'crypto';
import * as G from '../src/core/index.js';
import { playthrough } from './sim-lib.js';

const out = [];
const rec = (tag, b) => out.push([tag, b.win, b.tick, b.units.map(u => [u.dmgDone, u.healDone, u.taken, u.hp].join(',')).join('|'), b.log.length]);

// 1) 正常流程：主線一輪（含招募、配裝、天賦）
G.setSeed(20261004);
const { s } = playthrough({ talents: true });
out.push(['playthrough', s.gold, s.heroes.map(h => `${h.cls}${h.level}${h.spec}`).join(','), s.stats.runs, s.stats.wins]);

// 2) 矩陣：4 位傳說＋1 盜賊，所有專精組合 × 兩套天賦 × 7 層，外加秘境與寶庫
G.setSeed(77);
const items = {};
const mk = (cls, rarity) => {
  const h = G.makeHero(cls, 40, rarity);
  for (const sl of Object.keys(G.SLOTS)) { const it = G.makeItem(sl, 70, 3); it.up = 5; items[it.id] = it; h.gear[sl] = it.id; }
  return h;
};
const party = [mk('guardian', 4), mk('cleric', 4), mk('rogue', 4), mk('mage', 4), mk('rogue', 2)];
const specs = { guardian: ['prot', 'ret'], cleric: ['disc', 'holy'], rogue: ['assa', 'combat'], mage: ['fire', 'frost'] };
for (let combo = 0; combo < 16; combo++) {
  party.slice(0, 4).forEach((h, i) => G.setSpec(h, specs[h.cls][(combo >> i) & 1]));
  G.setSpec(party[4], specs.rogue[combo & 1]);
  for (const pickT of ['a', 'b']) {
    for (const h of party) for (const lv of G.TALENT_ROWS) G.setTalent(h, lv, pickT);
    for (let d = 0; d <= G.CH1_TOP; d++) rec(`d${d}-c${combo}-${pickT}`, new G.Battle(party, items, d, { autoHorn: true }).runToEnd());
    const date = new Date(Date.UTC(2026, 9, 5 + combo));
    for (const lv of [6, 12]) rec(`m${combo}-${pickT}-${lv}`, new G.Battle(party, items, combo % 7, { ...G.mythicBattleOpts(combo % 7, lv, date), autoHorn: true }).runToEnd());
  }
}
rec('vault', new G.Battle(party, items, 3, G.vaultBattleOpts(3)).runToEnd());
// 3) 德魯伊（v0.8.3）：三種專精各頂替一個職責，傳說與一般各一次
for (const [slot, sp] of [[0, 'bear'], [1, 'resto'], [2, 'feral']]) for (const rar of [0, 4]) {
  const d = mk('druid', rar); G.setSpec(d, sp); for (const lv of G.TALENT_ROWS) G.setTalent(d, lv, 'a');
  const p2 = party.map((h, i) => (i === slot ? d : h));
  for (let dd = 0; dd <= G.CH1_TOP; dd++) rec(`druid-${sp}-${rar}-d${dd}`, new G.Battle(p2, items, dd, { autoHorn: true }).runToEnd());
}
// 5) T0 套裝（v0.9.2）：四職業穿滿 4 件
{
  const p5 = party.map(h => JSON.parse(JSON.stringify(h)));
  for (const h of p5.slice(0, 4)) for (const sl of G.ARMOR_SLOTS) { const it = G.makeSetItem(h.cls, sl, 90); items[it.id] = it; h.gear[sl] = it.id; }
  for (let dd = 4; dd <= G.CH1_TOP; dd++) rec(`set-d${dd}`, new G.Battle(p5, items, dd, { autoHorn: true }).runToEnd());
}
// 4) 第二章（v0.9.0）：詛咒、讀條、護盾、打斷、淨化
for (let combo = 0; combo < 4; combo++) {
  party.slice(0, 4).forEach((h, i) => G.setSpec(h, specs[h.cls][(combo >> (i % 2)) & 1]));
  for (let dd = G.CH1_TOP + 1; dd <= G.CH2_TOP; dd++) rec(`ch2-d${dd}-c${combo}`, new G.Battle(party, items, dd, { autoHorn: true }).runToEnd());
}
// 6) 第三章（v0.25）：潮汐、魅惑、登船（接在最後，前面的紀錄不受影響）
for (let combo = 0; combo < 2; combo++) {
  party.slice(0, 4).forEach((h, i) => G.setSpec(h, specs[h.cls][(combo >> (i % 2)) & 1]));
  for (let dd = G.CH2_TOP + 1; dd < G.DUNGEONS.length; dd++) rec(`ch3-d${dd}-c${combo}`, new G.Battle(party, items, dd, { autoHorn: true }).runToEnd());
}
G.setSeed(null);
if (process.argv.includes('--prefix')) { // 只比對舊基準的筆數（新增章節只接在後面時用）
  const base = JSON.parse(fs.readFileSync(new URL('./regress-baseline.json', import.meta.url), 'utf8'));
  const d = base.out.findIndex((r, i) => JSON.stringify(r) !== JSON.stringify(out[i]));
  console.log(d < 0 ? `✅ 舊基準 ${base.out.length} 筆完全一致（新增 ${out.length - base.out.length} 筆）` : `❌ 第 ${d} 筆不同`); process.exit(d < 0 ? 0 : 1);
}

const digest = crypto.createHash('sha256').update(JSON.stringify(out)).digest('hex').slice(0, 16);
const file = new URL('./regress-baseline.json', import.meta.url);
if (process.argv.includes('--save')) { fs.writeFileSync(file, JSON.stringify({ digest, out }, null, 0)); console.log('saved baseline', digest, out.length, 'records'); }
else {
  const base = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (base.digest === digest) { console.log('✅ 回歸一致', digest, out.length, 'records'); }
  else {
    if (process.argv.includes('--matrix')) { const d2 = out.findIndex((r, i) => i > 0 && JSON.stringify(r) !== JSON.stringify(base.out[i])); console.log(d2 < 0 ? '✅ 矩陣部分一致（只有主線流程不同）' : '❌ 矩陣第 ' + d2 + ' 筆不同'); }
    const diff = out.findIndex((r, i) => JSON.stringify(r) !== JSON.stringify(base.out[i]));
    console.log('❌ 不一致', digest, '≠', base.digest, '第一筆差異 #' + diff, JSON.stringify(base.out[diff]), '→', JSON.stringify(out[diff]));
    process.exit(1);
  }
}
