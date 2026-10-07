// ===== 底部抽屜：英雄、裝備、選裝、文字 =====
import { newsHtml } from '../news.js';
import { tx } from '../../core/i18n.js';
import * as G from '../../core/index.js';
import { app } from '../state.js';
import { sheetSettings } from './settings.js';
import { $, fmt, pct, toast, hero, cls, inParty, itemStatText, itemName, partyPower, avgPartyIlvl, avgPartyLv, heroName, rarityTag, whoCan, pctText } from '../helpers.js';

import { sheetAchievements } from './achievements.js';
export function openModal(m) { app.modal = m; renderModal(); }
export function closeModal() {
  const done = app.modal && app.modal.type === 'dialog' && app.modal.done;
  app.modal = null; renderModal(); if (done) done();
}
// 對話：點一下下一句，最後一句或「跳過」結束後呼叫 done
export function playDialog(lines, done) { openModal({ type: 'dialog', lines, i: 0, done }); }
export function renderModal() {
  const el = $('#modal');
  if (!app.modal) { el.innerHTML = ''; el.dataset.key = ''; return; }
  let body = '';
  if (app.modal.type === 'hero') body = sheetHero(hero(app.modal.id));
  if (app.modal.type === 'item') body = sheetItem(app.S.items[app.modal.id]);
  if (app.modal.type === 'pick') body = sheetPick();
  if (app.modal.type === 'text') body = app.modal.html;
  if (app.modal.type === 'dialog') body = sheetDialog(app.modal);
  if (app.modal.type === 'settings') body = sheetSettings();
  if (app.modal.type === 'ach') body = sheetAchievements();
  if (app.modal.type === 'news') body = newsHtml(app.modal.only);
  if (!body) { app.modal = null; el.innerHTML = ''; return; }
  // 只有新開抽屜時播放滑入動畫；在抽屜內操作（選天賦、換頁）不重播，並保留捲動位置
  const key = app.modal.type + ':' + (app.modal.id || ''), old = el.querySelector('.sheet');
  const fresh = !old || el.dataset.key !== key, scroll = old ? old.scrollTop : 0;
  el.dataset.key = key;
  el.innerHTML = `<div class="scrim" data-act="close"><div class="sheet ${fresh ? 'anim' : ''}" role="dialog" aria-modal="true">${body}</div></div>`;
  if (!fresh) el.querySelector('.sheet').scrollTop = scroll;
  if (app.afterModal) app.afterModal();
}
function sheetDialog(m) {
  const L = m.lines[m.i], last = m.i >= m.lines.length - 1;
  return `<div class="dlg" data-act="dlgnext">${L.who ? `<b class="who">${L.who}</b>` : ''}<p class="${L.who ? '' : 'narr'}">${L.text}</p>
    <div class="row" style="align-items:center"><span class="sub num" style="margin:0">${m.i + 1}/${m.lines.length}</span>
    <button class="btn sm" data-act="dlgskip" style="margin-left:auto">${tx('跳過')}</button><button class="btn sm main" data-act="dlgnext">${last ? tx('開始') : tx('繼續 ▸')}</button></div></div>`;
}
function sheetHero(x) {
  if (!x) return '';
  const c = cls(x), st = G.heroStats(x, app.S.items), view = app.modal.view || 'gear', pend = G.pendingPicks(x);
  const sp = x.spec && G.SPECS[x.cls][x.spec];
  const R = G.HERO_RARITY[x.rarity || 0], L = x.legend && G.LEGENDS[x.cls];
  let h = tx('<h3>{0} {1} {2}</h3><div class="sub" style="margin:0">{3}{4}・{5}　{6}</div> {7} <div class="statgrid num"><div><b>{8}</b><span>等級</span></div><div><b>{9}</b><span>生命</span></div><div><b>{10}</b><span>威力</span></div><div><b>{11}%</b><span>暴擊</span></div></div> <div class="sub" style="margin:0">{12}・護甲減傷 {13}%</div> <div class="seg wide"><button data-act="heroview" data-id="{14}" data-v="gear" class="{15}">裝備</button><button data-act="heroview" data-id="{16}" data-v="talent" class="{17}">天賦{18}</button></div>', c.icon, heroName(x), rarityTag(x), c.name, sp ? `・${sp.name}` : '', G.ROLE_NAME[G.roleOf(x)], c.desc, x.rarity ? tx('<div class="raritycard r-{0}"><b class="c{1}">{2}加成</b><span>基礎屬性 ×{3}{4}{5}</span>{6}</div>', x.rarity, x.rarity, R.name, R.mult.toFixed(2), R.crit ? tx('・暴擊 +{0}%', Math.round(R.crit * 100)) : '', R.baseCdMult ? tx('・基礎技能冷卻 −10%') : '', L ? tx('<span><b class="c4">{0}</b>：{1}</span>', L.pname, L.desc) : '') : '', x.level, fmt(st.hp), st.pow, Math.round(st.crit * 100), x.level >= G.HERO.maxLevel ? tx('<b style="color:var(--brass)">巔峰 {0}</b>（生命／威力 +{1}%）<span class="num">{2} / {3}</span>', x.para || 0, x.para || 0, fmt(x.paraXp || 0), fmt(G.paraNeed(x.para || 0))) : tx('經驗 <span class="num">{0} / {1}</span>', fmt(x.xp), fmt(G.xpNeed(x.level))) + (x.para ? tx('・巔峰 {0}（生命／威力 +{1}%）', x.para, x.para) : ''), Math.round(st.armor * 100), x.id, view === 'gear' ? 'sel' : '', x.id, view === 'talent' ? 'sel' : '', pend ? `<span class="pip">${pend}</span>` : '');
  if (view === 'talent') return h + talentView(x) + heroActions(x);
  h += `<div>`;
  for (const [slot, sn] of Object.entries(G.SLOTS)) {
    const it = x.gear[slot] && app.S.items[x.gear[slot]];
    const n = app.S.bag.filter(id => app.S.items[id].slot === slot).length;
    h += tx('<div class="gearrow"><span class="sl">{0}</span><span>{1}</span> <span class="row">{2} <button class="btn sm" data-act="pick" data-id="{3}" data-slot="{4}" {5}>更換</button></span></div>', sn, it ? `${itemName(it)} <span class="sub num">${it.ilvl}</span><br><span class="sub num" style="font-size:12px">${itemStatText(it)}</span>` : tx('<span class="sub">（空）</span>'), it ? upBtn(it, 'sm') : '', x.id, slot, n ? '' : 'disabled');
  }
  const plan = G.upgradeAll(app.S, x.id, true), hasGear = Object.values(x.gear).some(Boolean);
  const better = G.autoEquip(app.S, x.id, true);
  h += setLine(x);
  h += tx('</div><div class="row"> <button class="btn grow {0}" data-act="autoequip1" data-id="{1}" {2}>{3}</button> <button class="btn" data-act="unequipall" data-id="{4}" {5}>全部卸下</button></div> <div class="row"> <button class="btn grow" data-act="upall" data-id="{6}" {7}>{8}</button> </div>', better ? 'main' : '', x.id, better ? '' : 'disabled', better ? tx('一鍵配裝（{0} 件更好）', better) : tx('已是最佳配裝'), x.id, hasGear ? '' : 'disabled', x.id, plan.count ? '' : 'disabled', plan.empty ? tx('沒有裝備') : plan.count ? tx('一鍵強化 {0} 次（{1} 金{2}）', plan.count, fmt(plan.spent), plan.dustSpent ? tx('・{0} 精華', plan.dustSpent) : '') : plan.maxed ? tx('已全部強化到 +{0}', G.maxUpFor(app.S)) : tx('金幣或精華不夠'));
  return h + heroActions(x);
}
// 套裝狀態：這位英雄職業的 T0 穿了幾件、啟動哪些效果
function setLine(x) {
  const S = G.SETS[x.cls]; if (!S) return '';
  const n = G.setCount(x, app.S.items);
  if (!n && !Object.values(app.S.items).some(it => it.set === x.cls)) return '';
  return `<div class="setline"><b class="c3">T0「${S.name}」</b><span class="num">${n}/4</span>
    <span class="${n >= 2 ? 'on' : ''}">${tx('2 件')}：${S.d2}</span><span class="${n >= 4 ? 'on' : ''}">${tx('4 件')}：${S.d4}</span></div>`;
}
// 套裝說明（裝備抽屜）
export function setInfo(it) {
  if (!it.set) return '';
  const S = G.SETS[it.set];
  return `<div class="setline"><b class="c3">T0「${S.name}」</b><span>${tx('{0}專屬套裝', G.CLASSES[it.set].name)}</span><span>${tx('2 件')}：${S.d2}</span><span>${tx('4 件')}：${S.d4}</span></div>`;
}
function heroActions(x) {
  const locked = G.partyLocked(app.S);
  if (locked) return tx('<div class="row"><button class="btn grow" disabled>{0}・掛機時無法更換隊員</button></div>', inParty(x) ? tx('出戰中') : tx('待命中'));
  return `<div class="row">${inParty(x)
    ? tx('<button class="btn grow" data-act="bench" data-id="{0}">移出隊伍</button>', x.id)
    : `<button class="btn main grow" data-act="join" data-id="${x.id}" ${app.S.party.length >= G.ECONOMY.partyMax ? 'disabled' : ''}>${app.S.party.length >= G.ECONOMY.partyMax ? tx('隊伍已滿') : tx('加入隊伍')}</button>`}
    ${lockBtn('hero', x)}${app.S.heroes.length > 1 && !x.locked ? `<button class="btn" data-act="fire" data-id="${x.id}" style="color:var(--bad)">${app.modal.confirmFire ? tx('確定解雇？退 {0} 金', fmt(Math.round(G.hireCost(x) * G.RECRUIT.fireRefund))) : tx('解雇')}</button>` : ''}</div>`;
}
// ---------- 天賦頁 ----------
function talentView(x) {
  const B = G.BASE_SKILLS[x.cls], specs = G.SPECS[x.cls], t = x.talents || {};
  const top = Math.max(0, app.S.unlocked - 1), dn = G.DUNGEONS[top];
  const opt = (act, v, on, locked, name, desc, extra = '') =>
    `<button class="opt ${on ? 'sel' : ''}" data-act="${act}" data-id="${x.id}" data-v="${v}" ${extra} ${locked ? 'disabled' : ''}><b>${name}</b><span>${desc}</span></button>`;
  const specRow = `<div class="trow ${Object.keys(specs).length > 2 ? 'n3' : ''} ${x.level < G.SPEC_LEVEL ? 'locked' : ''}"><span class="tlv num">Lv${G.SPEC_LEVEL}<small>${x.level < G.SPEC_LEVEL ? tx('未解鎖') : tx('專精')}</small></span>
      ${Object.entries(specs).map(([k, sp]) => opt('spec', k, x.spec === k, x.level < G.SPEC_LEVEL, `${sp.name}・${sp.skill}`, sp.desc)).join('')}</div>`;
  let h = tx('<div class="skillcard"><span class="label">基礎技能</span><b>{0}</b><span class="sub" style="margin:0">{1}</span></div>', B.name, B.desc);
  G.TALENTS[x.cls].forEach((row, i) => {
    const lv = G.TALENT_ROWS[i], locked = x.level < lv;
    if (lv > G.SPEC_LEVEL && !h.includes('data-act="spec"')) h += specRow; // 專精插在 Lv5 與 Lv15 之間
    h += `<div class="trow ${locked ? 'locked' : ''}"><span class="tlv num">Lv${lv}${locked ? tx('<small>未解鎖</small>') : ''}</span>
      ${['a', 'b'].map(k => opt('talent', k, t[lv] === k && !locked, locked, row[k].name, row[k].desc, `data-lv="${lv}"`)).join('')}</div>`;
  });
  h += tx('<div class="row"><button class="btn grow" data-act="recommend" data-id="{0}" data-d="{1}">依「{2}」推薦配置</button></div> <p class="sub" style="margin:0">隨時可以免費更換，下一場戰鬥生效。</p>', x.id, top, dn.name);
  return h;
}
function sheetPick() {
  const x = hero(app.modal.id), slot = app.modal.slot, cur = x.gear[slot] && app.S.items[x.gear[slot]];
  const all = app.S.bag.map(id => app.S.items[id]).filter(it => it.slot === slot), list = all.filter(it => G.canEquip(x, it)).sort((a, b) => G.heroItemScore(x, b) - G.heroItemScore(x, a));
  const hidden = all.length - list.length, base = cur ? G.heroItemScore(x, cur) : 0;
  const gainTag = it => { if (!cur) return '<span class="better">▲</span>'; const g = G.heroItemScore(x, it) / base - 1;
    if (g > 0.005) return `<span class="better">▲ ${pctText(g)}</span>`;
    const p = (cur.up || 0) > (it.up || 0) ? G.heroItemScoreAt(x, it, cur.up) / base - 1 : 0;
    return p > 0.005 ? `<span class="potential">${tx('潛力 {0}', pctText(p))}</span>` : ''; };
  return tx('<h3>為 {0} 選擇{1}</h3><div class="sub" style="margin:0">目前：{2}</div> <div class="choices">{3}</div> <div class="row">{4}<button class="btn" data-act="hero" data-id="{5}">返回</button></div>', x.name, G.SLOTS[slot], cur ? itemName(cur) + '・' + itemStatText(cur) : tx('無'), list.map(it => `<button class="item rar${it.rarity}" data-act="equip" data-hero="${x.id}" data-id="${it.id}"><div class="in">${itemName(it)}${gainTag(it)}</div><div class="il"><b class="num">${it.ilvl}</b></div><div class="is num">${itemStatText(it)}</div></button>`).join('') + (hidden ? tx('<p class="sub" style="margin:0">另有 {0} 件{1}不能穿（甲類或武器不符）</p>', hidden, cls(x).name) : ''), cur ? tx('<button class="btn" data-act="unequip" data-hero="{0}" data-slot="{1}">卸下</button>', x.id, slot) : '', x.id);
}
// 套裝說明插在「裝備給」上方
const withSet = (it, html) => html.replace('<span class="label">', affixLine(it) + setInfo(it) + '<span class="label">');
function sheetItem(it) {
  if (!it) return '';
  const party = G.partyHeroes(app.S);
  return withSet(it, tx('<h3>{0}</h3><div class="sub num" style="margin:0">{1}{2}・裝等 {3}・強化 +{4}/{5}<br>{6}</div>{13} <span class="label">裝備給</span><div class="stack">{7}</div> <div class="row">{8} {12}</div>', itemName(it), G.RARITY[it.rarity].name, G.SLOTS[it.slot], it.ilvl, it.up, G.maxUpFor(app.S), itemStatText(it), party.map(x => {
      const cur = x.gear[it.slot] && app.S.items[x.gear[it.slot]];
      if (!G.canEquip(x, it)) return tx('<button class="hero off" disabled><div class="ic">{0}</div><div class="nm">{1}<small>{2}</small></div><span class="tag">不能穿</span><div class="st">{3}</div></button>', cls(x).icon, x.name, cls(x).name, it.slot === 'weapon' ? tx('不會用這種武器') : it.set ? tx('其他職業的套裝') : tx('只能穿{0}以下', G.ARMOR_TYPES[cls(x).armorType].name));
      const base = cur ? G.heroItemScore(x, cur) : 0, g = cur ? G.heroItemScore(x, it) / base - 1 : Infinity;
      const p = cur && (cur.up || 0) > (it.up || 0) ? G.heroItemScoreAt(x, it, cur.up) / base - 1 : 0, better = g > 0.005;
      const fit = G.isFitArmor(x, it) ? tx('・本職 +{0}%', Math.round(G.GEAR.fitBonus * 100)) : '';
      return tx('<button class="hero" data-act="equip" data-hero="{0}" data-id="{1}"><div class="ic">{2}</div><div class="nm">{3}<small>{4}</small></div><span class="tag {5}">{6}</span><div class="st">目前：{7}{8}{9}</div></button>', x.id, it.id, cls(x).icon, x.name, cls(x).name, better ? 'in' : '', better ? tx('▲ {0}', pctText(g)) : tx('較差'), cur ? tx('{0}（{1}）', cur.name, cur.ilvl) : tx('空'), p > 0.005 && !better ? tx('・強化到 +{0} 會 {1}', cur.up, pctText(p)) : '', fit);
    }).join(''), upBtn(it, '') + ' ' + upManyBtn(it), it.id, G.salvageValue(it), G.salvageDust(it) ? tx('・<span class="dust num">{0}</span> 精華', G.salvageDust(it)) : '',
    lockBtn('item', it) + (it.locked ? '' : app.modal.confirmSalv === it.id
      ? tx('<button class="btn danger" data-act="salvage" data-id="{0}">確定分解{1}？</button>', it.id, G.RARITY[it.rarity].name)
      : tx('<button class="btn" data-act="salvage" data-id="{0}">分解 +<span class="num">{1}</span> 金{2}</button>', it.id, G.salvageValue(it), G.salvageDust(it) ? tx('・<span class="dust num">{0}</span> 精華', G.salvageDust(it)) : '')), equipLine(it)));
}
// v0.19 誰能穿：甲類＋可穿職業
function equipLine(it) {
  const a = G.armorOf(it);
  return `<div class="whocan">${a && !it.set ? `<b>${G.ARMOR_TYPES[a].name}</b>・` : ''}${tx('可裝備：{0}', whoCan(it))}</div>`;
}
// v0.16 詞綴說明（放在標題下方：withSet 會把套裝說明插在「裝備給」上方）
function affixLine(it) {
  const A = it.affix && G.GEAR_AFFIX[it.affix]; if (!A || !A.name) return '';
  const p = v => (v > 1 ? '+' : '−') + Math.round(Math.abs(v - 1) * 100) + '%', parts = [];
  if (A.pow !== 1) parts.push(tx('威力 {0}', p(A.pow))); if (A.sta !== 1) parts.push(tx('耐力 {0}', p(A.sta))); if (A.crit) parts.push(tx('暴擊 +{0}%', A.crit * 100));
  return `<div class="affixnote"><b>${tx(A.name)}</b>${parts.join(tx('、'))}</div>`;
}
// v0.14 鎖定按鈕：鎖住後不能解雇／分解（批次與自動分解也會跳過）
const lockBtn = (kind, x) => `<button class="btn" data-act="lock" data-kind="${kind}" data-id="${x.id}" title="${x.locked ? tx('解除鎖定') : tx('鎖定（避免誤分解／解雇）')}">${x.locked ? tx('🔒 已鎖定') : tx('🔓 鎖定')}</button>`;
// 強化按鈕：+5 以上叫「精煉」，額外需要精華
// v0.18.1 一次強化 5 級（剩不到 5 級時顯示「強化至 +上限」）；金幣或精華不足就鎖住
function upManyBtn(it) {
  const r = G.upgradeMany(app.S, it.id, 5, true);
  if (!r || r.steps < 2) return '';
  const label = r.steps < 5 ? tx('強化至 +{0}', r.to) : tx('強化 ×5');
  return `<button class="btn" data-act="up5" data-id="${it.id}" ${r.ok ? '' : 'disabled'}>${label} <span class="num">${fmt(r.gold)}</span>${r.dust ? `<span class="dust num">+${r.dust}✦</span>` : ''}</button>`;
}
function upBtn(it, size) {
  if (it.up >= G.maxUpFor(app.S)) return tx('<button class="btn {0}" disabled>強化 MAX</button>', size);
  const g = G.upgradeCost(it), d = G.dustCost(it), ok = app.S.gold >= g && (app.S.dust || 0) >= d;
  return `<button class="btn ${size}" data-act="up" data-id="${it.id}" ${ok ? '' : 'disabled'}>${d ? tx('精煉') : tx('強化')} <span class="num">${fmt(g)}</span>${d ? `<span class="dust num">+${d}✦</span>` : ''}</button>`;
}
