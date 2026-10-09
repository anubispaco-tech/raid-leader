// ===== 入口：分頁切換、事件、離線結算、啟動 =====
import { tx } from '../core/i18n.js';
import * as G from '../core/index.js';
import { app, KEY, canSkip } from './state.js';
import { load, save, exportCode, importCode } from './save.js';
import { moveAway, takeMoved } from './move.js';
import * as N from './news.js';
import { $, fmt, toast, hero, mmss, itemName, dailyOpenNow, firstWinLine } from './helpers.js';
import { viewDungeons } from './views/dungeon.js';
import { viewBattle } from './views/battle.js';
import { viewTeam } from './views/team.js';
import { viewBag, visibleBag } from './views/bag.js';
import { viewTavern } from './views/tavern.js';
import { renderModal, openModal, closeModal, playDialog } from './views/sheets.js';
import { PROLOGUE, STORY } from './story.js';
import { LANGS, getLang, setLang, localName } from '../core/i18n.js';
import { startBattle, startMythic, startMythicIdle, startVault, runTimer, finishBattle } from './battle-runner.js';
import * as T from './telemetry.js';
import { esc, heroName } from './helpers.js';
import { VERSION } from '../core/version.js';
import { installIcons, svg, BRAND } from './icons.js';
import * as C from './cloud.js';
import { mountGrid, zoomBy } from './grid.js';
import { prefs, setPref } from './prefs.js';
import * as SFX from './sfx.js';
import * as A from './acq.js';

A.captureParams(); // v0.21.1 先收下 ?src= ?ref=（在搬家流程改網址之前）

// ---------- 分頁 ----------
const ICONS = {
  dungeon: '<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6a3 3 0 0 1 6 0v6"/>',
  battle: '<path d="M5 19 19 5M14 5h5v5M5 14l5 5M4 20l3-3"/>',
  team: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 19c.6-3.4 3-5 6-5s5.4 1.6 6 5M15 14.5c2.6-.3 4.8 1.2 5.5 4.5"/>',
  bag: '<path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  tavern: '<path d="M6 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M16 5h2a2 2 0 0 1 0 4h-2M11 13v4M7 20h8"/>',
};
const TABS = [['dungeon', tx('副本')], ['battle', tx('戰鬥')], ['team', tx('團隊')], ['bag', tx('背包')], ['tavern', tx('酒館')]];
function renderTabs() {
  $('#tabs').innerHTML = TABS.map(([k, n]) =>
    `<button data-tab="${k}" class="${app.tab === k ? 'sel' : ''}" aria-label="${n}"><svg viewBox="0 0 24 24">${ICONS[k]}</svg>${n}${(k === 'battle' && app.battle && !app.battle.over && app.tab !== 'battle') || (k === 'bag' && app.S.stash.length) || (k === 'team' && (app.S.heroes.some(h => G.pendingPicks(h)) || G.leaderPoints(app.S) > 0)) ? '<span class="dot"></span>' : ''}</button>`).join('');
}
function render(skipModal) {
  achToasts();
  $('#gold').textContent = fmt(app.S.gold);
  $('#idleChip').hidden = !G.partyLocked(app.S);
  renderTabs();
  tutTick();
  { const up = G.leaderLevelUp(app.S); if (up && !G.tutActive(app.S)) { save(); setTimeout(() => toast(tx('團長升到 Lv{0}！得到 1 點天賦點（團隊 › 團長）', up)), 300); } } // v0.23
  const v = $('#view');
  if (app.tab === 'dungeon') v.innerHTML = viewDungeons();
  if (app.tab === 'battle') v.innerHTML = viewBattle();
  if (app.tab === 'team') v.innerHTML = viewTeam();
  if (app.tab === 'bag') v.innerHTML = viewBag();
  if (app.tab === 'tavern') v.innerHTML = viewTavern();
  if (app.tab === 'battle') { const lg = $('.log'); if (lg) lg.scrollTop = lg.scrollHeight; mountGrid($('#gridSlot'), app.battle); }
  else if (G.tutActive(app.S) && !app.fresh) v.insertAdjacentHTML('afterbegin', coachCard());
  tutHighlight();
  if (!skipModal) renderModal();
}
// ---------- v0.17 新手教學 ----------
function tutTick() {
  if (app.fresh) return;
  const done = G.tutAdvance(app.S); if (!done.length) return;
  save();
  for (const id of done) T.sendEvent(tx('教學'), id);
  if (done.includes('finish')) setTimeout(() => toast(tx('🎉 新手教學完成！獲得 {0} 金', G.TUT_REWARD.gold)), 300);
}
function coachCard() {
  const st = G.tutCurrent(app.S); if (!st) return '';
  const i = app.S.tut.step, n = G.TUTORIAL.length;
  return tx('<div class="coach"><div class="cstep num">{0}/{1}</div><div class="cbody"><b>{2}</b><span>{3}</span></div><button class="linkbtn cskip" data-act="tutskip">跳過教學</button></div>', i + 1, n, st.text, st.sub);
}
function tutHighlight() {
  document.querySelectorAll('.tut-hl').forEach(el => el.classList.remove('tut-hl'));
  const st = G.tutCurrent(app.S); if (!st || app.fresh || app.modal) return;
  const el = (app.tab === st.tab && document.querySelector('#view ' + st.sel)) || (app.tab !== st.tab && app.tab !== 'battle' && document.querySelector(`#tabs [data-tab="${st.tab}"]`));
  if (el) el.classList.add('tut-hl');
}
// ---------- v0.17 卡關指引 ----------
export function showStuck(kind) {
  if (app.fresh || app.modal) return;
  const r = G.stuckCheck(app.S, kind); if (!r) return;
  save(); T.sendEvent(tx('卡關指引'), `${r.reason}・${tx('第 {0} 層', app.S.unlocked)}`);
  const btn = b => (!b ? '' : b.tab ? `<button class="btn sm main" data-tab="${b.tab}">${b.label}</button>` : `<button class="btn sm main" data-act="${b.act}" data-closemodal="1" ${b.d != null ? `data-d="${b.d}"` : ''}>${b.label}</button>`);
  openModal({ type: 'text', html: tx('<h3>{0}</h3><p class="sub" style="margin:0">試試下面的方法：</p><div class="stucklist">{1}</div><div class="row"><button class="btn grow" data-act="closebtn">先不用</button></div>', r.title, r.tips.map(t => `<div class="stuck"><div><b>${t.text}</b><span class="sub" style="margin:0">${t.sub}</span></div>${btn(t.btn)}</div>`).join('')) });
}
app.showStuck = showStuck;
app.render = render;
app.renderModal = renderModal;
// 設定頁畫好後放 Google 登入按鈕、讀雲端狀態
app.afterModal = () => {
  if (!C.cloudEnabled()) return;
  if (document.getElementById('gsiBtn')) C.mountButton(); // 設定頁、v0.21.1 登入視窗
  if (app.modal && app.modal.type === 'settings') C.check();
};
app.closeModal = closeModal;
app.openModal = openModal;
app.renderTabs = renderTabs;

// ---------- 事件 ----------
// v0.20.1 背包長按（約 0.45 秒、沒移動）進入多選並選起這件
{
  let lp = null;
  const stop = () => { if (lp) { clearTimeout(lp.t); lp = null; } };
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest('.bagitem'); if (!el || app.msel || e.button > 0) return;
    lp = { x: e.clientX, y: e.clientY, t: setTimeout(() => {
      lp = null; const it = app.S.items[el.dataset.id]; if (!it) return;
      app.msel = new Set(it.locked ? [] : [it.id]); app.lpFired = true;
      if (it.locked) toast(tx('已鎖定的裝備不能分解'));
      try { navigator.vibrate && navigator.vibrate(15); } catch (er) { /* 不支援就算了 */ }
      render(true);
      setTimeout(() => { app.lpFired = false; }, 800); // 萬一放開時沒有觸發 click
    }, 450) };
  });
  document.addEventListener('pointermove', e => { if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 10) stop(); });
  // 放開後同一輪事件裡如果有 click 會先被吃掉；長按時清單已重畫，click 常常不會發生，所以放開後就清掉旗標
  document.addEventListener('pointerup', () => { stop(); if (app.lpFired) setTimeout(() => { app.lpFired = false; }, 0); });
  document.addEventListener('pointercancel', stop);
  document.addEventListener('contextmenu', e => { if (e.target.closest('.bagitem')) e.preventDefault(); });
}
document.addEventListener('click', e => {
  SFX.unlock(); // v0.20 瀏覽器要求：使用者點過畫面後才能出聲
  if (app.lpFired) { app.lpFired = false; e.preventDefault(); return; } // v0.20.1 長按剛觸發多選：吃掉放開時的那一下點擊
  const t = e.target.closest('[data-tab],[data-act]');
  if (!t) return;
  if (t.dataset.act === 'close') { if (e.target === t) closeModal(); return; }
  if (t.dataset.tab) { app.tab = t.dataset.tab; app.modal = null; app.msel = null; render(); window.scrollTo(0, 0); return; }
  if (t.dataset.closemodal) app.modal = null; // v0.17 指引視窗裡的按鈕：先關視窗再執行
  const a = t.dataset.act, id = t.dataset.id;
  if (a !== 'salvageupto') app.salvConfirm = false;
  if (a !== 'firemany') app.fireConfirm = false;
  if (a !== 'mselgo') app.mselConfirm = false;
  switch (a) {
    case 'fight': { const d = +t.dataset.d; stopIdleFor(d); const go = () => { startBattle(d); app.tab = 'battle'; render(); };
      if (!storyOnce(d === G.CH1_TOP + 1 ? ['post' + G.CH1_TOP, 'pre' + d] : 'pre' + d, go)) go(); return; }
    case 'mythic': {
      const d = +t.dataset.d;
      if (app.battle && !app.battle.over && app.battle.mythic && !app.battle.mythicIdle) { toast(tx('秘境挑戰進行中')); break; }
      if (!G.spendStamina(app.S)) { toast(tx('秘境體力不足，{0} 後回復 1 點', mmss(Math.ceil(G.staminaNext(app.S) / 1000)))); break; }
      stopIdleFor(-1); startMythic(d); app.tab = 'battle'; window.scrollTo(0, 0); save(); break;
    }
    case 'mtier': app.mtier = +t.dataset.v; break;
    case 'vault': if (G.vaultLeft(app.S)) stopIdleFor(-1); if (startVault(+t.dataset.d)) { app.tab = 'battle'; window.scrollTo(0, 0); } break;
    case 'vaultfloor': app.vaultFloor = +t.dataset.d; break;
    case 'prepare-vault': { const r = G.prepare(app.S, ['summon']); toast(prepMsg(r, tx('寶庫（偏範圍輸出）'))); save(); break; }
    case 'scroll': {
      const n = +t.dataset.n, r = G.recruitScroll(app.S, n);
      if (r.error) { toast(r.error === 'gold' ? tx('金幣不夠') : tx('名冊空位不夠')); break; }
      save(); showDraw(r.heroes, r.cost); return;
    }
    case 'recommend-mythic': {
      const d = +t.dataset.d, r = G.prepare(app.S, [...G.mechHints(d), ...G.affixHints(G.activeAffixes(G.keyOf(app.S, d)))]);
      toast(prepMsg(r, tx('「{0}」與今日詞綴', G.DUNGEONS[d].name))); save(); break;
    }
    case 'idle': {
      const d = +t.dataset.d;
      if (app.S.idle === d) { app.S.idle = null; clearTimeout(app.pendingRepeat); app.pendingRepeat = null; toast(tx('已停止掛機')); }
      else { const swap = app.S.idleMythic != null; app.S.idleMythic = null; app.S.idle = d; toast(tx('開始掛機：{0}', G.DUNGEONS[d].name)); if (swap || !app.battle || app.battle.over) { startBattle(d); } }
      save(); break;
    }
    case 'idlemythic': {
      const d = +t.dataset.d, lv = G.mythicIdleLevel(app.S, d);
      if (app.S.idleMythic === d) { app.S.idleMythic = null; clearTimeout(app.pendingRepeat); app.pendingRepeat = null; toast(tx('已停止秘境掛機')); }
      else if (lv) {
        const busy = app.battle && !app.battle.over && !app.battle.mythicIdle && !(app.S.idle != null && app.battle.dIdx === app.S.idle && !app.battle.mythic);
        if (busy) { toast(tx('目前有戰鬥進行中，打完再開始秘境掛機')); break; }
        app.S.idle = null; app.S.idleMythic = d; toast(tx('開始秘境掛機：{0} +{1}', G.DUNGEONS[d].name, lv));
        startMythicIdle(d); app.tab = 'battle'; window.scrollTo(0, 0);
      }
      save(); break;
    }
    case 'dlgnext': if (app.modal && app.modal.type === 'dialog') { if (app.modal.i < app.modal.lines.length - 1) { app.modal.i++; renderModal(); } else closeModal(); } return;
    case 'dlgskip': closeModal(); return;
    case 'settings': openModal({ type: 'settings' }); return;
    case 'news': N.openNews(); return;
    case 'newsreload': location.reload(); return;
    case 'ach': openModal({ type: 'ach' }); return;
    case 'achcat': app.achCat = t.dataset.v; renderModal(); return;
    case 'mode': app.mode = t.dataset.v; break;
    case 'chapter': app.chapter = +t.dataset.v; if (app.chapter === 1) storyOnce('post6'); break;
    case 'close-settings': closeModal(); return;
    case 'replaystory': playDialog(PROLOGUE, () => openModal({ type: 'settings' })); return;
    case 'lang': if (t.dataset.v !== getLang()) { // 新玩家還沒按開始就換語言：不留存檔，重新載入後仍是「開始冒險」
      if (app.fresh) { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } } else save();
      setLang(t.dataset.v); location.reload(); } return;
    case 'speed': app.speed = +t.dataset.x; runTimer(); break;
    case 'active': if (app.battle && app.battle.useActive(t.dataset.id)) { T.countUse('active'); app.render(true); } return; // v0.24 點隊員卡片施放主動技能
    case 'cmd': if (app.battle && app.battle.useCommand(t.dataset.v)) { T.countUse('cmd'); app.render(true); } return;  // v0.24 團長指令
    case 'lnode': { // v0.24 點節點：選取並顯示說明；可以點亮就直接點亮（草稿）
      const id = t.dataset.v, a = { ...(app.leaderDraft || G.leaderAlloc(app.S)) };
      if (app.leaderSel === id && G.canAdd(a, id, G.leaderLevel(app.S), app.S)) { a[id] = 1; app.leaderDraft = a; }
      app.leaderSel = id; break; }
    case 'lclose': if (!app.leaderSel) return; app.leaderSel = null; break; // v0.24.1 點樹的空白處關閉說明卡
    case 'lkeep': return;
    case 'lcmd': if (G.toggleCmd(app.S, t.dataset.v)) save(); break;
    case 'skip': if (app.battle && !app.battle.over) {
      if (!canSkip(app.battle)) { toast(tx('首次挑戰需完整觀戰（可用 4× 加速）')); break; }
      const b = app.battle; b.opts.autoHorn = true; // 直接結算視同掛機：首領戰自動吹號角
      if (b.actMode) b.actMode = 'auto'; b.autoCmd = true; // v0.24 主動技能與團長指令也自動
      if (b.waveIdx === b.waves.length - 1) b.useHorn();
      b.fxq = null; b.runToEnd(); finishBattle(); } break;
    case 'pref': { // v0.20 戰鬥畫面偏好（特效、立體視角、音效），存在這台裝置
      const k = t.dataset.k, v = t.dataset.v, val = k === 'fx' ? v : v === '1';
      if (prefs[k] === val) break;
      setPref(k, val);
      if (k === 'sound') { if (val) { SFX.unlock(); SFX.play('heal'); } T.sendEvent(tx('音效設定'), val ? tx('開') : tx('關')); }
      if (k === 'fx') T.sendEvent(tx('戰鬥特效'), { full: tx('完整'), lite: tx('簡化'), off: tx('關') }[val]);
      if (app.modal) renderModal(); else render(true);
      return;
    }
    case 'mselon': app.msel = new Set(); break;
    case 'mselcancel': app.msel = null; break;
    case 'msel': {
      const it = app.S.items[id]; if (!app.msel || !it) break;
      if (it.locked) { toast(tx('已鎖定的裝備不能分解')); break; }
      if (app.msel.has(id)) app.msel.delete(id); else app.msel.add(id);
      break;
    }
    case 'mselall': if (app.msel) for (const it of visibleBag()) if (!it.locked) app.msel.add(it.id); break;
    case 'mselgo': {
      if (!app.msel) break;
      const d = G.salvageMany(app.S, [...app.msel], true); if (!d.count) break;
      if (d.precious && !app.mselConfirm) { app.mselConfirm = true; break; } // 含史詩以上或套裝：再按一次確認
      app.mselConfirm = false;
      const r = G.salvageMany(app.S, [...app.msel]); app.msel = null;
      toast(tx('分解 {0} 件，獲得 {1} 金', r.count, fmt(r.gold)) + (r.dust ? tx('、{0} 精華', fmt(r.dust)) : '')); save(); break;
    }
    case 'gzoom': zoomBy(+t.dataset.v); return;
    case 'isotog': setPref('iso', !prefs.iso); render(true); return;
    case 'mute': setPref('sound', !prefs.sound); if (prefs.sound) { SFX.unlock(); SFX.play('heal'); } T.sendEvent(tx('音效設定'), prefs.sound ? tx('開') : tx('關')); render(true); return;
    case 'retreat': if (app.battle && !app.battle.over) { clearInterval(app.bTimer); app.battle.over = true; app.battle.win = false; app.battle.push(tx('🏳 主動撤退'), 'bad'); app.lastResult = app.battle.vault ? G.applyVaultResult(app.S, app.battle, G.partyHeroes) : app.battle.mythicIdle ? G.applyMythicIdleResult(app.S, app.battle) : app.battle.mythic ? G.applyMythicResult(app.S, app.battle) : G.applyResult(app.S, app.battle.dIdx, app.battle); if (app.S.idle === app.battle.dIdx) app.S.idle = null; if (app.battle.mythicIdle) app.S.idleMythic = null; save(); } break;
    case 'hero': openModal({ type: 'hero', id, view: app.modal && app.modal.id === id ? app.modal.view : undefined }); return;
    case 'heroview': app.modal = { type: 'hero', id, view: t.dataset.v }; break;
    case 'spec': G.setSpec(hero(id), t.dataset.v); save(); break;
    case 'talent': G.setTalent(hero(id), +t.dataset.lv, t.dataset.v); save(); break;
    case 'recommend': G.applyRecommend(hero(id), G.mechHints(+t.dataset.d)); toast(tx('已套用推薦配置')); save(); break;
    case 'recommend-party': case 'prepare': {
      const d = +t.dataset.d, r = G.prepare(app.S, G.mechHints(d));
      toast(prepMsg(r, tx('「{0}」', G.DUNGEONS[d].name))); save(); break;
    }
    case 'horn': if (app.battle && app.battle.useHorn()) app.render(true); return;
    case 'item': openModal({ type: 'item', id }); return;
    case 'pick': openModal({ type: 'pick', id, slot: t.dataset.slot }); return;
    case 'equip': G.equip(app.S, t.dataset.hero, id); toast(tx('已裝備')); save(); app.modal = { type: 'hero', id: t.dataset.hero }; break;
    case 'unequip': G.unequip(app.S, t.dataset.hero, t.dataset.slot); save(); app.modal = { type: 'hero', id: t.dataset.hero }; break;
    case 'up': { const it = app.S.items[id], refine = it && it.up >= G.GEAR.refineFrom;
      if (G.upgrade(app.S, id)) { toast(tx('{0}成功 +{1}', refine ? tx('精煉') : tx('強化'), it.up)); save(); } else toast(refine ? tx('金幣或精華不足') : tx('金幣不足')); break; }
    case 'buybag': { const c = G.buyBag(app.S); toast(c ? tx('背包 +{0} 格（花費 {1} 金）', G.ECONOMY.bagBuy.slots, fmt(c)) : tx('金幣不足')); save(); break; }
    case 'teamfilter': app.teamFilter = t.dataset.v; break;
    case 'mythicall': app.mythicAll = true; break;
    case 'mythichelp': app.mythicHelpOpen = true; break;
    case 'mythichelpok': app.S.mythicHelp = true; app.mythicHelpOpen = false; save(); break;
    case 'bagview': app.bagView = t.dataset.v; break;
    case 'cxview': app.cxView = t.dataset.v; break;
    case 'drops': app.dropOpen = app.dropOpen === t.dataset.v ? null : t.dataset.v; break;
    case 'sett5': if (G.upgradeSetT5(app.S, id)) { const it = app.S.items[id]; toast(tx('{0} 升級為 T0.5（傳說）', it.name)); T.sendEvent(tx('套裝升級'), `${it.set}:${it.slot}`); save(); } else toast(tx('還不能升級')); break;
    case 'codexclaim': { const r = G.claimCodex(app.S, +t.dataset.v); if (r) { toast(tx('圖鑑 {0}%：獲得 {1} 金、{2} 精華', r.pct, fmt(r.gold), r.dust)); save(); } break; }
    case 'tutskip': { const step = app.S.tut.step; G.tutSkip(app.S); save(); T.sendEvent(tx('教學'), `skip@${step}`); toast(tx('已跳過教學，「下一步」卡片會繼續提示')); break; }
    case 'cardok': G.markCard(app.S, t.dataset.v); save(); break;
    case 'gearfixok': { const had = app.S.gearFix; app.S.gearFix = 0; G.markCard(app.S, 'gear19');
      if (had) { const n = G.autoEquip(app.S); toast(tx('更換了 {0} 件裝備', n)); } save(); break; }
    case 'lock': { const on = G.toggleLock(app.S, t.dataset.kind, id); if (on != null) toast(on ? tx('已鎖定，不會被分解或解雇') : tx('已解除鎖定')); save(); break; }
    case 'up5': { const r = G.upgradeMany(app.S, id, 5);
      if (r && r.ok) { toast(tx('強化成功 +{0}', r.to)); save(); } else toast(tx('金幣或精華不足')); break; }
    case 'salvage': {
      // v0.18.1 史詩以上或套裝：要再按一次確認，避免誤觸
      const it = app.S.items[id];
      if (it && (it.rarity >= 3 || it.set) && app.modal && app.modal.confirmSalv !== id) { app.modal.confirmSalv = id; break; }
    } toast(tx('分解獲得 {0} 金', G.salvage(app.S, id))); save(); app.modal = null; break;
    case 'join': if (G.partyLocked(app.S)) { toast(tx('掛機中不能更換隊員，請先停止掛機')); break; } G.joinParty(app.S, id); save(); break;
    case 'bench': if (G.partyLocked(app.S)) { toast(tx('掛機中不能更換隊員，請先停止掛機')); break; } G.benchHero(app.S, id); save(); break;
    case 'fire': {
      if (G.partyLocked(app.S) && app.S.party.includes(id)) { toast(tx('掛機中不能更換隊員，請先停止掛機')); break; }
      if (!app.modal.confirmFire) { app.modal.confirmFire = true; break; }
      const x = G.fireHero(app.S, id); app.modal = null; if (x) toast(tx('{0} 離開了團隊，退還 {1} 金{2}', x.name, x.refund, gearMsg(x.gear))); save(); break;
    }
    case 'firemany': {
      const n = G.fireMany(app.S, app.fireSel ?? 0, true).count; if (!n) break;
      if (!app.fireConfirm) { app.fireConfirm = true; break; }
      app.fireConfirm = false;
      const r = G.fireMany(app.S, app.fireSel ?? 0); toast(tx('解雇 {0} 位英雄，退還 {1} 金{2}', r.count, fmt(r.refund), gearMsg(r.gear))); save(); break;
    }
    case 'hire': {
      const x = G.hire(app.S, id);
      if (x && x.rarity >= 3) { save(); showDraw([x], G.hireCost(x)); return; }
      if (x) { toast(tx('{0} 加入了{1}', x.name, app.S.party.includes(x.id) ? tx('隊伍') : tx('名冊'))); save(); }
      break;
    }
    case 'reroll': if (G.refreshTavern(app.S)) save(); break;
    case 'filter': app.invFilter = t.dataset.v; break;
    case 'autoequip1': { const n = G.autoEquip(app.S, id); toast(n ? tx('更換了 {0} 件裝備', n) : tx('目前已是最佳配裝')); save(); break; }
    case 'dq': dailyToast(G.claimQuest(app.S, +t.dataset.i), tx('任務獎勵')); save(); break;
    case 'dchest': dailyToast(G.claimChest(app.S), tx('每日寶箱')); save(); break;
    case 'dsign': { const r = G.claimSignin(app.S); dailyToast(r, r ? tx('簽到第 {0} 天', r.day) : ''); save(); break; }
    case 'dtoggle': app.dailyOpen = !dailyOpenNow(); break;
    case 'autoequip': { const n = G.autoEquip(app.S); toast(n ? tx('更換了 {0} 件裝備', n) : tx('目前已是最佳配裝')); save(); break; }
    case 'salvageupto': {
      const lv = app.salvSel ?? 0;
      if (lv >= 2 && !app.salvConfirm) { app.salvConfirm = true; break; } // 分解稀有以上要再按一次確認
      app.salvConfirm = false;
      const r = G.salvageUpTo(app.S, lv);
      toast(r.count ? tx('分解 {0} 件，獲得 {1} 金', r.count, r.gold) : tx('沒有符合的裝備')); save(); break;
    }
    case 'upall': {
      const r = G.upgradeAll(app.S, id);
      toast(r.count ? tx('強化 {0} 次，花費 {1} 金', r.count, fmt(r.spent)) : tx('金幣不夠')); save(); break;
    }
    case 'unequipall': {
      const r = G.unequipAll(app.S, id);
      toast(r.left ? tx('背包和戰利品箱都滿了，還有 {0} 件沒卸下', r.left) : tx('已卸下 {0} 件{1}', r.moved + r.stashed, r.stashed ? tx('（{0} 件放進戰利品箱）', r.stashed) : '')); save(); break;
    }
    case 'autosalv': app.S.autoSalvageBelow = +t.dataset.v; save(); break;
    case 'ilvlgap': app.S.salvageIlvlGap = +t.dataset.v; save(); break;
    case 'salvlow': { const r = G.salvageLowIlvl(app.S, app.S.salvageIlvlGap || 10); toast(tx('分解 {0} 件，獲得 {1} 金', r.count, fmt(r.gold))); save(); break; }
    case 'keeprar': app.S.keepRarity = +t.dataset.v; save(); break;
    case 'takestash': { const n = G.takeFromStash(app.S); toast(n ? tx('取出 {0} 件', n) : tx('背包已滿')); save(); break; }
    case 'salvagestash': { const r = G.salvageStash(app.S); toast(tx('分解 {0} 件，獲得 {1} 金', r.count, r.gold)); save(); break; }
    case 'export': openModal({ type: 'text', html: tx('<h3>匯出存檔碼</h3><p class="sub" style="margin:0">複製這段文字，到另一台裝置的「匯入」貼上。</p><textarea id="expTxt" readonly>{0}</textarea><div class="row"><button class="btn main" data-act="copy">複製</button><button class="btn" data-act="closebtn">關閉</button></div>', exportCode()) }); return;
    case 'copy': { const ta = $('#expTxt'); navigator.clipboard?.writeText(ta.value).then(() => toast(tx('已複製')), () => { ta.select(); toast(tx('請手動複製')); }) ?? (ta.select(), toast(tx('請手動複製'))); return; }
    case 'import': openModal({ type: 'text', html: tx('<h3>匯入存檔碼</h3><p class="sub" style="margin:0">會覆蓋目前進度。只匯入你自己匯出、或信任的人給的存檔碼。</p><textarea id="impTxt" placeholder="貼上存檔碼"></textarea><div class="row"><button class="btn main" data-act="doimport">匯入</button><button class="btn" data-act="closebtn">取消</button></div>') }); return;
    case 'doimport': try { app.S = G.migrate(importCode($('#impTxt').value)); app.battle = null; save(); app.modal = null; toast(tx('匯入完成')); } catch (err) { toast(tx('存檔碼無法讀取，請確認是否完整複製')); return; } break;
    case 'reset': openModal({ type: 'text', html: tx('<h3>重新開始？</h3><p class="sub" style="margin:0">目前的英雄、裝備與進度都會清除，無法復原。</p><div class="row"><button class="btn" data-act="doreset" style="color:var(--bad);border-color:var(--bad)">清除並重來</button><button class="btn" data-act="closebtn">取消</button></div>') }); return;
    case 'doreset': clearInterval(app.bTimer); clearTimeout(app.pendingRepeat); app.S = G.newGame(); app.battle = null; app.lastResult = null; app.modal = null; app.tab = 'dungeon'; save(); render(); playDialog(PROLOGUE, () => {}); return;
    case 'closebtn': app.modal = null; break;
    case 'cloudup': C.upload(); return;
    case 'clouddown': C.download(false); return;
    case 'cloudpick': C.pick(t.dataset.v); return;
    case 'cloudout': C.logout(); toast(tx('已登出（這台裝置的進度保留）')); break;
    case 'nick': openNick(); return;
    case 'share': shareInvite(); return;
    // v0.23 團長
    case 'teamview': app.teamView = t.dataset.v; app.leaderDraft = null; window.scrollTo(0, 0); break;
    case 'lbranch': app.leaderBranch = t.dataset.v; break;
    case 'ladd': { const a = { ...(app.leaderDraft || G.leaderAlloc(app.S)) }; if (G.canAdd(a, t.dataset.v, G.leaderLevel(app.S), app.S)) { a[t.dataset.v] = 1; app.leaderDraft = a; } break; }
    case 'lsub': { const a = { ...(app.leaderDraft || G.leaderAlloc(app.S)) }, id = t.dataset.v; if (a[id] && !G.leaderAlloc(app.S)[id] && G.canRemove(a, id)) { delete a[id]; app.leaderDraft = a; } break; }
    case 'lrefundok': if (app.S.leader) { delete app.S.leader.refunded; save(); } break;
    case 'lcancel': app.leaderDraft = null; break;
    case 'lcommit': if (app.leaderDraft && G.commitAlloc(app.S, app.leaderDraft)) { app.leaderDraft = null; save(); toast(tx('團長天賦已更新')); T.sendEvent(tx('團長配點'), leaderSummary()); } else toast(tx('配點不合法，請重新調整')); break;
    case 'lreset': openModal({ type: 'text', html: tx('<h3>重置團長天賦？</h3><p class="sub" style="margin:0">收回全部 {0} 點，花費 {1} 金。重置後可以重新分配。</p><div class="row"><button class="btn main" data-act="ldoreset" data-closemodal="1">重置</button><button class="btn" data-act="closebtn">取消</button></div>', G.spentPts(G.leaderAlloc(app.S)), fmt(G.resetCost(app.S))) }); return;
    case 'ldoreset': if (G.resetLeader(app.S)) { app.leaderDraft = null; save(); toast(tx('已重置團長天賦')); T.sendEvent(tx('團長重置'), `Lv${G.leaderLevel(app.S)}`); } else toast(tx('金幣不夠')); break;
    case 'sharecopy': { const el = $('#shareTxt'); navigator.clipboard?.writeText(el.value).then(() => { toast(tx('已複製邀請連結')); T.sendEvent(tx('分享'), 'copy'); }, () => { el.select(); toast(tx('請手動複製')); }) ?? (el.select(), toast(tx('請手動複製'))); return; }
    case 'loginskip': closeModal(); return;
    case 'inappclose': $('#inappBar').hidden = true; try { sessionStorage.setItem('rl-inapp', '1'); } catch (err) { /* ignore */ } return;
    case 'inappcopy': navigator.clipboard?.writeText(A.outsideUrl()).then(() => toast(tx('已複製連結，請貼到 Safari 或 Chrome 開啟')), () => toast(tx('請手動複製'))) ?? toast(tx('請手動複製')); return;
    case 'savenick': {
      const v = ($('#nickInp').value || '').trim().slice(0, 16);
      app.S.player.name = v; app.S.player.asked = true; app.modal = null; save();
      toast(v ? tx('暱稱設為「{0}」，天梯約 1 分鐘內更新', v) : tx('以匿名參加')); T.sendSnapshot(true).then(r => { if (r && r.error === 'too fast') setTimeout(() => T.sendSnapshot(), 25000); }); break;
    }
    case 'skipnick': app.S.player.asked = true; app.modal = null; save(); T.sendSnapshot(); break;
    case 'sendfb': {
      const ta = $('#fbText'), text = (ta.value || '').trim();
      if (!text) { toast(tx('請先輸入意見')); return; }
      t.disabled = true;
      T.sendFeedback(text).then(r => {
        if (r && r.ok) { app.fbDraft = ''; ta.value = ''; toast(tx('已送出，謝謝回饋！')); }
        else toast(r && r.error === 'too fast' ? tx('送太快了，請一分鐘後再試') : tx('送出失敗，請稍後再試'));
        t.disabled = false;
      });
      return;
    }
  }
  render();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && app.modal) closeModal();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('g[data-act]')) { e.preventDefault(); e.target.closest('g[data-act]').dispatchEvent(new MouseEvent('click', { bubbles: true })); } // v0.24 天賦樹節點
});

// ---------- 成就 ----------
// 每次重畫時檢查；新達成的跳提示（背包里程碑另有自己的提示）。啟動時先靜默補登舊進度
function achToasts() {
  const fresh = G.checkAchievements(app.S).filter(a => !a.reward);
  if (!fresh.length) return;
  save();
  const a = fresh[0];
  setTimeout(() => toast(tx('🏆 成就達成：{0}（+{1} 點）', a.name, a.pts) + (fresh.length > 1 ? tx('　另有 {0} 項', fresh.length - 1) : '')), 600);
}
// ---------- 每日 ----------
function dailyToast(r, what) {
  if (!r) return;
  const parts = [];
  if (r.gold) parts.push(tx('+{0} 金', fmt(r.gold)));
  if (r.dust) parts.push(tx('精華 +{0}', r.dust));
  if (r.sta) parts.push(tx('秘境體力 +{0}', r.sta));
  if (r.item) parts.push(itemName(r.item) + (r.dest === 'stash' ? tx('（放進戰利品箱）') : r.dest === 'salvaged' ? tx('（背包已滿，自動分解）') : ''));
  toast(what + '：' + parts.join(tx('、')));
}
// ---------- 離線結算 ----------
function settleOffline() {
  const r = G.offlineProgress(app.S);
  if (!r || !r.runs) return;
  const fw = G.dailyAfterOffline(app.S, r, app.S.idleMythic != null);
  save();
  const hrs = r.sec >= 3600 ? tx('{0} 小時', (r.sec / 3600).toFixed(1)) : tx('{0} 分鐘', Math.round(r.sec / 60));
  openModal({ type: 'text', html: tx('<h3>離線收益</h3><p class="sub" style="margin:0">你離開了 {0}，隊伍在 {1} 持續作戰。</p> <div class="statgrid num"><div><b>{2}</b><span>挑戰</span></div><div><b>{3}</b><span>通關</span></div><div><b>+{4}</b><span>金幣</span></div><div><b>{5}</b><span>裝備</span></div></div> {6} {7} <div class="row"><button class="btn main grow" data-act="autoequip">一鍵配裝</button><button class="btn" data-act="closebtn">好</button></div>', hrs, app.S.idleMythic != null ? tx('秘境「{0}」+{1}', G.DUNGEONS[app.S.idleMythic].name, G.mythicIdleLevel(app.S, app.S.idleMythic)) : G.DUNGEONS[app.S.idle].name, r.runs, r.wins, fmt(r.gold), r.items, r.stashed ? tx('<div style="color:var(--brass)">背包已滿，{0} 件放進戰利品箱，到背包取出</div>', r.stashed) : '', (r.lv ? tx('<div style="color:var(--good)">期間共升級 {0} 次</div>', r.lv) : '') + firstWinLine(fw)) });
}
// 切到背景：暫停即時戰鬥並記錄時間；回來時掛機改用離線結算，避免重複計算
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { clearInterval(app.bTimer); clearTimeout(app.pendingRepeat); app.pendingRepeat = null; save(); if (app.S.player.asked) T.sendSnapshot(true); C.uploadOnHide(); return; }
  C.check(); N.refresh();
  if (G.partyLocked(app.S) && (Date.now() - app.S.lastSeen) > 60000) {
    app.battle = null; app.lastResult = null; settleOffline(); resumeIdle(); render();
  } else if (app.battle && !app.battle.over) runTimer();
  else resumeIdle();
});
setInterval(() => { if (!document.hidden) { T.tick(5); save(); C.autoTick(); showStuck('time'); maybeBind(); } }, 5000);
document.addEventListener('input', e => { if (e.target.id === 'fbText') app.fbDraft = e.target.value; });
document.addEventListener('change', e => {
  if (e.target.id === 'salvSel') { app.salvSel = +e.target.value; app.salvConfirm = false; render(); }
  if (e.target.id === 'fireSel') { app.fireSel = +e.target.value; app.fireConfirm = false; render(); }
}); // 回饋草稿：畫面重畫時不會消失
// 抽卡結果：依稀有度由高到低排列，傳說與史詩特別標示
function showDraw(list, cost) {
  if (list.some(x => x.legend)) C.milestone(); // 獲得傳說英雄：立刻同步雲端
  const sorted = [...list].sort((a, b) => (b.rarity || 0) - (a.rarity || 0)), best = sorted[0].rarity || 0;
  openModal({ type: 'text', html: tx('<h3>{0}</h3> <p class="sub" style="margin:0">花費 {1} 金・已加入名冊{2}</p> <div class="drawlist">{3}</div> <div class="row"><button class="btn main grow" data-act="closebtn">好</button><button class="btn" data-tab="team">去團隊看看</button></div>', best === 4 ? tx('✨ 傳說降臨！') : best === 3 ? tx('史詩英雄加入！') : tx('招募結果'), fmt(cost), app.S.party.length < G.ECONOMY.partyMax ? '' : tx('（隊伍已滿，在待命區）'), sorted.map(x => `<div class="drawcard r-${x.rarity || 0}"><span class="ic">${G.CLASSES[x.cls].icon}</span><span>${heroName(x)}</span><span class="rtag r${x.rarity || 0}">${G.HERO_RARITY[x.rarity || 0].name}</span><small>${G.CLASSES[x.cls].name}・Lv${x.level}</small>${x.legend ? tx('<small class="c4">{0}：{1}</small>', G.LEGENDS[x.cls].pname, G.LEGENDS[x.cls].desc) : ''}</div>`).join('')) });
}
// 暱稱：第一次開遊戲時詢問（可跳過），之後可在團隊分頁修改
function openNick() {
  openModal({ type: 'text', html: tx('<h3>你的暱稱</h3><p class="sub" style="margin:0">顯示在天梯上，之後隨時可以修改。遊戲會記錄暱稱、進度與遊玩時間，不會收集帳號或個人資料。</p> <input id="nickInp" class="inp" maxlength="16" placeholder="例如：Yomi" value="{0}" autocomplete="off"> <div class="row"><button class="btn main grow" data-act="savenick">確定</button><button class="btn" data-act="skipnick">匿名參加</button></div>', esc(app.S.player.name)) });
}
// 鎖定縮放：iOS Safari 會忽略 viewport 的 user-scalable，另外擋捏合手勢
for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

// ---------- 啟動 ----------
function start(data) {
  const saved = (data && data.S) || load();
  installIcons(); // 職業圖示換成 SVG（在建立任何戰鬥之前）
  app.S = G.migrate(saved || G.newGame()); app.fresh = !saved;
  const newSrc = A.applyAcq(app.S, !saved), sa = A.standalone(); // v0.21.1 來源（只記第一次）、主畫面模式
  if (sa) app.S.player.pwa = 1;
  G.checkAchievements(app.S); // 舊存檔：已達成的成就直接補登，不跳提示
  for (const h of [...app.S.heroes, ...(app.S.tavern || [])]) h.name = localName(h.name);
  for (const it of Object.values(app.S.items)) it.name = it.base || it.set ? G.itemLabel(it) : localName(it.name); // v0.16 名稱由代號組出
  $('.brand-t').innerHTML = svg(BRAND, 'gi-brand'); $('.brand').setAttribute('aria-label', tx('設定')); $('.brand').title = 'RAID LEADER'; $('#idleChip').textContent = tx('掛機中'); document.title = getLang() === 'en' ? 'Raid Leader' : 'RAID LEADER 副本團長';
  document.documentElement.lang = getLang();
  $('#saveChip').textContent = tx('存檔中'); $('#newsBtn').setAttribute('aria-label', tx('公告'));
  N.updateDot(); N.refresh(true);
  if (newSrc) { save(); T.sendEvent(tx('來源'), app.S.player.src + (app.S.player.ref ? ' ref:' + app.S.player.ref : '')); }
  if (sa && once('rl-pwa')) T.sendEvent(tx('主畫面模式'), A.platform());
  showInApp();
  settleOffline();
  resumeIdle();
  render();
  const after = () => {
    setTimeout(() => N.maybePop(), 600); // v0.18 公告彈出：等暱稱等其他視窗之後
    if (T.enabled() && !app.S.player.asked && !app.modal) openNick();
    else if (app.S.player.asked) setTimeout(() => T.sendSnapshot(), 3000);
  };
  // v0.14 讀取畫面：先讀本機存檔，有 Google 登入就等雲端比對完（最多 6 秒）再進遊戲，避免玩到一半才被雲端進度蓋掉
  const boot = bootScreen(), t0 = Date.now(), useCloud = !!saved && C.cloudEnabled() && C.loggedIn();
  if (useCloud) boot.msg(tx('同步雲端存檔…'));
  const wait = useCloud ? Promise.race([C.check(true).catch(() => {}), new Promise(ok => setTimeout(ok, 6000))]) : Promise.resolve();
  wait.then(() => setTimeout(() => {
    boot.done();
    showTitle(!saved, login => {
      app.fresh = false; save();
      const go = () => (!saved ? playDialog(PROLOGUE, after) : after());
      // v0.21.1 開始畫面按「Google 登入接續」，或 iPhone 第一次從主畫面開（存檔和 Safari 分開）→ 先問要不要登入
      const pwaNew = !saved && sa && A.platform() === 'ios' && C.cloudEnabled() && !C.loggedIn();
      if (login) openLogin('title', go);
      else if (pwaNew) openLogin('pwa', go, { title: tx('從主畫面開啟'), text: tx('主畫面版的進度和 Safari 分開保存。之前在瀏覽器玩過的話，用 Google 登入就能接續；也可以到設定用存檔碼匯入。'), skip: tx('開始新冒險') });
      else go();
    });
  }, Math.max(0, 700 - (Date.now() - t0))));
}
function bootScreen() {
  const el = document.createElement('div'); el.id = 'boot';
  el.innerHTML = `<div class="blogo">RAID LEADER</div><div class="bbar"><i></i></div><div class="bmsg">${tx('讀取存檔中…')}</div>`;
  document.body.appendChild(el);
  return { msg: t => { el.querySelector('.bmsg').textContent = t; }, done: () => { el.classList.add('out'); setTimeout(() => el.remove(), 260); } };
}
// 開始畫面：每次開啟遊戲顯示一次（同一個分頁工作階段內不重複）；可切換語言
function showTitle(fresh, onGo) {
  let seen = false; try { seen = sessionStorage.getItem('rl-title') === '1'; } catch (e) { /* ignore */ }
  if (seen) { onGo(); return; }
  const el = document.createElement('div'); el.id = 'title';
  el.innerHTML = `<div class="tbox"><div class="tlogo">RAID LEADER</div>${getLang() === 'en' ? '' : '<div class="tsub">副本團長</div>'}
    <p class="ttag">${tx('帶領你的冒險團，攻下每一座副本。')}</p>
    <button class="btn main tgo" data-act="titlego">${fresh ? tx('開始冒險') : tx('繼續冒險')}</button>
    ${C.cloudEnabled() && !C.loggedIn() && !A.inApp() ? `<button class="linkbtn tlogin" data-act="titlelogin">${tx('已有進度？用 Google 登入接續')}</button>` : ''}
    <div class="seg tlang">${LANGS.map(l => `<button data-act="lang" data-v="${l.id}" class="${l.id === getLang() ? 'sel' : ''}">${l.name}</button>`).join('')}</div>
    <div class="sub num tver">v${VERSION}</div></div>`;
  document.body.appendChild(el);
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-act="titlego"],[data-act="titlelogin"]'); if (!b) return;
    try { sessionStorage.setItem('rl-title', '1'); } catch (err) { /* ignore */ }
    el.classList.add('out'); setTimeout(() => el.remove(), 260); onGo(b.dataset.act === 'titlelogin');
  });
}
window.claude?.hot?.snapshot?.(() => ({ S: app.S }));
// v0.17.2 搬家：舊網址直接跳走；新網址先收下帶過來的存檔再啟動
if (!moveAway()) takeMoved().then(r => {
  window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
  const msg = { moved: tx('已搬到新網址，進度已帶過來'), kept: tx('這台裝置在新網址已有進度，沒有覆蓋'), bad: tx('搬家存檔讀取失敗，可用 Google 登入或存檔碼找回進度') }[r];
  if (msg) { const wait = () => (document.getElementById('title') || document.getElementById('boot') ? setTimeout(wait, 400) : setTimeout(() => toast(msg), 300)); setTimeout(wait, 800); }
});

// 手動開打其他副本／秘境／寶庫時先停掉掛機，避免掛機迴圈與陣容鎖卡住
function stopIdleFor(d) {
  const m = app.S.idleMythic != null, i = app.S.idle != null && app.S.idle !== d;
  if (!m && !i) return;
  app.S.idleMythic = null; if (i) app.S.idle = null;
  clearTimeout(app.pendingRepeat); app.pendingRepeat = null; toast(tx('已停止掛機')); save();
}
// 劇情只播一次：沒看過就播放並記錄，回傳 true；看過了回傳 false（不呼叫 done）
function storyOnce(keys, done) {
  const seen = app.S.story.seen, todo = [].concat(keys).filter(k => STORY[k] && !seen.includes(k));
  if (!todo.length) return false;
  seen.push(...todo); save(); playDialog(todo.flatMap(k => STORY[k]), done || (() => {})); return true;
}
app.storyOnce = storyOnce;
function resumeIdle() {
  if (app.S.idleMythic != null && G.mythicIdleLevel(app.S, app.S.idleMythic)) startMythicIdle(app.S.idleMythic);
  else if (app.S.idle != null && app.S.clears[app.S.idle]) startBattle(app.S.idle);
}
function prepMsg(r, what) {
  const roles = tx('坦 {0}・補 {1}・輸出 {2}', r.roles.tank, r.roles.heal, r.roles.dps), gear = r.swapped ? tx('，換上 {0} 件裝備', r.swapped) : '';
  return r.locked ? tx('掛機中不換陣容，已依{0}調整天賦{1}', what, gear) : tx('已依{0}備戰：{1}{2}', what, roles, gear);
}

function gearMsg(g) {
  if (!g) return '';
  const n = g.bag + g.stash + g.salvaged; if (!n) return '';
  return tx('；卸下 {0} 件裝備{1}{2}', n, g.stash ? tx('（{0} 件進戰利品箱）', g.stash) : '', g.salvaged ? tx('（{0} 件放不下已分解 +{1} 金）', g.salvaged, fmt(g.gold)) : '');
}

// ---------- v0.21.1 推廣準備：登入入口、綁定提示、分享、內建瀏覽器提示 ----------
function once(k) { try { if (sessionStorage.getItem(k)) return false; sessionStorage.setItem(k, '1'); } catch (e) { /* ignore */ } return true; }
// 登入視窗：from 記在事件裡（title／pwa／bind）；next = 關掉視窗或登入後（雲端沒有存檔）要接著做的事
function openLogin(from, next, o = {}) {
  app.loginFrom = from;
  openModal({ type: 'text', login: true, onClose: next || null, html: `<h3>${o.title || tx('用 Google 登入')}</h3>
    <p class="sub" style="margin:0">${o.text || tx('登入後會自動載入你在其他裝置的雲端進度。只會記下 Google 帳號編號，不會儲存 Email 或其他資料。')}</p>
    <div id="gsiBtn" class="gsi"></div>
    <div class="row"><button class="btn grow" data-act="loginskip">${o.skip || tx('先不用')}</button></div>` });
}
// 綁定提示：還沒登入的玩家通關第 2 層、或玩滿 30 分鐘時提醒一次
function maybeBind() {
  const S = app.S, p = S && S.player;
  if (!p || p.bindAsked || app.fresh || app.modal || !C.cloudEnabled() || C.loggedIn() || A.inApp()) return;
  if (document.getElementById('title') || document.getElementById('boot')) return;
  if (app.battle && !app.battle.over && app.tab === 'battle') return;
  const why = S.clears[1] ? 'floor2' : (p.playSec || 0) >= 1800 ? '30min' : '';
  if (!why) return;
  p.bindAsked = 1; save(); T.sendEvent(tx('綁定提示'), why);
  openLogin('bind', null, { title: tx('綁定 Google，進度不怕不見'), text: tx('目前進度只存在這台裝置的瀏覽器。換手機、清除瀏覽紀錄、或改從主畫面開啟時，進度都可能不見。用 Google 登入後會自動備份，換裝置也能接續。'), skip: tx('之後再說') });
}
// 分享給朋友：手機用系統分享選單，不支援就複製連結
async function shareInvite() {
  const url = A.shareUrl(app.S.player.pid), text = tx('一起來當副本團長！手機瀏覽器就能玩的放置團本 RPG，免下載：');
  if (navigator.share) {
    try { await navigator.share({ title: 'RAID LEADER 副本團長', text, url }); T.sendEvent(tx('分享'), 'native'); return; }
    catch (err) { if (err && err.name === 'AbortError') return; }
  }
  openModal({ type: 'text', html: `<h3>${tx('邀請朋友')}</h3><p class="sub" style="margin:0">${tx('把這個連結傳給朋友。朋友從你的連結開始玩，我們就知道是你帶來的。')}</p>
    <textarea id="shareTxt" readonly>${esc(text + ' ' + url)}</textarea>
    <div class="row"><button class="btn main" data-act="sharecopy">${tx('複製')}</button><button class="btn" data-act="closebtn">${tx('關閉')}</button></div>` });
}
// App 內建瀏覽器（IG、FB、Threads、LINE）：提示改用外部瀏覽器，進度與 Google 登入才保得住
function showInApp() {
  const ia = A.inApp(), el = $('#inappBar'); if (!el) return;
  let closed = false; try { closed = sessionStorage.getItem('rl-inapp') === '1'; } catch (e) { /* ignore */ }
  if (!ia || closed) { el.hidden = true; return; }
  if (once('rl-inapp-ev')) T.sendEvent(tx('內建瀏覽器'), `${ia}:${A.platform()}`);
  const href = A.outsideHref(ia);
  const how = href ? tx('點「用瀏覽器開啟」') : A.platform() === 'ios' ? tx('點右上角 ⋯ →「在外部瀏覽器開啟」') : tx('點右上角選單 →「在瀏覽器開啟」');
  el.innerHTML = `<div class="ia-t"><b>${tx('你正在 {0} 裡開啟遊戲', ia)}</b><span>${tx('這裡的進度可能存不住、也無法 Google 登入。請{0}。', how)}</span></div>
    <div class="ia-b">${href ? `<a class="btn sm main" href="${esc(href)}">${tx('用瀏覽器開啟')}</a>` : ''}<button class="btn sm" data-act="inappcopy">${tx('複製連結')}</button><button class="btn sm" data-act="inappclose" aria-label="${tx('關閉')}">✕</button></div>`;
  el.hidden = false;
}

// v0.23 團長配點摘要（事件用）：Lv12 戰術4・士氣6・後勤2・終極 rally
function leaderSummary() {
  const a = G.leaderAlloc(app.S);
  return `Lv${G.leaderLevel(app.S)} ` + Object.keys(G.LEADER_TREE).map(b => `${b[0]}${G.branchPts(a, b)}`).join('/') + ' ' + G.equippedCmds(app.S).join(',');
}
