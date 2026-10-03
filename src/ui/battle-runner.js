// ===== 即時戰鬥的計時與結算 =====
import * as G from '../core/index.js';
import { app, TICK_MS } from './state.js';
import { save } from './save.js';
import { toast } from './helpers.js';

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
  app.lastResult = app.battle.mythic ? G.applyMythicResult(app.S, app.battle) : G.applyResult(app.S, app.battle.dIdx, app.battle);
  save();
  if (!app.battle.mythic && app.S.idle === app.battle.dIdx) {
    const d = app.battle.dIdx;
    app.pendingRepeat = setTimeout(() => { app.pendingRepeat = null; if (app.S.idle === d) startBattle(d); }, 3000);
  }
  app.render(true);
}
