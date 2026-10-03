// ===== 背包分頁（含戰利品箱與分解設定）=====
import * as G from '../../core/index.js';
import { app } from '../state.js';
import { itemStatText, itemName } from '../helpers.js';

function bestUpgradeFor(it) { // 是否比某位出戰者身上的更好
  return G.partyHeroes(app.S).some(h => { const cur = h.gear[it.slot] && app.S.items[h.gear[it.slot]]; return !cur || G.itemScore(it) > G.itemScore(cur); });
}
const seg = (act, cur, opts) => `<div class="seg">${opts.map(([v, n]) => `<button data-act="${act}" data-v="${v}" class="${cur === v ? 'sel' : ''}">${n}</button>`).join('')}</div>`;
const itemRow = (it, act = 'item') => `<button class="item rar${it.rarity}" data-act="${act}" data-id="${it.id}">
    <div class="in">${itemName(it)}${bestUpgradeFor(it) ? '<span class="better">▲ 可提升</span>' : ''}</div>
    <div class="il">${G.SLOTS[it.slot]}<b class="num">${it.ilvl}</b></div>
    <div class="is num">${G.RARITY[it.rarity].name}・${itemStatText(it)}</div></button>`;

export function viewBag() {
  const S = app.S, E = G.ECONOMY;
  const items = S.bag.map(id => S.items[id]).filter(Boolean)
    .filter(it => app.invFilter === 'all' || it.slot === app.invFilter)
    .sort((a, b) => G.itemScore(b) - G.itemScore(a));
  const full = S.bag.length >= E.bagMax;
  let h = `<h2>背包 <span class="sub num ${full ? 'warnc' : ''}">${S.bag.length}/${E.bagMax}</span></h2>`;
  if (S.stash.length) {
    h += `<div class="stashbox"><div class="row" style="align-items:center"><b>戰利品箱</b><span class="sub num" style="margin:0">${S.stash.length}/${E.stashMax}</span>
      <span class="sub" style="margin:0 0 0 auto">背包滿時暫存在這裡</span></div>
      <div class="stack">${S.stash.map(id => S.items[id]).sort((a, b) => G.itemScore(b) - G.itemScore(a)).slice(0, 5).map(it => itemRow(it)).join('')}
      ${S.stash.length > 5 ? `<div class="sub" style="margin:0">還有 ${S.stash.length - 5} 件</div>` : ''}</div>
      <div class="row"><button class="btn sm main grow" data-act="takestash" ${full ? 'disabled' : ''}>${full ? '背包已滿' : `取出到背包（可放 ${E.bagMax - S.bag.length} 件）`}</button>
      <button class="btn sm" data-act="salvagestash">全部分解</button></div></div>`;
  }
  h += `<div class="toolbar">${seg('filter', app.invFilter, [['all', '全部'], ['weapon', '武器'], ['armor', '護甲'], ['trinket', '飾品']])}
    <button class="btn sm main" data-act="autoequip">一鍵配裝</button></div>
    <div class="toolbar"><button class="btn sm" data-act="salvageupto" data-v="0">分解普通</button><button class="btn sm" data-act="salvageupto" data-v="1">分解精良以下</button></div>`;
  h += items.length ? `<div class="stack">${items.map(it => itemRow(it)).join('')}</div>` : `<div class="empty">背包是空的。通關副本會掉落裝備。</div>`;
  h += `<h2 style="font-size:18px">戰利品設定</h2><div class="settings">
    <div class="set"><span>掉落時自動分解</span>${seg('autosalv', S.autoSalvageBelow, [[0, '關閉'], [1, '普通'], [2, '精良以下']])}</div>
    <div class="set"><span>背包滿後只保留</span>${seg('keeprar', S.keepRarity, [[1, '精良以上'], [2, '稀有以上'], [3, '史詩']])}</div>
    <p class="sub" style="margin:0">背包滿後，符合品質的裝備放進戰利品箱（上限 ${E.stashMax} 件），其餘自動分解成金幣。</p></div>`;
  return h;
}
