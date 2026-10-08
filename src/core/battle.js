// ===== 戰鬥模擬（每 tick = 1 秒）=====
// 結構：每 tick 先結算持續效果 → 英雄行動（技能優先）→ 敵人行動 → 判定波次。
// 職業行為與職業專屬效果都在職業包（classes/）：act() 每秒出手，hooks / legend.hooks 掛在下面標出的時機。
// 首領機制在 BOSS_MECHS；天賦這類通用修正值（mods）在這裡統一處理。
import { tx } from './i18n.js';
import { DUNGEON, RAID_HORN } from './config.js';
import { R, rnd, pick, uid } from './rng.js';
import { heroStats, rarityMods } from './heroes.js';
import { setMods } from './items.js';
import { buildWaves } from './dungeons.js';
import { heroMods } from './talents.js';
import { PACKS, roleOf } from './classes/index.js';
import { ACTIVES, ACTIVE, activeKey } from './actives.js';
import { COMMANDS } from './leader.js';

// ---------- 首領機制：回傳本 tick 對坦克的攻擊倍率 ----------
const BOSS_MECHS = {
  enrage(b, e, m) {
    if (b.waveTick < m.at) return 1;
    if (b.waveTick === m.at) { b.push(tx('🔥 {0} 狂暴了！傷害大增', e.name), 'warn'); b.fx({ k: 'phase', s: e.id }); }
    return m.mult;
  },
  pulse(b, e, m) {
    if (b.waveTick % m.every) return 1;
    b.push(tx('💥 {0} 施放範圍攻擊', e.name), 'warn'); b.fx({ k: 'pulse', s: e.id });
    for (const u of b.alive()) b.hitHero(u, e.atk * m.dmg * b.weakMult(e), 'magic');
    return 1;
  },
  buster(b, e, m, tgt) {
    if (b.waveTick % m.every) return 1;
    b.push(tx('⚡ {0} 對 {1} 重擊', e.name, tgt.name), 'warn'); b.fx({ k: 'buster', s: e.id, t: tgt.id });
    b.isBuster = true;
    return m.mult;
  },
  // ---- 第二章 ----
  // 詛咒：隨機點名一名隊員，每秒失去最大生命的 pct，持續 dur 秒；治療職責會用「淨化」解除
  curse(b, e, m) {
    if (b.waveTick % m.every) return 1;
    const pool = b.alive().filter(u => !(u.curse > b.tick)); if (!pool.length) return 1;
    const u = pick(pool); u.curse = b.tick + m.dur; u.cursePct = m.pct;
    b.push(tx('☠ {0} 詛咒了 {1}', e.name, u.name), 'warn'); b.fx({ k: 'curse', s: e.id, t: u.id, dur: m.dur });
    return 1;
  },
  // 讀條：time 秒後全隊受到魔法傷害（攻擊 × mult）；能打斷的職業會在讀條時打斷
  cast(b, e, m) {
    if (b.waveTick % m.every || e.casting) return 1;
    e.casting = { until: b.tick + m.time, mult: m.mult };
    b.push(tx('📖 {0} 開始讀條（{1} 秒）', e.name, m.time), 'warn'); b.fx({ k: 'cast', s: e.id, time: m.time });
    return 1;
  },
  // 護盾：獲得最大生命 pct 的護盾，window 秒內沒打破就回復 heal 的生命
  shield(b, e, m) {
    if (b.waveTick % m.every) return 1;
    e.bshield = Math.round(e.max * m.pct); e.bshieldUntil = b.tick + m.window; e.bshieldHeal = m.heal;
    b.push(tx('🛡 {0} 張開護盾！{1} 秒內打破它', e.name, m.window), 'warn'); b.fx({ k: 'shield', s: e.id });
    return 1;
  },
  // 轉階段：生命低於 at 時攻擊永久 ×atk
  phase(b, e, m) {
    if (!e.phased && e.hp < e.max * m.at) { e.phased = true; e.atk *= m.atk; b.push(tx('🌑 {0} 進入第二階段！攻擊大增', e.name), 'warn'); b.fx({ k: 'phase', s: e.id }); }
    return 1;
  },
  // 雙首領的羈絆：另一隻先倒下，這隻攻擊 ×mult
  bond(b, e, m) {
    if (!e.bonded && b.enemies.some(x => x.boss && x !== e && x.hp <= 0)) { e.bonded = true; e.atk *= m.mult; b.push(tx('💢 {0} 悲憤交加，攻擊大增', e.name), 'warn'); b.fx({ k: 'phase', s: e.id }); }
    return 1;
  },
  summon(b, e, m) {
    if (b.waveTick % m.every) return 1;
    for (let k = 0; k < m.n; k++) b.enemies.push({ name: tx('召喚物'), hp: e.addHp, max: e.addHp, atk: e.addAtk, boss: false, id: uid() });
    b.push(tx('🌀 {0} 召喚了 {1} 隻小怪', e.name, m.n), 'warn'); b.fx({ k: 'summon', s: e.id });
    return 1;
  },
};

export class Battle {
  // opts.autoHorn：首領現身時自動吹英勇號角（掛機、直接結算、模擬用）
  // opts.mythic / waves / maxTicks：傳奇秘境（見 mythic.js mythicBattleOpts）
  constructor(party, items, dIdx, opts = {}) {
    this.dIdx = dIdx; this.opts = opts;
    this.mythic = opts.mythic || null;
    this.vault = opts.vault || null; this.kills = 0;
    this.maxTicks = opts.maxTicks || DUNGEON.maxTicks;
    this.units = party.map(h => {
      const s = heroStats(h, items), pack = PACKS[h.cls], mods = { ...heroMods(h), ...rarityMods(h), ...(pack.modsOf ? pack.modsOf(h) : {}), ...setMods(h, items) }; // modsOf：職業包依型態給的固定修正
      const lh = (mods.legend && pack.legend.hooks) || {}; // 傳說被動的掛勾
      return { id: h.id, name: h.name, cls: h.cls, rarity: h.rarity || 0, role: roleOf(h), icon: pack.icon, spec: h.spec || null, mods,
        pack, hk: pack.hooks || {}, lh, legendCd: lh.cdMult || 1,
        max: s.hp, hp: s.hp, pow: s.pow, crit: s.crit, armor: s.armor, shield: 0, hots: [], cd: {}, buf: {}, used: {},
        dmgDone: 0, skillDmg: 0, healDone: 0, taken: 0 };
    });
    // 隊伍光環：鼓舞（全隊生命）、守護天使（全隊範圍減傷）
    const partyHp = this.units.reduce((a, u) => a + (u.mods.partyHp || 0) + (u.mods.setPartyHp || 0), 0);
    for (const u of this.units) { u.max = Math.round(u.max * (1 + partyHp)); u.hp = u.max; }
    this.partyAoe = Math.min(0.3, this.units.reduce((a, u) => a + (u.mods.partyAoe || 0), 0));
    // 怒風圖騰等：全隊暴擊光環（上限 +15%）
    const partyCrit = Math.min(0.15, this.units.reduce((a, u) => a + (u.mods.partyCrit || 0), 0));
    if (partyCrit) for (const u of this.units) u.crit += partyCrit;
    // v0.23 團長天賦（opts.leader＝leaderMods 的結果）：全隊生命在隊伍光環之後套用
    const L = this.L = opts.leader || {};
    if (L.hp) for (const u of this.units) { u.max = Math.round(u.max * (1 + L.hp)); u.hp = u.max; }
    this.leaderUsed = {};
    // v0.24 英雄主動技能（opts.actives：'auto' 依時機自動施放、'manual' 只有玩家點才放、沒給＝關閉，模擬與回歸測試預設關閉）
    this.actMode = opts.actives || null;
    if (this.actMode) for (const u of this.units) { const k = activeKey(u.cls, u.role); if (k) u.act = { key: k, ready: ACTIVE.first }; }
    // v0.24 團長指令（opts.leader.cmds）；autoCmd 時依時機自動下達
    this.cmds = (L.cmds || []).filter(c => COMMANDS[c] && ['rally', 'shatter', 'assault', 'inspire', 'bulwark'].includes(c));
    this.cmdUsed = {}; this.autoCmd = !!opts.autoCmd;
    this.horn = { used: false, until: -1 };
    this.lust = { used: false, until: -1, haste: 0, proc: 0, src: null }; // 嗜血（薩滿）
    this.waves = opts.waves || buildWaves(dIdx);
    this.waveIdx = 0; this.tick = 0; this.waveTick = 0; this.over = false; this.win = false;
    this.log = [];
    this.loadWave();
  }
  loadWave() {
    this.enemies = this.waves[this.waveIdx].map(e => ({ ...e, max: e.hp, id: uid(), weak: 0, weakUntil: -1, poison: 0 }));
    this.waveTick = 0;
    for (const u of this.units) { u.cold = !!u.mods.coldBlood; u.necro = 0; }
    if (this.opts.autoHorn && (this.waveIdx === this.waves.length - 1 || (this.vault && this.waveIdx === 0))) this.useHorn();
  }
  has(affix) { return !!this.mythic && this.mythic.affixes.includes(affix); }
  alive() { return this.units.filter(u => u.hp > 0); }
  foes() { return this.enemies.filter(e => e.hp > 0); }
  // v0.20 演出事件：只有畫面層設了 fxq 才記錄（模擬不受影響），不使用亂數
  fx(ev) { if (this.fxq) this.fxq.push(ev); }
  push(msg, cls = '') { this.log.push({ t: this.tick, msg, cls }); if (this.log.length > 80) this.log.shift(); }
  skillLog(u, name, t) { this.push(tx('{0} {1}：{2}{3}', u.icon, u.name, name, t && t.name !== u.name ? ` → ${t.name}` : ''), 'skill'); }

  // ---------- 團長指令 ----------
  hornActive() { return this.horn.until > this.tick; }
  useHorn() {
    if (this.horn.used || this.over) return false;
    const L = this.L, dur = RAID_HORN.dur + (L.hornDur || 0);
    this.horn.used = true; this.horn.until = this.tick + dur;
    this.fx({ k: 'horn' });
    this.push(tx('📯 英勇號角！全隊傷害與治療 +{0}%，持續 {1} 秒', Math.round(this.hornBonus() * 100), dur), 'info');
    if (L.rallyHeal) for (const u of this.alive()) { const h = Math.min(u.max - u.hp, Math.round(u.max * L.rallyHeal)); u.hp += h; if (h) this.fx({ k: 'heal', s: u.id, t: u.id }); }
    if (L.hornBreak) for (const e of this.foes()) { if (e.casting) { e.casting = null; this.fx({ k: 'kick', t: e.id }); } if (e.bshield > 0) e.bshield = Math.round(e.bshield * 0.5); }
    return true;
  }
  // 嗜血：持續期間每位隊員每秒有 haste 機率多出手一次；proc > 0 時隊員攻擊有機率引發閃電（傳說雷鳴・卡洛）
  lustActive() { return this.lust.until > this.tick; }
  startLust(src, dur, haste, proc = 0, procMult = 1) {
    if (this.lust.used || this.over) return false;
    Object.assign(this.lust, { used: true, until: this.tick + dur, haste, proc, procMult, src });
    this.fx({ k: 'lust', s: src.id });
    this.push(tx('🥁 {0} 施放嗜血！全隊出手速度 +{1}%，持續 {2} 秒', src.name, Math.round(haste * 100), dur), 'info');
    return true;
  }
  hornBonus() { return RAID_HORN.bonus + (this.L.hornBonus || 0); }
  // ---------- v0.24 英雄主動技能 ----------
  activeReady(u) { return !!u.act && u.hp > 0 && u.act.ready <= this.tick && !this.over && this.foes().length > 0; }
  useActive(id) {
    const u = this.units.find(x => x.id === id); if (!u || !this.activeReady(u)) return false;
    const A = ACTIVES[u.act.key]; u.act.ready = this.tick + ACTIVE.cd; u.act.used = (u.act.used || 0) + 1;
    this.fx({ k: 'lust', s: u.id });
    this.push(tx('✨ {0} {1}：{2}', u.icon, u.name, A.name), 'skill');
    A.use(this, u);
    return true;
  }
  // ---------- v0.24 團長指令 ----------
  cmdReady(c) { return this.cmds.includes(c) && !this.cmdUsed[c] && !this.over && this.foes().length > 0; }
  useCommand(c) {
    if (!this.cmdReady(c)) return false;
    this.cmdUsed[c] = true;
    const ext = this.L.cmdDur || 0;
    this.fx({ k: 'horn' });
    this.push(tx('📣 團長指令：{0}', COMMANDS[c].name), 'info');
    if (c === 'rally' || c === 'inspire') { const p = c === 'rally' ? 0.15 : 0.2; for (const u of this.alive()) { const h = Math.min(u.max - u.hp, Math.round(u.max * p)); u.hp += h; if (h) this.fx({ k: 'heal', t: u.id }); } }
    if (c === 'shatter') {
      for (const e of this.foes()) { if (e.casting) { e.casting = null; this.fx({ k: 'kick', t: e.id }); } if (e.bshield > 0) e.bshield = Math.round(e.bshield * 0.5); }
      if (this.L.shatterVuln) this.vuln = { until: this.tick + 5 + ext, v: this.L.shatterVuln };
    }
    if (c === 'assault') this.assault = { until: this.tick + 10 + ext, v: 0.15 };
    if (c === 'bulwark') this.bulwark = { until: this.tick + 6 + ext, v: 0.3 };
    return true;
  }
  // 自動時機（掛機、直接結算、模擬；手動戰鬥則等玩家按）
  autoCommands() {
    const boss = this.waveIdx === this.waves.length - 1 && !this.vault, foes = this.foes(), a = this.alive();
    if (!a.length || !foes.length) return;
    const avg = a.reduce((t, u) => t + u.hp / u.max, 0) / a.length, low = avg < 0.5 || a.some(u => u.hp < u.max * 0.3);
    const cast = foes.some(e => e.casting), shield = foes.some(e => e.bshield > 0);
    if (low && this.cmdReady('inspire')) this.useCommand('inspire');
    else if (low && this.cmdReady('rally')) this.useCommand('rally');
    if ((cast || shield) && this.cmdReady('shatter')) this.useCommand('shatter');
    if (boss && this.cmdReady('assault')) this.useCommand('assault');
    if ((cast || (boss && avg < 0.6)) && this.cmdReady('bulwark')) this.useCommand('bulwark');
  }
  healMult(u) { return (u.mods.healMult || 1) * (u.mods.setHeal ? 1 + u.mods.setHeal : 1) * (this.hornActive() ? 1 + this.hornBonus() : 1) * (1 + (this.L.heal || 0)); }
  weakMult(e) { return e.weakUntil > this.tick ? 1 - e.weak : 1; }

  // ---------- 傷害與治療 ----------
  hitEnemy(u, e, amt, o = {}) {
    if (e.hp <= 0) return 0;
    const m = u.mods;
    amt *= (m.dmgMult || 1) * (this.hornActive() ? 1 + this.hornBonus() : 1) * (1 + (this.L.dmg || 0)) * (e.boss ? 1 + (this.L.bossDmg || 0) : 1);
    if (this.assault && this.assault.until > this.tick) amt *= 1 + this.assault.v;            // 總攻號令
    if (e.boss && this.vuln && this.vuln.until > this.tick) amt *= 1 + this.vuln.v;          // 震懾
    if (this.L.shieldDmg && e.bshield > 0) amt *= 1 + this.L.shieldDmg;
    if (m.setDmg) amt *= 1 + m.setDmg;                                // 套裝
    if (u.hk.outMult) amt *= u.hk.outMult(this, u, e, o);           // 掛勾：輸出倍率
    if (m.execute && e.hp < e.max * 0.35) amt *= 1 + m.execute;
    if (m.sweep && !e.boss) amt *= 1 + m.sweep;
    let critC = u.crit + (u.hk.critBonus ? u.hk.critBonus(this, u) : 0); // 掛勾：暫時暴擊加成
    if (u.cold) { critC = 1; u.cold = false; }
    if (u.nextCrit) { critC = 1; u.nextCrit = false; } // 下一擊必暴（傳說等效果設定）
    const crit = R() < critC;
    if (crit) amt *= m.critDmg || 2;
    if (crit && !o.dot && u.lh.onCrit) u.lh.onCrit(this, u, e);       // 傳說掛勾：暴擊後
    amt = Math.min(e.hp, Math.round(amt * rnd(0.92, 1.08)));
    if (e.bshield > 0) { // 首領護盾先吸收
      const ab = Math.min(e.bshield, amt); e.bshield -= ab; e.hp += ab;
      if (e.bshield === 0) { this.push(tx('💥 {0} 的護盾被打破了', e.name), 'good'); this.fx({ k: 'sbreak', t: e.id }); }
    }
    e.hp -= amt; u.dmgDone += amt; if (o.skill || o.dot) u.skillDmg += amt;
    this.fx({ k: 'hit', s: u.id, t: e.id, crit, aoe: !!o.aoe, dot: !!o.dot, proc: !!o.proc, skill: !!o.skill });
    if (u.hk.afterHit) u.hk.afterHit(this, u, e, amt, o);           // 掛勾：命中後（吸血、疊毒、額外目標…）
    if (this.lust.proc && !o.dot && !o.proc && this.lustActive() && R() < this.lust.proc) { // 風暴之怒：引發閃電
      const L = this.lust, t = e.hp > amt ? e : this.foes().find(x => x !== e);
      if (t) { this.hitEnemy(L.src, t, L.src.pow * L.procMult, { proc: true, skill: true }); }
    }
    if (e.hp === 0) {
      if (e.goblin) this.kills = (this.kills || 0) + 1;
      if (u.lh.onKill) u.lh.onKill(this, u, e);                     // 傳說掛勾：擊殺後
      this.push(tx('{0} 被擊殺', e.name), e.boss ? 'good' : ''); this.fx({ k: 'kill', t: e.id, boss: !!e.boss });
      if (!e.boss && this.has('bolstering')) { // 繁盛：其他小怪變強
        const rest = this.foes().filter(x => !x.boss);
        for (const x of rest) { x.max = Math.round(x.max * 1.15); x.hp = Math.round(x.hp * 1.15); x.atk *= 1.15; }
        if (rest.length) this.push(tx('🌿 繁盛：其餘 {0} 隻小怪變強', rest.length), 'warn');
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
      const g = this.alive().find(x => x.hk.busterGuard && x.hk.busterGuard.can(this, x)); // 掛勾：隊友替坦克擋重擊
      if (g) red *= g.hk.busterGuard.apply(this, g, u);
    }
    red *= 1 - (m.allReduce || 0);
    if (m.setTaken) red *= 1 - m.setTaken;                            // 套裝
    const aura = this.alive().find(x => x.lh.partyTaken);            // 傳說掛勾：在場時全隊減傷
    if (aura) red *= aura.lh.partyTaken;
    if (m.lowHpReduce && u.hp < u.max * 0.5) red *= 1 - m.lowHpReduce;
    if (this.L.tankTaken && u.role === 'tank') red *= 1 - this.L.tankTaken;
    if (this.L.lowTaken && u.hp < u.max * 0.3) red *= 1 - this.L.lowTaken;
    if (u.buf.wall > this.tick) red *= 0.75;                                                    // 不動壁壘
    if (this.guard && this.guard.until > this.tick) red *= 1 - this.guard.v;                   // 咆哮守護
    if (this.bulwark && this.bulwark.until > this.tick) red *= 1 - this.bulwark.v;             // 堅守號令
    amt = Math.round(amt * Math.max(0.05, red) * rnd(0.9, 1.1));
    const absorbed = Math.min(u.shield, amt); u.shield -= absorbed; amt -= absorbed;
    u.hp = Math.max(0, u.hp - amt); u.taken += amt;
    this.fx({ k: 'hurt', s: attacker ? attacker.id : null, t: u.id, kind });
    if (u.role === 'tank' && kind !== 'magic' && this.has('necrotic')) u.necro = Math.min(40, u.necro + 1);
    if (kind !== 'magic' && m.counter && attacker && R() < m.counter) this.hitEnemy(u, attacker, u.pow);
    if (u.hp === 0 && this.L.lastStand && !this.leaderUsed.hold) { this.leaderUsed.hold = true; u.hp = 1; this.push(tx('🛡 不屈：{0} 撐住了致命一擊', u.name), 'info'); }
    this.lifeSavers(u);
    if (u.hp === 0) this.onDeath(u);
    return amt;
  }
  // 保命技能：跌破門檻（含致命一擊）時觸發，每場一次（職業包的專精技能 → 天賦寒冰屏障 → 傳說被動）
  lifeSavers(u) {
    const save = (key, below, dur, name) => {
      if (u.used[key] || u.hp >= u.max * below) return;
      u.used[key] = true; u.hp = Math.max(1, u.hp); u.buf.immune = this.tick + dur; this.skillLog(u, name); this.fx({ k: 'immune', t: u.id });
    };
    if (u.hk.lifeSaver) u.hk.lifeSaver(this, u, save);
    if (u.mods.iceBlock) save('ice', 0.3, u.mods.iceBlock, tx('寒冰屏障'));
    if (u.lh.lifeSaver) u.lh.lifeSaver(this, u);
  }
  onDeath(u) {
    const priest = this.alive().find(x => x.mods.redemption && !x.used.redemption);
    if (priest) { priest.used.redemption = true; u.hp = Math.round(u.max * priest.mods.redemption); this.skillLog(priest, tx('救贖'), u); this.fx({ k: 'heal', s: priest.id, t: u.id, big: true }); return; }
    if (this.L.revive && !this.leaderUsed.revive) { this.leaderUsed.revive = true; u.hp = Math.round(u.max * this.L.revive); this.push(tx('✚ 戰地救援：{0} 重新站起來', u.name), 'info'); this.fx({ k: 'heal', t: u.id, big: true }); return; }
    this.push(tx('💀 {0}（{1}）陣亡', u.name, u.pack.name), 'bad'); this.fx({ k: 'die', t: u.id });
  }
  heal(src, tgt, amt, raw = false) {
    if (tgt.hp <= 0) return 0;
    const necro = tgt.necro ? Math.max(0.2, 1 - 0.02 * tgt.necro) : 1; // 壞疽
    const h = Math.min(tgt.max - tgt.hp, Math.round(amt * (raw ? 1 : this.healMult(src)) * necro));
    tgt.hp += h; src.healDone += h;
    if (h > 0) this.fx({ k: 'heal', s: src.id, t: tgt.id });
    if (src.lh.onHeal && !raw) src.lh.onHeal(this, src, tgt, amt, h); // 傳說掛勾：治療後
    return h;
  }
  // 通用技能：能打斷的職業打斷讀條；治療職責淨化詛咒。回傳 true 表示用掉了這一秒
  utility(u, foes) {
    const caster = foes.find(e => e.casting);
    if (caster && u.pack.kick && u.pack.kick(u) && (u.cd.kick || 0) <= this.tick) {
      caster.casting = null; u.cd.kick = this.tick + Math.round((u.mods.kickCd || 12) * (1 - (this.L.kickCd || 0))); this.fx({ k: 'kick', s: u.id, t: caster.id });
      this.skillLog(u, tx('打斷'), caster); return true;
    }
    if (u.role === 'heal' && (u.cd.dispel || 0) <= this.tick) {
      const c = this.alive().find(x => x.curse > this.tick);
      if (c) { c.curse = 0; u.cd.dispel = this.tick + (u.mods.dispelCd || 6); this.skillLog(u, tx('淨化'), c); this.fx({ k: 'dispel', s: u.id, t: c.id }); return true; }
    }
    return false;
  }
  // 敵人目標：坦克；雙首領時第二隻首領打第二位坦克（有的話）
  enemyTarget(e) {
    const a = this.alive(); if (!a.length) return null;
    const tanks = a.filter(u => u.role === 'tank');
    if (e && e.boss && tanks.length > 1) { const bi = this.foes().filter(x => x.boss).indexOf(e); if (bi > 0) return tanks[Math.min(bi, tanks.length - 1)]; }
    return tanks[0] || pick(a);
  }

  // ---------- 每 tick 的持續效果 ----------
  tickEffects() {
    for (const e of this.foes()) {
      if (e.poison && e.poisonSrc) this.hitEnemy(e.poisonSrc, e, e.poison * e.poisonPer * e.poisonSrc.pow, { dot: true });
      if (e.bleed && e.bleed.until >= this.tick && e.hp > 0) this.hitEnemy(e.bleed.src, e, e.bleed.amt, { dot: true });
    }
    for (const e of this.foes()) if (e.bshield > 0 && this.tick >= e.bshieldUntil) { // 護盾時間到：首領回血
      e.bshield = 0; const h = Math.round(e.max * e.bshieldHeal); e.hp = Math.min(e.max, e.hp + h);
      this.push(tx('💚 護盾沒被打破，{0} 回復了 {1} 生命', e.name, h), 'bad'); this.fx({ k: 'sfail', t: e.id });
    }
    for (const u of this.alive()) if (u.curse > this.tick) this.hitHero(u, u.max * u.cursePct, 'magic');
    for (const u of this.alive()) {
      u.hots = u.hots.filter(h => h.until >= this.tick);
      for (const h of u.hots) this.heal(h.src, u, h.amt);
      if (u.hk.tick) u.hk.tick(this, u);
      if (u.lh.tick) u.lh.tick(this, u);                               // 傳說掛勾：每秒                               // 掛勾：每秒（引導技能等）
    }
  }

  step() {
    if (this.over) return;
    this.tick++; this.waveTick++;
    this.tickEffects();
    if (this.autoCmd && this.cmds.length) this.autoCommands();
    if (this.actMode === 'auto') for (const u of this.alive()) if (this.activeReady(u) && ACTIVES[u.act.key].auto(this, u)) this.useActive(u.id);
    for (const u of this.alive()) {
      const foes = this.foes(); if (!foes.length) break;
      if (this.utility(u, foes)) continue; // 打斷讀條、淨化詛咒（用掉這一秒的行動）
      u.pack.act(this, u, foes, foes.find(e => !e.boss) || foes[0]);
      if (this.lustActive() && R() < this.lust.haste) { // 嗜血：多出手一次
        const f2 = this.foes(); if (f2.length) u.pack.act(this, u, f2, f2.find(e => !e.boss) || f2[0]);
      }
    }
    for (const e of this.foes()) {
      const tgt = this.enemyTarget(e); if (!tgt) break;
      this.isBuster = false;
      let atk = e.atk * this.weakMult(e);
      if (!e.boss && this.has('raging') && e.hp < e.max * 0.3) atk *= 1.5; // 暴怒
      if (e.boss) for (const m of e.mech || []) atk *= BOSS_MECHS[m.t](this, e, m, tgt);
      if (tgt.hp > 0) this.hitHero(tgt, atk, this.isBuster ? 'buster' : 'phys', e);
    }
    for (const e of this.foes()) if (e.casting && this.tick >= e.casting.until) { // 讀條完成：全隊受傷
      const c = e.casting; e.casting = null;
      this.push(tx('💥 {0} 讀條完成，全隊受到重創', e.name), 'bad'); this.fx({ k: 'blast', s: e.id });
      for (const u of this.alive()) this.hitHero(u, e.atk * c.mult * this.weakMult(e), 'magic');
    }
    if (this.has('volcanic') && this.waveTick % 8 === 0 && this.alive().length) { // 火山
      const u = pick(this.alive()); this.push(tx('🌋 火山爆發，{0} 受到傷害', u.name), 'warn'); this.fx({ k: 'volc', t: u.id });
      this.hitHero(u, this.mythic.volcanic, 'magic');
    }
    if (this.mythic && this.tick === this.mythic.timer && !this.over) this.push(tx('⏰ 超過限時！仍可打完，但鑰石會降級'), 'bad');
    this.checkEnd();
  }
  checkEnd() {
    if (!this.alive().length) { this.over = true; this.win = false; this.push(tx('☠️ 團滅…'), 'bad'); this.fx({ k: 'end', win: false }); return; }
    if (!this.foes().length) {
      if (this.waveIdx < this.waves.length - 1) {
        this.waveIdx++;
        for (const u of this.alive()) u.hp = Math.min(u.max, u.hp + Math.round(u.max * DUNGEON.waveHeal));
        this.push(this.waveIdx === this.waves.length - 1 ? tx('👑 首領 {0} 現身！', this.waves[this.waveIdx][0].name) : tx('第 {0} 波敵人來襲', this.waveIdx + 1), 'info');
        this.loadWave(); this.fx({ k: 'wave', boss: this.waveIdx === this.waves.length - 1 });
      } else { this.over = true; this.win = true; this.push(tx('🏆 副本通關！'), 'good'); this.fx({ k: 'end', win: true }); }
    }
    if (this.tick >= this.maxTicks && !this.over) {
      if (this.vault) { this.over = true; this.win = true; this.push(tx('⏰ 時間到！共打倒 {0} 隻寶藏哥布林', this.kills || 0), 'good'); this.fx({ k: 'end', win: true }); }
      else { this.over = true; this.win = false; this.push(tx('⌛ 時間耗盡，撤退'), 'bad'); this.fx({ k: 'end', win: false }); }
    }
  }
  runToEnd() { while (!this.over) this.step(); return this; }
}
