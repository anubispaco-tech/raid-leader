// ===== 副本團長 Raid Leader — 核心邏輯（無 DOM，可在 Node 測試）=====
const RAID = (() => {
  const R = Math.random;
  const rnd = (a, b) => a + R() * (b - a);
  const rint = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = arr => arr[Math.floor(R() * arr.length)];
  const uid = () => Math.random().toString(36).slice(2, 9);

  // ---------- 職業 ----------
  const CLASSES = {
    guardian: { name: '守護騎士', role: 'tank', icon: '🛡️', hp: 230, hpL: 42, pow: 6, powL: 1.5, armor: 0.45, crit: 0.05,
      desc: '嘲諷所有敵人，承受傷害。護甲減傷 45%。' },
    cleric:   { name: '聖光牧師', role: 'heal', icon: '✨', hp: 130, hpL: 22, pow: 9, powL: 2.0, armor: 0.15, crit: 0.05,
      desc: '治療血量最低的隊友，每 5 秒群體治療。' },
    rogue:    { name: '暗影盜賊', role: 'dps',  icon: '🗡️', hp: 140, hpL: 24, pow: 10, powL: 2.3, armor: 0.2, crit: 0.15,
      desc: '單體爆發，暴擊率高。擅長打王。' },
    mage:     { name: '奧術法師', role: 'dps',  icon: '🔥', hp: 115, hpL: 19, pow: 9, powL: 2.1, armor: 0.1, crit: 0.08,
      desc: '範圍傷害，同時攻擊所有敵人。擅長清小怪。' },
  };
  const ROLE_NAME = { tank: '坦克', heal: '治療', dps: '輸出' };

  // ---------- 裝備 ----------
  const RARITY = [
    { name: '普通', mult: 1.0,  color: '#9ca3af' },
    { name: '精良', mult: 1.2,  color: '#22c55e' },
    { name: '稀有', mult: 1.45, color: '#3b82f6' },
    { name: '史詩', mult: 1.75, color: '#a855f7' },
  ];
  const SLOTS = { weapon: '武器', armor: '護甲', trinket: '飾品' };
  const SLOT_NAMES = {
    weapon: ['長劍', '法杖', '匕首', '戰錘', '權杖', '短弓'],
    armor: ['鎖甲', '法袍', '皮甲', '板甲', '斗篷'],
    trinket: ['護符', '戒指', '徽記', '寶珠', '項鍊'],
  };
  const PREFIX = ['', '堅毅的', '銳利的', '灼熱的', '寒霜的', '虛空的', '遠古的', '龍鱗的'];

  function makeItem(slot, ilvl, rarity) {
    const B = ilvl * RARITY[rarity].mult;
    const v = () => rnd(0.9, 1.1);
    let pow = 0, sta = 0, crit = 0;
    if (slot === 'weapon') { pow = B * 0.6 * v(); sta = B * 1.0 * v(); }
    if (slot === 'armor') { pow = B * 0.15 * v(); sta = B * 3.0 * v(); }
    if (slot === 'trinket') { pow = B * 0.35 * v(); sta = B * 1.0 * v(); crit = rarity >= 2 ? 0.01 * rarity + 0.01 : 0; }
    const pre = PREFIX[Math.min(PREFIX.length - 1, Math.floor(ilvl / 6))];
    return { id: uid(), slot, ilvl, rarity, up: 0, pow: Math.round(pow), sta: Math.round(sta), crit,
      name: pre + pick(SLOT_NAMES[slot]) };
  }
  const upMult = it => 1 + 0.08 * (it.up || 0);
  const itemPow = it => Math.round(it.pow * upMult(it));
  const itemSta = it => Math.round(it.sta * upMult(it));
  const itemScore = it => it.ilvl * RARITY[it.rarity].mult * upMult(it);
  const salvageValue = it => Math.round(it.ilvl * RARITY[it.rarity].mult * 1.5);
  const upgradeCost = it => Math.round(15 * (it.up + 1) * (1 + it.ilvl / 10));
  const MAX_UP = 5;

  function rollRarity(minR = 0) {
    const x = R();
    let r = x < 0.03 ? 3 : x < 0.15 ? 2 : x < 0.45 ? 1 : 0;
    return Math.max(r, minR);
  }

  // ---------- 英雄 ----------
  const NAMES = ['艾倫', '凱莉', '雷恩', '米拉', '索恩', '伊薇', '巴頓', '妮雅', '托爾', '菲歐', '達克', '露娜',
    '葛雷', '希拉', '奧德', '薇絲', '布蘭', '卡珊', '洛克', '艾琳', '費恩', '茉兒', '賽勒', '朵拉'];
  const xpNeed = L => Math.round(60 * Math.pow(L, 1.8));
  const MAX_LV = 40;

  function makeHero(cls, level = 1) {
    return { id: uid(), cls, name: pick(NAMES), level, xp: 0, gear: { weapon: null, armor: null, trinket: null } };
  }
  function heroStats(h, items) {
    const c = CLASSES[h.cls];
    let pow = c.pow + c.powL * (h.level - 1);
    let hp = c.hp + c.hpL * (h.level - 1);
    let crit = c.crit;
    for (const s of Object.keys(SLOTS)) {
      const it = h.gear[s] && items[h.gear[s]];
      if (!it) continue;
      pow += itemPow(it); hp += itemSta(it) * 2; crit += it.crit;
    }
    return { pow: Math.round(pow), hp: Math.round(hp), crit: Math.min(0.5, crit), armor: c.armor };
  }
  function heroIlvl(h, items) {
    let sum = 0;
    for (const s of Object.keys(SLOTS)) { const it = h.gear[s] && items[h.gear[s]]; sum += it ? it.ilvl : 0; }
    return Math.round(sum / 3);
  }
  function heroPower(h, items) { // 戰力（顯示用）
    const s = heroStats(h, items);
    return Math.round(s.pow * 10 * (1 + s.crit) + s.hp * 0.5);
  }
  function gainXp(h, xp) {
    let ups = 0;
    if (h.level >= MAX_LV) return 0;
    h.xp += xp;
    while (h.level < MAX_LV && h.xp >= xpNeed(h.level)) { h.xp -= xpNeed(h.level); h.level++; ups++; }
    if (h.level >= MAX_LV) h.xp = 0;
    return ups;
  }

  // ---------- 副本 ----------
  // 每隻王考驗一個職責：脈衝=治療、重擊=坦克、召喚=範圍、狂暴=輸出
  const DUNGEONS = [
    { name: '腐根洞窟', boss: '蘑菇領主', trash: '孢子菇', mech: [{ t: 'pulse', every: 7, dmg: 0.9 }], tip: '定期噴發孢子傷害全隊 → 考驗治療' },
    { name: '鏽蝕礦坑', boss: '礦坑巨像', trash: '礦坑狗頭人', mech: [{ t: 'buster', every: 8, mult: 3.2 }], tip: '重擊坦克 → 考驗坦克血量與護甲' },
    { name: '沉沒神殿', boss: '潮汐祭司', trash: '深淵魚人', mech: [{ t: 'summon', every: 10, n: 2 }], tip: '不斷召喚小怪 → 考驗範圍輸出' },
    { name: '灰燼要塞', boss: '熔火督軍', trash: '熔岩衛兵', mech: [{ t: 'enrage', at: 55, mult: 3 }], tip: '55 秒後狂暴 → 考驗輸出' },
    { name: '霜語墓穴', boss: '寒霜巫妖', trash: '骷髏戰士', mech: [{ t: 'pulse', every: 6, dmg: 1.0 }, { t: 'summon', every: 12, n: 2 }], tip: '寒冰脈衝＋召喚骷髏 → 治療與範圍' },
    { name: '虛空裂隙', boss: '虛空吞噬者', trash: '虛空行者', mech: [{ t: 'buster', every: 7, mult: 3.5 }, { t: 'enrage', at: 60, mult: 3 }], tip: '重擊＋狂暴 → 坦克與輸出' },
    { name: '龍眠高塔', boss: '遠古紅龍', trash: '龍人衛士', mech: [{ t: 'pulse', every: 7, dmg: 1.0 }, { t: 'buster', every: 9, mult: 3.2 }, { t: 'enrage', at: 70, mult: 3 }], tip: '全機制 → 全隊綜合考驗' },
  ];
  const T_HP = 1.9, T_ATK = 1.7; // 每階成長
  const dropIlvl = i => Math.round(6 * Math.pow(1.5, i));
  function dungeonInfo(i) {
    const t = i + 1;
    return { ...DUNGEONS[i], tier: t, dropIlvl: dropIlvl(i), recIlvl: i === 0 ? 0 : dropIlvl(i - 1), recLevel: [1, 2, 4, 6, 10, 13, 17][i] };
  }
  function buildWaves(i) {
    const d = DUNGEONS[i];
    const DIFF = [1, 1.1, 1, 1.4, 1, 1.35, 1][i];
    const sh = Math.pow(T_HP, i) * DIFF, sa = Math.pow(T_ATK, i) * Math.sqrt(DIFF);
    const trash = (n) => Array.from({ length: n }, (_, k) => ({ name: d.trash, hp: Math.round(85 * sh), atk: 6.5 * sa, boss: false }));
    return [trash(3), trash(3), [{ name: d.boss, hp: Math.round(850 * sh), atk: 13 * sa, boss: true, mech: d.mech, addHp: Math.round(70 * sh), addAtk: 5 * sa }]];
  }

  // ---------- 戰鬥 ----------
  const MAX_TICKS = 240;
  class Battle {
    constructor(party, items, dIdx) {
      this.dIdx = dIdx;
      this.units = party.map(h => {
        const s = heroStats(h, items);
        return { id: h.id, name: h.name, cls: h.cls, role: CLASSES[h.cls].role, icon: CLASSES[h.cls].icon,
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
      let crit = R() < u.crit; if (crit) amt *= 2;
      amt = Math.round(amt * rnd(0.92, 1.08));
      e.hp = Math.max(0, e.hp - amt); u.dmgDone += amt;
      if (e.hp === 0) this.push(`${e.name} 被擊殺`, e.boss ? 'good' : '');
      return crit;
    }
    hitHero(u, amt, src) {
      amt = Math.round(amt * (1 - u.armor) * rnd(0.9, 1.1));
      u.hp = Math.max(0, u.hp - amt); u.taken += amt;
      if (u.hp === 0) this.push(`💀 ${u.name}（${CLASSES[u.cls].name}）陣亡`, 'bad');
    }
    enemyTarget() {
      const a = this.alive(); if (!a.length) return null;
      const tank = a.find(u => u.role === 'tank');
      return tank || pick(a);
    }
    step() {
      if (this.over) return;
      this.tick++; this.waveTick++;
      // 英雄行動
      for (const u of this.alive()) {
        const foes = this.foes(); if (!foes.length) break;
        const focus = foes.find(e => !e.boss) || foes[0];
        if (u.role === 'tank') this.hitEnemy(u, focus, u.pow * 0.8);
        else if (u.role === 'heal') {
          const team = this.alive();
          if (this.tick % 5 === 0 && team.some(x => x.hp < x.max * 0.9)) {
            for (const x of team) { const h = Math.min(x.max - x.hp, Math.round(u.pow * 0.75)); x.hp += h; u.healDone += h; }
          } else {
            const low = team.reduce((m, x) => (x.hp / x.max < m.hp / m.max ? x : m));
            if (low.hp < low.max) {
              let h = u.pow * 1.9 * (R() < u.crit ? 1.5 : 1);
              h = Math.min(low.max - low.hp, Math.round(h)); low.hp += h; u.healDone += h;
            } else this.hitEnemy(u, focus, u.pow * 0.5);
          }
        } else if (u.cls === 'mage') {
          const n = foes.length; const per = n > 1 ? 0.72 : 1.0;
          for (const e of foes) this.hitEnemy(u, e, u.pow * per);
        } else { // rogue：優先打王
          const t = foes.find(e => e.boss) || focus;
          this.hitEnemy(u, t, u.pow * 1.3);
        }
      }
      // 敵人行動
      for (const e of this.foes()) {
        const tgt = this.enemyTarget(); if (!tgt) break;
        let atk = e.atk;
        if (e.boss) {
          for (const m of e.mech || []) {
            if (m.t === 'enrage' && this.waveTick >= m.at) { atk *= m.mult; if (this.waveTick === m.at) this.push(`🔥 ${e.name} 狂暴了！傷害大增`, 'warn'); }
            if (m.t === 'pulse' && this.waveTick % m.every === 0) {
              this.push(`💥 ${e.name} 施放範圍攻擊`, 'warn');
              for (const u of this.alive()) this.hitHero(u, e.atk * m.dmg / (1 - u.armor), e.name); // 魔法傷害：無視護甲
            }
            if (m.t === 'buster' && this.waveTick % m.every === 0) {
              this.push(`⚡ ${e.name} 對 ${tgt.name} 重擊`, 'warn'); atk *= m.mult;
            }
            if (m.t === 'summon' && this.waveTick % m.every === 0) {
              for (let k = 0; k < m.n; k++) this.enemies.push({ name: '召喚物', hp: e.addHp, max: e.addHp, atk: e.addAtk, boss: false, id: uid() });
              this.push(`🌀 ${e.name} 召喚了 ${m.n} 隻小怪`, 'warn');
            }
          }
        }
        if (tgt.hp > 0) this.hitHero(tgt, atk, e.name);
      }
      // 判定
      if (!this.alive().length) { this.over = true; this.win = false; this.push('☠️ 團滅…', 'bad'); return; }
      if (!this.foes().length) {
        if (this.waveIdx < this.waves.length - 1) {
          this.waveIdx++;
          for (const u of this.alive()) u.hp = Math.min(u.max, u.hp + Math.round(u.max * 0.5));
          this.loadWave();
          this.push(this.waveIdx === this.waves.length - 1 ? `👑 首領 ${this.enemies[0].name} 現身！` : `第 ${this.waveIdx + 1} 波敵人來襲`, 'info');
        } else { this.over = true; this.win = true; this.push('🏆 副本通關！', 'good'); }
      }
      if (this.tick >= MAX_TICKS && !this.over) { this.over = true; this.win = false; this.push('⌛ 時間耗盡，撤退', 'bad'); }
    }
    runToEnd() { while (!this.over) this.step(); return this; }
  }

  // ---------- 獎勵 ----------
  function rewards(dIdx, win, firstClear) {
    const info = dungeonInfo(dIdx);
    const gold = Math.round((25 + 18 * dIdx) * (win ? 1 : 0.3) * rnd(0.9, 1.1));
    const xp = Math.round(35 * Math.pow(dIdx + 1, 1.7) * (win ? 1 : 0.3));
    const loot = [];
    if (win) {
      const n = R() < 0.35 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const slot = pick(Object.keys(SLOTS));
        loot.push(makeItem(slot, info.dropIlvl + rint(-1, 2), rollRarity(firstClear && k === 0 ? 2 : 0)));
      }
    }
    return { gold, xp, loot };
  }

  // ---------- 遊戲狀態 ----------
  const PARTY_MAX = 5, ROSTER_MAX = 10, BAG_MAX = 40, OFFLINE_CAP_H = 8;
  const hireCost = h => 30 + 25 * h.level;
  const REFRESH_COST = 10;

  function newGame() {
    const s = { v: 1, gold: 60, heroes: [], items: {}, bag: [], party: [], unlocked: 1, clears: {},
      tavern: [], idle: null, lastSeen: Date.now(), stats: { runs: 0, wins: 0 }, autoSalvageCommon: false, created: Date.now() };
    for (const c of ['guardian', 'cleric', 'rogue']) { const h = makeHero(c); s.heroes.push(h); s.party.push(h.id); }
    rollTavern(s);
    return s;
  }
  function avgLevel(s) { const p = s.heroes; return p.length ? Math.round(p.reduce((a, h) => a + h.level, 0) / p.length) : 1; }
  function rollTavern(s) {
    const L = Math.max(1, avgLevel(s) - 1);
    s.tavern = Array.from({ length: 3 }, () => makeHero(pick(Object.keys(CLASSES)), Math.max(1, L + rint(-1, 0))));
  }
  function partyHeroes(s) { return s.party.map(id => s.heroes.find(h => h.id === id)).filter(Boolean); }
  function addLoot(s, it) {
    if ((s.autoSalvageCommon && it.rarity === 0) || s.bag.length >= BAG_MAX) { s.gold += salvageValue(it); return false; }
    s.items[it.id] = it; s.bag.push(it.id); return true;
  }
  function applyResult(s, dIdx, battle) {
    const first = battle.win && !s.clears[dIdx];
    const rw = rewards(dIdx, battle.win, first);
    s.stats.runs++;
    // 等級壓制：等級遠高於副本建議時，經驗與金幣遞減（避免掛低層無限練功）
    const rec = dungeonInfo(dIdx).recLevel;
    const decay = L => Math.max(0.05, Math.min(1, 1 - 0.25 * (L - (rec + 4))));
    const party = partyHeroes(s);
    const avgL = party.length ? party.reduce((a, h) => a + h.level, 0) / party.length : 1;
    rw.gold = Math.max(1, Math.round(rw.gold * decay(avgL)));
    s.gold += rw.gold;
    rw.decayed = decay(avgL) < 1;
    const baseXp = rw.xp; rw.xp = Math.round(baseXp * decay(avgL));
    const lvUps = [];
    for (const h of party) { const n = gainXp(h, Math.round(baseXp * decay(h.level))); if (n) lvUps.push({ name: h.name, level: h.level }); }
    if (battle.win) {
      s.stats.wins++;
      s.clears[dIdx] = (s.clears[dIdx] || 0) + 1;
      if (dIdx + 1 >= s.unlocked && dIdx + 1 < DUNGEONS.length) s.unlocked = dIdx + 2;
    }
    const kept = rw.loot.filter(it => addLoot(s, it));
    return { ...rw, first, lvUps, kept, salvaged: rw.loot.length - kept.length };
  }
  function equip(s, heroId, itemId) {
    const h = s.heroes.find(x => x.id === heroId), it = s.items[itemId]; if (!h || !it) return;
    const prev = h.gear[it.slot];
    // 若此裝備在別人身上，先卸下
    for (const o of s.heroes) if (o.gear[it.slot] === itemId) o.gear[it.slot] = null;
    s.bag = s.bag.filter(id => id !== itemId);
    h.gear[it.slot] = itemId;
    if (prev) s.bag.push(prev);
  }
  function unequip(s, heroId, slot) {
    const h = s.heroes.find(x => x.id === heroId); if (!h || !h.gear[slot]) return;
    s.bag.push(h.gear[slot]); h.gear[slot] = null;
  }
  function salvage(s, itemId) {
    const it = s.items[itemId]; if (!it) return 0;
    s.bag = s.bag.filter(id => id !== itemId); delete s.items[itemId];
    const v = salvageValue(it); s.gold += v; return v;
  }
  function upgrade(s, itemId) {
    const it = s.items[itemId]; if (!it || it.up >= MAX_UP) return false;
    const c = upgradeCost(it); if (s.gold < c) return false;
    s.gold -= c; it.up++; return true;
  }
  // 一鍵配裝：依裝備分數，替出戰隊員從背包挑最好的
  function autoEquip(s) {
    let changed = 0;
    for (const h of partyHeroes(s)) {
      for (const slot of Object.keys(SLOTS)) {
        const cur = h.gear[slot] && s.items[h.gear[slot]];
        let best = null;
        for (const id of s.bag) { const it = s.items[id]; if (it.slot === slot && (!best || itemScore(it) > itemScore(best))) best = it; }
        if (best && (!cur || itemScore(best) > itemScore(cur))) { equip(s, h.id, best.id); changed++; }
      }
    }
    return changed;
  }
  // 離線收益：以掛機副本模擬
  function offlineProgress(s, now = Date.now()) {
    if (s.idle == null || !s.clears[s.idle]) { s.lastSeen = now; return null; }
    const sec = Math.min(OFFLINE_CAP_H * 3600, Math.max(0, (now - s.lastSeen) / 1000));
    s.lastSeen = now;
    if (sec < 60) return null;
    const party = partyHeroes(s); if (!party.length) return null;
    let t = 0, runs = 0, wins = 0, gold = 0, items = 0, lv = 0;
    while (runs < 400) {
      const b = new Battle(partyHeroes(s), s.items, s.idle).runToEnd();
      t += b.tick + 5; if (t > sec) break;
      const r = applyResult(s, s.idle, b);
      runs++; if (b.win) wins++; gold += r.gold; items += r.kept.length; lv += r.lvUps.length;
    }
    return { sec: Math.round(sec), runs, wins, gold, items, lv };
  }

  return { CLASSES, ROLE_NAME, RARITY, SLOTS, DUNGEONS, dungeonInfo, buildWaves, Battle, makeHero, makeItem, heroStats, heroIlvl, heroPower,
    xpNeed, MAX_LV, gainXp, rewards, newGame, rollTavern, partyHeroes, applyResult, equip, unequip, salvage, upgrade, upgradeCost,
    salvageValue, itemPow, itemSta, itemScore, autoEquip, offlineProgress, hireCost, REFRESH_COST, PARTY_MAX, ROSTER_MAX, BAG_MAX, MAX_UP,
    OFFLINE_CAP_H, MAX_TICKS };
})();
if (typeof module !== 'undefined') module.exports = RAID;
