// ===== 職業包：奧術法師（輸出・範圍）=====
import { ready, specCd, fx, spec, baseCd, SPEC_ROW } from './shared.js';

const P = {
  id: 'mage', name: '奧術法師', role: 'dps', icon: '🔥', hp: 115, hpL: 19, pow: 9, powL: 2.1, armor: 0.1, crit: 0.08,
  desc: '範圍傷害，同時攻擊所有敵人。擅長清小怪。',
  prefers: ['summon'],
  ai: { aoe: 0.72, single: 1.0 },
  base: { name: '烈焰風暴', cd: 9, mult: 2, desc: '冷卻 9 秒：全體敵人威力 ×2' },
  specs: {
    fire:  { name: '火焰', skill: '燃燒', counters: 'enrage', desc: '冷卻 30 秒：10 秒內暴擊率 +40%', cd: 30, dur: 10, crit: 0.4 },
    frost: { name: '冰霜', skill: '冰霜新星', counters: 'summon', desc: '冷卻 18 秒：全體敵人攻擊 −40% 持續 4 秒', cd: 18, dur: 4, weaken: 0.4 },
  },
  talents: [
    { a: { name: '奧術智慧', desc: '威力 +8%', mods: { powMult: 1.08 } },
      b: { name: '法術強化', desc: '烈焰風暴傷害 +40%', mods: { baseMult: 1.4 } } },
    { a: { name: '寒冰屏障', desc: '生命低於 30% 時免傷 4 秒，每場一次', mods: { iceBlock: 4 } },
      b: { name: '法力護盾', desc: '受到的傷害 −15%', mods: { allReduce: 0.15 } } },
    { a: { name: '連鎖反應', desc: '範圍攻擊每多 1 個目標，傷害 +5%', mods: { chain: 0.05 } },
      b: { name: '專注', desc: '只剩 1 個目標時傷害 +25%', mods: { focus: 0.25 } } },
    SPEC_ROW,
    { a: { name: '炎爆術', desc: '每 10 秒對首領造成威力 ×5', mods: { pyro: 5 } },
      b: { name: '暴風雪', desc: '烈焰風暴冷卻 9 → 6 秒', mods: { baseCd: 6 } } },
  ],
  recommend: has => ({ spec: has('summon') ? 'frost' : 'fire', t: ['a', 'b', has('summon') ? 'a' : 'b', 'b', 'a'] }),
  legend: {
    name: '莉薇亞', title: '星火', passive: 'molten', pname: '熔熱', desc: '烈焰風暴冷卻 −50%，擊殺敵人時再減 1 秒',
    hooks: {
      cdMult: 0.5,
      onKill(b, u) { if (u.cd.base) u.cd.base -= 1; },
    },
  },
  act(b, u, foes) {
    const S = spec(P, u), B = P.base, boss = foes.find(e => e.boss);
    if (u.spec === 'fire' && ready(b, u, 'spec') && boss) {
      u.buf.combust = b.tick + S.dur; u.cd.spec = b.tick + specCd(u, S); b.skillLog(u, S.skill);
    }
    if (u.spec === 'frost' && ready(b, u, 'spec') && (foes.length >= 2 || boss)) {
      const w = Math.min(0.8, S.weaken * fx(u));
      for (const e of foes) { e.weak = Math.max(e.weakUntil > b.tick ? e.weak : 0, w); e.weakUntil = b.tick + S.dur; }
      u.cd.spec = b.tick + specCd(u, S); b.skillLog(u, S.skill);
    }
    if (u.mods.pyro && b.tick % 10 === 0) {
      const t = boss || foes[0]; b.hitEnemy(u, t, u.pow * u.mods.pyro, { skill: true }); b.skillLog(u, '炎爆術', t);
    }
    const n = foes.length, chain = 1 + (u.mods.chain || 0) * (n - 1), focusM = n === 1 ? 1 + (u.mods.focus || 0) : 1;
    if (ready(b, u, 'base')) {
      for (const e of b.foes()) b.hitEnemy(u, e, u.pow * B.mult * (u.mods.baseMult || 1) * chain * focusM, { skill: true, aoe: true });
      u.cd.base = b.tick + baseCd(u, B.cd); b.skillLog(u, B.name);
      return;
    }
    const per = n > 1 ? P.ai.aoe : P.ai.single;
    for (const e of b.foes()) b.hitEnemy(u, e, u.pow * per * chain * focusM, { aoe: true });
  },
  hooks: {
    critBonus: (b, u) => (u.buf.combust > b.tick ? P.specs.fire.crit * fx(u) : 0), // 燃燒
  },
};
export default P;
