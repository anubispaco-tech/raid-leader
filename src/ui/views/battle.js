// ===== 戰鬥分頁與結算畫面 =====
import * as G from '../../core/index.js';
import { app } from '../state.js';
import { $, fmt, pct, toast, hero, cls, inParty, itemStatText, itemName, partyPower, avgPartyIlvl, avgPartyLv } from '../helpers.js';

function unitRow(u, enemy) {
  const dead = u.hp <= 0;
  const bar = enemy ? 'enemy-bar' : 'role-' + u.role;
  return `<div class="unit ${dead ? 'dead' : ''} ${u.boss ? 'boss' : ''}">
    <div class="ic">${enemy ? (u.boss ? '👑' : '👾') : u.icon}</div>
    <div class="nm">${u.name}${enemy ? '' : `<small>${G.CLASSES[u.cls].name}</small>`}</div>
    <div class="hpn num">${fmt(u.hp)} / ${fmt(u.max)}</div>
    <div class="bar"><i class="${bar}" style="width:${pct(u.hp, u.max)}%"></i></div></div>`;
}
export function viewBattle() {
  if (!app.battle) return `<h2>戰鬥</h2><div class="empty">目前沒有進行中的戰鬥。<br>到「副本」選一層開始挑戰。<br><br><button class="btn main" data-tab="dungeon">前往副本</button></div>`;
  const d = G.dungeonInfo(app.battle.dIdx), b = app.battle;
  let h = `<div class="bhead"><h2>${d.name}</h2><span class="sub num" style="margin:0">${b.tick}s</span>
    <div class="waves">${b.waves.map((_, i) => `<i class="${i < b.waveIdx || (b.over && b.win) ? 'done' : i === b.waveIdx ? 'cur' : ''}"></i>`).join('')}</div></div>
    <div class="arena">
      <div class="side"><span class="label">敵方・${b.waveIdx === b.waves.length - 1 ? '首領戰' : `第 ${b.waveIdx + 1} 波`}</span>${b.enemies.filter(e => e.hp > 0 || e.boss).slice(0, 7).map(e => unitRow(e, true)).join('')}</div>
      <div class="side"><span class="label">我方隊伍</span>${b.units.map(u => unitRow(u, false)).join('')}</div>
    </div>
    <div class="log" aria-live="polite">${b.log.map(l => `<p class="${l.cls}"><span class="t">${String(l.t).padStart(3, ' ')}</span>${l.msg}</p>`).join('')}</div>`;
  if (!b.over) {
    h += `<div class="ctrl"><div class="seg">${[1, 2, 4].map(x => `<button data-act="speed" data-x="${x}" class="${app.speed === x ? 'sel' : ''}">${x}×</button>`).join('')}</div>
      <button class="btn" data-act="skip">直接結算</button>
      <button class="btn" data-act="retreat">撤退</button></div>`;
  }
  if (b.over && app.lastResult) h += viewResult();
  return h;
}
function viewResult() {
  const r = app.lastResult, b = app.battle;
  const dmgMax = Math.max(1, ...b.units.map(u => Math.max(u.dmgDone, u.healDone)));
  const sec = Math.max(1, b.tick);
  let h = `<div class="result ${b.win ? 'win' : 'lose'}"><h3>${b.win ? '通關' : '失敗'}</h3>
    <div class="rew"><span><i class="coin" style="display:inline-block"></i> <b class="num">+${fmt(r.gold)}</b> 金幣</span><span><b class="num">+${fmt(r.xp)}</b> 經驗</span>${r.first ? '<span style="color:var(--brass)">首通獎勵：保底稀有</span>' : ''}${r.decayed ? '<span style="color:var(--warn)">等級壓制：經驗與金幣遞減，該往下一層了</span>' : ''}</div>`;
  if (r.lvUps.length) h += `<div style="color:var(--good);font-size:14px">⬆ ${r.lvUps.map(x => `${x.name} 升到 Lv${x.level}`).join('、')}</div>`;
  if (r.kept.length || r.salvaged) h += `<div class="stack">${r.kept.map(it => `<div class="item rar${it.rarity}"><div class="in">${itemName(it)}</div><div class="il">${G.SLOTS[it.slot]}<b class="num">${it.ilvl}</b></div><div class="is">${itemStatText(it)}</div></div>`).join('')}${r.salvaged ? `<div class="sub" style="margin:0">${r.salvaged} 件自動分解為金幣</div>` : ''}</div>`;
  h += `<div class="meter"><span class="label">傷害 / 治療統計（每秒）</span>${b.units.map(u => {
    const v = u.role === 'heal' ? u.healDone : u.dmgDone;
    return `<div class="mrow"><span>${u.icon} ${u.name}</span><span class="mb"><i class="role-${u.role}" style="width:${pct(v, dmgMax)}%"></i></span><span class="num" style="text-align:right">${fmt(v / sec)}${u.role === 'heal' ? ' HPS' : ' DPS'}</span></div>`;
  }).join('')}</div>`;
  if (!b.win) h += `<div class="sub" style="margin:0">${failHint(b)}</div>`;
  h += `<div class="row">${app.pendingRepeat ? `<span class="sub" style="margin:0;align-self:center">掛機中，3 秒後自動再戰…</span>` : ''}
    <button class="btn main grow" data-act="fight" data-d="${b.dIdx}">再打一次</button>
    ${r.kept.length ? `<button class="btn" data-act="autoequip">一鍵配裝</button>` : ''}
    <button class="btn" data-tab="dungeon">返回副本</button></div></div>`;
  return h;
}
function failHint(b) {
  const tank = b.units.find(u => u.role === 'tank'), heal = b.units.find(u => u.role === 'heal');
  if (b.tick >= G.DUNGEON.maxTicks) return '提示：時間耗盡，輸出不足。補強輸出或強化武器。';
  if (!tank) return '提示：隊伍沒有坦克，敵人會隨機攻擊脆皮隊員。';
  if (!heal) return '提示：隊伍沒有治療，長時間戰鬥撐不住。';
  if (tank.hp <= 0 && b.units.filter(u => u.hp > 0).length === 0 && tank.taken > tank.max) return '提示：坦克先倒，試著強化坦克的護甲與耐力，或多帶一位治療。';
  return '提示：回前一層刷裝備與等級，或調整陣容（法師清小怪、盜賊打首領）。';
}
