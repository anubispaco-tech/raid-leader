// ===== 戰鬥模擬（每 tick = 1 秒）=====
// 職業行為在 HERO_ACTIONS，首領機制在 BOSS_MECHS：新增技能或機制時加一個函式即可。
import { CLASSES, CLASS_AI, DUNGEON } from './config.js';
import { R, rnd, pick, uid } from './rng.js';
import { heroStats } from './heroes.js';
import { buildWaves } from './dungeons.js';

// ---------- 職業行為：(battle, 英雄, 活著的敵人, 優先目標) ----------
const HERO_ACTIONS = {
  guardian(b, u, foes, focus) { b.hitEnemy(u, focus, u.pow * CLASS_AI.tank.hit); },
  cleric(b, u, foes, focus) {
    const A = CLASS_AI.heal, team = b.alive();
    if (b.tick % A.groupEvery === 0 && team.some(x => x.hp < x.max * A.groupBelow)) {
      for (const x of team) b.heal(u, x, u.pow * A.group);
      return;
    }
    const low = team.reduce((m, x) => (x.hp / x.max < m.hp / m.max ? x : m));
    if (low.hp < low.max) b.heal(u, low, u.pow * A.single * (R() < u.crit ? A.critMult : 1));
    else b.hitEnemy(u, focus, u.pow * A.idleHit);
  },
  rogue(b, u, foes, focus) { b.hitEnemy(u, foes.find(e => e.boss) || focus, u.pow * CLASS_AI.rogue.hit); },
  mage(b, u, foes) {
    const per = foes.length > 1 ? CLASS_AI.mage.aoe : CLASS_AI.mage.single;
    for (const e of foes) b.hitEnemy(u, e, u.pow * per);
  },
};

// ---------- 首領機制：回傳本 tick 對坦克的攻擊倍率 ----------
const BOSS_MECHS = {
  enrage(b, e, m) {
    if (b.waveTick < m.at) return 1;
    if (b.waveTick === m.at) b.push(`🔥 ${e.name} 狂暴了！傷害大增`, 'warn');
    return m.mult;
  },
  pulse(b, e, m) {
    if (b.waveTick % m.every) return 1;
    b.push(`💥 ${e.name} 施放範圍攻擊`, 'warn');
    for (const u of b.alive()) b.hitHero(u, e.atk * m.dmg, true); // 魔法傷害：無視護甲
    return 1;
  },
  buster(b, e, m, tgt) {
    if (b.waveTick % m.every) return 1;
    b.push(`⚡ ${e.name} 對 ${tgt.name} 重擊`, 'warn');
    return m.mult;
  },
  summon(b, e, m) {
    if (b.waveTick % m.every) return 1;
    for (let k = 0; k < m.n; k++) b.enemies.push({ name: '召喚物', hp: e.addHp, max: e.addHp, atk: e.addAtk, boss: false, id: uid() });
    b.push(`🌀 ${e.name} 召喚了 ${m.n} 隻小怪`, 'warn');
    return 1;
  },
};

export class Battle {
  constructor(party, items, dIdx) {
    this.dIdx = dIdx;
    this.units = party.map(h => {
      const s = heroStats(h, items), c = CLASSES[h.cls];
      return { id: h.id, name: h.name, cls: h.cls, role: c.role, icon: c.icon,
        max: s.hp, hp: s.hp, pow: s.pow, crit: s.crit, armor: s.armor, dmgDone: 0, healDone: 0, taken: 0 };
    });
    this.waves = buildWaves(dIdx);
    this.waveIdx = 0; this.tick = 0; this.waveTick = 0; this.over = false; this.win = false;
    this.log = [];
    this.loadWave();
  }
  loadWave() {
    this.enemies = this.waves[this.waveIdx].map(e => ({ ...e, max: e.hp, id: uid() }));
    this.waveTick = 0;
  }
  alive() { return this.units.filter(u => u.hp > 0); }
  foes() { return this.enemies.filter(e => e.hp > 0); }
  push(msg, cls = '') { this.log.push({ t: this.tick, msg, cls }); if (this.log.length > 80) this.log.shift(); }

  hitEnemy(u, e, amt) {
    const crit = R() < u.crit; if (crit) amt *= 2;
    amt = Math.round(amt * rnd(0.92, 1.08));
    e.hp = Math.max(0, e.hp - amt); u.dmgDone += amt;
    if (e.hp === 0) this.push(`${e.name} 被擊殺`, e.boss ? 'good' : '');
    return crit;
  }
  hitHero(u, amt, ignoreArmor = false) {
    amt = Math.round(amt * (ignoreArmor ? 1 : 1 - u.armor) * rnd(0.9, 1.1));
    u.hp = Math.max(0, u.hp - amt); u.taken += amt;
    if (u.hp === 0) this.push(`💀 ${u.name}（${CLASSES[u.cls].name}）陣亡`, 'bad');
  }
  heal(src, tgt, amt) {
    const h = Math.min(tgt.max - tgt.hp, Math.round(amt));
    tgt.hp += h; src.healDone += h;
  }
  enemyTarget() {
    const a = this.alive(); if (!a.length) return null;
    return a.find(u => u.role === 'tank') || pick(a);
  }

  step() {
    if (this.over) return;
    this.tick++; this.waveTick++;
    // 英雄行動
    for (const u of this.alive()) {
      const foes = this.foes(); if (!foes.length) break;
      HERO_ACTIONS[u.cls](this, u, foes, foes.find(e => !e.boss) || foes[0]);
    }
    // 敵人行動
    for (const e of this.foes()) {
      const tgt = this.enemyTarget(); if (!tgt) break;
      let atk = e.atk;
      if (e.boss) for (const m of e.mech || []) atk *= BOSS_MECHS[m.t](this, e, m, tgt);
      if (tgt.hp > 0) this.hitHero(tgt, atk);
    }
    this.checkEnd();
  }
  checkEnd() {
    if (!this.alive().length) { this.over = true; this.win = false; this.push('☠️ 團滅…', 'bad'); return; }
    if (!this.foes().length) {
      if (this.waveIdx < this.waves.length - 1) {
        this.waveIdx++;
        for (const u of this.alive()) u.hp = Math.min(u.max, u.hp + Math.round(u.max * DUNGEON.waveHeal));
        this.loadWave();
        this.push(this.waveIdx === this.waves.length - 1 ? `👑 首領 ${this.enemies[0].name} 現身！` : `第 ${this.waveIdx + 1} 波敵人來襲`, 'info');
      } else { this.over = true; this.win = true; this.push('🏆 副本通關！', 'good'); }
    }
    if (this.tick >= DUNGEON.maxTicks && !this.over) { this.over = true; this.win = false; this.push('⌛ 時間耗盡，撤退', 'bad'); }
  }
  runToEnd() { while (!this.over) this.step(); return this; }
}
