// ===== 職業包：聖光牧師（治療）=====
import { tx } from '../i18n.js';
import { R } from '../rng.js';
import { ready, specCd, fx, spec, baseCd, SPEC_ROW } from './shared.js';

const P = {
  id: 'cleric', name: tx('聖光牧師'), role: 'heal', icon: '✨', hp: 130, hpL: 22, pow: 9, powL: 2.0, armor: 0.15, crit: 0.05,
  desc: tx('治療血量最低的隊友，每 5 秒群體治療。'),
  ai: { single: 1.9, critMult: 1.5, groupEvery: 5, group: 0.75, groupBelow: 0.9, idleHit: 0.5 },
  base: { name: tx('真言術：盾'), cd: 10, mult: 4, desc: tx('冷卻 10 秒：給血量最低的隊友護盾（威力 ×4）') },
  specs: {
    disc: { name: tx('戒律'), skill: tx('痛苦鎮壓'), counters: 'buster', desc: tx('冷卻 15 秒：坦克受到重擊時，該次傷害 −60%'), cd: 15, reduce: 0.6 },
    holy: { name: tx('神聖'), skill: tx('神聖讚美詩'), counters: 'pulse', desc: tx('冷卻 30 秒：全隊平均血量低於 60% 時，連續 3 秒群補（威力 ×1.2）'), cd: 30, dur: 3, mult: 1.2, below: 0.6 },
  },
  talents: [
    { a: { name: tx('冥想'), desc: tx('治療 +10%'), mods: { healMult: 1.1 } },
      b: { name: tx('迅捷禱言'), desc: tx('群補間隔 5 → 4 秒'), mods: { groupEvery: 4 } } },
    { a: { name: tx('堅定護盾'), desc: tx('護盾 +40%'), mods: { baseMult: 1.4 } },
      b: { name: tx('恢復'), desc: tx('單體治療後再持續回血 3 秒'), mods: { renew: 0.3 } } },
    { a: { name: tx('救贖'), desc: tx('第一位陣亡的隊友以 50% 生命復活，每場一次'), mods: { redemption: 0.5 } },
      b: { name: tx('聖光之怒'), desc: tx('沒人需要治療時，攻擊傷害 ×3'), mods: { smite: 3 } } },
    SPEC_ROW,
    { a: { name: tx('守護天使'), desc: tx('全隊受到的範圍傷害 −10%'), mods: { partyAoe: 0.1 } },
      b: { name: tx('慈悲'), desc: tx('暴擊率 +10%'), mods: { critAdd: 0.1 } } },
    { a: { name: tx('淨化專精'), desc: tx('淨化冷卻 6 → 3 秒'), mods: { dispelCd: 3 } },
      b: { name: tx('祈福'), desc: tx('全隊生命 +5%'), mods: { partyHp: 0.05 } } },
  ],
  recommend: has => ({ spec: has('buster') && !has('pulse') ? 'disc' : 'holy', t: ['a', 'a', 'a', 'b', has('pulse') ? 'a' : 'b', has('curse') ? 'a' : 'b'] }),
  legend: {
    name: tx('艾蕾娜'), title: tx('晨曦'), passive: 'overflow', pname: tx('溢光'), desc: tx('治療超出的部分轉為護盾（上限是該隊員生命的 20%）'),
    hooks: {
      onHeal(b, src, tgt, amt, h) {
        const over = Math.round(amt * b.healMult(src)) - h;
        if (over > 0) tgt.shield = Math.min(Math.round(tgt.max * 0.2), tgt.shield + over);
      },
    },
  },
  act(b, u, foes, focus) {
    const A = P.ai, S = spec(P, u), B = P.base, team = b.alive();
    const avg = team.reduce((a, x) => a + x.hp / x.max, 0) / team.length;
    if (u.spec === 'holy' && ready(b, u, 'spec') && avg < S.below) {
      u.buf.hymn = b.tick + S.dur; u.cd.spec = b.tick + specCd(u, S); b.skillLog(u, S.skill);
    }
    if (u.buf.hymn > b.tick) return; // 引導中：每 tick 群補在 hooks.tick 處理
    const low = team.reduce((m, x) => (x.hp / x.max < m.hp / m.max ? x : m));
    if (ready(b, u, 'base') && low.hp < low.max * 0.85) {
      const tgt = team.find(x => x.role === 'tank' && x.hp < x.max * 0.85) || low;
      tgt.shield += Math.round(u.pow * B.mult * (u.mods.baseMult || 1) * b.healMult(u));
      u.cd.base = b.tick + baseCd(u, B.cd); b.skillLog(u, B.name, tgt);
      return;
    }
    if (b.tick % (u.mods.groupEvery || A.groupEvery) === 0 && team.some(x => x.hp < x.max * A.groupBelow)) {
      for (const x of team) b.heal(u, x, u.pow * A.group);
      return;
    }
    if (low.hp < low.max) {
      b.heal(u, low, u.pow * A.single * (R() < u.crit ? A.critMult : 1));
      if (u.mods.renew) low.hots.push({ until: b.tick + 3, amt: u.pow * u.mods.renew, src: u });
    } else b.hitEnemy(u, focus, u.pow * A.idleHit * (u.mods.smite || 1));
  },
  hooks: {
    // 痛苦鎮壓：隊上有戒律牧師且冷卻好了，坦克吃重擊時減傷
    busterGuard: {
      can: (b, x) => x.spec === 'disc' && ready(b, x, 'spec'),
      apply(b, x, tgt) { const S = P.specs.disc; const f = 1 - Math.min(0.9, S.reduce * fx(x)); x.cd.spec = b.tick + specCd(x, S); b.skillLog(x, S.skill, tgt); return f; },
    },
    // 神聖讚美詩：引導中每秒群補
    tick(b, u) { if (u.buf.hymn > b.tick) { const S = P.specs.holy; for (const x of b.alive()) b.heal(u, x, u.pow * S.mult * fx(u)); } },
  },
};
export default P;
