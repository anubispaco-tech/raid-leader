// v0.21 T0.5 成本模擬：第二章通關後，每天「掛機 N 場最高層＋秘境 15 場＋每日任務」
// 量：每天精華收入（分解、重複套裝、每日）、套裝掉落、出戰職業湊齊 4 件的天數
//   node tools/sim-t05.js [樣本數=3] [天數=10] [每天掛機場數=300]
import * as G from '../src/core/index.js';
import { playthrough } from './sim-lib.js';
import { setSeed } from '../src/core/rng.js';

const [n = 3, days = 10, perDay = 300] = process.argv.slice(2).map(Number);
const last = G.CHAPTERS[1].floors[1];
const DAILY_DUST = G.DAILY.questDust * 3 + (30 + 60) / 7; // 三個任務＋簽到平均
const res = [];
for (let k = 0; k < n; k++) {
  setSeed(1000 + k);
  const a = playthrough({ talents: true });
  const { s } = playthrough({ talents: true, s: a.s, stopAt: last, maxRuns: 2500 });
  const party = () => G.partyHeroes(s);
  const seen = new Set(Object.keys(s.items).filter(id => s.items[id].set));
  const have = {}; // 職業 → Set(部位)
  const note = it => { (have[it.set] = have[it.set] || new Set()).add(it.slot); };
  Object.values(s.items).filter(it => it.set).forEach(note);
  const daysTo4 = {}, perDayStats = [];
  for (let day = 1; day <= days; day++) {
    let dSalv = 0, dDupe = 0, sets = 0;
    const top = Math.max(...Object.keys(s.clears).map(Number).filter(d => s.clears[d]));
    for (let r = 0; r < perDay + 15; r++) {
      // 只用金幣強化到 +5（不花精華，才能量出純收入）
      for (const h of party()) for (const sl of Object.keys(G.SLOTS)) { const id = h.gear[sl]; const it = id && s.items[id]; if (it && G.dustCost(it) === 0 && it.up < G.GEAR.refineFrom && s.gold > 500) G.upgrade(s, id); }
      G.autoEquip(s);
      const d0 = s.dust;
      let b;
      if (r < perDay) { G.prepare(s, G.mechHints(top)); b = new G.Battle(party(), s.items, top, { autoHorn: true }).runToEnd(); G.applyResult(s, top, b); }
      else { const d = r % (G.CH1_TOP + 1); const o = G.mythicBattleOpts(d, s.mythic.key); b = new G.Battle(party(), s.items, d, { ...o, autoHorn: true }).runToEnd(); G.applyMythicResult(s, b); }
      dSalv += s.dust - d0;
      // 新套裝：記下；同職業同部位已有更好的 → 當成重複分解
      for (const id of Object.keys(s.items)) {
        const it = s.items[id]; if (!it.set || seen.has(id)) continue; seen.add(id); sets++;
        const dup = (have[it.set] && have[it.set].has(it.slot));
        note(it);
        if (dup && (s.bag.includes(id) || s.stash.includes(id))) { const v0 = s.dust; G.salvage(s, id); dDupe += s.dust - v0; }
      }
      for (const id of [...s.bag]) { const it = s.items[id]; if (s.bag.length > 20 && it && !it.set) { const v0 = s.dust; G.salvage(s, id); dSalv += s.dust - v0; } }
    }
    for (const c of new Set(party().map(h => h.cls))) if (daysTo4[c] === undefined && have[c] && have[c].size === 4) daysTo4[c] = day;
    perDayStats.push({ salv: dSalv, dupe: dDupe, daily: DAILY_DUST, sets });
  }
  const avg = f => perDayStats.reduce((x, d) => x + f(d), 0) / perDayStats.length;
  res.push({ classes: party().map(h => h.cls), daysTo4, dust: avg(d => d.salv + d.dupe + d.daily), salv: avg(d => d.salv), dupe: avg(d => d.dupe), daily: DAILY_DUST, sets: avg(d => d.sets), key: s.mythic.key, ilvl: party().map(h => G.heroIlvl(h, s.items)), top: Math.max(...Object.keys(s.clears).map(Number)) + 1 });
}
setSeed(null);
for (const r of res) console.log(JSON.stringify({ ...r, dust: Math.round(r.dust), salv: Math.round(r.salv), dupe: Math.round(r.dupe), daily: Math.round(r.daily), sets: +r.sets.toFixed(1) }));
const m = f => res.reduce((x, r) => x + f(r), 0) / res.length;
console.log(`\n平均每天：精華 ${Math.round(m(r => r.dust))}（分解 ${Math.round(m(r => r.salv))}＋重複套裝 ${Math.round(m(r => r.dupe))}＋每日 ${Math.round(m(r => r.daily))}）・套裝 ${m(r => r.sets).toFixed(1)} 件`);
const refineAll = 5 * 6 * [1, 2, 3, 4, 5].reduce((a, k) => a + k * G.GEAR.dustPerStep, 0);
console.log(`參考：全隊 5 人×6 件精煉到 +10 共需 ${refineAll} 精華`);
