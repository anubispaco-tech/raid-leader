// ===== 技能、專精、天賦（資料定義）=====
// 天賦只用「修正值 mods」描述效果，戰鬥邏輯在 battle.js 讀取。改數字只需改這個檔。

// ---------- 基礎技能（Lv1）----------
export const BASE_SKILLS = {
  guardian: { name: '盾牌猛擊', cd: 8, mult: 2.5, weaken: 0.3, weakenDur: 4, desc: '冷卻 8 秒：威力 ×2.5 傷害，目標攻擊 −30% 持續 4 秒' },
  cleric:   { name: '真言術：盾', cd: 10, mult: 4, desc: '冷卻 10 秒：給血量最低的隊友護盾（威力 ×4）' },
  rogue:    { name: '剔骨', cd: 6, mult: 3.5, desc: '冷卻 6 秒：對首領造成威力 ×3.5' },
  mage:     { name: '烈焰風暴', cd: 9, mult: 2, desc: '冷卻 9 秒：全體敵人威力 ×2' },
};

// ---------- 專精（Lv10 選擇）----------
export const SPEC_LEVEL = 10;
export const SPECS = {
  guardian: {
    prot: { name: '防護', skill: '聖盾術', counters: 'buster', desc: '生命低於 30% 時自動 5 秒無敵，每場一次', below: 0.3, dur: 5 },
    ret:  { name: '懲戒', skill: '復仇之怒', counters: 'enrage', desc: '冷卻 20 秒：10 秒內傷害 +50%、吸血 20%', cd: 20, dur: 10, dmg: 0.5, leech: 0.2 },
  },
  cleric: {
    disc: { name: '戒律', skill: '痛苦鎮壓', counters: 'buster', desc: '冷卻 15 秒：坦克受到重擊時，該次傷害 −60%', cd: 15, reduce: 0.6 },
    holy: { name: '神聖', skill: '神聖讚美詩', counters: 'pulse', desc: '冷卻 30 秒：全隊平均血量低於 60% 時，連續 3 秒群補（威力 ×1.2）', cd: 30, dur: 3, mult: 1.2, below: 0.6 },
  },
  rogue: {
    assa:   { name: '刺殺', skill: '致命毒藥', counters: 'enrage', desc: '每次攻擊疊 1 層毒，每層每秒威力 ×0.4，最多 3 層', perStack: 0.4, maxStacks: 3 },
    combat: { name: '戰鬥', skill: '劍刃亂舞', counters: 'summon', desc: '冷卻 15 秒：8 秒內每次攻擊額外打中 2 個目標', cd: 15, dur: 8, extra: 2 },
  },
  mage: {
    fire:  { name: '火焰', skill: '燃燒', counters: 'enrage', desc: '冷卻 30 秒：10 秒內暴擊率 +40%', cd: 30, dur: 10, crit: 0.4 },
    frost: { name: '冰霜', skill: '冰霜新星', counters: 'summon', desc: '冷卻 18 秒：全體敵人攻擊 −40% 持續 4 秒', cd: 18, dur: 4, weaken: 0.4 },
  },
};

// ---------- 天賦列（每列二選一）----------
// mods 欄位：hpMult powMult critAdd critDmg healMult dmgMult cdMult(基礎技能) …（battle.js 讀取）
export const TALENT_ROWS = [5, 15, 20, 25, 30];
const SPEC_ROW = { // Lv25 四職業共用
  a: { name: '專精精通', desc: '專精技能冷卻 −30%', mods: { specCd: 0.7 } },
  b: { name: '專精強化', desc: '專精技能效果 +30%', mods: { specFx: 1.3 } },
};
export const TALENTS = {
  guardian: [
    { a: { name: '堅韌', desc: '生命 +10%', mods: { hpMult: 1.1 } },
      b: { name: '銳利盾牌', desc: '盾牌猛擊傷害 +50%', mods: { baseMult: 1.5 } } },
    { a: { name: '格擋', desc: '受到重擊的傷害 −25%', mods: { busterReduce: 0.25 } },
      b: { name: '魔抗', desc: '受到範圍攻擊的傷害 −30%', mods: { aoeReduce: 0.3 } } },
    { a: { name: '鼓舞', desc: '全隊生命 +5%', mods: { partyHp: 0.05 } },
      b: { name: '反擊', desc: '受擊時 15% 機率反擊威力 ×1', mods: { counter: 0.15 } } },
    SPEC_ROW,
    { a: { name: '盾牆', desc: '生命低於 50% 時再減傷 15%', mods: { lowHpReduce: 0.15 } },
      b: { name: '正義之錘', desc: '傷害 +20%', mods: { dmgMult: 1.2 } } },
  ],
  cleric: [
    { a: { name: '冥想', desc: '治療 +10%', mods: { healMult: 1.1 } },
      b: { name: '迅捷禱言', desc: '群補間隔 5 → 4 秒', mods: { groupEvery: 4 } } },
    { a: { name: '堅定護盾', desc: '護盾 +40%', mods: { baseMult: 1.4 } },
      b: { name: '恢復', desc: '單體治療後再持續回血 3 秒', mods: { renew: 0.3 } } },
    { a: { name: '救贖', desc: '第一位陣亡的隊友以 50% 生命復活，每場一次', mods: { redemption: 0.5 } },
      b: { name: '聖光之怒', desc: '沒人需要治療時，攻擊傷害 ×3', mods: { smite: 3 } } },
    SPEC_ROW,
    { a: { name: '守護天使', desc: '全隊受到的範圍傷害 −10%', mods: { partyAoe: 0.1 } },
      b: { name: '慈悲', desc: '暴擊率 +10%', mods: { critAdd: 0.1 } } },
  ],
  rogue: [
    { a: { name: '精準', desc: '暴擊率 +5%', mods: { critAdd: 0.05 } },
      b: { name: '致命', desc: '暴擊傷害 ×2 → ×2.5', mods: { critDmg: 2.5 } } },
    { a: { name: '閃避', desc: '受到攻擊時 20% 機率閃過', mods: { dodge: 0.2 } },
      b: { name: '割裂', desc: '剔骨額外造成流血（5 秒，每秒威力 ×0.5）', mods: { bleed: 0.5 } } },
    { a: { name: '處決', desc: '目標生命低於 35% 時傷害 +30%', mods: { execute: 0.3 } },
      b: { name: '清掃', desc: '對小怪傷害 +25%', mods: { sweep: 0.25 } } },
    SPEC_ROW,
    { a: { name: '暗影之舞', desc: '剔骨冷卻 6 → 4 秒', mods: { baseCd: 4 } },
      b: { name: '冷血', desc: '每波第一次攻擊必定暴擊', mods: { coldBlood: 1 } } },
  ],
  mage: [
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
};

// ---------- 英雄的天賦狀態 ----------
export const unlockedRows = h => TALENT_ROWS.filter(lv => h.level >= lv);
export const canPickSpec = h => h.level >= SPEC_LEVEL;
// 還沒選的天賦列數＋專精（用於紅點提示）
export function pendingPicks(h) {
  const t = h.talents || {};
  return unlockedRows(h).filter(lv => !t[lv]).length + (canPickSpec(h) && !h.spec ? 1 : 0);
}
// 把已選天賦合併成一個修正值物件
export function heroMods(h) {
  const m = {}, t = h.talents || {};
  TALENTS[h.cls].forEach((row, i) => {
    const lv = TALENT_ROWS[i], pick = h.level >= lv && t[lv];
    if (pick && row[pick]) Object.assign(m, row[pick].mods);
  });
  return m;
}
export function setSpec(h, spec) { if (canPickSpec(h) && SPECS[h.cls][spec]) h.spec = spec; }
export function setTalent(h, lv, pick) {
  if (!TALENT_ROWS.includes(lv) || h.level < lv || !['a', 'b'].includes(pick)) return;
  h.talents = { ...(h.talents || {}), [lv]: pick };
}

// ---------- 推薦配置（依副本機制）----------
// 每個專精對應一種首領機制；天賦依機制挑防禦或輸出。模擬工具與「推薦」按鈕共用。
export function recommend(cls, mechTypes) {
  const has = t => mechTypes.includes(t);
  const R = {
    guardian: () => ({ spec: has('buster') ? 'prot' : 'ret', t: ['a', has('buster') ? 'a' : 'b', 'a', 'b', has('enrage') ? 'b' : 'a'] }),
    cleric:   () => ({ spec: has('buster') && !has('pulse') ? 'disc' : 'holy', t: ['a', 'a', 'a', 'b', has('pulse') ? 'a' : 'b'] }),
    rogue:    () => ({ spec: has('summon') ? 'combat' : 'assa', t: ['b', 'b', has('summon') ? 'b' : 'a', 'b', 'a'] }),
    mage:     () => ({ spec: has('summon') ? 'frost' : 'fire', t: ['a', 'b', has('summon') ? 'a' : 'b', 'b', 'a'] }),
  };
  return R[cls]();
}
export function applyRecommend(h, mechTypes) {
  const r = recommend(h.cls, mechTypes);
  if (canPickSpec(h)) h.spec = r.spec;
  const t = {};
  TALENT_ROWS.forEach((lv, i) => { if (h.level >= lv) t[lv] = r.t[i]; });
  h.talents = t;
}
