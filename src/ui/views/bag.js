// ===== 背包分頁 =====
import * as G from '../../core/index.js';
import { app } from '../state.js';
import { $, fmt, pct, toast, hero, cls, inParty, itemStatText, itemName, partyPower, avgPartyIlvl, avgPartyLv } from '../helpers.js';

function bestUpgradeFor(it) { // 是否比某位出戰者身上的更好
  return G.partyHeroes(app.S).some(h => { const cur = h.gear[it.slot] && app.S.items[h.gear[it.slot]]; return !cur || G.itemScore(it) > G.itemScore(cur); });
}
export function viewBag() {
  const items = app.S.bag.map(id => app.S.items[id]).filter(Boolean)
    .filter(it => app.invFilter === 'all' || it.slot === app.invFilter)
    .sort((a, b) => G.itemScore(b) - G.itemScore(a));
  let h = `<h2>背包 <span class="sub num">${app.S.bag.length}/${G.ECONOMY.bagMax}</span></h2><p class="sub">背包滿了，新掉落會自動分解成金幣。</p>
    <div class="toolbar"><div class="seg">${[['all', '全部'], ['weapon', '武器'], ['armor', '護甲'], ['trinket', '飾品']].map(([k, n]) => `<button data-act="filter" data-f="${k}" class="${app.invFilter === k ? 'sel' : ''}">${n}</button>`).join('')}</div>
    <button class="btn sm main" data-act="autoequip">一鍵配裝</button></div>
    <div class="toolbar"><button class="btn sm" data-act="salvagecommon">分解全部普通</button>
    <button class="btn sm ${app.S.autoSalvageCommon ? 'on' : ''}" data-act="autosalv">${app.S.autoSalvageCommon ? '✓ ' : ''}自動分解普通</button></div>`;
  if (!items.length) return h + `<div class="empty">背包是空的。通關副本會掉落裝備。</div>`;
  h += `<div class="stack">${items.map(it => `<button class="item rar${it.rarity}" data-act="item" data-id="${it.id}">
    <div class="in">${itemName(it)}${bestUpgradeFor(it) ? '<span class="better">▲ 可提升</span>' : ''}</div>
    <div class="il">${G.SLOTS[it.slot]}<b class="num">${it.ilvl}</b></div>
    <div class="is num">${G.RARITY[it.rarity].name}・${itemStatText(it)}</div></button>`).join('')}</div>`;
  return h;
}
