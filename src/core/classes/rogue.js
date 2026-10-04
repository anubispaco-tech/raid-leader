// ===== 職業包：暗影盜賊（輸出・單體）=====
import { tx } from '../i18n.js';
import { ready, specCd, spec, baseCd, SPEC_ROW } from './shared.js';

const P = {
  id: 'rogue', name: tx('暗影盜賊'), role: 'dps', icon: '🗡️', hp: 140, hpL: 24, pow: 10, powL: 2.3, armor: 0.2, crit: 0.15,
  desc: tx('單體爆發，暴擊率高。擅長打王。'),
  prefers: ['enrage'], // 推薦陣容：遇到這些機制時優先帶
  ai: { hit: 1.3 },
  base: { name: tx('剔骨'), cd: 6, mult: 3.5, desc: tx('冷卻 6 秒：對首領造成威力 ×3.5') },
  specs: {
    assa:   { name: tx('刺殺'), skill: tx('致命毒藥'), counters: 'enrage', desc: tx('每次攻擊疊 1 層毒，每層每秒威力 ×0.4，最多 3 層'), perStack: 0.4, maxStacks: 3 },
    combat: { name: tx('戰鬥'), skill: tx('劍刃亂舞'), counters: 'summon', desc: tx('冷卻 15 秒：8 秒內每次攻擊額外打中 2 個目標'), cd: 15, dur: 8, extra: 2 },
  },
  talents: [
    { a: { name: tx('精準'), desc: tx('暴擊率 +5%'), mods: { critAdd: 0.05 } },
      b: { name: tx('致命'), desc: tx('暴擊傷害 ×2 → ×2.5'), mods: { critDmg: 2.5 } } },
    { a: { name: tx('閃避'), desc: tx('受到攻擊時 20% 機率閃過'), mods: { dodge: 0.2 } },
      b: { name: tx('割裂'), desc: tx('剔骨額外造成流血（5 秒，每秒威力 ×0.5）'), mods: { bleed: 0.5 } } },
    { a: { name: tx('處決'), desc: tx('目標生命低於 35% 時傷害 +30%'), mods: { execute: 0.3 } },
      b: { name: tx('清掃'), desc: tx('對小怪傷害 +25%'), mods: { sweep: 0.25 } } },
    SPEC_ROW,
    { a: { name: tx('暗影之舞'), desc: tx('剔骨冷卻 6 → 4 秒'), mods: { baseCd: 4 } },
      b: { name: tx('冷血'), desc: tx('每波第一次攻擊必定暴擊'), mods: { coldBlood: 1 } } },
  ],
  recommend: has => ({ spec: has('summon') ? 'combat' : 'assa', t: ['b', 'b', has('summon') ? 'b' : 'a', 'b', 'a'] }),
  legend: {
    name: tx('卡西恩'), title: tx('影刃'), passive: 'chain', pname: tx('連鎖暴擊'), desc: tx('暴擊後的下一次攻擊必定暴擊，每 6 秒最多一次'),
    hooks: {
      onCrit(b, u) { if ((u.chainReady || 0) <= b.tick) { u.nextCrit = true; u.chainReady = b.tick + 6; } },
    },
  },
  act(b, u, foes, focus) {
    const S = spec(P, u), B = P.base, boss = foes.find(e => e.boss);
    if (u.spec === 'combat' && ready(b, u, 'spec') && foes.length > 1) {
      u.buf.flurry = b.tick + S.dur; u.cd.spec = b.tick + specCd(u, S); b.skillLog(u, S.skill);
    }
    if (ready(b, u, 'base')) {
      const t = boss || focus;
      b.hitEnemy(u, t, u.pow * B.mult, { skill: true });
      if (u.mods.bleed) t.bleed = { until: b.tick + 5, amt: u.pow * u.mods.bleed, src: u };
      u.cd.base = b.tick + baseCd(u, B.cd); b.skillLog(u, B.name, t);
      return;
    }
    b.hitEnemy(u, boss || focus, u.pow * P.ai.hit);
  },
  hooks: {
    afterHit(b, u, e, amt, o) {
      // 致命毒藥：疊毒（每秒在戰鬥核心結算）
      if (u.spec === 'assa' && !o.dot) { const S = P.specs.assa; e.poison = Math.min(S.maxStacks, (e.poison || 0) + 1); e.poisonSrc = u; e.poisonPer = S.perStack; }
      // 劍刃亂舞：額外打 2 個目標
      if (u.buf.flurry > b.tick && !o.aoe && !o.dot && !o.extra) {
        for (const x of b.foes().filter(x => x !== e).slice(0, P.specs.combat.extra)) b.hitEnemy(u, x, amt, { extra: true, skill: true });
      }
    },
  },
};
export default P;
