// ===== 成就（v0.12）：WOW 式成就頁與成就點數 =====
// 每個成就：分類、名稱、說明、點數、進度 prog(s) → [目前, 目標]。達成後記在 s.ach.done[id] = 時間（之後不會被取消）
// 背包里程碑（BAG_MILESTONES）也列在這裡，顯示「獎勵：背包 +5 格」
import { tx } from './i18n.js';
import { BAG_MILESTONES, BAG_PER_MILESTONE, mythicBestLevel, DUNGEONS, CLASSES, HERO, GEAR, ECONOMY } from './config.js';
import { setCount } from './items.js';

export const ACH_CATS = [
  { id: 'story', name: tx('主線') }, { id: 'mythic', name: tx('秘境') }, { id: 'gear', name: tx('裝備') },
  { id: 'hero', name: tx('英雄') }, { id: 'misc', name: tx('日常與收集') },
];
const clear = i => s => [s.clears[i] ? 1 : 0, 1];
const n = v => Number(v) || 0;
const items = s => Object.values(s.items || {});
const equipped = s => s.heroes.flatMap(h => Object.values(h.gear || {}).filter(Boolean).map(id => s.items[id]).filter(Boolean));
const bagMs = id => BAG_MILESTONES.find(m => m.id === id);

const LIST = [
  // 主線
  { id: 'clear1', cat: 'story', pts: 5, name: tx('第一步'), desc: tx('通關第 I 層「{0}」', DUNGEONS[0].name), prog: clear(0) },
  { id: 'clear3', cat: 'story', pts: 10, bag: true },
  { id: 'clear5', cat: 'story', pts: 10, bag: true },
  { id: 'clear7', cat: 'story', pts: 25, bag: true },
  { id: 'clear8', cat: 'story', pts: 10, name: tx('深入裂谷'), desc: tx('通關第 VIII 層「{0}」', DUNGEONS[7].name), prog: clear(7) },
  { id: 'clear11', cat: 'story', pts: 25, name: tx('日月同輝'), desc: tx('擊敗雙子先知（第 XI 層）'), prog: clear(10) },
  { id: 'clear14', cat: 'story', pts: 50, name: tx('深淵終結者'), desc: tx('擊敗裂谷之主・莫瑞斯（第 XIV 層）'), prog: clear(13) },
  // v0.25 第三章・潮痕海岸
  { id: 'clear15', cat: 'story', pts: 10, name: tx('登陸維爾達'), desc: tx('通關第 XV 層「{0}」', DUNGEONS[14].name), prog: clear(14) },
  { id: 'clear18', cat: 'story', pts: 25, name: tx('穿越黑帆'), desc: tx('擊敗黑帆雙雄（第 XVIII 層）'), prog: clear(17) },
  { id: 'clear21', cat: 'story', pts: 50, name: tx('淨潮者'), desc: tx('淨化被侵蝕的守護者・艾瓦拉（第 XXI 層）'), prog: clear(20) },
  { id: 'nocharm', cat: 'story', pts: 25, name: tx('不為歌聲所動'), desc: tx('通關第 XVII 層，全程沒有隊員被魅惑'), prog: s => [n(s.stats.nocharm), 1] },
  { id: 'wins100', cat: 'story', pts: 10, name: tx('百戰'), desc: tx('累計勝利 {0} 場', 100), prog: s => [n(s.stats.wins), 100] },
  { id: 'wins1000', cat: 'story', pts: 25, name: tx('千錘百鍊'), desc: tx('累計勝利 {0} 場', 1000), prog: s => [n(s.stats.wins), 1000] },
  { id: 'wins5000', cat: 'story', pts: 50, name: tx('身經萬戰'), desc: tx('累計勝利 {0} 場', 5000), prog: s => [n(s.stats.wins), 5000] },
  // 秘境
  { id: 'mythic2', cat: 'mythic', pts: 5, name: tx('初探秘境'), desc: tx('傳奇秘境限時通關任一副本'), prog: s => [Math.min(1, mythicBestLevel(s)), 1] },
  { id: 'mythic5', cat: 'mythic', pts: 10, bag: true },
  { id: 'mythic10', cat: 'mythic', pts: 25, bag: true },
  { id: 'mythic15', cat: 'mythic', pts: 25, bag: true },
  { id: 'mythic20', cat: 'mythic', pts: 50, name: tx('傳奇之巔'), desc: tx('傳奇秘境 +{0} 限時通關', 20), prog: s => [mythicBestLevel(s), 20] },
  { id: 'abyss5', cat: 'mythic', pts: 25, bag: true },
  { id: 'abyss10', cat: 'mythic', pts: 50, bag: true },
  { id: 'abyss15', cat: 'mythic', pts: 50, name: tx('凝視深淵'), desc: tx('深淵秘境 +{0} 限時通關', 15), prog: s => [mythicBestLevel(s, 2), 15] },
  { id: 'fast10', cat: 'mythic', pts: 10, name: tx('疾風'), desc: tx('秘境以 80% 時間內通關（鑰石 +2）{0} 次', 10), prog: s => [n(s.stats.fast), 10] },
  { id: 'mruns100', cat: 'mythic', pts: 10, name: tx('鑰石收藏家'), desc: tx('完成 {0} 場秘境挑戰', 100), prog: s => [n(s.mythic && s.mythic.runs), 100] },
  { id: 'allbest', cat: 'mythic', pts: 25, name: tx('全面制霸'), desc: tx('傳奇秘境 7 個副本都限時通關 +{0} 以上', 10), prog: s => [Array.from({ length: 7 }, (_, i) => s.mythic.best[i]).filter(b => b && b.level >= 10).length, 7] },
  // 裝備
  { id: 'epic', cat: 'gear', pts: 5, name: tx('紫色光芒'), desc: tx('獲得一件史詩裝備'), prog: s => [items(s).some(it => it.rarity >= 3) ? 1 : 0, 1] },
  { id: 'legend', cat: 'gear', pts: 25, name: tx('橙色傳說'), desc: tx('獲得一件傳說裝備'), prog: s => [items(s).some(it => it.rarity >= 4) ? 1 : 0, 1] },
  { id: 'refine', cat: 'gear', pts: 25, name: tx('精益求精'), desc: tx('把一件裝備精煉到 +{0}', GEAR.maxUp), prog: s => [Math.max(0, ...items(s).map(it => n(it.up))), GEAR.maxUp] },
  { id: 'set4', cat: 'gear', pts: 25, name: tx('全套到手'), desc: tx('任一英雄穿齊 4 件職業套裝'), prog: s => [Math.max(0, ...s.heroes.map(h => setCount(h, s.items))), 4] },
  { id: 'allepic', cat: 'gear', pts: 25, name: tx('一身紫裝'), desc: tx('任一英雄 6 個部位都是史詩以上'), prog: s => [Math.max(0, ...s.heroes.map(h => Object.values(h.gear || {}).filter(id => id && s.items[id] && s.items[id].rarity >= 3).length)), 6] },
  { id: 'salvage500', cat: 'gear', pts: 10, name: tx('回收專家'), desc: tx('分解 {0} 件裝備', 500), prog: s => [n(s.stats.salvaged), 500] },
  { id: 'ilvl150', cat: 'gear', pts: 25, name: tx('深淵裝備'), desc: tx('穿上一件裝等 {0} 以上的裝備', 150), prog: s => [Math.max(0, ...equipped(s).map(it => n(it.ilvl))) >= 150 ? 1 : 0, 1] },
  // 英雄
  { id: 'lv30', cat: 'hero', pts: 5, name: tx('獨當一面'), desc: tx('任一英雄達到 Lv{0}', 30), prog: s => [Math.max(0, ...s.heroes.map(h => h.level)), 30] },
  { id: 'lvmax', cat: 'hero', pts: 25, name: tx('登峰造極'), desc: tx('任一英雄達到等級上限 Lv{0}', HERO.maxLevel), prog: s => [Math.max(0, ...s.heroes.map(h => h.level)), HERO.maxLevel] },
  { id: 'team60', cat: 'hero', pts: 50, name: tx('滿級團隊'), desc: tx('5 位英雄都達到 Lv{0}', HERO.maxLevel), prog: s => [s.heroes.filter(h => h.level >= HERO.maxLevel).length, 5] },
  { id: 'para10', cat: 'hero', pts: 25, name: tx('巔峰之路'), desc: tx('任一英雄巔峰等級 {0}', 10), prog: s => [Math.max(0, ...s.heroes.map(h => n(h.para))), 10] },
  { id: 'leg1', cat: 'hero', pts: 10, name: tx('傳說降臨'), desc: tx('招募到第一位傳說英雄'), prog: s => [s.heroes.some(h => h.legend) ? 1 : 0, 1] },
  { id: 'legall', cat: 'hero', pts: 50, name: tx('群英薈萃'), desc: tx('名冊同時擁有 {0} 位不同職業的傳說', Object.keys(CLASSES).length), prog: s => [new Set(s.heroes.filter(h => h.legend).map(h => h.cls)).size, Object.keys(CLASSES).length] },
  { id: 'allcls', cat: 'hero', pts: 10, name: tx('兼容並蓄'), desc: tx('名冊同時擁有全部 {0} 種職業', Object.keys(CLASSES).length), prog: s => [new Set(s.heroes.map(h => h.cls)).size, Object.keys(CLASSES).length] },
  { id: 'roster', cat: 'hero', pts: 10, name: tx('人滿為患'), desc: tx('名冊人數達到上限 {0}', ECONOMY.rosterMax), prog: s => [s.heroes.length, ECONOMY.rosterMax] },
  { id: 'recruit100', cat: 'hero', pts: 10, name: tx('伯樂'), desc: tx('累計招募 {0} 位英雄', 100), prog: s => [n(s.recruit && s.recruit.total), 100] },
  // 日常與收集
  { id: 'vault10', cat: 'misc', pts: 10, bag: true },
  { id: 'vault30', cat: 'misc', pts: 10, bag: true },
  { id: 'vault60', cat: 'misc', pts: 25, bag: true },
  { id: 'sign7', cat: 'misc', pts: 10, name: tx('一週團長'), desc: tx('累積簽到 {0} 天', 7), prog: s => [n(s.daily && s.daily.signDays), 7] },
  { id: 'sign30', cat: 'misc', pts: 25, name: tx('月度團長'), desc: tx('累積簽到 {0} 天', 30), prog: s => [n(s.daily && s.daily.signDays), 30] },
  { id: 'chest10', cat: 'misc', pts: 10, name: tx('勤勞的團長'), desc: tx('開啟 {0} 次每日寶箱', 10), prog: s => [n(s.stats.chests), 10] },
  { id: 'gold1m', cat: 'misc', pts: 10, name: tx('富甲一方'), desc: tx('同時持有 {0} 金幣', '1,000,000'), prog: s => [Math.min(n(s.gold), 1e6), 1e6] },
  { id: 'story', cat: 'misc', pts: 5, name: tx('說書人'), desc: tx('看完第二章的完結劇情'), prog: s => [(s.story && s.story.seen || []).includes('post13') ? 1 : 0, 1] },
  { id: 'story3', cat: 'misc', pts: 5, name: tx('海岸的傳說'), desc: tx('看完第三章的完結劇情'), prog: s => [(s.story && s.story.seen || []).includes('post20') ? 1 : 0, 1] },
];
// 背包里程碑：名稱沿用，說明附上獎勵
export const ACHIEVEMENTS = LIST.map(a => {
  if (!a.bag) return a;
  const m = bagMs(a.id);
  return { ...a, name: m.name, desc: tx('獎勵：背包 +{0} 格', BAG_PER_MILESTONE), prog: s => [m.test(s) ? 1 : 0, 1], reward: true };
});
export const achTotal = () => ACHIEVEMENTS.reduce((a, x) => a + x.pts, 0);
export const achPoints = s => ACHIEVEMENTS.reduce((a, x) => a + (s.ach && s.ach.done[x.id] ? x.pts : 0), 0);
export const achProgress = (s, a) => { const [c, g] = a.prog(s); return [Math.min(c, g), g]; };
// 檢查新達成的成就（記錄時間並回傳清單，給畫面跳提示）
export function checkAchievements(s, now = Date.now()) {
  s.ach = s.ach || { done: {} };
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (s.ach.done[a.id]) continue;
    let ok = false; try { const [c, g] = a.prog(s); ok = c >= g; } catch (e) { ok = false; }
    if (ok) { s.ach.done[a.id] = now; fresh.push(a); }
  }
  return fresh;
}
