// ===== 戰鬥分頁與結算畫面 =====
import { tx } from '../../core/i18n.js';
import * as G from '../../core/index.js';
import { app, canSkip } from '../state.js';
import { fmt, pct, mmss, itemStatText, itemName, firstWinLine } from '../helpers.js';
import { enemyIcon, svg, HORN } from '../icons.js';
import { prefs } from '../prefs.js';

// 敵方最多顯示 4 列、固定高度，召喚物變多時不會把下面的東西往下推
const MAX_FOE_ROWS = 4;
function enemyRows(b) {
  const list = b.enemies.filter(e => e.hp > 0 || e.boss).sort((x, y) => y.boss - x.boss);
  const more = list.length - MAX_FOE_ROWS;
  return list.slice(0, MAX_FOE_ROWS).map(e => unitRow(e, true)).join('') + (more > 0 ? tx('<div class="more">另外 {0} 隻</div>', more) : '');
}
function unitRow(u, enemy) {
  const dead = u.hp <= 0;
  const bar = enemy ? 'enemy-bar' : 'role-' + u.role;
  return `<div class="unit ${dead ? 'dead' : ''} ${u.boss ? 'boss' : ''}">
    <div class="ic">${enemy ? enemyIcon(u) : u.icon}</div>
    <div class="nm">${enemy ? u.name : `<span class="c${u.rarity || 0}">${u.name}</span><small>${G.CLASSES[u.cls].name}</small>`}</div>
    <div class="hpn num">${fmt(u.hp)} / ${fmt(u.max)}</div>
    <div class="bar"><i class="${bar}" style="width:${pct(u.hp, u.max)}%"></i></div></div>`;
}
export function viewBattle() {
  if (!app.battle) return tx('<h2>戰鬥</h2><div class="empty">目前沒有進行中的戰鬥。<br>到「副本」選一層開始挑戰。<br><br><button class="btn main" data-tab="dungeon">前往副本</button></div>');
  const d = G.dungeonInfo(app.battle.dIdx), b = app.battle;
  if (b.vault) d.name = tx('寶庫・第 {0} 層', G.ROMAN[b.vault.floor]);
  if (prefs.fx !== 'off') return viewBattleGrid(b, d) + ctrlBar(b);
  let h = tx('<div class="bhead"><h2>{0}{1}</h2><span class="sub num" style="margin:0">{2}s</span> {3}{4}{13}</div> {5}{6} {11}<div class="arena{12}"> <div class="side foes"><span class="label">敵方・{7}</span>{8}</div> <div class="side"><span class="label">我方隊伍</span>{9}</div> </div> <div class="log" aria-live="polite">{10}</div>', d.name, b.mythic ? ` <span class="keystone sm num">+${b.mythic.level}</span>` : '', b.tick, b.vault ? '' : `<div class="waves">`, b.vault ? '' : b.waves.map((_, i) => `<i class="${i < b.waveIdx || (b.over && b.win) ? 'done' : i === b.waveIdx ? 'cur' : ''}"></i>`).join('') + '</div>', b.mythic ? mythicTimerBar(b) : '', b.vault ? vaultBar(b) : '', b.waveIdx === b.waves.length - 1 ? tx('首領戰') : tx('第 {0} 波', b.waveIdx + 1), enemyRows(b), b.units.map(u => unitRow(u, false)).join(''), b.log.map(l => `<p class="${l.cls}"><span class="t">${String(l.t).padStart(3, ' ')}</span>${l.msg}</p>`).join(''), prefs.fx !== 'off' ? '<div id="gridSlot" class="gridslot"></div>' : ((b.actMode || (b.cmds && b.cmds.length)) ? partyStrip(b) : ''), prefs.fx !== 'off' ? ' compact' : '', (prefs.fx !== 'off' ? isoBtn() : '') + muteBtn());
  h += ctrlBar(b);
  if (b.over && app.lastResult) h += viewResult();
  return h;
}
function mythicTimerBar(b) {
  const T = b.mythic.timer, left = T - b.tick, over = left < 0;
  return `<div class="mtimer ${over ? 'over' : ''}"><div class="mtrack"><i style="width:${pct(Math.min(b.tick, T), T)}%"></i><em style="left:${G.MYTHIC.bonusAt * 100}%"></em></div>
    <span class="num">${over ? tx('超時 {0}', mmss(-left)) : tx('剩 {0}', mmss(left))}</span></div>
    <div class="chips">${b.mythic.affixes.map(a => `<span class="chip">${G.AFFIXES[a].name}</span>`).join('')}</div>`;
}
function vaultBar(b) {
  const left = Math.max(0, b.vault.dur - b.tick), f = b.vault.floor, cap = G.vaultMaxKills(f);
  return tx('<div class="mtimer"><div class="mtrack"><i style="width:{0}%"></i></div><span class="num">剩 {1}</span></div> <div class="vaultcount"><b class="num">{2}</b> 隻哥布林・<span class="num">+{3}</span> 金{4}</div>', pct(b.tick, b.vault.dur), mmss(left), b.kills, fmt(Math.min(b.kills, cap) * G.vaultGoldPerKill(f)), (G.vaultDustPar(f) ? tx('・+{0} 精華', G.vaultDust(f, b.kills)) : '') + (b.kills >= cap ? tx('（已達金幣上限）') : tx('<span class="sub" style="margin:0">　金幣算到 {0} 隻</span>', cap)));
}
// v0.20.1 格子模式（手機優先）：標題 → 結算（打完時置頂）→ 敵方一行血條 → 格子 → 我方橫排血條 → 戰鬥紀錄
function viewBattleGrid(b, d) {
  let h = `<div class="bhead"><h2>${d.name}${b.mythic ? ` <span class="keystone sm num">+${b.mythic.level}</span>` : ''}</h2><span class="sub num" style="margin:0">${b.tick}s</span> ${b.vault ? '' : `<div class="waves">${b.waves.map((_, i) => `<i class="${i < b.waveIdx || (b.over && b.win) ? 'done' : i === b.waveIdx ? 'cur' : ''}"></i>`).join('')}</div>`}${isoBtn()}${muteBtn()}</div>`;
  h += (b.mythic ? mythicTimerBar(b) : '') + (b.vault ? vaultBar(b) : '');
  if (b.over && app.lastResult) h += viewResult();
  h += foeBar(b) + '<div id="gridSlot" class="gridslot"></div>' + partyStrip(b);
  h += `<div class="log short" aria-live="polite">${b.log.map(l => `<p class="${l.cls}"><span class="t">${String(l.t).padStart(3, ' ')}</span>${l.msg}</p>`).join('')}</div>`;
  return h;
}
// 敵方只留一行：首領戰顯示首領血條（雙首領兩條），小怪波顯示剩幾隻＋合計血量
function foeBar(b) {
  const bosses = b.enemies.filter(e => e.boss);
  if (bosses.length) return `<div class="foebar">${bosses.map(e => `<div class="fb ${e.hp <= 0 ? 'dead' : ''}"><span class="ic">${enemyIcon(e)}</span><span class="nm">${e.name}${e.bshield > 0 ? ` <small class="shield">${tx('護盾')}</small>` : ''}${e.casting ? ` <small class="casting">${e.casting.charm ? tx('魅惑之歌') : tx('讀條中')}</small>` : ''}${tideTag(b, e)}</span><span class="num">${Math.ceil(pct(e.hp, e.max))}%</span><span class="bar"><i class="enemy-bar" style="width:${pct(e.hp, e.max)}%"></i></span></div>`).join('')}</div>`;
  const alive = b.enemies.filter(e => e.hp > 0), hp = alive.reduce((a, e) => a + e.hp, 0), max = b.enemies.reduce((a, e) => a + e.max, 0) || 1;
  return `<div class="foebar"><div class="fb"><span class="nm">${b.waveIdx === b.waves.length - 1 ? tx('首領戰') : tx('第 {0} 波', b.waveIdx + 1)}・${tx('剩 {0} 隻', alive.length)}</span><span class="num">${Math.ceil(pct(hp, max))}%</span><span class="bar"><i class="enemy-bar" style="width:${pct(hp, max)}%"></i></span></div></div>`;
}
// v0.25 潮汐狀態標籤（只標在帶潮汐機制的首領旁）
const tideTag = (b, e) => !b.tide || b.tide.src !== e.id ? '' : b.tideHigh() ? ` <small class="tide">${tx('漲潮')} ${b.tide.high - b.tick}s</small>` : b.tideLow() ? ` <small class="ebb">${tx('退潮')} ${b.tide.low - b.tick}s</small>` : '';
// 我方 5 人一排：第一行職業圖示＋名字、血條、第三行主動技能圖示（冷卻環）＋血量%
// v0.24.1：技能名不再蓋在卡片上（名字照常顯示），可以施放時圖示發亮；施放時格子上的隊員頭上會跳出技能名
const shortName = n => String(n).split('・')[0];
function partyStrip(b) {
  return `<div class="pstrip">${b.units.map(u => {
    const A = u.act && G.ACTIVES[u.act.key], ready = A && b.activeReady(u), left = A ? Math.max(0, u.act.ready - b.tick) : 0;
    const dead = u.hp <= 0, hp = dead ? '✕' : Math.ceil(pct(u.hp, u.max)) + '%';
    const cdPct = A && !ready && !dead ? Math.min(100, Math.round(left / (u.act.used ? G.ACTIVE.cd : G.ACTIVE.first) * 100)) : 0;
    const sk = A ? `<span class="skic ${ready ? 'ready' : ''}" style="--cd:${cdPct}%">${svg(A.icon)}${!ready && !dead && left ? `<b class="num">${left}</b>` : ''}</span>` : '';
    const inner = `<span class="ic">${u.icon}</span><span class="pn">${shortName(u.name)}</span><span class="bar"><i class="role-${u.role}" style="width:${pct(u.hp, u.max)}%"></i></span>${sk}<span class="num hp">${hp}</span>`;
    const label = `${u.name} ${hp}` + (A ? `・${A.name}${ready ? tx('（可施放）') : ''}` : '');
    return A && !b.over
      ? `<button class="pc act ${dead ? 'dead' : ''} ${ready ? 'ready' : ''} ${u.charmed > b.tick ? 'charmed' : ''}" data-act="active" data-id="${u.id}" ${ready ? '' : 'aria-disabled="true"'} title="${A.name}：${A.desc}" aria-label="${label}">${inner}</button>`
      : `<div class="pc ${dead ? 'dead' : ''} ${u.charmed > b.tick ? 'charmed' : ''}" title="${u.name}" aria-label="${label}">${inner}</div>`;
  }).join('')}</div>` + cmdRow(b);
}
// v0.24 團長指令列（號角在下方控制列，這裡放天賦樹點出來的指令，最多兩個）
function cmdRow(b) {
  if (!b.cmds || !b.cmds.length || b.over) return '';
  return `<div class="cmdrow">${b.cmds.map(c => { const C = G.COMMANDS[c], used = b.cmdUsed[c];
    return `<button class="btn sm cmdbtn ${used ? '' : 'ready'}" data-act="cmd" data-v="${c}" ${used ? 'disabled' : ''} title="${C.desc}">${svg(C.icon)}${C.name}${used ? tx('・已用') : ''}</button>`; }).join('')}</div>`;
}
function ctrlBar(b) {
  return b.over ? '' : tx('<div class="ctrlbar"><div class="ctrl"><div class="seg">{0}</div> {1} {2} <button class="btn" data-act="retreat">撤退</button></div></div>', [1, 2, 4].map(x => `<button data-act="speed" data-x="${x}" class="${app.speed === x ? 'sel' : ''}">${x}×</button>`).join(''), hornBtn(b), canSkip(b) ? tx('<button class="btn" data-act="skip">直接結算</button>') : tx('<button class="btn" disabled title="首次挑戰需完整觀戰（可用 4× 加速）">🔒 結算</button>'));
}
// v0.20 立體／平面快速切換（顯示目前的視角）
function isoBtn() {
  return `<button class="hbtn viewbtn ${prefs.iso ? 'on' : ''}" data-act="isotog" aria-pressed="${prefs.iso}" aria-label="${prefs.iso ? tx('切換成平面視角') : tx('切換成立體視角')}">${prefs.iso ? '3D' : '2D'}</button>`;
}
// v0.20 音效快速開關
function muteBtn() {
  return `<button class="hbtn mute ${prefs.sound ? '' : 'off'}" data-act="mute" aria-pressed="${prefs.sound}" aria-label="${prefs.sound ? tx('關閉音效') : tx('開啟音效')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z"/>${prefs.sound ? '<path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>' : '<path d="m16 9 5 6M21 9l-5 6"/>'}</svg></button>`;
}
function hornBtn(b) {
  const on = b.hornActive(), left = b.horn.until - b.tick;
  return tx('<button class="btn horn {0}" data-act="horn" {1} aria-label="英勇號角">{3}{2}</button>', on ? 'on' : '', b.horn.used ? 'disabled' : '', on ? `${left}s` : b.horn.used ? tx('已用') : tx('號角'), svg(HORN));
}
function viewResult() {
  const r = app.lastResult, b = app.battle;
  const dmgMax = Math.max(1, ...b.units.map(u => Math.max(u.dmgDone, u.healDone)));
  const sec = Math.max(1, b.tick);
  const title = r.vault ? tx('打倒 {0} 隻哥布林', r.kills) : r.mythicIdle ? (b.win ? tx('秘境掛機・通關') : tx('秘境掛機・失敗')) : r.mythic ? (r.inTime ? tx('限時通關') : b.win ? tx('超時通關') : tx('失敗')) : (b.win ? tx('通關') : tx('失敗'));
  let h = tx('<div class="result {0}"><h3>{1}</h3>{2} {3} <div class="rew"><span><i class="coin" style="display:inline-block"></i> <b class="num">+{4}</b> 金幣</span><span><b class="num">+{5}</b> 經驗</span>{6}{7}</div>', (r.vault || (r.mythic ? r.inTime : b.win)) ? 'win' : 'lose', title, r.vault && r.record ? tx('<span class="newrec" style="justify-self:start">本層新紀錄</span>') : '', r.mythicIdle ? tx('<div class="sub" style="margin:0">掛機等級 +{0}・鑰石不變（目前 +{1}）・獎勵 {2}%</div>', b.mythic.level, G.keyOf(app.S, b.dIdx), Math.round(G.MYTHIC.idleMult * 100)) : r.mythic ? tx('<div class="keychange"><span class="keystone num">+{0}</span><span class="arrow">→</span><span class="keystone num {1}">+{2}</span> <span class="sub" style="margin:0">用時 <b class="num">{3}</b> / 限時 {4}</span>{5}</div>', r.prevKey, r.nextKey > r.prevKey ? 'up' : r.nextKey < r.prevKey ? 'down' : '', r.nextKey, mmss(b.tick), mmss(b.mythic.timer), r.record ? tx('<span class="newrec">新紀錄</span>') : '') : '', fmt(r.gold), fmt(r.xp), (r.dust ? `<span class="dust"><b class="num">+${r.dust}</b> ${tx('精華')}</span>` : '') + (r.first ? tx('<span style="color:var(--brass)">首次通關：必掉稀有以上</span>') : ''), r.decayed ? `<span style="color:var(--warn)">${b.dIdx === G.DUNGEONS.length - 1 ? tx('等級壓制：獎勵最低保留 {0}%，想要更多可以改用秘境掛機', Math.round(G.REWARD.decayFloorTop * 100)) : tx('這層對你太簡單了，經驗與金幣變少，往下一層吧')}</span>` : '');
  h += firstWinLine(r.firstWin);
  if (r.lvUps.length) h += `<div style="color:var(--good);font-size:14px">⬆ ${r.lvUps.map(x => tx('{0} 升到 {1}', x.name, x.para ? tx('巔峰 {0}', x.para) : `Lv${x.level}`)).join(tx('、'))}</div>`;
  if (r.kept.length || r.stashed.length || r.salvaged) h += `<div class="stack">${r.kept.map(it => `<div class="item rar${it.rarity}"><div class="in">${itemName(it)}</div><div class="il">${G.SLOTS[it.slot]}<b class="num">${it.ilvl}</b></div><div class="is">${itemStatText(it)}</div></div>`).join('')}${r.stashed.length ? tx('<div style="color:var(--brass);font-size:13px">背包已滿，{0} 件放進戰利品箱</div>', r.stashed.length) : ''}${r.salvaged ? tx('<div class="sub" style="margin:0">{0} 件自動分解為金幣與精華</div>', r.salvaged) : ''}</div>`;
  h += tx('<div class="meter"><span class="label">傷害 / 治療統計（每秒）</span>{0}</div>', b.units.map(u => {
    const v = u.role === 'heal' ? u.healDone : u.dmgDone;
    const sk = u.dmgDone ? Math.round(100 * u.skillDmg / u.dmgDone) : 0;
    return `<div class="mrow"><span>${u.icon} ${u.name}${u.role !== 'heal' && sk ? tx('<small class="num">技能 {0}%</small>', sk) : ''}</span><span class="mb"><i class="role-${u.role}" style="width:${pct(v, dmgMax)}%"></i></span><span class="num" style="text-align:right">${fmt(v / sec)}${u.role === 'heal' ? ' HPS' : ' DPS'}</span></div>`;
  }).join(''));
  if (!b.win && !r.vault) h += `<div class="sub" style="margin:0">${failHint(b)}</div>`;
  h += tx('<div class="row">{0} {1} {2} <button class="btn" data-tab="dungeon">返回副本</button></div></div>', app.pendingRepeat ? tx('<span class="sub" style="margin:0;align-self:center">掛機中，3 秒後自動再戰…</span>') : '', r.vault ? (G.vaultLeft(app.S) ? tx('<button class="btn main grow" data-act="vault" data-d="{0}">再打一次（今天剩 {1} 次）</button>', b.vault.floor, G.vaultLeft(app.S)) : tx('<span class="sub" style="margin:0;align-self:center">今天的寶庫次數用完了</span>'))
      : r.mythicIdle ? (app.S.idleMythic != null ? tx('<button class="btn grow" data-act="idlemythic" data-d="{0}">停止秘境掛機</button>', b.dIdx) : '')
      : `<button class="btn main grow" data-act="${r.mythic ? 'mythic' : 'fight'}" data-d="${b.dIdx}">${r.mythic ? tx('再挑戰 +{0}（體力 {1}）', r.nextKey, G.stamina(app.S).pts) : tx('再打一次')}</button>`, r.kept.length ? tx('<button class="btn" data-act="autoequip">一鍵配裝</button>') : '');
  return h;
}
function failHint(b) {
  const tank = b.units.find(u => u.role === 'tank'), heal = b.units.find(u => u.role === 'heal');
  if (b.tick >= G.DUNGEON.maxTicks) return tx('提示：時間耗盡，輸出不足。補強輸出或強化武器。');
  if (!tank) return tx('提示：隊伍沒有坦克，敵人會到處亂打脆皮隊員。');
  if (!heal) return tx('提示：隊伍沒有治療，長時間戰鬥撐不住。');
  if (tank.hp <= 0 && b.units.filter(u => u.hp > 0).length === 0 && tank.taken > tank.max) return tx('提示：坦克先倒，試著強化坦克的護甲與耐力，或多帶一位治療。');
  return tx('提示：回前一層刷裝備與等級，或按「備戰」換個陣容。');
}
