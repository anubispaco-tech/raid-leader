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
import { viewBag } from './views/bag.js';
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
import { mountGrid } from './grid.js';
import { prefs, setPref } from './prefs.js';
import * as SFX from './sfx.js';

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
    `<button data-tab="${k}" class="${app.tab === k ? 'sel' : ''}" aria-label="${n}"><svg viewBox="0 0 24 24">${ICONS[k]}</svg>${n}${(k === 'battle' && app.battle && !app.battle.over && app.tab !== 'battle') || (k === 'bag' && app.S.stash.length) || (k === 'team' && app.S.heroes.some(h => G.pendingPicks(h))) ? '<span class="dot"></span>' : ''}</button>`).join('');
}
function render(skipModal) {
  achToasts();
  $('#gold').textContent = fmt(app.S.gold);
  $('#idleChip').hidden = !G.partyLocked(app.S);
  renderTabs();
  tutTick();
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
app.afterModal = () => { if (app.modal && app.modal.type === 'settings' && C.cloudEnabled()) { C.mountButton(); C.check(); } };
app.openModal = openModal;
app.renderTabs = renderTabs;

// ---------- 事件 ----------
document.addEventListener('click', e => {
  SFX.unlock(); // v0.20 瀏覽器要求：使用者點過畫面後才能出聲
  const t = e.target.closest('[data-tab],[data-act]');
  if (!t) return;
  if (t.dataset.act === 'close') { if (e.target === t) closeModal(); return; }
  if (t.dataset.tab) { app.tab = t.dataset.tab; app.modal = null; render(); window.scrollTo(0, 0); return; }
  if (t.dataset.closemodal) app.modal = null; // v0.17 指引視窗裡的按鈕：先關視窗再執行
  const a = t.dataset.act, id = t.dataset.id;
  if (a !== 'salvageupto') app.salvConfirm = false;
  if (a !== 'firemany') app.fireConfirm = false;
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
    case 'skip': if (app.battle && !app.battle.over) {
      if (!canSkip(app.battle)) { toast(tx('首次挑戰需完整觀戰（可用 4× 加速）')); break; }
      const b = app.battle; b.opts.autoHorn = true; // 直接結算視同掛機：首領戰自動吹號角
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
document.addEventListener('keydown', e => { if (e.key === 'Escape' && app.modal) closeModal(); });

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
setInterval(() => { if (!document.hidden) { T.tick(5); save(); C.autoTick(); showStuck('time'); } }, 5000);
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
  G.checkAchievements(app.S); // 舊存檔：已達成的成就直接補登，不跳提示
  for (const h of [...app.S.heroes, ...(app.S.tavern || [])]) h.name = localName(h.name);
  for (const it of Object.values(app.S.items)) it.name = it.base || it.set ? G.itemLabel(it) : localName(it.name); // v0.16 名稱由代號組出
  $('.brand-t').innerHTML = svg(BRAND, 'gi-brand'); $('.brand').setAttribute('aria-label', tx('設定')); $('.brand').title = 'RAID LEADER'; $('#idleChip').textContent = tx('掛機中'); document.title = getLang() === 'en' ? 'Raid Leader' : 'RAID LEADER 副本團長';
  document.documentElement.lang = getLang();
  $('#saveChip').textContent = tx('存檔中'); $('#newsBtn').setAttribute('aria-label', tx('公告'));
  N.updateDot(); N.refresh(true);
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
    showTitle(!saved, () => { app.fresh = false; save(); return !saved ? playDialog(PROLOGUE, after) : after(); });
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
    <div class="seg tlang">${LANGS.map(l => `<button data-act="lang" data-v="${l.id}" class="${l.id === getLang() ? 'sel' : ''}">${l.name}</button>`).join('')}</div>
    <div class="sub num tver">v${VERSION}</div></div>`;
  document.body.appendChild(el);
  el.addEventListener('click', e => {
    if (!e.target.closest('[data-act="titlego"]')) return;
    try { sessionStorage.setItem('rl-title', '1'); } catch (err) { /* ignore */ }
    el.classList.add('out'); setTimeout(() => el.remove(), 260); onGo();
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
