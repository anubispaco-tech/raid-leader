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
  paragon: { need: 20000, growth: 0.1, bonus: 0.01 }, // 巔峰：Lv40 後經驗轉巔峰點；第 p 級需 need×(1+growth×p)，每級生命／威力 +1%
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
  { name: '傳說', mult: 2.1,  color: '#f59e0b', weight: 0 },    // 只從傳奇秘境 +7 起掉落
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
  maxUp: 10, upBonus: 0.08,         // 每級強化屬性 +8%（+6 以上為精煉）
  refineFrom: 5, dustPerStep: 5,    // 精煉：+5 → +6 要 5 精華，之後每級多 5（+6→+7 要 10…）
  salvageDust: [0, 1, 2, 4, 10],    // 分解得到的精華（依品質）
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
  hpGrowth: 2.15, atkGrowth: 1.82,  // 每層敵人生命 / 攻擊倍率（v0.3 天賦上線後調高）
  difficulty: [1, 1.1, 1, 1.4, 1, 1.35, 1], // 個別層加難
  recLevel: [1, 2, 3, 5, 10, 14, 19],       // 建議等級（v0.3 模擬首通時的等級）
  dropBase: 6, dropGrowth: 1.5,     // 掉落裝等 = base × growth^層
  trash: { count: 3, hp: 85, atk: 6.5 },
  boss: { hp: 850, atk: 13, addHp: 70, addAtk: 5 },
  maxTicks: 240,                    // 超過即失敗（秒）
  waveHeal: 0.5,                    // 波與波之間回血比例
};

// ---------- 傳奇秘境 ----------
export const MYTHIC = {
  unlockAfter: 6,                   // 通關第 7 層（index 6）後解鎖
  startKey: 2,
  hpGrowth: 1.10, atkGrowth: 1.08,  // 每 +1 敵人生命 / 攻擊倍率（以第 7 層為基準）
  timer: [150, 150, 160, 150, 160, 165, 170], // 各副本限時（秒）
  overtime: 120,                    // 超過限時再撐這麼久仍打不完 → 失敗
  bonusAt: 0.8,                     // 用不到 80% 時間 → 鑰石 +2
  affixAt: [2, 5, 8],               // 第 1、2、3 個詞綴生效的等級
  dropBase: 68, dropPerLevel: 3,    // 掉落裝等 = base + 每級 × 等級
  legendFrom: 7, legendBase: 0.03, legendPerLevel: 0.01, legendMax: 0.15,
  goldMult: 1.5, xpMult: 1.2,       // 相對第 7 層的獎勵
  idleBelow: 2, idleMult: 0.7,      // 秘境掛機：打「限時最高 −2」，金幣經驗 7 折、每場 1 件，鑰石不變
};

// ---------- 英雄稀有度（v0.7）----------
// mult 乘在職業基礎＋等級成長（不含裝備）；weight = 招募機率；hire = 僱用價倍率
export const HERO_RARITY = [
  { name: '普通', mult: 1.00, crit: 0,    weight: 0.55,  hire: 1 },
  { name: '精良', mult: 1.08, crit: 0,    weight: 0.28,  hire: 1.5 },
  { name: '稀有', mult: 1.16, crit: 0.02, weight: 0.12,  hire: 2.5 },
  { name: '史詩', mult: 1.25, crit: 0.04, weight: 0.045, hire: 4, baseCdMult: 0.9 },
  { name: '傳說', mult: 1.40, crit: 0.04, weight: 0.005, hire: 8, baseCdMult: 0.9 },
];
// 每個職業唯一的傳奇英雄（名字與被動皆為原創）
export const LEGENDS = {
  guardian: { name: '巴洛斯', title: '鐵壁', passive: 'undying', pname: '不屈', desc: '每場第一次受到致命傷害改為剩 1 血並無敵 3 秒；在場時全隊受到的傷害 −8%' },
  cleric:   { name: '艾蕾娜', title: '晨曦', passive: 'overflow', pname: '溢光', desc: '治療超出的部分轉為護盾（上限是該隊員生命的 20%）' },
  rogue:    { name: '卡西恩', title: '影刃', passive: 'chain', pname: '連鎖暴擊', desc: '暴擊後的下一次攻擊必定暴擊，每 6 秒最多一次' },
  mage:     { name: '莉薇亞', title: '星火', passive: 'molten', pname: '熔熱', desc: '烈焰風暴冷卻 −50%，擊殺敵人時再減 1 秒' },
};
export const RECRUIT = {
  scrollBase: 120, scrollPerLevel: 30, // 招募令單抽價格 = base + 每級 × 隊伍平均等級
  tenDiscount: 0.9,
  pityEpic: 50, pityLegend: 100,      // 連續 N 抽沒出 → 下一抽保底
  fireRefund: 0.2,
};

// ---------- 寶庫（v0.7）----------
export const VAULT = {
  unlockAfter: 2,                     // 通關第 3 層（index 2）後解鎖
  daily: 3, dur: 60,                  // 每天次數、每場秒數
  strength: 0.7,                      // 敵人強度 = 該層一般小怪 × 0.7
  waveGrowth: 0.12,                   // 每一波哥布林生命 +12%
  goblinAtk: 0.25,                    // 哥布林攻擊 = 一般小怪 × 0.25
  par: [20, 14, 19, 12, 22, 15, 15],  // 各層「剛通關的隊伍」60 秒擊殺數（模擬實測）
  parRuns: 10,                        // 打到 par 隻 ≈ 該層一般掛機 10 場的金幣
  capMult: 1.2,                       // 金幣最多算到 par × 1.2 隻（讓「打自己最高層」最划算）
  xpMult: 0.2,                        // 經驗 = 該層一般一場 × 0.2
};

// ---------- 背包擴充：每達成一項 +5 格 ----------
// test(s) 回傳是否達成；best = 秘境任一副本的最高限時等級
export const BAG_MILESTONES = [
  { id: 'clear3', name: '首次通關第 3 層', test: s => !!s.clears[2] },
  { id: 'clear5', name: '首次通關第 5 層', test: s => !!s.clears[4] },
  { id: 'clear7', name: '首次通關第 7 層', test: s => !!s.clears[6] },
  { id: 'mythic5', name: '秘境 +5 限時通關', test: s => mythicBestLevel(s) >= 5 },
  { id: 'mythic10', name: '秘境 +10 限時通關', test: s => mythicBestLevel(s) >= 10 },
  { id: 'mythic15', name: '秘境 +15 限時通關', test: s => mythicBestLevel(s) >= 15 },
  { id: 'vault10', name: '寶庫累計 10 次', test: s => ((s.vault && s.vault.runs) || 0) >= 10 },
  { id: 'vault30', name: '寶庫累計 30 次', test: s => ((s.vault && s.vault.runs) || 0) >= 30 },
  { id: 'vault60', name: '寶庫累計 60 次', test: s => ((s.vault && s.vault.runs) || 0) >= 60 },
];
export const BAG_PER_MILESTONE = 5;
export const mythicBestLevel = s => Math.max(0, ...Object.values((s.mythic && s.mythic.best) || {}).map(b => b.level));

// ---------- 遊玩數據與排行榜（GAS 網頁應用程式；留空就完全不連線）----------
export const TELEMETRY = {
  url: 'https://script.google.com/macros/s/AKfycbwytKL7OhbuCd2WavlIopA49-vLdfLZXGQFPoUdnpmigJEWq3B4zuvSdoZqHX47Hhk0mg/exec',
  snapshotMin: 5,                   // 每玩幾分鐘送一次進度
  leaderboardSec: 60,               // 排行榜重新讀取間隔
};

// ---------- 團長指令 ----------
export const RAID_HORN = { name: '英勇號角', dur: 15, bonus: 0.3 }; // 每場一次，全隊傷害與治療 +30%

// ---------- 獎勵與經濟 ----------
export const REWARD = {
  goldBase: 25, goldPerTier: 18,
  xpBase: 35, xpExp: 1.7,
  loseMult: 0.3,                    // 失敗時金幣經驗比例
  doubleDropChance: 0.35,
  firstClearMinRarity: 2,           // 首通保底稀有
  decayGrace: 4, decayPerLevel: 0.25, decayFloor: 0.05, // 等級壓制
  decayFloorTop: 0.4,               // 最高層（第 7 層）壓制下限：後期仍可掛機
};
export const ECONOMY = {
  startGold: 60,
  hireBase: 30, hirePerLevel: 25,
  refreshCost: 10,
  partyMax: 5, rosterMax: 30, bagMax: 50, // bagMax = 起始格數，達成里程碑再擴充（見 BAG_MILESTONES）
  stashMax: 100,                    // 戰利品箱：背包滿時暫存，需手動取出
  defaultKeepRarity: 2,             // 背包滿後只保留此品質以上（2 = 稀有）
  offlineCapHours: 8,
};

// 樓層編號（羅馬數字，配合西方奇幻風格；第二章接著用 VIII 起）
export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV'];
