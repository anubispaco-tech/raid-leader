// ===== 職業包：薩滿（輔助型：元素輸出／恢復治療）=====
// 本身輸出或治療中等，但嗜血與圖騰讓全隊變強。嗜血一隊只算一次（帶兩位薩滿不會發動兩次）。
import { tx } from '../i18n.js';
import { ready, specCd, fx, spec, SPEC_ROW } from './shared.js';

const ROLE = { elemental: 'dps', resto: 'heal' };
const P = {
  id: 'shaman', name: tx('薩滿'), role: 'dps', roleText: tx('輸出／治療'), icon: '⚡',
  hp: 125, hpL: 21, pow: 8.5, powL: 1.95, armor: 0.22, crit: 0.07,
  desc: tx('元素可輸出、恢復可治療；首領戰開場自動施放嗜血，全隊加速，圖騰再強化全隊。'),
  roleOf: h => ROLE[h.spec] || 'dps',
  prefers: ['enrage', 'shield', 'phase'], // 嗜血爆發：狂暴、護盾、轉階段
  kick: u => !!u.mods.canKick,              // 學了「風剪」才能打斷
  ai: { bolt: 1.3, falloff: 0.85, wave: 1.6, surge: 2.6, surgeCd: 6, idleHit: 0.5, tideHot: 0.25, tideHotDur: 4, chain: 1.1, chainCd: 5 },
  lust: { dur: 10, haste: 0.3, legendDur: 6, proc: 0.15, procMult: 1.0 },
  base: { name: tx('嗜血'), cd: 0, desc: tx('每場一次：首領現身時自動施放，全隊出手速度 +30%，持續 10 秒；一隊只算一次') },
  specs: {
    elemental: { name: tx('元素'), skill: tx('閃電鏈'), counters: 'summon', desc: tx('輸出。冷卻 8 秒：閃電彈跳最多 3 個目標，每跳威力 ×2.2、遞減 15%'), cd: 8, mult: 2.2, jumps: 3 },
    resto: { name: tx('潮汐恢復'), skill: tx('治療之潮'), counters: 'pulse', desc: tx('治療。冷卻 12 秒：全隊回復威力 ×0.7，並留下治療圖騰 4 秒（每秒威力 ×0.25）；每 5 秒「治療鏈」補 3 人；坦克危急時「先祖迅捷」大補（冷卻 6 秒）'), cd: 12, mult: 0.7 },
  },
  talents: [
    { a: { name: tx('元素之力'), desc: tx('威力 +8%'), mods: { powMult: 1.08 } },
      b: { name: tx('大地之盾'), desc: tx('受到的傷害 −15%'), mods: { allReduce: 0.15 } } },
    { a: { name: tx('先祖指引'), desc: tx('治療 +15%'), mods: { healMult: 1.15 } },
      b: { name: tx('雷霆'), desc: tx('傷害 +15%'), mods: { dmgMult: 1.15 } } },
    { a: { name: tx('大地圖騰'), desc: tx('全隊受到的範圍傷害 −10%'), mods: { partyAoe: 0.1 } },
      b: { name: tx('怒風圖騰'), desc: tx('全隊暴擊率 +5%'), mods: { partyCrit: 0.05 } } },
    SPEC_ROW,
    { a: { name: tx('先祖之魂'), desc: tx('全隊生命 +5%'), mods: { partyHp: 0.05 } },
      b: { name: tx('風怒'), desc: tx('暴擊傷害 ×2 → ×2.3'), mods: { critDmg: 2.3 } } },
    { a: { name: tx('淨化圖騰'), desc: tx('每 6 秒淨化 1 名隊員的詛咒'), mods: { cleanseTotem: 6 } },
      b: { name: tx('風剪'), desc: tx('可以打斷首領讀條（冷卻 12 秒）'), mods: { canKick: 1 } } },
    { a: { name: tx('英雄氣概'), desc: tx('嗜血持續 +4 秒'), mods: { lustDur: 4 } },
      b: { name: tx('元素精通'), desc: tx('暴擊率 +6%'), mods: { critAdd: 0.06 } } },
  ],
  // 備戰不改薩滿的職責，只依職責與機制配天賦
  recommend(has, h) {
    const sp = (h && h.spec) || 'elemental';
    const row6 = has('curse') ? 'a' : has('cast') ? 'b' : 'a';
    const t = sp === 'resto' ? ['b', 'a', has('pulse') || has('curse') ? 'a' : 'b', 'b', 'a', row6, 'a']
      : ['a', 'b', has('pulse') ? 'a' : 'b', 'b', 'b', row6, has('enrage') || has('shield') ? 'a' : 'b'];
    return { spec: sp, t };
  },
  legend: {
    name: tx('卡洛'), title: tx('雷鳴'), passive: 'stormfury', pname: tx('風暴之怒'),
    desc: tx('嗜血持續 10 → 16 秒；嗜血期間全隊每次攻擊有 15% 機率引發閃電（威力 ×1）'),
    hooks: {}, // 效果在下方 hooks.tick 施放嗜血時一併處理
  },
  act(b, u, foes, focus) {
    const S = spec(P, u), A = P.ai, boss = foes.find(e => e.boss);
    if (u.spec === 'resto') {
      const team = b.alive();
      const tankLow = team.find(x => x.role === 'tank' && x.hp < x.max * 0.5);
      if (tankLow && ready(b, u, 'surge')) { // 坦克危急：先祖迅捷大補（冷卻 6 秒）
        b.heal(u, tankLow, u.pow * A.surge); u.cd.surge = b.tick + A.surgeCd; b.skillLog(u, tx('先祖迅捷'), tankLow); return;
      }
      if (tankLow) { b.heal(u, tankLow, u.pow * A.wave); return; }
      if (ready(b, u, 'spec') && team.some(x => x.hp < x.max * 0.85)) { // 治療之潮＋治療圖騰
        for (const x of team) { b.heal(u, x, u.pow * S.mult * fx(u)); x.hots.push({ until: b.tick + A.tideHotDur, amt: u.pow * A.tideHot * fx(u), src: u }); }
        u.cd.spec = b.tick + specCd(u, S); b.skillLog(u, S.skill);
        return;
      }
      const hurt = team.filter(x => x.hp < x.max * 0.85).sort((x, y) => x.hp / x.max - y.hp / y.max);
      if (hurt.length >= 2 && ready(b, u, 'chain')) { // 治療鏈：最多 3 人，每跳遞減 15%
        hurt.slice(0, 3).forEach((x, i) => b.heal(u, x, u.pow * A.chain * Math.pow(A.falloff, i)));
        u.cd.chain = b.tick + A.chainCd; return;
      }
      const tank = team.find(x => x.role === 'tank' && x.hp < x.max * 0.8);
      const low = tank || team.reduce((m, x) => (x.hp / x.max < m.hp / m.max ? x : m));
      if (low.hp < low.max * 0.7) { b.heal(u, low, u.pow * A.wave); return; } // 治療波
      b.hitEnemy(u, focus, u.pow * A.idleHit);
      return;
    }
    // 元素（未選專精時也用這套）
    if (u.spec === 'elemental' && ready(b, u, 'spec') && (foes.length >= 2 || boss)) {
      const tgts = [...foes].sort((x, y) => (y.boss ? 1 : 0) - (x.boss ? 1 : 0) || y.hp - x.hp).slice(0, S.jumps);
      tgts.forEach((e, i) => b.hitEnemy(u, e, u.pow * S.mult * fx(u) * Math.pow(A.falloff, i), { skill: true, aoe: true }));
      u.cd.spec = b.tick + specCd(u, S); b.skillLog(u, S.skill);
      return;
    }
    b.hitEnemy(u, focus, u.pow * A.bolt); // 閃電箭
  },
  hooks: {
    tick(b, u) {
      // 嗜血：首領現身後由第一位薩滿施放，一隊一次
      if (!b.lust.used && b.foes().some(e => e.boss)) {
        const L = P.lust, leg = !!u.mods.legend;
        b.startLust(u, L.dur + (u.mods.lustDur || 0) + (u.mods.setLust || 0) + (leg ? L.legendDur : 0), L.haste, leg ? L.proc : 0, L.procMult);
      }
      // 淨化圖騰
      if (u.mods.cleanseTotem && b.tick % u.mods.cleanseTotem === 0) {
        const c = b.alive().find(x => x.curse > b.tick);
        if (c) { c.curse = 0; b.skillLog(u, tx('淨化圖騰'), c); }
      }
    },
  },
};
export default P;
