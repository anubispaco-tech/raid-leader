// ===== 數值與內容設定 =====
// 職業數值在 classes/ 的職業包；其餘平衡改這個檔。改完跑 `node tools/sim.js 10` 看首通場次。

// ---------- 職業 ----------
// 職業資料都在 classes/ 資料夾的職業包裡；這裡只是方便其他模組沿用舊名稱
import { tx } from './i18n.js';
import { PACKS } from './classes/index.js';
export const CLASSES = PACKS;
export const ROLE_NAME = { tank: tx('坦克'), heal: tx('治療'), dps: tx('輸出') };


// ---------- 英雄 ----------
export const HERO = {
  maxLevel: 60, // v0.9.1：第二章完整開放 → 60
  paragon: { need: 20000, growth: 0.1, bonus: 0.01 }, // 巔峰：Lv40 後經驗轉巔峰點；第 p 級需 need×(1+growth×p)，每級生命／威力 +1%
  xpBase: 60, xpExp: 1.8,          // 升級所需經驗 = xpBase × 等級^xpExp
  // 名字＋稱號組合（24 × 20 = 480 種），招募時避開名冊與酒館裡已有的名字
  titles: [tx('鐵拳'), tx('銀羽'), tx('灰鬣'), tx('寒星'), tx('赤炎'), tx('夜歌'), tx('石心'), tx('疾風'), tx('晨露'), tx('暗步'),
    tx('橡盾'), tx('雷鳴'), tx('星塵'), tx('霧行'), tx('炭火'), tx('冰牙'), tx('白楊'), tx('荊棘'), tx('長歌'), tx('黑羽')],
  names: [tx('艾倫'), tx('凱莉'), tx('雷恩'), tx('米拉'), tx('索恩'), tx('伊薇'), tx('巴頓'), tx('妮雅'), tx('托爾'), tx('菲歐'), tx('達克'), tx('露娜'),
    tx('葛雷'), tx('希拉'), tx('奧德'), tx('薇絲'), tx('布蘭'), tx('卡珊'), tx('洛克'), tx('艾琳'), tx('費恩'), tx('茉兒'), tx('賽勒'), tx('朵拉')],
  starters: ['guardian', 'cleric', 'rogue'],
};

// ---------- 裝備 ----------
export const RARITY = [
  { name: tx('普通'), mult: 1.0,  color: '#9ca3af', weight: 0.55 },
  { name: tx('精良'), mult: 1.2,  color: '#22c55e', weight: 0.30 },
  { name: tx('稀有'), mult: 1.45, color: '#3b82f6', weight: 0.12 },
  { name: tx('史詩'), mult: 1.75, color: '#a855f7', weight: 0.03 },
  { name: tx('傳說'), mult: 2.1,  color: '#f59e0b', weight: 0 },    // 只從傳奇秘境 +7 起掉落
];
export const SLOTS = { weapon: tx('武器'), armor: tx('護甲'), trinket: tx('飾品') };
// 各部位屬性分配（× 裝等 × 稀有度倍率）
export const SLOT_STATS = {
  weapon:  { pow: 0.6,  sta: 1.0 },
  armor:   { pow: 0.15, sta: 3.0 },
  trinket: { pow: 0.35, sta: 1.0 },
};
export const SLOT_NAMES = {
  weapon: [tx('長劍'), tx('法杖'), tx('匕首'), tx('戰錘'), tx('權杖'), tx('短弓')],
  armor: [tx('鎖甲'), tx('法袍'), tx('皮甲'), tx('板甲'), tx('斗篷')],
  trinket: [tx('護符'), tx('戒指'), tx('徽記'), tx('寶珠'), tx('項鍊')],
};
export const PREFIX = ['', tx('堅毅的'), tx('銳利的'), tx('灼熱的'), tx('寒霜的'), tx('虛空的'), tx('遠古的'), tx('龍鱗的')];
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
  { name: tx('腐根洞窟'), boss: tx('蘑菇領主'), trash: tx('孢子菇'), mech: [{ t: 'pulse', every: 7, dmg: 0.9 }], tip: tx('定期噴發孢子傷害全隊 → 考驗治療') },
  { name: tx('鏽蝕礦坑'), boss: tx('礦坑巨像'), trash: tx('礦坑狗頭人'), mech: [{ t: 'buster', every: 8, mult: 3.2 }], tip: tx('重擊坦克 → 考驗坦克血量與護甲') },
  { name: tx('沉沒神殿'), boss: tx('潮汐祭司'), trash: tx('深淵魚人'), mech: [{ t: 'summon', every: 10, n: 2 }], tip: tx('不斷召喚小怪 → 考驗範圍輸出') },
  { name: tx('灰燼要塞'), boss: tx('熔火督軍'), trash: tx('熔岩衛兵'), mech: [{ t: 'enrage', at: 55, mult: 3 }], tip: tx('55 秒後狂暴 → 考驗輸出') },
  { name: tx('霜語墓穴'), boss: tx('寒霜巫妖'), trash: tx('骷髏戰士'), mech: [{ t: 'pulse', every: 6, dmg: 1.0 }, { t: 'summon', every: 12, n: 2 }], tip: tx('寒冰脈衝＋召喚骷髏 → 治療與範圍') },
  { name: tx('虛空裂隙'), boss: tx('虛空吞噬者'), trash: tx('虛空行者'), mech: [{ t: 'buster', every: 7, mult: 3.5 }, { t: 'enrage', at: 60, mult: 3 }], tip: tx('重擊＋狂暴 → 坦克與輸出') },
  { name: tx('龍眠高塔'), boss: tx('遠古紅龍'), trash: tx('龍人衛士'), mech: [{ t: 'pulse', every: 7, dmg: 1.0 }, { t: 'buster', every: 9, mult: 3.2 }, { t: 'enrage', at: 70, mult: 3 }], tip: tx('全機制 → 全隊綜合考驗') },
  // ---- 第二章：深淵裂谷（v0.9.0：VIII~X）----
  { name: tx('塔底斷層'), boss: tx('石鱗守衛'), trash: tx('裂谷爬行者'), mech: [{ t: 'buster', every: 8, mult: 3.2 }, { t: 'curse', every: 9, pct: 0.04, dur: 8 }], tip: tx('重擊＋詛咒 → 坦克與治療（治療會自動淨化詛咒）') },
  { name: tx('迴聲礦脈'), boss: tx('魂鑄匠'), trash: tx('魂鑄傀儡'), mech: [{ t: 'summon', every: 11, n: 2 }, { t: 'cast', every: 14, time: 3, mult: 2.2 }], tip: tx('召喚＋讀條 → 範圍輸出與打斷（守護騎士、盜賊、熊／豹德魯伊會打斷）') },
  { name: tx('燼心祭壇'), boss: tx('裂谷祭司'), trash: tx('裂谷信徒'), mech: [{ t: 'pulse', every: 7, dmg: 0.9 }, { t: 'shield', every: 20, pct: 0.08, window: 10, heal: 0.1 }], tip: tx('脈衝＋護盾 → 治療與爆發（10 秒內打破護盾，否則首領回血）') },
  // ---- 第二章後半（v0.9.1：XI~XIV）----
  { name: tx('雙月王座'), boss: tx('雙子先知'), trash: tx('月影侍從'), mech: [],
    twin: [{ name: tx('日之先知'), mech: [{ t: 'buster', every: 8, mult: 3.0 }, { t: 'bond', mult: 1.5 }] },
           { name: tx('月之先知'), mech: [{ t: 'pulse', every: 7, dmg: 0.8 }, { t: 'bond', mult: 1.5 }] }],
    tip: tx('雙首領 → 帶兩個坦克各扛一隻；一隻先倒，另一隻會悲憤變強，血量要一起壓') },
  { name: tx('寒淵冰窟'), boss: tx('冰晶女皇'), trash: tx('霜縛戰士'), mech: [{ t: 'curse', every: 8, pct: 0.045, dur: 8 }, { t: 'enrage', at: 75, mult: 3 }], tip: tx('詛咒＋狂暴 → 治療淨化與輸出') },
  { name: tx('虛影迴廊'), boss: tx('虛空守門人'), trash: tx('虛影潛伏者'), mech: [{ t: 'cast', every: 13, time: 3, mult: 2.4 }, { t: 'phase', at: 0.5, atk: 1.4 }], tip: tx('讀條＋轉階段 → 打斷；血量低於 50% 後攻擊大增，號角留到後半') },
  { name: tx('深淵之心'), boss: tx('裂谷之主・莫瑞斯'), trash: tx('深淵化身'), mech: [{ t: 'curse', every: 10, pct: 0.04, dur: 8 }, { t: 'shield', every: 22, pct: 0.06, window: 10, heal: 0.1 }, { t: 'phase', at: 0.5, atk: 1.4 }], tip: tx('詛咒＋護盾＋轉階段 → 全隊綜合考驗') },
];
// 章節：floors = [第一層 index, 最後一層 index]
export const CHAPTERS = [
  { name: tx('第一章'), sub: tx('龍眠之路'), floors: [0, 6] },
  { name: tx('第二章'), sub: tx('深淵裂谷'), floors: [7, 13] },
];
export const CH1_TOP = 6; // 第一章最後一層（秘境、寶庫目前以第一章為範圍）
export const DUNGEON = {
  hpGrowth: 2.15, atkGrowth: 1.82,  // 每層敵人生命 / 攻擊倍率（v0.3 天賦上線後調高）
  difficulty: [1, 1.1, 1, 1.4, 1, 1.35, 1, 1, 1, 1, 1, 1, 1, 1], // 個別層加難
  recLevel: [1, 2, 3, 5, 10, 14, 19, 25, 30, 35, 40, 45, 50, 55],       // 建議等級（第一章為 v0.3 模擬首通時的等級）
  // 第二章：相對第 7 層的生命／攻擊倍率（逐層列出，方便調；避免第一章 ×2.15 的成長讓數字爆掉）
  ch2: { hp: [3.2, 2.8, 4.0, 5.0, 5.4, 8.5, 8.0], atk: [1.6, 1.45, 1.75, 1.9, 2.0, 2.6, 2.6], dropGrowth: 1.12 },
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
  { name: tx('普通'), mult: 1.00, crit: 0,    weight: 0.55,  hire: 1 },
  { name: tx('精良'), mult: 1.08, crit: 0,    weight: 0.28,  hire: 1.5 },
  { name: tx('稀有'), mult: 1.16, crit: 0.02, weight: 0.12,  hire: 2.5 },
  { name: tx('史詩'), mult: 1.25, crit: 0.04, weight: 0.045, hire: 4, baseCdMult: 0.9 },
  { name: tx('傳說'), mult: 1.40, crit: 0.04, weight: 0.005, hire: 8, baseCdMult: 0.9 },
];
// 每個職業唯一的傳奇英雄（名字與被動在各職業包的 legend）
export const LEGENDS = Object.fromEntries(Object.entries(PACKS).map(([k, p]) => [k, p.legend]));
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
  { id: 'clear3', name: tx('首次通關第 3 層'), test: s => !!s.clears[2] },
  { id: 'clear5', name: tx('首次通關第 5 層'), test: s => !!s.clears[4] },
  { id: 'clear7', name: tx('首次通關第 7 層'), test: s => !!s.clears[6] },
  { id: 'mythic5', name: tx('秘境 +5 限時通關'), test: s => mythicBestLevel(s) >= 5 },
  { id: 'mythic10', name: tx('秘境 +10 限時通關'), test: s => mythicBestLevel(s) >= 10 },
  { id: 'mythic15', name: tx('秘境 +15 限時通關'), test: s => mythicBestLevel(s) >= 15 },
  { id: 'vault10', name: tx('寶庫累計 10 次'), test: s => ((s.vault && s.vault.runs) || 0) >= 10 },
  { id: 'vault30', name: tx('寶庫累計 30 次'), test: s => ((s.vault && s.vault.runs) || 0) >= 30 },
  { id: 'vault60', name: tx('寶庫累計 60 次'), test: s => ((s.vault && s.vault.runs) || 0) >= 60 },
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
export const RAID_HORN = { name: tx('英勇號角'), dur: 15, bonus: 0.3 }; // 每場一次，全隊傷害與治療 +30%

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
