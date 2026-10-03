// ===== 戰鬥分頁與結算畫面 =====
import * as G from '../../core/index.js';
import { app } from '../state.js';
import { fmt, pct, mmss, itemStatText, itemName } from '../helpers.js';

// 敵方最多顯示 4 列、固定高度，召喚物變多時不會把下面的東西往下推
const MAX_FOE_ROWS = 4;
function enemyRows(b) {
  const list = b.enemies.filter(e => e.hp > 0 || e.boss).sort((x, y) => y.boss - x.boss);
  const more = list.length - MAX_FOE_ROWS;
  return list.slice(0, MAX_FOE_ROWS).map(e => unitRow(e, true)).join('') + (more > 0 ? `<div class="more">另外 ${more} 隻</div>` : '');
}
function unitRow(u, enemy) {
  const dead = u.hp <= 0;
  const bar = enemy ? 'enemy-bar' : 'role-' + u.role;
  return `<div class="unit ${dead ? 'dead' : ''} ${u.boss ? 'boss' : ''}">
    <div class="ic">${enemy ? (u.boss ? '👑' : '👾') : u.icon}</div>
    <div class="nm">${enemy ? u.name : `<span class="c${u.rarity || 0}">${u.name}</span><small>${G.CLASSES[u.cls].name}</small>`}</div>
    <div class="hpn num">${fmt(u.hp)} / ${fmt(u.max)}</div>
    <div class="bar"><i class="${bar}" style="width:${pct(u.hp, u.max)}%"></i></div></div>`;
}
export function viewBattle() {
  if (!app.battle) return `<h2>戰鬥</h2><div class="empty">目前沒有進行中的戰鬥。<br>到「副本」選一層開始挑戰。<br><br><button class="btn main" data-tab="dungeon">前往副本</button></div>`;
  const d = G.dungeonInfo(app.battle.dIdx), b = app.battle;
  if (b.vault) d.name = `寶庫・第 ${b.vault.floor + 1} 層`;
  let h = `<div class="bhead"><h2>${d.name}${b.mythic ? ` <span class="keystone sm num">+${b.mythic.level}</span>` : ''}</h2><span class="sub num" style="margin:0">${b.tick}s</span>
    ${b.vault ? '' : `<div class="waves">`}${b.vault ? '' : b.waves.map((_, i) => `<i class="${i < b.waveIdx || (b.over && b.win) ? 'done' : i === b.waveIdx ? 'cur' : ''}"></i>`).join('') + '</div>'}</div>
    ${b.mythic ? mythicTimerBar(b) : ''}${b.vault ? vaultBar(b) : ''}
    <div class="arena">
      <div class="side foes"><span class="label">敵方・${b.waveIdx === b.waves.length - 1 ? '首領戰' : `第 ${b.waveIdx + 1} 波`}</span>${enemyRows(b)}</div>
      <div class="side"><span class="label">我方隊伍</span>${b.units.map(u => unitRow(u, false)).join('')}</div>
    </div>
    <div class="log" aria-live="polite">${b.log.map(l => `<p class="${l.cls}"><span class="t">${String(l.t).padStart(3, ' ')}</span>${l.msg}</p>`).join('')}</div>`;
  if (!b.over) {
    h += `<div class="ctrlbar"><div class="ctrl"><div class="seg">${[1, 2, 4].map(x => `<button data-act="speed" data-x="${x}" class="${app.speed === x ? 'sel' : ''}">${x}×</button>`).join('')}</div>
      ${hornBtn(b)}
      <button class="btn" data-act="skip">直接結算</button>
      <button class="btn" data-act="retreat">撤退</button></div></div>`;
  }
  if (b.over && app.lastResult) h += viewResult();
  return h;
}
function mythicTimerBar(b) {
  const T = b.mythic.timer, left = T - b.tick, over = left < 0;
  return `<div class="mtimer ${over ? 'over' : ''}"><div class="mtrack"><i style="width:${pct(Math.min(b.tick, T), T)}%"></i><em style="left:${G.MYTHIC.bonusAt * 100}%"></em></div>
    <span class="num">${over ? `超時 ${mmss(-left)}` : `剩 ${mmss(left)}`}</span></div>
    <div class="chips">${b.mythic.affixes.map(a => `<span class="chip">${G.AFFIXES[a].name}</span>`).join('')}</div>`;
}
function vaultBar(b) {
  const left = Math.max(0, b.vault.dur - b.tick), f = b.vault.floor, cap = G.vaultMaxKills(f);
  return `<div class="mtimer"><div class="mtrack"><i style="width:${pct(b.tick, b.vault.dur)}%"></i></div><span class="num">剩 ${mmss(left)}</span></div>
    <div class="vaultcount"><b class="num">${b.kills}</b> 隻哥布林・<span class="num">+${fmt(Math.min(b.kills, cap) * G.vaultGoldPerKill(f))}</span> 金${b.kills >= cap ? '（已達金幣上限）' : `<span class="sub" style="margin:0">　金幣算到 ${cap} 隻</span>`}</div>`;
}
function hornBtn(b) {
  const on = b.hornActive(), left = b.horn.until - b.tick;
  return `<button class="btn horn ${on ? 'on' : ''}" data-act="horn" ${b.horn.used ? 'disabled' : ''} aria-label="英勇號角">📯 ${on ? `${left}s` : b.horn.used ? '已用' : '號角'}</button>`;
}
function viewResult() {
  const r = app.lastResult, b = app.battle;
  const dmgMax = Math.max(1, ...b.units.map(u => Math.max(u.dmgDone, u.healDone)));
  const sec = Math.max(1, b.tick);
  const title = r.vault ? `打倒 ${r.kills} 隻哥布林` : r.mythic ? (r.inTime ? '限時通關' : b.win ? '超時通關' : '失敗') : (b.win ? '通關' : '失敗');
  let h = `<div class="result ${(r.vault || (r.mythic ? r.inTime : b.win)) ? 'win' : 'lose'}"><h3>${title}</h3>${r.vault && r.record ? '<span class="newrec" style="justify-self:start">本層新紀錄</span>' : ''}
    ${r.mythic ? `<div class="keychange"><span class="keystone num">+${r.prevKey}</span><span class="arrow">→</span><span class="keystone num ${r.nextKey > r.prevKey ? 'up' : r.nextKey < r.prevKey ? 'down' : ''}">+${r.nextKey}</span>
      <span class="sub" style="margin:0">用時 <b class="num">${mmss(b.tick)}</b> / 限時 ${mmss(b.mythic.timer)}</span>${r.record ? '<span class="newrec">新紀錄</span>' : ''}</div>` : ''}
    <div class="rew"><span><i class="coin" style="display:inline-block"></i> <b class="num">+${fmt(r.gold)}</b> 金幣</span><span><b class="num">+${fmt(r.xp)}</b> 經驗</span>${r.first ? '<span style="color:var(--brass)">首次通關：必掉稀有以上</span>' : ''}${r.decayed ? '<span style="color:var(--warn)">這層對你太簡單了，經驗與金幣變少，往下一層吧</span>' : ''}</div>`;
  if (r.lvUps.length) h += `<div style="color:var(--good);font-size:14px">⬆ ${r.lvUps.map(x => `${x.name} 升到 Lv${x.level}`).join('、')}</div>`;
  if (r.kept.length || r.stashed.length || r.salvaged) h += `<div class="stack">${r.kept.map(it => `<div class="item rar${it.rarity}"><div class="in">${itemName(it)}</div><div class="il">${G.SLOTS[it.slot]}<b class="num">${it.ilvl}</b></div><div class="is">${itemStatText(it)}</div></div>`).join('')}${r.stashed.length ? `<div style="color:var(--brass);font-size:13px">背包已滿，${r.stashed.length} 件放進戰利品箱</div>` : ''}${r.salvaged ? `<div class="sub" style="margin:0">${r.salvaged} 件自動分解為金幣</div>` : ''}</div>`;
  h += `<div class="meter"><span class="label">傷害 / 治療統計（每秒）</span>${b.units.map(u => {
    const v = u.role === 'heal' ? u.healDone : u.dmgDone;
    const sk = u.dmgDone ? Math.round(100 * u.skillDmg / u.dmgDone) : 0;
    return `<div class="mrow"><span>${u.icon} ${u.name}${u.role !== 'heal' && sk ? `<small class="num">技能 ${sk}%</small>` : ''}</span><span class="mb"><i class="role-${u.role}" style="width:${pct(v, dmgMax)}%"></i></span><span class="num" style="text-align:right">${fmt(v / sec)}${u.role === 'heal' ? ' HPS' : ' DPS'}</span></div>`;
  }).join('')}</div>`;
  if (!b.win && !r.vault) h += `<div class="sub" style="margin:0">${failHint(b)}</div>`;
  h += `<div class="row">${app.pendingRepeat ? `<span class="sub" style="margin:0;align-self:center">掛機中，3 秒後自動再戰…</span>` : ''}
    ${r.vault ? (G.vaultLeft(app.S) ? `<button class="btn main grow" data-act="vault" data-d="${b.vault.floor}">再打一次（今天剩 ${G.vaultLeft(app.S)} 次）</button>` : '<span class="sub" style="margin:0;align-self:center">今天的寶庫次數用完了</span>')
      : `<button class="btn main grow" data-act="${r.mythic ? 'mythic' : 'fight'}" data-d="${b.dIdx}">${r.mythic ? `再挑戰 +${r.nextKey}` : '再打一次'}</button>`}
    ${r.kept.length ? `<button class="btn" data-act="autoequip">一鍵配裝</button>` : ''}
    <button class="btn" data-tab="dungeon">返回副本</button></div></div>`;
  return h;
}
function failHint(b) {
  const tank = b.units.find(u => u.role === 'tank'), heal = b.units.find(u => u.role === 'heal');
  if (b.tick >= G.DUNGEON.maxTicks) return '提示：時間耗盡，輸出不足。補強輸出或強化武器。';
  if (!tank) return '提示：隊伍沒有坦克，敵人會到處亂打脆皮隊員。';
  if (!heal) return '提示：隊伍沒有治療，長時間戰鬥撐不住。';
  if (tank.hp <= 0 && b.units.filter(u => u.hp > 0).length === 0 && tank.taken > tank.max) return '提示：坦克先倒，試著強化坦克的護甲與耐力，或多帶一位治療。';
  return '提示：回前一層刷裝備與等級，或按「備戰」換個陣容。';
}
