// ===== 戰鬥模擬（每 tick = 1 秒）=====
// 結構：每 tick 先結算持續效果 → 英雄行動（技能優先）→ 敵人行動 → 判定波次。
// 職業行為在 HERO_ACTIONS，首領機制在 BOSS_MECHS，技能數值在 talents.js。
import { CLASSES, CLASS_AI, DUNGEON, RAID_HORN } from './config.js';
import { R, rnd, pick, uid } from './rng.js';
import { heroStats } from './heroes.js';
import { buildWaves } from './dungeons.js';
import { BASE_SKILLS, SPECS, heroMods } from './talents.js';

const ready = (b, u, key) => (u.cd[key] || 0) <= b.tick;
const spec = u => u.spec && SPECS[u.cls][u.spec];
const specCd = (u, s) => Math.round(s.cd * (u.mods.specCd || 1));
const fx = u => u.mods.specFx || 1;

// ---------- 職業行為：(battle, 英雄, 活著的敵人, 優先目標) ----------
const HERO_ACTIONS = {
  guardian(b, u, foes, focus) {
    const S = spec(u), B = BASE_SKILLS.guardian;
    if (u.spec === 'ret' && ready(b, u, 'spec')) {
      u.buf.wrath = b.tick + S.dur; u.cd.spec = b.tick + specCd(u, S); b.skillLog(u, S.skill);
    }
    if (ready(b, u, 'base')) {
      const t = foes.find(e => e.boss) || focus;
      b.hitEnemy(u, t, u.pow * B.mult * (u.mods.baseMult || 1), { skill: true });
      t.weak = Math.max(t.weakUntil > b.tick ? t.weak : 0, B.weaken); t.weakUntil = b.tick + B.weakenDur;
      u.cd.base = b.tick + B.cd; b.skillLog(u, B.name, t);
      return;
    }
    b.hitEnemy(u, focus, u.pow * CLASS_AI.tank.hit);
  },
  cleric(b, u, foes, focus) {
    const A = CLASS_AI.heal, S = spec(u), B = BASE_SKILLS.cleric, team = b.alive();
    const avg = team.reduce((a, x) => a + x.hp / x.max, 0) / team.length;
    if (u.spec === 'holy' && ready(b, u, 'spec') && avg < S.below) {
      u.buf.hymn = b.tick + S.dur; u.cd.spec = b.tick + specCd(u, S); b.skillLog(u, S.skill);
    }
    if (u.buf.hymn > b.tick) return; // 引導中：每 tick 群補在 tickEffects 處理
    const low = team.reduce((m, x) => (x.hp / x.max < m.hp / m.max ? x : m));
    if (ready(b, u, 'base') && low.hp < low.max * 0.85) {
      const tgt = team.find(x => x.role === 'tank' && x.hp < x.max * 0.85) || low;
      tgt.shield += Math.round(u.pow * B.mult * (u.mods.baseMult || 1) * b.healMult(u));
      u.cd.base = b.tick + B.cd; b.skillLog(u, B.name, tgt);
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
  rogue(b, u, foes, focus) {
    const S = spec(u), B = BASE_SKILLS.rogue, boss = foes.find(e => e.boss);
    if (u.spec === 'combat' && ready(b, u, 'spec') && foes.length > 1) {
      u.buf.flurry = b.tick + S.dur; u.cd.spec = b.tick + specCd(u, S); b.skillLog(u, S.skill);
    }
    if (ready(b, u, 'base')) {
      const t = boss || focus;
      b.hitEnemy(u, t, u.pow * B.mult, { skill: true });
      if (u.mods.bleed) t.bleed = { until: b.tick + 5, amt: u.pow * u.mods.bleed, src: u };
      u.cd.base = b.tick + (u.mods.baseCd || B.cd); b.skillLog(u, B.name, t);
      return;
    }
    b.hitEnemy(u, boss || focus, u.pow * CLASS_AI.rogue.hit);
  },
  mage(b, u, foes) {
    const S = spec(u), B = BASE_SKILLS.mage, boss = foes.find(e => e.boss);
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
      u.cd.base = b.tick + (u.mods.baseCd || B.cd); b.skillLog(u, B.name);
      return;
    }
    const per = n > 1 ? CLASS_AI.mage.aoe : CLASS_AI.mage.single;
    for (const e of b.foes()) b.hitEnemy(u, e, u.pow * per * chain * focusM, { aoe: true });
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
    for (const u of b.alive()) b.hitHero(u, e.atk * m.dmg * b.weakMult(e), 'magic');
    return 1;
  },
  buster(b, e, m, tgt) {
    if (b.waveTick % m.every) return 1;
    b.push(`⚡ ${e.name} 對 ${tgt.name} 重擊`, 'warn');
    b.isBuster = true;
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
  // opts.autoHorn：首領現身時自動吹英勇號角（掛機、直接結算、模擬用）
  // opts.mythic / waves / maxTicks：傳奇秘境（見 mythic.js mythicBattleOpts）
  constructor(party, items, dIdx, opts = {}) {
    this.dIdx = dIdx; this.opts = opts;
    this.mythic = opts.mythic || null;
    this.maxTicks = opts.maxTicks || DUNGEON.maxTicks;
    this.units = party.map(h => {
      const s = heroStats(h, items), c = CLASSES[h.cls];
      return { id: h.id, name: h.name, cls: h.cls, role: c.role, icon: c.icon, spec: h.spec || null, mods: heroMods(h),
        max: s.hp, hp: s.hp, pow: s.pow, crit: s.crit, armor: s.armor, shield: 0, hots: [], cd: {}, buf: {}, used: {},
        dmgDone: 0, skillDmg: 0, healDone: 0, taken: 0 };
    });
    // 隊伍光環：鼓舞（全隊生命）、守護天使（全隊範圍減傷）
    const partyHp = this.units.reduce((a, u) => a + (u.mods.partyHp || 0), 0);
    for (const u of this.units) { u.max = Math.round(u.max * (1 + partyHp)); u.hp = u.max; }
    this.partyAoe = Math.min(0.3, this.units.reduce((a, u) => a + (u.mods.partyAoe || 0), 0));
    this.horn = { used: false, until: -1 };
    this.waves = opts.waves || buildWaves(dIdx);
    this.waveIdx = 0; this.tick = 0; this.waveTick = 0; this.over = false; this.win = false;
    this.log = [];
    this.loadWave();
  }
  loadWave() {
    this.enemies = this.waves[this.waveIdx].map(e => ({ ...e, max: e.hp, id: uid(), weak: 0, weakUntil: -1, poison: 0 }));
    this.waveTick = 0;
    for (const u of this.units) { u.cold = !!u.mods.coldBlood; u.necro = 0; }
    if (this.opts.autoHorn && this.waveIdx === this.waves.length - 1) this.useHorn();
  }
  has(affix) { return !!this.mythic && this.mythic.affixes.includes(affix); }
  alive() { return this.units.filter(u => u.hp > 0); }
  foes() { return this.enemies.filter(e => e.hp > 0); }
  push(msg, cls = '') { this.log.push({ t: this.tick, msg, cls }); if (this.log.length > 80) this.log.shift(); }
  skillLog(u, name, t) { this.push(`${u.icon} ${u.name}：${name}${t && t.name !== u.name ? ` → ${t.name}` : ''}`, 'skill'); }

  // ---------- 團長指令 ----------
  hornActive() { return this.horn.until > this.tick; }
  useHorn() {
    if (this.horn.used || this.over) return false;
    this.horn.used = true; this.horn.until = this.tick + RAID_HORN.dur;
    this.push(`📯 英勇號角！全隊傷害與治療 +${Math.round(RAID_HORN.bonus * 100)}%，持續 ${RAID_HORN.dur} 秒`, 'info');
    return true;
  }
  healMult(u) { return (u.mods.healMult || 1) * (this.hornActive() ? 1 + RAID_HORN.bonus : 1); }
  weakMult(e) { return e.weakUntil > this.tick ? 1 - e.weak : 1; }

  // ---------- 傷害與治療 ----------
  hitEnemy(u, e, amt, o = {}) {
    if (e.hp <= 0) return 0;
    const m = u.mods;
    amt *= (m.dmgMult || 1) * (this.hornActive() ? 1 + RAID_HORN.bonus : 1);
    if (u.buf.wrath > this.tick) amt *= 1 + SPECS.guardian.ret.dmg * fx(u);
    if (m.execute && e.hp < e.max * 0.35) amt *= 1 + m.execute;
    if (m.sweep && !e.boss) amt *= 1 + m.sweep;
    let critC = u.crit + (u.buf.combust > this.tick ? SPECS.mage.fire.crit * fx(u) : 0);
    if (u.cold) { critC = 1; u.cold = false; }
    if (R() < critC) amt *= m.critDmg || 2;
    amt = Math.min(e.hp, Math.round(amt * rnd(0.92, 1.08)));
    e.hp -= amt; u.dmgDone += amt; if (o.skill || o.dot) u.skillDmg += amt;
    if (u.buf.wrath > this.tick && amt > 0) this.heal(u, u, amt * SPECS.guardian.ret.leech * fx(u), true);
    if (u.spec === 'assa' && !o.dot) { const S = SPECS.rogue.assa; e.poison = Math.min(S.maxStacks, (e.poison || 0) + 1); e.poisonSrc = u; }
    if (u.buf.flurry > this.tick && !o.aoe && !o.dot && !o.extra) {
      for (const x of this.foes().filter(x => x !== e).slice(0, SPECS.rogue.combat.extra)) this.hitEnemy(u, x, amt, { extra: true, skill: true });
    }
    if (e.hp === 0) {
      this.push(`${e.name} 被擊殺`, e.boss ? 'good' : '');
      if (!e.boss && this.has('bolstering')) { // 繁盛：其他小怪變強
        const rest = this.foes().filter(x => !x.boss);
        for (const x of rest) { x.max = Math.round(x.max * 1.15); x.hp = Math.round(x.hp * 1.15); x.atk *= 1.15; }
        if (rest.length) this.push(`🌿 繁盛：其餘 ${rest.length} 隻小怪變強`, 'warn');
      }
    }
    return amt;
  }
  // kind：phys 一般攻擊、buster 重擊、magic 範圍魔法（無視護甲）
  hitHero(u, amt, kind = 'phys', attacker) {
    if (u.hp <= 0 || u.buf.immune > this.tick) return 0;
    const m = u.mods;
    if (kind !== 'magic' && m.dodge && R() < m.dodge) return 0;
    let red = kind === 'magic' ? 1 - (m.aoeReduce || 0) - this.partyAoe : 1 - u.armor;
    if (kind === 'buster') {
      red *= 1 - (m.busterReduce || 0);
      const disc = this.alive().find(x => x.spec === 'disc' && ready(this, x, 'spec'));
      if (disc) { const S = SPECS.cleric.disc; red *= 1 - Math.min(0.9, S.reduce * fx(disc)); disc.cd.spec = this.tick + specCd(disc, S); this.skillLog(disc, S.skill, u); }
    }
    red *= 1 - (m.allReduce || 0);
    if (m.lowHpReduce && u.hp < u.max * 0.5) red *= 1 - m.lowHpReduce;
    amt = Math.round(amt * Math.max(0.05, red) * rnd(0.9, 1.1));
    const absorbed = Math.min(u.shield, amt); u.shield -= absorbed; amt -= absorbed;
    u.hp = Math.max(0, u.hp - amt); u.taken += amt;
    if (u.role === 'tank' && kind !== 'magic' && this.has('necrotic')) u.necro = Math.min(40, u.necro + 1);
    if (kind !== 'magic' && m.counter && attacker && R() < m.counter) this.hitEnemy(u, attacker, u.pow);
    this.lifeSavers(u);
    if (u.hp === 0) this.onDeath(u);
    return amt;
  }
  // 聖盾術、寒冰屏障：跌破門檻（含致命一擊）時觸發，每場一次
  lifeSavers(u) {
    const P = SPECS.guardian.prot;
    const save = (key, below, dur, name) => {
      if (u.used[key] || u.hp >= u.max * below) return;
      u.used[key] = true; u.hp = Math.max(1, u.hp); u.buf.immune = this.tick + dur; this.skillLog(u, name);
    };
    if (u.spec === 'prot') save('divine', P.below, Math.round(P.dur * fx(u)), P.skill);
    if (u.mods.iceBlock) save('ice', 0.3, u.mods.iceBlock, '寒冰屏障');
  }
  onDeath(u) {
    const priest = this.alive().find(x => x.mods.redemption && !x.used.redemption);
    if (priest) { priest.used.redemption = true; u.hp = Math.round(u.max * priest.mods.redemption); this.skillLog(priest, '救贖', u); return; }
    this.push(`💀 ${u.name}（${CLASSES[u.cls].name}）陣亡`, 'bad');
  }
  heal(src, tgt, amt, raw = false) {
    if (tgt.hp <= 0) return 0;
    const necro = tgt.necro ? Math.max(0.2, 1 - 0.02 * tgt.necro) : 1; // 壞疽
    const h = Math.min(tgt.max - tgt.hp, Math.round(amt * (raw ? 1 : this.healMult(src)) * necro));
    tgt.hp += h; src.healDone += h; return h;
  }
  enemyTarget() {
    const a = this.alive(); if (!a.length) return null;
    return a.find(u => u.role === 'tank') || pick(a);
  }

  // ---------- 每 tick 的持續效果 ----------
  tickEffects() {
    for (const e of this.foes()) {
      if (e.poison && e.poisonSrc) this.hitEnemy(e.poisonSrc, e, e.poison * SPECS.rogue.assa.perStack * e.poisonSrc.pow, { dot: true });
      if (e.bleed && e.bleed.until >= this.tick && e.hp > 0) this.hitEnemy(e.bleed.src, e, e.bleed.amt, { dot: true });
    }
    for (const u of this.alive()) {
      u.hots = u.hots.filter(h => h.until >= this.tick);
      for (const h of u.hots) this.heal(h.src, u, h.amt);
      if (u.buf.hymn > this.tick) { const S = SPECS.cleric.holy; for (const x of this.alive()) this.heal(u, x, u.pow * S.mult * fx(u)); }
    }
  }

  step() {
    if (this.over) return;
    this.tick++; this.waveTick++;
    this.tickEffects();
    for (const u of this.alive()) {
      const foes = this.foes(); if (!foes.length) break;
      HERO_ACTIONS[u.cls](this, u, foes, foes.find(e => !e.boss) || foes[0]);
    }
    for (const e of this.foes()) {
      const tgt = this.enemyTarget(); if (!tgt) break;
      this.isBuster = false;
      let atk = e.atk * this.weakMult(e);
      if (!e.boss && this.has('raging') && e.hp < e.max * 0.3) atk *= 1.5; // 暴怒
      if (e.boss) for (const m of e.mech || []) atk *= BOSS_MECHS[m.t](this, e, m, tgt);
      if (tgt.hp > 0) this.hitHero(tgt, atk, this.isBuster ? 'buster' : 'phys', e);
    }
    if (this.has('volcanic') && this.waveTick % 8 === 0 && this.alive().length) { // 火山
      const u = pick(this.alive()); this.push(`🌋 火山爆發，${u.name} 受到傷害`, 'warn');
      this.hitHero(u, this.mythic.volcanic, 'magic');
    }
    if (this.mythic && this.tick === this.mythic.timer && !this.over) this.push('⏰ 超過限時！仍可打完，但鑰石會降級', 'bad');
    this.checkEnd();
  }
  checkEnd() {
    if (!this.alive().length) { this.over = true; this.win = false; this.push('☠️ 團滅…', 'bad'); return; }
    if (!this.foes().length) {
      if (this.waveIdx < this.waves.length - 1) {
        this.waveIdx++;
        for (const u of this.alive()) u.hp = Math.min(u.max, u.hp + Math.round(u.max * DUNGEON.waveHeal));
        this.push(this.waveIdx === this.waves.length - 1 ? `👑 首領 ${this.waves[this.waveIdx][0].name} 現身！` : `第 ${this.waveIdx + 1} 波敵人來襲`, 'info');
        this.loadWave();
      } else { this.over = true; this.win = true; this.push('🏆 副本通關！', 'good'); }
    }
    if (this.tick >= this.maxTicks && !this.over) { this.over = true; this.win = false; this.push('⌛ 時間耗盡，撤退', 'bad'); }
  }
  runToEnd() { while (!this.over) this.step(); return this; }
}
