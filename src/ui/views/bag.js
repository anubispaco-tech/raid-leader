// ===== 背包分頁（含戰利品箱與分解設定）=====
import { tx } from '../../core/i18n.js';
import * as G from '../../core/index.js';
import { app } from '../state.js';
import { itemStatText, itemName, fmt, gainFor, pctText, gearRuleCard } from '../helpers.js';
import { svg, setGlyph } from '../icons.js';

// v0.19 對出戰隊員的提升：「▲ 名字 +N%」；目前不比較好但強化後會更好 →「潛力」；隊上沒人能穿 → 灰字
function gainNote(it) {
  const g = gainFor(it);
  if (g.best) return `<span class="better">▲ ${g.best.h.name} ${pctText(g.best.pct)}</span>`;
  if (g.pot) return `<span class="potential" title="${tx('強化到 +{0} 時', g.pot.up)}">${tx('潛力 {0} {1}', g.pot.h.name, pctText(g.pot.pct))}</span>`;
  if (!g.any) return `<span class="nofit">${tx('隊上沒人能穿')}</span>`;
  return '';
}
const seg = (act, cur, opts) => `<div class="seg">${opts.map(([v, n]) => `<button data-act="${act}" data-v="${v}" class="${cur === v ? 'sel' : ''}">${n}</button>`).join('')}</div>`;
// v0.20.1 背包清單可長按多選（bag = true 時加 .bagitem；sel = 目前多選的 Set）
const itemRow = (it, act = 'item', bag = false, sel = null) => `<button class="item rar${it.rarity}${bag ? ' bagitem' : ''}${sel && sel.has(it.id) ? ' picked' : ''}${sel && it.locked ? ' nopick' : ''}" data-act="${sel ? 'msel' : act}" data-id="${it.id}"${sel ? ` aria-pressed="${sel.has(it.id)}"` : ''}>
    <div class="in">${sel ? `<span class="tick" aria-hidden="true"></span>` : ''}${itemName(it)}${gainNote(it)}</div>
    <div class="il">${G.SLOTS[it.slot]}<b class="num">${it.ilvl}</b></div>
    <div class="is num">${G.RARITY[it.rarity].name}・${itemStatText(it)}</div>${setMini(it)}</button>`;
// v0.15 T0 套裝在列表上直接顯示簡短效果
const setMini = it => (it.set ? `<div class="setmini">${tx('{0}專屬・2 件：{1}', G.CLASSES[it.set].name, G.SETS[it.set].d2)}</div>` : '');

const salvCount = () => app.S.bag.filter(id => app.S.items[id].rarity <= (app.salvSel ?? 0) && !app.S.items[id].set && !app.S.items[id].locked).length;
function buyRow(S) {
  const c = G.bagBuyCost(S), n = S.bagBought || 0, B = G.ECONOMY.bagBuy;
  return tx('<div class="set"><span style="margin:0">金幣擴充 <span class="sub num">{0}/{1}</span></span>{2}</div>', n, B.max, c == null ? tx('<span class="num okc">已全部擴充</span>') : tx('<button class="btn sm main" data-act="buybag" {0}>+{1} 格・<span class="num">{2}</span> 金</button>', S.gold >= c ? '' : 'disabled', B.slots, fmt(c)));
}
// v0.16 背包／圖鑑切換（v0.21 圖鑑分「套裝」與「一般裝備」，里程碑獎勵只算一般裝備）
const bagTabs = () => { const c = G.codexStats(app.S), sc = G.setCodexStats(app.S), ready = G.CODEX_REWARDS.some(r => c.pct >= r.pct && !app.S.codexClaimed.includes(r.pct));
  return `<div class="seg modes"><button data-act="bagview" data-v="bag" class="${app.bagView !== 'codex' ? 'sel' : ''}">${tx('背包')}</button><button data-act="bagview" data-v="codex" class="${app.bagView === 'codex' ? 'sel' : ''}">${tx('圖鑑 {0}/{1}', sc.got, sc.total)}${ready ? ' <span class="pip">!</span>' : ''}</button></div>`; };
function viewCodex() {
  const S = app.S, c = G.codexStats(S), sc = G.setCodexStats(S), ready = G.CODEX_REWARDS.some(r => c.pct >= r.pct && !S.codexClaimed.includes(r.pct));
  const base = app.cxView === 'base';
  let h = bagTabs() + `<div class="seg cxtabs"><button data-act="cxview" data-v="set" class="${base ? '' : 'sel'}">${tx('職業套裝 {0}/{1}', sc.got, sc.total)}</button><button data-act="cxview" data-v="base" class="${base ? 'sel' : ''}">${tx('一般裝備 {0}%', c.pct)}${ready ? ' <span class="pip">!</span>' : ''}</button></div>`;
  return h + (base ? codexBase(S, c) : codexSets(S, sc));
}
// 套裝圖鑑：每職業一列、四個部位；拿到 T0 亮、升到 T0.5 加金框
function codexSets(S, sc) {
  const has = k => !!S.codex[k];
  let h = tx('<p class="sub" style="margin:0 0 8px">第二章、深淵秘境、每日寶箱都會掉 T0 套裝（缺的部位優先）。傳奇秘境限時 +{0} 後，可以用 {1} 精華把 T0 升成 T0.5（傳說）。</p>', G.SET_T5.key, G.SET_T5.dust);
  h += `<div class="cxbar"><i style="width:${(sc.got / sc.total) * 100}%"></i></div><div class="cxsets">`;
  for (const cls of Object.keys(G.SETS)) {
    const n0 = G.ARMOR_SLOTS.filter(sl => has(`set:${cls}:${sl}`)).length, n5 = G.ARMOR_SLOTS.filter(sl => has(`set:${cls}:${sl}:5`)).length;
    h += `<div class="cxset"><div class="cxsh">${G.CLASSES[cls].icon}<b>${G.SETS[cls].name}</b><small class="num">T0 ${n0}/4・T0.5 ${n5}/4</small></div><div class="cxpieces">${G.ARMOR_SLOTS.map(sl => {
      const k0 = has(`set:${cls}:${sl}`), k5 = has(`set:${cls}:${sl}:5`);
      return `<div class="cxp ${k0 || k5 ? 'on' : ''} ${k5 ? 't5' : ''}">${svg(setGlyph(cls, sl), 'gi-' + cls)}<small>${G.SET_PIECE[sl]}</small></div>`; }).join('')}</div>
      <div class="cxbonus"><span>${tx('2 件')}：${G.SETS[cls].d2}</span><span>${tx('4 件')}：${G.SETS[cls].d4}</span></div></div>`;
  }
  return h + '</div>';
}
function codexBase(S, c) {
  const has = k => !!S.codex[k];
  let h = tx('<p class="sub" style="margin:0 0 8px">拿到過的裝備會亮起來（自動分解的也算），以「種類＋稀有度」為一格。<span class="num">{0}/{1}</span></p>', c.got, c.total);
  h += `<div class="cxbar"><i style="width:${(c.got / c.total) * 100}%"></i></div><div class="cxmiles">${G.CODEX_REWARDS.map(r => {
    const done = S.codexClaimed.includes(r.pct), ok = c.pct >= r.pct;
    return `<button class="cxm ${done ? 'done' : ok ? 'ready' : ''}" data-act="codexclaim" data-v="${r.pct}" ${ok && !done ? '' : 'disabled'}><b class="num">${r.pct}%</b><small class="num">${done ? tx('已領取') : `${fmt(r.gold)} ${tx('金')}・${r.dust}✦`}</small></button>`; }).join('')}</div>`;
  const cell = (k, r) => `<i class="cx ${has(k) ? 'on r' + r : ''}" title="${G.RARITY[r] ? G.RARITY[r].name : ''}"></i>`;
  h += `<div class="cxhead"><span></span>${G.RARITY.map((r, i) => `<b class="c${i}">${r.name}</b>`).join('')}</div>`;
  for (const [slot, list] of Object.entries(G.ITEM_BASES)) {
    h += `<div class="cxslot label">${G.SLOTS[slot]}</div>`;
    h += list.map(([key, name]) => `<div class="cxrow"><span class="${G.RARITY.some((_, r) => has(`${key}:${r}`)) ? '' : 'sub'}">${tx(name)}</span>${G.RARITY.map((_, r) => cell(`${key}:${r}`, r)).join('')}</div>`).join('');
  }
  return h;
}
// 目前篩選下、背包清單上看得到的裝備（多選的「全選」也用這份）
export function visibleBag() {
  const S = app.S;
  return S.bag.map(id => S.items[id]).filter(Boolean)
    .filter(it => app.invFilter === 'all' || it.slot === app.invFilter || (app.invFilter === 'armor' && G.ARMOR_SLOTS.includes(it.slot)) || (app.invFilter === 'set' && it.set))
    .sort((a, b) => G.itemScore(b) - G.itemScore(a));
}
// v0.20.1 多選分解的底部操作列
function mselBar() {
  const r = G.salvageMany(app.S, [...app.msel], true);
  return `<div class="ctrlbar mselbar"><div class="ctrl"><span class="mcount">${tx('已選 {0} 件', r.count)}<small class="num">+${fmt(r.gold)} ${tx('金')}${r.dust ? ` ・+${fmt(r.dust)} ${tx('精華')}` : ''}</small></span>
    <button class="btn" data-act="mselall">${tx('全選')}</button><button class="btn" data-act="mselcancel">${tx('取消')}</button>
    <button class="btn ${app.mselConfirm ? 'danger' : 'main'}" data-act="mselgo" ${r.count ? '' : 'disabled'}>${app.mselConfirm ? tx('含史詩／套裝，確定？') : tx('分解')}</button></div></div>`;
}
export function viewBag() {
  if (app.bagView === 'codex') return viewCodex();
  const S = app.S, E = G.ECONOMY;
  const items = visibleBag();
  const cap = G.bagMax(S), full = S.bag.length >= cap;
  let h = gearRuleCard('bag') + bagTabs() + tx('<h2>背包 <span class="sub num {0}">{1}/{2}</span><span class="sub" style="float:right;font-size:14px;margin-top:6px">精華 <b class="dust num">{3}</b></span></h2> <p class="sub" style="margin:0 0 8px">分解精良以上的裝備會得到精華。通關第 7 層後，可用精華把裝備精煉到 +6 ~ +{4}。</p>', full ? 'warnc' : '', S.bag.length, cap, fmt(S.dust || 0), G.GEAR.maxUp);
  if (S.stash.length) {
    h += tx('<div class="stashbox"><div class="row" style="align-items:center"><b>戰利品箱</b><span class="sub num" style="margin:0">{0}/{1}</span> <span class="sub" style="margin:0 0 0 auto">背包滿時掉落的裝備</span></div> <div class="stack">{2} {3}</div> <div class="row"><button class="btn sm main grow" data-act="takestash" {4}>{5}</button> <button class="btn sm" data-act="salvagestash">全部分解</button></div></div>', S.stash.length, E.stashMax, S.stash.map(id => S.items[id]).sort((a, b) => G.itemScore(b) - G.itemScore(a)).slice(0, 5).map(it => itemRow(it)).join(''), S.stash.length > 5 ? tx('<div class="sub" style="margin:0">還有 {0} 件</div>', S.stash.length - 5) : '', full ? 'disabled' : '', full ? tx('背包已滿') : tx('取出到背包（還能放 {0} 件）', cap - S.bag.length));
  }
  h += tx('<div class="toolbar">{0} <button class="btn sm main" data-act="autoequip">一鍵配裝</button></div> <div class="toolbar"><label class="selwrap"><span>分解</span><select id="salvSel" aria-label="分解品質">{1}</select></label> <button class="btn sm {2}" data-act="salvageupto">{3}</button></div>', seg('filter', app.invFilter, [['all', tx('全部')], ['weapon', tx('武器')], ['armor', tx('護甲')], ['trinket', tx('飾品')], ['set', tx('套裝')]]), [0, 1, 2, 3].map(r => `<option value="${r}" ${app.salvSel === r ? 'selected' : ''}>${G.RARITY[r].name}${r ? tx('以下') : ''}</option>`).join(''), app.salvConfirm ? 'danger' : '', app.salvConfirm ? tx('確定分解 {0} 件？', salvCount()) : tx('分解（{0} 件）', salvCount()));
  { const gap = S.salvageIlvlGap || 10, n = G.salvageLowIlvl(S, gap, true).count;
    h += `<div class="toolbar"><span class="sub" style="margin:0">${tx('比平均裝等低 {0} 以上', gap)}</span><button class="btn sm" data-act="salvlow" ${n ? '' : 'disabled'}>${tx('分解低裝等（{0} 件）', n)}</button></div>`; }
  if (items.length && !app.msel) h += `<div class="toolbar"><span class="sub" style="margin:0">${tx('長按裝備可以多選一起分解')}</span><button class="btn sm" data-act="mselon">${tx('多選')}</button></div>`;
  h += items.length ? `<div class="stack baglist">${items.map(it => itemRow(it, 'item', true, app.msel)).join('')}</div>` : tx('<div class="empty">背包是空的。通關副本會掉落裝備。</div>');
  if (app.msel) h += mselBar();
  h += tx('<h2 style="font-size:18px">戰利品設定</h2><div class="settings"> <div class="set"><span>掉落時自動分解</span>{0}</div> <div class="set"><span>背包滿後只保留</span>{1}</div> <div class="set"><span>依裝等自動分解</span>{6}</div> <p class="sub" style="margin:0">背包滿了以後，符合品質的裝備會先放進戰利品箱（最多 {2} 件），其他自動換成金幣。</p></div> <h2 style="font-size:18px">背包擴充 <span class="sub num">{3}/{4}</span></h2> <div class="settings">{5}</div>', seg('autosalv', S.autoSalvageBelow, [[0, tx('關閉')], [1, tx('普通')], [2, tx('精良以下')]]), seg('keeprar', S.keepRarity, [[1, tx('精良以上')], [2, tx('稀有以上')], [3, tx('史詩')]]), E.stashMax, cap, E.bagMax + G.BAG_PER_MILESTONE * G.BAG_MILESTONES.length + E.bagBuy.slots * E.bagBuy.max, buyRow(S) + G.BAG_MILESTONES.map(m => tx('<div class="set"><span class="{0}" style="margin:0">{1}{2}</span><span class="num {3}" style="margin:0">+{4} 格</span></div>', m.test(S) ? '' : 'sub', m.test(S) ? '✓ ' : '', m.name, m.test(S) ? 'okc' : 'sub', G.BAG_PER_MILESTONE)).join(''), seg('ilvlgap', S.salvageIlvlGap || 0, [[0, tx('關閉')], [10, tx('低 10 以上')], [20, tx('低 20 以上')]]));
  h += `<p class="sub" style="margin:4px 0 0">${tx('依裝等：比出戰隊員平均裝等（目前 {0}）低這麼多的掉落直接分解，傳說除外。', Math.round(G.partyIlvl(S)))}</p>`;
  return h;
}
