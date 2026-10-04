// ===== 職業包：守護騎士（坦克）=====
import { tx } from '../i18n.js';
import { ready, specCd, fx, spec, baseCd, SPEC_ROW } from './shared.js';

const P = {
  id: 'guardian', name: tx('守護騎士'), role: 'tank', icon: '🛡️', hp: 230, hpL: 42, pow: 6, powL: 1.5, armor: 0.45, crit: 0.05,
  desc: tx('嘲諷所有敵人，承受傷害。護甲減傷 45%。'),
  kick: () => true, // 盾牌猛擊可以打斷讀條
  ai: { hit: 0.8 },
  base: { name: tx('盾牌猛擊'), cd: 8, mult: 2.5, weaken: 0.3, weakenDur: 4, desc: tx('冷卻 8 秒：威力 ×2.5 傷害，目標攻擊 −30% 持續 4 秒') },
  specs: {
    prot: { name: tx('防護'), skill: tx('聖盾術'), counters: 'buster', desc: tx('生命低於 30% 時自動 5 秒無敵，每場一次'), below: 0.3, dur: 5 },
    ret:  { name: tx('懲戒'), skill: tx('復仇之怒'), counters: 'enrage', desc: tx('冷卻 20 秒：10 秒內傷害 +50%、吸血 20%'), cd: 20, dur: 10, dmg: 0.5, leech: 0.2 },
  },
  talents: [
    { a: { name: tx('堅韌'), desc: tx('生命 +10%'), mods: { hpMult: 1.1 } },
      b: { name: tx('銳利盾牌'), desc: tx('盾牌猛擊傷害 +50%'), mods: { baseMult: 1.5 } } },
    { a: { name: tx('格擋'), desc: tx('受到重擊的傷害 −25%'), mods: { busterReduce: 0.25 } },
      b: { name: tx('魔抗'), desc: tx('受到範圍攻擊的傷害 −30%'), mods: { aoeReduce: 0.3 } } },
    { a: { name: tx('鼓舞'), desc: tx('全隊生命 +5%'), mods: { partyHp: 0.05 } },
      b: { name: tx('反擊'), desc: tx('受擊時 15% 機率反擊威力 ×1'), mods: { counter: 0.15 } } },
    SPEC_ROW,
    { a: { name: tx('盾牆'), desc: tx('生命低於 50% 時再減傷 15%'), mods: { lowHpReduce: 0.15 } },
      b: { name: tx('正義之錘'), desc: tx('傷害 +20%'), mods: { dmgMult: 1.2 } } },
    { a: { name: tx('不動如山'), desc: tx('受到的所有傷害 −10%'), mods: { allReduce: 0.1 } },
      b: { name: tx('神聖憤怒'), desc: tx('盾牌猛擊冷卻 8 → 6 秒'), mods: { baseCd: 6 } } },
  ],
  recommend: has => ({ spec: has('buster') ? 'prot' : 'ret', t: ['a', has('buster') ? 'a' : 'b', 'a', 'b', has('enrage') ? 'b' : 'a', has('enrage') ? 'b' : 'a'] }),
  legend: {
    name: tx('巴洛斯'), title: tx('鐵壁'), passive: 'undying', pname: tx('不屈'), desc: tx('每場第一次受到致命傷害改為剩 1 血並無敵 3 秒；在場時全隊受到的傷害 −8%'),
    hooks: {
      partyTaken: 0.92, // 在場時全隊受到的傷害倍率
      lifeSaver(b, u) {
        if (u.hp === 0 && !u.used.undying) { u.used.undying = true; u.hp = 1; u.buf.immune = b.tick + 3; b.skillLog(u, tx('不屈')); }
      },
    },
  },
  act(b, u, foes, focus) {
    const S = spec(P, u), B = P.base;
    if (u.spec === 'ret' && ready(b, u, 'spec')) {
      u.buf.wrath = b.tick + S.dur; u.cd.spec = b.tick + specCd(u, S); b.skillLog(u, S.skill);
    }
    if (ready(b, u, 'base')) {
      const t = foes.find(e => e.boss) || focus;
      b.hitEnemy(u, t, u.pow * B.mult * (u.mods.baseMult || 1), { skill: true });
      t.weak = Math.max(t.weakUntil > b.tick ? t.weak : 0, B.weaken); t.weakUntil = b.tick + B.weakenDur;
      u.cd.base = b.tick + baseCd(u, B.cd); b.skillLog(u, B.name, t);
      return;
    }
    b.hitEnemy(u, focus, u.pow * P.ai.hit);
  },
  hooks: {
    // 復仇之怒：傷害加成與吸血
    outMult: (b, u) => (u.buf.wrath > b.tick ? 1 + P.specs.ret.dmg * fx(u) : 1),
    afterHit(b, u, e, amt) {
      if (u.buf.wrath > b.tick && amt > 0) b.heal(u, u, amt * P.specs.ret.leech * fx(u), true);
    },
    // 聖盾術
    lifeSaver(b, u, save) { if (u.spec === 'prot') save('divine', P.specs.prot.below, Math.round(P.specs.prot.dur * fx(u)), P.specs.prot.skill); },
  },
};
export default P;
