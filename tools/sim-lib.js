// ===== 模擬共用：一個「合理玩家」從零玩到通關第 7 層 =====
// 策略：補滿 5 人（坦、補、盜、法、法）、有錢就強化、每場前一鍵配裝；
// 打不過就交替刷前一層；talents=true 時每場前套用「推薦配置」。
import * as G from '../src/core/index.js';

export function playthrough({ maxRuns = 1500, talents = true, horn = false, stopAt = G.CH1_TOP, s = G.newGame(), leader = null } = {}) {
  const log = [], first = {};
  for (let run = 0; run < maxRuns; run++) {
    const want = s.party.length < 5 ? (s.heroes.some(h => h.cls === 'mage') ? 'rogue' : 'mage') : null;
    if (want) {
      const t = s.tavern.find(h => h.cls === want);
      if (t && s.gold >= G.hireCost(t)) G.hire(s, t.id);
      else if (!t && s.gold >= G.refreshCost(s) + 80) G.refreshTavern(s);
    }
    for (const h of G.partyHeroes(s)) for (const sl of Object.keys(G.SLOTS)) { const id = h.gear[sl]; if (id && s.gold > 300) G.upgrade(s, id); }
    G.autoEquip(s);
    for (const id of [...s.bag]) if (s.bag.length > 20) G.salvage(s, id);
    const top = s.unlocked - 1;
    const d = s._fs >= 1 && top > 0 && run % 2 === 0 ? top - 1 : top;
    if (d > G.CH1_TOP) { // 第二章：雙首領需要第二位坦克 → 從酒館補一位守護騎士，並用一鍵備戰排陣容
      if (G.mechHints(d).includes('twin') && s.heroes.filter(h => G.roleOf(h) === 'tank').length < 2) {
        const t = s.tavern.find(h => h.cls === 'guardian');
        if (t && s.gold >= G.hireCost(t)) G.hire(s, t.id); else if (!t && s.gold >= G.refreshCost(s)) G.refreshTavern(s);
      }
      G.prepare(s, G.mechHints(d));
    } else if (talents) for (const h of G.partyHeroes(s)) G.applyRecommend(h, G.mechHints(d));
    const b = new G.Battle(G.partyHeroes(s), s.items, d, { autoHorn: horn, leader: typeof leader === 'function' ? leader(s, run) : leader }).runToEnd();
    G.applyResult(s, d, b);
    if (d === top) s._fs = b.win ? 0 : (s._fs || 0) + 1;
    if (b.win && first[d] === undefined) {
      first[d] = run;
      const p = G.partyHeroes(s);
      log.push(`D${d + 1} 首通 @run ${run} lv=${p.map(h => h.level).join('/')} ilvl=${p.map(h => G.heroIlvl(h, s.items)).join('/')} ticks=${b.tick}`);
    }
    if (first[stopAt] !== undefined) break;
  }
  return { log, first, s };
}

// 通關第 7 層後繼續打秘境：每天 perDay 場、輪流打 7 個副本、每場前套用推薦天賦（含詞綴）、首領戰吹號角
export function mythicRun({ runs = 300, perDay = 15, start = new Date('2026-10-05T04:00:00Z'), leader = null } = {}) {
  const { s } = playthrough({ talents: true });
  const keyAt = {}, hist = [];
  for (let r = 0; r < runs; r++) {
    const date = new Date(start.getTime() + Math.floor(r / perDay) * 864e5);
    for (const h of G.partyHeroes(s)) for (const sl of Object.keys(G.SLOTS)) { const id = h.gear[sl]; if (id && s.gold > 500) G.upgrade(s, id); }
    G.autoEquip(s);
    for (const id of [...s.bag]) if (s.bag.length > 20) G.salvage(s, id);
    const d = r % (G.CH1_TOP + 1), lvl = s.mythic.key;
    const o = G.mythicBattleOpts(d, lvl, date);
    const hints = [...G.mechHints(d), ...G.affixHints(o.mythic.affixes)];
    for (const h of G.partyHeroes(s)) G.applyRecommend(h, hints);
    const b = new G.Battle(G.partyHeroes(s), s.items, d, { ...o, autoHorn: true, leader }).runToEnd();
    const res = G.applyMythicResult(s, b);
    hist.push(res.inTime);
    for (let k = 2; k <= s.mythic.key; k++) if (keyAt[k] === undefined) keyAt[k] = r + 1;
  }
  const lv = G.partyHeroes(s).map(h => h.level), il = G.partyHeroes(s).map(h => G.heroIlvl(h, s.items));
  return { keyAt, final: s.mythic.key, timedRate: Math.round(100 * hist.filter(Boolean).length / hist.length), lv, il };
}
export function average(n, opts) {
  const agg = {};
  let sample;
  for (let i = 0; i < n; i++) { const r = playthrough(opts); sample = sample || r; for (const k in r.first) (agg[k] = agg[k] || []).push(r.first[k]); }
  const avg = Object.fromEntries(Object.entries(agg).map(([k, v]) => [k, { runs: Math.round(v.reduce((a, b) => a + b) / v.length), done: v.length }]));
  return { avg, sample, n };
}
export const fmtAvg = ({ avg, n }) => '平均首通場次: ' + Object.entries(avg).map(([k, v]) => `D${+k + 1}:${v.runs}(${v.done}/${n})`).join(' ');
