// ===== 數值與內容設定 =====
// 調平衡只改這個檔：改完跑 `node tools/sim.js 10` 看首通場次。

// ---------- 職業 ----------
// hp/pow = Lv1 數值；hpL/powL = 每級成長；armor = 物理減傷
export const CLASSES = {
  guardian: { name: '守護騎士', role: 'tank', icon: '🛡️', hp: 230, hpL: 42, pow: 6, powL: 1.5, armor: 0.45, crit: 0.05,
    desc: '嘲諷所有敵人，承受傷害。護甲減傷 45%。' },
  cleric:   { name: '聖光牧師', role: 'heal', icon: '✨', hp: 130, hpL: 22, pow: 9, powL: 2.0, armor: 0.15, crit: 0.05,
    desc: '治療血量最低的隊友，每 5 秒群體治療。' },
  rogue:    { name: '暗影盜賊', role: 'dps',  icon: '🗡️', hp: 140, hpL: 24, pow: 10, powL: 2.3, armor: 0.2, crit: 0.15,
    desc: '單體爆發，暴擊率高。擅長打王。' },
  mage:     { name: '奧術法師', role: 'dps',  icon: '🔥', hp: 115, hpL: 19, pow: 9, powL: 2.1, armor: 0.1, crit: 0.08,
    desc: '範圍傷害，同時攻擊所有敵人。擅長清小怪。' },
};
export const ROLE_NAME = { tank: '坦克', heal: '治療', dps: '輸出' };

// 職業戰鬥係數（傷害 / 治療 = 威力 × 係數）
export const CLASS_AI = {
  tank:  { hit: 0.8 },
  heal:  { single: 1.9, critMult: 1.5, groupEvery: 5, group: 0.75, groupBelow: 0.9, idleHit: 0.5 },
  rogue: { hit: 1.3 },
  mage:  { aoe: 0.72, single: 1.0 },
};

// ---------- 英雄 ----------
export const HERO = {
  maxLevel: 40,
  xpBase: 60, xpExp: 1.8,          // 升級所需經驗 = xpBase × 等級^xpExp
  names: ['艾倫', '凱莉', '雷恩', '米拉', '索恩', '伊薇', '巴頓', '妮雅', '托爾', '菲歐', '達克', '露娜',
    '葛雷', '希拉', '奧德', '薇絲', '布蘭', '卡珊', '洛克', '艾琳', '費恩', '茉兒', '賽勒', '朵拉'],
  starters: ['guardian', 'cleric', 'rogue'],
};

// ---------- 裝備 ----------
export const RARITY = [
  { name: '普通', mult: 1.0,  color: '#9ca3af', weight: 0.55 },
  { name: '精良', mult: 1.2,  color: '#22c55e', weight: 0.30 },
  { name: '稀有', mult: 1.45, color: '#3b82f6', weight: 0.12 },
  { name: '史詩', mult: 1.75, color: '#a855f7', weight: 0.03 },
];
export const SLOTS = { weapon: '武器', armor: '護甲', trinket: '飾品' };
// 各部位屬性分配（× 裝等 × 稀有度倍率）
export const SLOT_STATS = {
  weapon:  { pow: 0.6,  sta: 1.0 },
  armor:   { pow: 0.15, sta: 3.0 },
  trinket: { pow: 0.35, sta: 1.0 },
};
export const SLOT_NAMES = {
  weapon: ['長劍', '法杖', '匕首', '戰錘', '權杖', '短弓'],
  armor: ['鎖甲', '法袍', '皮甲', '板甲', '斗篷'],
  trinket: ['護符', '戒指', '徽記', '寶珠', '項鍊'],
};
export const PREFIX = ['', '堅毅的', '銳利的', '灼熱的', '寒霜的', '虛空的', '遠古的', '龍鱗的'];
export const GEAR = {
  maxUp: 5, upBonus: 0.08,          // 每級強化屬性 +8%
  upCostBase: 15,                   // 強化費用 = base × (等級+1) × (1 + 裝等/10)
  salvageMult: 1.5,                 // 分解金幣 = 裝等 × 稀有度倍率 × salvageMult
  staToHp: 2,                       // 1 耐力 = 2 生命
};

// ---------- 副本 ----------
// 每隻王考驗一個職責：脈衝=治療、重擊=坦克、召喚=範圍、狂暴=輸出
export const DUNGEONS = [
  { name: '腐根洞窟', boss: '蘑菇領主', trash: '孢子菇', mech: [{ t: 'pulse', every: 7, dmg: 0.9 }], tip: '定期噴發孢子傷害全隊 → 考驗治療' },
  { name: '鏽蝕礦坑', boss: '礦坑巨像', trash: '礦坑狗頭人', mech: [{ t: 'buster', every: 8, mult: 3.2 }], tip: '重擊坦克 → 考驗坦克血量與護甲' },
  { name: '沉沒神殿', boss: '潮汐祭司', trash: '深淵魚人', mech: [{ t: 'summon', every: 10, n: 2 }], tip: '不斷召喚小怪 → 考驗範圍輸出' },
  { name: '灰燼要塞', boss: '熔火督軍', trash: '熔岩衛兵', mech: [{ t: 'enrage', at: 55, mult: 3 }], tip: '55 秒後狂暴 → 考驗輸出' },
  { name: '霜語墓穴', boss: '寒霜巫妖', trash: '骷髏戰士', mech: [{ t: 'pulse', every: 6, dmg: 1.0 }, { t: 'summon', every: 12, n: 2 }], tip: '寒冰脈衝＋召喚骷髏 → 治療與範圍' },
  { name: '虛空裂隙', boss: '虛空吞噬者', trash: '虛空行者', mech: [{ t: 'buster', every: 7, mult: 3.5 }, { t: 'enrage', at: 60, mult: 3 }], tip: '重擊＋狂暴 → 坦克與輸出' },
  { name: '龍眠高塔', boss: '遠古紅龍', trash: '龍人衛士', mech: [{ t: 'pulse', every: 7, dmg: 1.0 }, { t: 'buster', every: 9, mult: 3.2 }, { t: 'enrage', at: 70, mult: 3 }], tip: '全機制 → 全隊綜合考驗' },
];
export const DUNGEON = {
  hpGrowth: 1.9, atkGrowth: 1.7,    // 每層敵人生命 / 攻擊倍率
  difficulty: [1, 1.1, 1, 1.4, 1, 1.35, 1], // 個別層加難
  recLevel: [1, 2, 4, 6, 10, 13, 17],       // 建議等級（模擬首通時的等級）
  dropBase: 6, dropGrowth: 1.5,     // 掉落裝等 = base × growth^層
  trash: { count: 3, hp: 85, atk: 6.5 },
  boss: { hp: 850, atk: 13, addHp: 70, addAtk: 5 },
  maxTicks: 240,                    // 超過即失敗（秒）
  waveHeal: 0.5,                    // 波與波之間回血比例
};

// ---------- 獎勵與經濟 ----------
export const REWARD = {
  goldBase: 25, goldPerTier: 18,
  xpBase: 35, xpExp: 1.7,
  loseMult: 0.3,                    // 失敗時金幣經驗比例
  doubleDropChance: 0.35,
  firstClearMinRarity: 2,           // 首通保底稀有
  decayGrace: 4, decayPerLevel: 0.25, decayFloor: 0.05, // 等級壓制
};
export const ECONOMY = {
  startGold: 60,
  hireBase: 30, hirePerLevel: 25,
  refreshCost: 10,
  partyMax: 5, rosterMax: 10, bagMax: 50,
  stashMax: 100,                    // 戰利品箱：背包滿時暫存，需手動取出
  defaultKeepRarity: 2,             // 背包滿後只保留此品質以上（2 = 稀有）
  offlineCapHours: 8,
};
