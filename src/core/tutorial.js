// ===== v0.17 新手教學（4 步、只到第 2 層）與卡關指引 =====
import { tx } from './i18n.js';
import { ECONOMY, DUNGEONS } from './config.js';
import { partyHeroes, hasUpgrade } from './game.js';
import { nextStep } from './advice.js';

// 每一步：done(s) 達成條件；tab／sel 是畫面上要高亮的分頁與按鈕
export const TUTORIAL = [
  { id: 'fight1', text: tx('開打第一場'), sub: tx('點「腐根洞窟」的「挑戰」，隊伍會自己打。'), tab: 'dungeon', sel: '[data-act="fight"][data-d="0"]', done: s => s.stats.runs >= 1 },
  { id: 'equip', text: tx('換上新裝備'), sub: tx('打贏會掉裝備。按「一鍵配裝」，自動替隊員換上更好的。'), tab: 'dungeon', sel: '[data-act="autoequip"]', done: s => s.stats.runs >= 1 && !hasUpgrade(s) },
  { id: 'hire', text: tx('招募第 4 位隊員'), sub: tx('到酒館用金幣招募英雄，隊伍最多 5 人。金幣不夠就再打一場第 1 層。'), tab: 'tavern', sel: '[data-act="hire"]', done: s => s.party.length >= 4 },
  { id: 'clear2', text: tx('通關第 2 層'), sub: tx('挑戰「{0}」。之後的路，「下一步」卡片會告訴你。', DUNGEONS[1].name), tab: 'dungeon', sel: '[data-act="fight"][data-d="1"]', done: s => !!s.clears[1] },
];
export const TUT_REWARD = { gold: 300 };
export const tutActive = s => !!s.tut && !s.tut.done;
export const tutCurrent = s => (tutActive(s) ? TUTORIAL[s.tut.step] || null : null);
// 推進：回傳這次完成的步驟 id（給埋點用）；全部完成時發獎勵
export function tutAdvance(s) {
  const done = [];
  while (tutActive(s) && TUTORIAL[s.tut.step] && TUTORIAL[s.tut.step].done(s)) { done.push(TUTORIAL[s.tut.step].id); s.tut.step++; }
  if (tutActive(s) && s.tut.step >= TUTORIAL.length) { s.tut.done = true; s.gold += TUT_REWARD.gold; done.push('finish'); }
  return done;
}
export function tutSkip(s) { if (tutActive(s)) { s.tut.done = true; s.tut.skipped = s.tut.step; } }

// ---------- 卡關指引 ----------
// 有在玩但沒進展：遊玩時間累積 STUCK.sec 秒、最高層沒變 → 推一次指引；同一層連輸 STUCK.fails 場也推一次
export const STUCK = { sec: 20 * 60, fails: 3 };
const topOf = s => s.unlocked - 1;
export function stuckCheck(s, kind) {
  if (tutActive(s)) return null;
  const p = s.prog || (s.prog = { top: topOf(s), at: s.player.playSec, warned: false, failWarned: 0 });
  if (topOf(s) !== p.top) { p.top = topOf(s); p.at = s.player.playSec; p.warned = false; p.failWarned = 0; }
  const top = topOf(s), dn = DUNGEONS[top] ? DUNGEONS[top].name : '';
  if (kind === 'battle' && (s.failStreak || 0) >= STUCK.fails && s.failStreak > p.failWarned && s.idle == null) {
    p.failWarned = s.failStreak + 1; // 再輸 2 場才會再提醒
    return { reason: 'fails', title: tx('「{0}」卡關了嗎？', dn), tips: stuckTips(s, true) };
  }
  if (kind === 'time' && !p.warned && s.player.playSec - p.at >= STUCK.sec && top < DUNGEONS.length - 1) {
    p.warned = true;
    return { reason: 'time', title: tx('一段時間沒有新進度'), tips: stuckTips(s, false) };
  }
  return null;
}
// 依目前狀況挑 1–3 條建議，第一條附按鈕（沿用「下一步」的判斷）
function stuckTips(s, lost) {
  const tips = [], n = nextStep(s), party = partyHeroes(s), top = topOf(s);
  if (n && n.btn) tips.push({ text: n.text, sub: n.sub, btn: n.btn });
  if (party.length < ECONOMY.partyMax) tips.push({ text: tx('隊伍只有 {0} 人', party.length), sub: tx('補滿 5 人戰力差很多，到酒館招募。'), btn: { label: tx('前往酒館'), tab: 'tavern' } });
  tips.push({ text: tx('依這層的首領機制備戰'), sub: tx('一鍵挑選陣容、天賦與裝備，針對「{0}」的機制。', DUNGEONS[top].name), btn: { label: tx('一鍵備戰'), act: 'prepare', d: top } });
  if (lost && top > 0) tips.push({ text: tx('回前一層掛機'), sub: tx('掛機刷等級與裝備，離線也會累積，再回來挑戰。'), btn: { label: tx('掛機刷「{0}」', DUNGEONS[top - 1].name), act: 'idle', d: top - 1 } });
  const seen = new Set();
  return tips.filter(t => (seen.has(t.text) ? false : seen.add(t.text))).slice(0, 3);
}

// ---------- 新系統說明卡（只顯示一次）----------
export const seenCard = (s, id) => (s.cards || []).includes(id);
export function markCard(s, id) { s.cards = s.cards || []; if (!s.cards.includes(id)) s.cards.push(id); }
