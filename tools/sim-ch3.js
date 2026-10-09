// v0.25 第三章模擬：主動技能＋團長天賦樹＋指令全開，一路玩到第 XXI 層，印出每層首通場數
//   node tools/sim-ch3.js [種子數=6] [nokick]
//   nokick：拿掉所有打斷（量魅惑、讀條沒處理時的難度）
import * as G from '../src/core/index.js';
import { playthrough } from './sim-lib.js';
import { setSeed } from '../src/core/rng.js';

const [seeds = 6] = process.argv.slice(2).filter(a => /^\d+$/.test(a)).map(Number);
const NOKICK = process.argv.includes('nokick');
if (NOKICK) for (const p of Object.values(G.CLASSES)) p.kick = () => false;
const last = G.DUNGEONS.length - 1;
const xpOf = (s, run) => run + G.LEADER.xpFirst * Object.keys(s.clears).filter(k => s.clears[k]).length;
// 依當下團長等級照順序點（同 sim-actives.js），並帶兩個指令
const ORDER = ['t0', 'm0', 't1', 'm1', 't2', 'm2', 't4', 'm4', 't3', 'm3', 't6', 'm7', 't7', 'm6', 't10', 'm5', 'm8', 't5', 't8', 'm9', 'm10', 't9', 't11', 'l0', 'l1', 'l2', 'l4', 'l3', 'l9', 'l5'];
function leaderAt(lv) {
  const a = {}; for (const id of ORDER) { if (G.spentPts(a) >= lv) break; if (G.canAdd(a, id, lv)) a[id] = 1; }
  const s = { leader: { alloc: a, cmds: [] }, stats: { runs: 0 }, clears: {} };
  return { ...G.leaderMods(a), cmds: G.equippedCmds(s) };
}
const runs = [], meta = [];
for (let k = 0; k < seeds; k++) {
  setSeed(9100 + k);
  const lead = (s, run) => leaderAt(G.leaderLevel(xpOf(s, run)));
  const o = { talents: true, horn: true, actives: 'auto', autoCmd: true };
  const a = playthrough({ ...o, leader: lead, maxRuns: 3000 });
  const off = a.first[G.CH1_TOP] ?? 3000;
  const b = playthrough({ ...o, leader: (s, run) => lead(s, run + off), s: a.s, stopAt: last, maxRuns: 6000 });
  const f = []; for (let i = 0; i <= last; i++) f.push(i <= G.CH1_TOP ? a.first[i] : (b.first[i] === undefined ? undefined : off + b.first[i]));
  runs.push(f);
  const p = G.partyHeroes(b.s);
  meta.push({ lv: Math.round(p.reduce((t, h) => t + h.level, 0) / p.length), il: Math.round(p.reduce((t, h) => t + G.heroIlvl(h, b.s.items), 0) / p.length) });
}
const avg = i => { const v = runs.map(f => f[i]).filter(x => x !== undefined); return v.length ? Math.round(v.reduce((x, y) => x + y, 0) / v.length) : null; };
const done = i => runs.filter(f => f[i] !== undefined).length;
console.log(`第三章模擬 ${seeds} 種子${NOKICK ? '（無打斷）' : ''}：結束時平均 Lv${Math.round(meta.reduce((t, m) => t + m.lv, 0) / seeds)}、裝等 ${Math.round(meta.reduce((t, m) => t + m.il, 0) / seeds)}`);
console.log('層\t累積\t本層\t通過');
for (let i = 0; i <= last; i++) { const c = avg(i), p = i ? avg(i - 1) : 0; console.log(`${G.ROMAN[i]}\t${c ?? '—'}\t${c != null && p != null ? c - p : '—'}\t${done(i)}/${seeds}`); }
