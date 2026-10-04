// ===== 即時戰鬥的計時與結算 =====
import { tx } from '../core/i18n.js';
import * as G from '../core/index.js';
import { app, TICK_MS } from './state.js';
import { save } from './save.js';
import { toast, mmss } from './helpers.js';
import { sendEvent } from './telemetry.js';

export function startBattle(dIdx) {
  const p = G.partyHeroes(app.S);
  if (!p.length) { toast(tx('隊伍沒有成員')); app.tab = 'team'; app.render(); return; }
  clearTimeout(app.pendingRepeat); app.pendingRepeat = null;
  app.battle = new G.Battle(p, app.S.items, dIdx, { autoHorn: app.S.idle === dIdx }); app.lastResult = null;
  app.battle.push(tx('進入 {0}，第 1 波敵人出現', G.DUNGEONS[dIdx].name), 'info');
  runTimer();
}
// 傳奇秘境：用目前鑰石等級與今天的詞綴開打（不會掛機重複）
export function startMythic(dIdx) {
  const p = G.partyHeroes(app.S);
  if (!p.length) { toast(tx('隊伍沒有成員')); app.tab = 'team'; app.render(); return; }
  clearTimeout(app.pendingRepeat); app.pendingRepeat = null;
  const o = G.mythicBattleOpts(dIdx, G.keyOf(app.S, dIdx));
  app.battle = new G.Battle(p, app.S.items, dIdx, o); app.lastResult = null;
  app.battle.push(tx('進入{3}：{0} +{1}｜詞綴：{2}', G.DUNGEONS[dIdx].name, o.mythic.level, o.mythic.affixes.map(a => G.AFFIXES[a].name).join(tx('、')), o.mythic.tier === 2 ? tx('深淵秘境') : tx('傳奇秘境')), 'info');
  runTimer();
}
// 秘境掛機：固定打「限時最高 −2」，結束 3 秒後自動再開
export function startMythicIdle(dIdx) {
  const p = G.partyHeroes(app.S), lv = G.mythicIdleLevel(app.S, dIdx);
  if (!p.length || !lv) return;
  clearTimeout(app.pendingRepeat); app.pendingRepeat = null;
  const o = G.mythicBattleOpts(dIdx, lv);
  app.battle = new G.Battle(p, app.S.items, dIdx, { ...o, autoHorn: true }); app.battle.mythicIdle = true; app.lastResult = null;
  app.battle.push(tx('秘境掛機：{0} +{1}（鑰石不變，獎勵 {2}%）', G.DUNGEONS[dIdx].name, lv, Math.round(G.MYTHIC.idleMult * 100)), 'info');
  runTimer();
}
// 寶庫：每日次數用完就不能開
export function startVault(floor) {
  const p = G.partyHeroes(app.S);
  if (!p.length) { toast(tx('隊伍沒有成員')); app.tab = 'team'; app.render(); return false; }
  if (!G.vaultLeft(app.S)) { toast(tx('今天的寶庫次數用完了，明天 00:00 重置')); return false; }
  clearTimeout(app.pendingRepeat); app.pendingRepeat = null;
  app.battle = new G.Battle(p, app.S.items, floor, G.vaultBattleOpts(floor)); app.lastResult = null;
  app.battle.push(tx('進入寶庫第 {0} 層：60 秒內打倒越多寶藏哥布林，金幣越多！', floor + 1), 'info');
  runTimer(); return true;
}
export function runTimer() {
  clearInterval(app.bTimer);
  app.bTimer = setInterval(stepBattle, TICK_MS / app.speed);
}
function stepBattle() {
  if (!app.battle || app.battle.over) { clearInterval(app.bTimer); return; }
  app.battle.step();
  if (app.battle.over) finishBattle();
  else if (app.tab === 'battle') app.render(true);
  else app.renderTabs();
}
export function finishBattle() {
  clearInterval(app.bTimer);
  app.lastResult = app.battle.vault ? G.applyVaultResult(app.S, app.battle, G.partyHeroes)
    : app.battle.mythicIdle ? G.applyMythicIdleResult(app.S, app.battle)
    : app.battle.mythic ? G.applyMythicResult(app.S, app.battle) : G.applyResult(app.S, app.battle.dIdx, app.battle);
  save();
  const r = app.lastResult, b = app.battle;
  for (const m of G.newBagMilestones(app.S)) setTimeout(() => toast(tx('🎒 {0}：背包 +{1} 格', m.name, G.BAG_PER_MILESTONE)), 400);
  if (b.vault) sendEvent(tx('寶庫'), tx('第 {0} 層 打倒 {1} 隻 +{2} 金', b.vault.floor + 1, r.kills, r.gold));
  else if (b.mythicIdle) { /* 掛機不送事件，避免洗版 */ }
  else if (b.mythic) { // 秘境：破紀錄才單筆送出，其餘每 10 場彙總一筆（避免連刷洗版、吃配額）
    const m = app.mBuf || (app.mBuf = { n: 0, timed: 0, fail: 0 });
    m.n++; if (r.inTime) m.timed++; else if (!b.win) m.fail++;
    if (r.record) sendEvent(tx('秘境'), `${G.DUNGEONS[b.dIdx].name} +${b.mythic.level} ${tx('限時')} ${mmss(b.tick)}${tx('（新紀錄）')}`);
    if (m.n >= 10) { sendEvent(tx('秘境'), tx('近 {0} 場：限時 {1}・失敗 {2}・目前鑰石 +{3}', m.n, m.timed, m.fail, G.keyOf(app.S, b.dIdx))); app.mBuf = null; }
  }
  else if (r.first) sendEvent(tx('首通'), tx('第 {0} 層 {1}', b.dIdx + 1, G.DUNGEONS[b.dIdx].name));
  if (!app.battle.mythic && !app.battle.vault && app.S.idle === app.battle.dIdx) {
    const d = app.battle.dIdx;
    app.pendingRepeat = setTimeout(() => { app.pendingRepeat = null; if (app.S.idle === d) startBattle(d); }, 3000);
  }
  if (b.mythicIdle && app.S.idleMythic === b.dIdx) {
    const d = b.dIdx;
    app.pendingRepeat = setTimeout(() => { app.pendingRepeat = null; if (app.S.idleMythic === d) startMythicIdle(d); }, 3000);
  }
  app.render(true);
  if (r.first && app.storyOnce) app.storyOnce('post' + b.dIdx); // 首次通關後的劇情
}
