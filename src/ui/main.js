// ===== 入口：分頁切換、事件、離線結算、啟動 =====
import * as G from '../core/index.js';
import { app } from './state.js';
import { load, save, exportCode, importCode } from './save.js';
import { $, fmt, toast, hero } from './helpers.js';
import { viewDungeons } from './views/dungeon.js';
import { viewBattle } from './views/battle.js';
import { viewTeam } from './views/team.js';
import { viewBag } from './views/bag.js';
import { viewTavern } from './views/tavern.js';
import { renderModal, openModal, closeModal } from './views/sheets.js';
import { startBattle, runTimer, finishBattle } from './battle-runner.js';

// ---------- 分頁 ----------
const ICONS = {
  dungeon: '<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6a3 3 0 0 1 6 0v6"/>',
  battle: '<path d="M5 19 19 5M14 5h5v5M5 14l5 5M4 20l3-3"/>',
  team: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 19c.6-3.4 3-5 6-5s5.4 1.6 6 5M15 14.5c2.6-.3 4.8 1.2 5.5 4.5"/>',
  bag: '<path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  tavern: '<path d="M6 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M16 5h2a2 2 0 0 1 0 4h-2M11 13v4M7 20h8"/>',
};
const TABS = [['dungeon', '副本'], ['battle', '戰鬥'], ['team', '團隊'], ['bag', '背包'], ['tavern', '酒館']];
function renderTabs() {
  $('#tabs').innerHTML = TABS.map(([k, n]) =>
    `<button data-tab="${k}" class="${app.tab === k ? 'sel' : ''}" aria-label="${n}"><svg viewBox="0 0 24 24">${ICONS[k]}</svg>${n}${(k === 'battle' && app.battle && !app.battle.over && app.tab !== 'battle') || (k === 'bag' && app.S.stash.length) || (k === 'team' && app.S.heroes.some(h => G.pendingPicks(h))) ? '<span class="dot"></span>' : ''}</button>`).join('');
}
function render(skipModal) {
  $('#gold').textContent = fmt(app.S.gold);
  $('#idleChip').hidden = app.S.idle == null;
  renderTabs();
  const v = $('#view');
  if (app.tab === 'dungeon') v.innerHTML = viewDungeons();
  if (app.tab === 'battle') v.innerHTML = viewBattle();
  if (app.tab === 'team') v.innerHTML = viewTeam();
  if (app.tab === 'bag') v.innerHTML = viewBag();
  if (app.tab === 'tavern') v.innerHTML = viewTavern();
  if (app.tab === 'battle') { const lg = $('.log'); if (lg) lg.scrollTop = lg.scrollHeight; }
  if (!skipModal) renderModal();
}
app.render = render;
app.renderTabs = renderTabs;

// ---------- 事件 ----------
document.addEventListener('click', e => {
  const t = e.target.closest('[data-tab],[data-act]');
  if (!t) return;
  if (t.dataset.act === 'close') { if (e.target === t) closeModal(); return; }
  if (t.dataset.tab) { app.tab = t.dataset.tab; app.modal = null; render(); window.scrollTo(0, 0); return; }
  const a = t.dataset.act, id = t.dataset.id;
  switch (a) {
    case 'fight': startBattle(+t.dataset.d); app.tab = 'battle'; break;
    case 'idle': {
      const d = +t.dataset.d;
      if (app.S.idle === d) { app.S.idle = null; clearTimeout(app.pendingRepeat); app.pendingRepeat = null; toast('已停止掛機'); }
      else { app.S.idle = d; toast(`開始掛機：${G.DUNGEONS[d].name}`); if (!app.battle || app.battle.over) { startBattle(d); } }
      save(); break;
    }
    case 'speed': app.speed = +t.dataset.x; runTimer(); break;
    case 'skip': if (app.battle && !app.battle.over) {
      const b = app.battle; b.opts.autoHorn = true; // 直接結算視同掛機：首領戰自動吹號角
      if (b.waveIdx === b.waves.length - 1) b.useHorn();
      b.runToEnd(); finishBattle(); } break;
    case 'retreat': if (app.battle && !app.battle.over) { clearInterval(app.bTimer); app.battle.over = true; app.battle.win = false; app.battle.push('🏳 主動撤退', 'bad'); app.lastResult = G.applyResult(app.S, app.battle.dIdx, app.battle); if (app.S.idle === app.battle.dIdx) app.S.idle = null; save(); } break;
    case 'hero': openModal({ type: 'hero', id, view: app.modal && app.modal.id === id ? app.modal.view : undefined }); return;
    case 'heroview': app.modal = { type: 'hero', id, view: t.dataset.v }; break;
    case 'spec': G.setSpec(hero(id), t.dataset.v); save(); break;
    case 'talent': G.setTalent(hero(id), +t.dataset.lv, t.dataset.v); save(); break;
    case 'recommend': G.applyRecommend(hero(id), G.DUNGEONS[+t.dataset.d].mech.map(m => m.t)); toast('已套用推薦配置'); save(); break;
    case 'recommend-party': {
      const d = +t.dataset.d; for (const x of G.partyHeroes(app.S)) G.applyRecommend(x, G.DUNGEONS[d].mech.map(m => m.t));
      toast(`全隊已套用「${G.DUNGEONS[d].name}」推薦天賦`); save(); break;
    }
    case 'horn': if (app.battle && app.battle.useHorn()) app.render(true); return;
    case 'item': openModal({ type: 'item', id }); return;
    case 'pick': openModal({ type: 'pick', id, slot: t.dataset.slot }); return;
    case 'equip': G.equip(app.S, t.dataset.hero, id); toast('已裝備'); save(); app.modal = { type: 'hero', id: t.dataset.hero }; break;
    case 'unequip': G.unequip(app.S, t.dataset.hero, t.dataset.slot); save(); app.modal = { type: 'hero', id: t.dataset.hero }; break;
    case 'up': if (G.upgrade(app.S, id)) { toast('強化成功'); save(); } else toast('金幣不足'); break;
    case 'salvage': toast(`分解獲得 ${G.salvage(app.S, id)} 金`); save(); app.modal = null; break;
    case 'join': G.joinParty(app.S, id); save(); break;
    case 'bench': G.benchHero(app.S, id); save(); break;
    case 'fire': {
      if (!app.modal.confirmFire) { app.modal.confirmFire = true; break; }
      const x = G.fireHero(app.S, id); app.modal = null; if (x) toast(`${x.name} 離開了團隊`); save(); break;
    }
    case 'hire': {
      const x = G.hire(app.S, id);
      if (x) { toast(`${x.name} 加入了${app.S.party.includes(x.id) ? '隊伍' : '名冊'}`); save(); }
      break;
    }
    case 'reroll': if (G.refreshTavern(app.S)) save(); break;
    case 'filter': app.invFilter = t.dataset.v; break;
    case 'autoequip': { const n = G.autoEquip(app.S); toast(n ? `更換了 ${n} 件裝備` : '目前已是最佳配裝'); save(); break; }
    case 'salvageupto': {
      const r = G.salvageUpTo(app.S, +t.dataset.v);
      toast(r.count ? `分解 ${r.count} 件，獲得 ${r.gold} 金` : '沒有可分解的裝備'); save(); break;
    }
    case 'autosalv': app.S.autoSalvageBelow = +t.dataset.v; save(); break;
    case 'keeprar': app.S.keepRarity = +t.dataset.v; save(); break;
    case 'takestash': { const n = G.takeFromStash(app.S); toast(n ? `取出 ${n} 件` : '背包已滿'); save(); break; }
    case 'salvagestash': { const r = G.salvageStash(app.S); toast(`分解 ${r.count} 件，獲得 ${r.gold} 金`); save(); break; }
    case 'export': openModal({ type: 'text', html: `<h3>匯出存檔碼</h3><p class="sub" style="margin:0">複製這段文字，到另一台裝置的「匯入」貼上。</p><textarea id="expTxt" readonly>${exportCode()}</textarea><div class="row"><button class="btn main" data-act="copy">複製</button><button class="btn" data-act="closebtn">關閉</button></div>` }); return;
    case 'copy': { const ta = $('#expTxt'); navigator.clipboard?.writeText(ta.value).then(() => toast('已複製'), () => { ta.select(); toast('請手動複製'); }) ?? (ta.select(), toast('請手動複製')); return; }
    case 'import': openModal({ type: 'text', html: `<h3>匯入存檔碼</h3><p class="sub" style="margin:0">會覆蓋目前進度。</p><textarea id="impTxt" placeholder="貼上存檔碼"></textarea><div class="row"><button class="btn main" data-act="doimport">匯入</button><button class="btn" data-act="closebtn">取消</button></div>` }); return;
    case 'doimport': try { app.S = importCode($('#impTxt').value); app.battle = null; save(); app.modal = null; toast('匯入完成'); } catch (err) { toast('存檔碼無法讀取，請確認是否完整複製'); return; } break;
    case 'reset': openModal({ type: 'text', html: `<h3>重新開始？</h3><p class="sub" style="margin:0">目前的英雄、裝備與進度都會清除，無法復原。</p><div class="row"><button class="btn" data-act="doreset" style="color:var(--bad);border-color:var(--bad)">清除並重來</button><button class="btn" data-act="closebtn">取消</button></div>` }); return;
    case 'doreset': clearInterval(app.bTimer); clearTimeout(app.pendingRepeat); app.S = G.newGame(); app.battle = null; app.lastResult = null; app.modal = null; app.tab = 'dungeon'; save(); break;
    case 'closebtn': app.modal = null; break;
  }
  render();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && app.modal) closeModal(); });

// ---------- 離線結算 ----------
function settleOffline() {
  const r = G.offlineProgress(app.S);
  if (!r || !r.runs) return;
  save();
  const hrs = r.sec >= 3600 ? `${(r.sec / 3600).toFixed(1)} 小時` : `${Math.round(r.sec / 60)} 分鐘`;
  openModal({ type: 'text', html: `<h3>離線收益</h3><p class="sub" style="margin:0">你離開了 ${hrs}，隊伍在 ${G.DUNGEONS[app.S.idle].name} 持續作戰。</p>
    <div class="statgrid num"><div><b>${r.runs}</b><span>挑戰</span></div><div><b>${r.wins}</b><span>通關</span></div><div><b>+${fmt(r.gold)}</b><span>金幣</span></div><div><b>${r.items}</b><span>裝備</span></div></div>
    ${r.stashed ? `<div style="color:var(--brass)">背包已滿，${r.stashed} 件放進戰利品箱，到背包取出</div>` : ''}
    ${r.lv ? `<div style="color:var(--good)">期間共升級 ${r.lv} 次</div>` : ''}
    <div class="row"><button class="btn main grow" data-act="autoequip">一鍵配裝</button><button class="btn" data-act="closebtn">好</button></div>` });
}
// 切到背景：暫停即時戰鬥並記錄時間；回來時掛機改用離線結算，避免重複計算
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { clearInterval(app.bTimer); clearTimeout(app.pendingRepeat); app.pendingRepeat = null; save(); return; }
  if (app.S.idle != null && (Date.now() - app.S.lastSeen) > 60000) {
    app.battle = null; app.lastResult = null; settleOffline(); startBattle(app.S.idle); render();
  } else if (app.battle && !app.battle.over) runTimer();
  else if (app.S.idle != null) startBattle(app.S.idle);
});
setInterval(() => { if (!document.hidden) save(); }, 5000);
// 鎖定縮放：iOS Safari 會忽略 viewport 的 user-scalable，另外擋捏合手勢
for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

// ---------- 啟動 ----------
function start(data) {
  app.S = G.migrate((data && data.S) || load() || G.newGame());
  settleOffline();
  if (app.S.idle != null && app.S.clears[app.S.idle]) startBattle(app.S.idle);
  render();
}
window.claude?.hot?.snapshot?.(() => ({ S: app.S }));
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
