// ===== 職業包：德魯伊（依專精切換坦克／治療／輸出）=====
// 唯一會換職責的職業：Lv10 選專精時決定，之後可隨時免費更換。單一職責的數值比專職職業低約 10%。
import { tx } from '../i18n.js';
import { ready, specCd, fx, spec, baseCd, SPEC_ROW } from './shared.js';

const ROLE = { bear: 'tank', resto: 'heal', feral: 'dps' };
// 各型態的基礎屬性（熊的生命與守護騎士相同、但沒有聖盾術；其餘為專職職業 ×0.9）；傳說「萬物復甦」沒有這 10% 折扣
const FORM = {
  bear:  { hp: 230, hpL: 42, pow: 5.4, powL: 1.35, armor: 0.45, crit: 0.05 },
  resto: { hp: 117, hpL: 20, pow: 8.1, powL: 1.8, armor: 0.15, crit: 0.05 },
  feral: { hp: 126, hpL: 22, pow: 9, powL: 2.07, armor: 0.2, crit: 0.12 },
};
const P = {
  id: 'druid', name: tx('德魯伊'), role: 'dps', roleText: tx('坦克／治療／輸出'), icon: '🌿',
  hp: 126, hpL: 22, pow: 9, powL: 2.07, armor: 0.2, crit: 0.12,
  desc: tx('依專精化身熊、樹人或獵豹，可以當坦克、治療或輸出；單一職責比專職職業弱一些。'),
  roleOf: h => ROLE[h.spec] || 'dps',
  statsOf(h) {
    const f = FORM[h.spec] || FORM.feral;
    if (!h.legend) return f;
    return { ...f, hp: f.hp / 0.9, hpL: f.hpL / 0.9, pow: f.pow / 0.9, powL: f.powL / 0.9 };
  },
  // 熊形態天生扛重擊（沒有聖盾術，改用這個補坦度）
  modsOf: h => (h.spec === 'bear' ? { busterReduce: 0.15 } : {}),
  ai: { tankHit: 0.8, catHit: 1.2, heal: 2.0, swift: 4, swiftCd: 8, idleHit: 0.6 },
  base: { name: tx('月火術'), cd: 6, mult: 2, dot: 0.4, dotDur: 4, desc: tx('冷卻 6 秒：威力 ×2 傷害，並在 4 秒內每秒造成威力 ×0.4') },
  specs: {
    bear:  { name: tx('守護（熊）'), skill: tx('狂暴回復'), counters: 'buster', desc: tx('坦克。熊形態受到的重擊傷害 −15%；冷卻 15 秒：生命低於 50% 時，6 秒內回復 40% 生命'), cd: 15, below: 0.5, dur: 6, heal: 0.4 },
    resto: { name: tx('恢復（樹人）'), skill: tx('生命綻放'), counters: 'pulse', desc: tx('治療。冷卻 7 秒：全隊 4 秒內每秒回復威力 ×0.4；隊友生命低於 50% 時另有「迅癒」大補（冷卻 8 秒）'), cd: 7, dur: 4, mult: 0.4 },
    feral: { name: tx('野性（獵豹）'), skill: tx('撕裂'), counters: 'enrage', desc: tx('輸出。冷卻 12 秒：首領流血 8 秒，每秒威力 ×0.7'), cd: 12, dur: 8, mult: 0.7 },
  },
  talents: [
    { a: { name: tx('厚皮'), desc: tx('生命 +10%'), mods: { hpMult: 1.1 } },
      b: { name: tx('月光強化'), desc: tx('月火術傷害 +50%'), mods: { baseMult: 1.5 } } },
    { a: { name: tx('樹皮術'), desc: tx('受到的傷害 −15%'), mods: { allReduce: 0.15 } },
      b: { name: tx('野性本能'), desc: tx('暴擊率 +6%'), mods: { critAdd: 0.06 } } },
    { a: { name: tx('共生'), desc: tx('全隊生命 +5%'), mods: { partyHp: 0.05 } },
      b: { name: tx('原始之怒'), desc: tx('傷害 +15%'), mods: { dmgMult: 1.15 } } },
    SPEC_ROW,
    { a: { name: tx('生生不息'), desc: tx('治療 +15%'), mods: { healMult: 1.15 } },
      b: { name: tx('迅捷月火'), desc: tx('月火術冷卻 6 → 4 秒'), mods: { baseCd: 4 } } },
  ],
  // 備戰不改德魯伊的職責（陣容是照目前職責挑的），只依職責配天賦
  recommend(has, h) {
    const sp = (h && h.spec) || 'feral';
    const t = { bear: ['a', 'a', 'a', 'b', 'a'], resto: ['a', 'a', 'a', 'b', 'a'], feral: ['b', 'b', 'b', 'b', 'b'] }[sp];
    return { spec: sp, t };
  },
  legend: {
    name: tx('瑟蘭朵'), title: tx('森語'), passive: 'renewal', pname: tx('萬物復甦'),
    desc: tx('每場第一次全隊平均生命低於 30% 時，全隊回復 25% 生命；任何專精都沒有 10% 的數值折扣'),
    hooks: {
      tick(b, u) {
        if (u.used.renewal) return;
        const team = b.alive(); if (!team.length) return;
        if (team.reduce((a, x) => a + x.hp / x.max, 0) / team.length >= 0.3) return;
        u.used.renewal = true; b.skillLog(u, tx('萬物復甦'));
        for (const x of team) b.heal(u, x, x.max * 0.25, true);
      },
    },
  },
  act(b, u, foes, focus) {
    const S = spec(P, u), B = P.base, A = P.ai, boss = foes.find(e => e.boss);
    // 月火術：三種型態共用
    const moonfire = t => {
      b.hitEnemy(u, t, u.pow * B.mult * (u.mods.baseMult || 1), { skill: true });
      t.bleed = { until: b.tick + B.dotDur, amt: u.pow * B.dot * (u.mods.baseMult || 1), src: u };
      u.cd.base = b.tick + baseCd(u, B.cd); b.skillLog(u, B.name, t);
    };
    if (u.spec === 'bear') {
      if (ready(b, u, 'spec') && u.hp < u.max * S.below) {
        u.hots.push({ until: b.tick + S.dur, amt: u.max * S.heal * fx(u) / S.dur, src: u });
        u.cd.spec = b.tick + specCd(u, S); b.skillLog(u, S.skill);
      }
      if (ready(b, u, 'base')) return moonfire(boss || focus);
      b.hitEnemy(u, focus, u.pow * A.tankHit);
      return;
    }
    if (u.spec === 'resto') {
      const team = b.alive();
      if (ready(b, u, 'spec') && team.some(x => x.hp < x.max * 0.95)) {
        for (const x of team) x.hots.push({ until: b.tick + S.dur, amt: u.pow * S.mult * fx(u), src: u });
        u.cd.spec = b.tick + specCd(u, S); b.skillLog(u, S.skill);
        return;
      }
      // 坦克優先：坦克低於 75% 就先補坦克，否則補血量比例最低的人
      const tank = team.find(x => x.role === 'tank' && x.hp < x.max * 0.75);
      const low = tank || team.reduce((m, x) => (x.hp / x.max < m.hp / m.max ? x : m));
      if (low.hp < low.max * 0.5 && ready(b, u, 'swift')) { // 迅癒：危急時的大補
        b.heal(u, low, u.pow * A.swift); u.cd.swift = b.tick + A.swiftCd; b.skillLog(u, tx('迅癒'), low); return;
      }
      if (low.hp < low.max * 0.8) { b.heal(u, low, u.pow * A.heal); return; }
      if (ready(b, u, 'base')) return moonfire(boss || focus);
      b.hitEnemy(u, focus, u.pow * A.idleHit);
      return;
    }
    // 野性（未選專精時也用這套）
    if (u.spec === 'feral' && boss && ready(b, u, 'spec')) {
      boss.bleed = { until: b.tick + S.dur, amt: u.pow * S.mult * fx(u), src: u };
      u.cd.spec = b.tick + specCd(u, S); b.skillLog(u, S.skill, boss);
    }
    if (ready(b, u, 'base')) return moonfire(boss || focus);
    b.hitEnemy(u, boss || focus, u.pow * A.catHit);
  },
  hooks: {},
};
export default P;
