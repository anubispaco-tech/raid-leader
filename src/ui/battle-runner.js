// ===== 即時戰鬥的計時與結算 =====
import * as G from '../core/index.js';
import { app, TICK_MS } from './state.js';
import { save } from './save.js';
import { toast, mmss } from './helpers.js';
import { sendEvent } from './telemetry.js';

export function startBattle(dIdx) {
  const p = G.partyHeroes(app.S);
  if (!p.length) { toast('隊伍沒有成員'); app.tab = 'team'; app.render(); return; }
  clearTimeout(app.pendingRepeat); app.pendingRepeat = null;
  app.battle = new G.Battle(p, app.S.items, dIdx, { autoHorn: app.S.idle === dIdx }); app.lastResult = null;
  app.battle.push(`進入 ${G.DUNGEONS[dIdx].name}，第 1 波敵人出現`, 'info');
  runTimer();
}
// 傳奇秘境：用目前鑰石等級與今天的詞綴開打（不會掛機重複）
export function startMythic(dIdx) {
  const p = G.partyHeroes(app.S);
  if (!p.length) { toast('隊伍沒有成員'); app.tab = 'team'; app.render(); return; }
  clearTimeout(app.pendingRepeat); app.pendingRepeat = null;
  const o = G.mythicBattleOpts(dIdx, app.S.mythic.key);
  app.battle = new G.Battle(p, app.S.items, dIdx, o); app.lastResult = null;
  app.battle.push(`進入傳奇秘境：${G.DUNGEONS[dIdx].name} +${o.mythic.level}｜詞綴：${o.mythic.affixes.map(a => G.AFFIXES[a].name).join('、')}`, 'info');
  runTimer();
}
// 寶庫：每日次數用完就不能開
export function startVault(floor) {
  const p = G.partyHeroes(app.S);
  if (!p.length) { toast('隊伍沒有成員'); app.tab = 'team'; app.render(); return false; }
  if (!G.vaultLeft(app.S)) { toast('今天的寶庫次數用完了，明天 00:00 重置'); return false; }
  clearTimeout(app.pendingRepeat); app.pendingRepeat = null;
  app.battle = new G.Battle(p, app.S.items, floor, G.vaultBattleOpts(floor)); app.lastResult = null;
  app.battle.push(`進入寶庫第 ${floor + 1} 層：60 秒內打倒越多寶藏哥布林，金幣越多！`, 'info');
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
    : app.battle.mythic ? G.applyMythicResult(app.S, app.battle) : G.applyResult(app.S, app.battle.dIdx, app.battle);
  save();
  const r = app.lastResult, b = app.battle;
  for (const m of G.newBagMilestones(app.S)) setTimeout(() => toast(`🎒 ${m.name}：背包 +${G.BAG_PER_MILESTONE} 格`), 400);
  if (b.vault) sendEvent('寶庫', `第 ${b.vault.floor + 1} 層 打倒 ${r.kills} 隻 +${r.gold} 金`);
  else if (b.mythic) sendEvent('秘境', `${G.DUNGEONS[b.dIdx].name} +${b.mythic.level} ${r.inTime ? '限時' : b.win ? '超時' : '失敗'} ${mmss(b.tick)}${r.record ? '（新紀錄）' : ''}`);
  else if (r.first) sendEvent('首通', `第 ${b.dIdx + 1} 層 ${G.DUNGEONS[b.dIdx].name}`);
  if (!app.battle.mythic && !app.battle.vault && app.S.idle === app.battle.dIdx) {
    const d = app.battle.dIdx;
    app.pendingRepeat = setTimeout(() => { app.pendingRepeat = null; if (app.S.idle === d) startBattle(d); }, 3000);
  }
  app.render(true);
}
