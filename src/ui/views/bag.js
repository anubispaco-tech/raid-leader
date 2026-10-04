// ===== 背包分頁（含戰利品箱與分解設定）=====
import { tx } from '../../core/i18n.js';
import * as G from '../../core/index.js';
import { app } from '../state.js';
import { itemStatText, itemName, fmt } from '../helpers.js';

function bestUpgradeFor(it) { // 是否比某位出戰者身上的更好
  return G.partyHeroes(app.S).some(h => { const cur = h.gear[it.slot] && app.S.items[h.gear[it.slot]]; return !cur || G.itemScore(it) > G.itemScore(cur); });
}
const seg = (act, cur, opts) => `<div class="seg">${opts.map(([v, n]) => `<button data-act="${act}" data-v="${v}" class="${cur === v ? 'sel' : ''}">${n}</button>`).join('')}</div>`;
const itemRow = (it, act = 'item') => `<button class="item rar${it.rarity}" data-act="${act}" data-id="${it.id}">
    <div class="in">${itemName(it)}${bestUpgradeFor(it) ? tx('<span class="better">▲ 可提升</span>') : ''}</div>
    <div class="il">${G.SLOTS[it.slot]}<b class="num">${it.ilvl}</b></div>
    <div class="is num">${G.RARITY[it.rarity].name}・${itemStatText(it)}</div></button>`;

const salvCount = () => app.S.bag.filter(id => app.S.items[id].rarity <= (app.salvSel ?? 0)).length;
export function viewBag() {
  const S = app.S, E = G.ECONOMY;
  const items = S.bag.map(id => S.items[id]).filter(Boolean)
    .filter(it => app.invFilter === 'all' || it.slot === app.invFilter)
    .sort((a, b) => G.itemScore(b) - G.itemScore(a));
  const cap = G.bagMax(S), full = S.bag.length >= cap;
  let h = tx('<h2>背包 <span class="sub num {0}">{1}/{2}</span><span class="sub" style="float:right;font-size:14px;margin-top:6px">精華 <b class="dust num">{3}</b></span></h2> <p class="sub" style="margin:0 0 8px">分解精良以上的裝備會得到精華。通關第 7 層後，可用精華把裝備精煉到 +6 ~ +{4}。</p>', full ? 'warnc' : '', S.bag.length, cap, fmt(S.dust || 0), G.GEAR.maxUp);
  if (S.stash.length) {
    h += tx('<div class="stashbox"><div class="row" style="align-items:center"><b>戰利品箱</b><span class="sub num" style="margin:0">{0}/{1}</span> <span class="sub" style="margin:0 0 0 auto">背包滿時掉落的裝備</span></div> <div class="stack">{2} {3}</div> <div class="row"><button class="btn sm main grow" data-act="takestash" {4}>{5}</button> <button class="btn sm" data-act="salvagestash">全部分解</button></div></div>', S.stash.length, E.stashMax, S.stash.map(id => S.items[id]).sort((a, b) => G.itemScore(b) - G.itemScore(a)).slice(0, 5).map(it => itemRow(it)).join(''), S.stash.length > 5 ? tx('<div class="sub" style="margin:0">還有 {0} 件</div>', S.stash.length - 5) : '', full ? 'disabled' : '', full ? tx('背包已滿') : tx('取出到背包（還能放 {0} 件）', cap - S.bag.length));
  }
  h += tx('<div class="toolbar">{0} <button class="btn sm main" data-act="autoequip">一鍵配裝</button></div> <div class="toolbar"><label class="selwrap"><span>分解</span><select id="salvSel" aria-label="分解品質">{1}</select></label> <button class="btn sm {2}" data-act="salvageupto">{3}</button></div>', seg('filter', app.invFilter, [['all', tx('全部')], ['weapon', tx('武器')], ['armor', tx('護甲')], ['trinket', tx('飾品')]]), [0, 1, 2, 3].map(r => `<option value="${r}" ${app.salvSel === r ? 'selected' : ''}>${G.RARITY[r].name}${r ? tx('以下') : ''}</option>`).join(''), app.salvConfirm ? 'danger' : '', app.salvConfirm ? tx('確定分解 {0} 件？', salvCount()) : tx('分解（{0} 件）', salvCount()));
  h += items.length ? `<div class="stack">${items.map(it => itemRow(it)).join('')}</div>` : tx('<div class="empty">背包是空的。通關副本會掉落裝備。</div>');
  h += tx('<h2 style="font-size:18px">戰利品設定</h2><div class="settings"> <div class="set"><span>掉落時自動分解</span>{0}</div> <div class="set"><span>背包滿後只保留</span>{1}</div> <p class="sub" style="margin:0">背包滿了以後，符合品質的裝備會先放進戰利品箱（最多 {2} 件），其他自動換成金幣。</p></div> <h2 style="font-size:18px">背包擴充 <span class="sub num">{3}/{4}</span></h2> <div class="settings">{5}</div>', seg('autosalv', S.autoSalvageBelow, [[0, tx('關閉')], [1, tx('普通')], [2, tx('精良以下')]]), seg('keeprar', S.keepRarity, [[1, tx('精良以上')], [2, tx('稀有以上')], [3, tx('史詩')]]), E.stashMax, cap, E.bagMax + G.BAG_PER_MILESTONE * G.BAG_MILESTONES.length, G.BAG_MILESTONES.map(m => tx('<div class="set"><span class="{0}" style="margin:0">{1}{2}</span><span class="num {3}" style="margin:0">+{4} 格</span></div>', m.test(S) ? '' : 'sub', m.test(S) ? '✓ ' : '', m.name, m.test(S) ? 'okc' : 'sub', G.BAG_PER_MILESTONE)).join(''));
  return h;
}
