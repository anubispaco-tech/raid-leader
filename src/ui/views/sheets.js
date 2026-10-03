// ===== 底部抽屜：英雄、裝備、選裝、文字 =====
import * as G from '../../core/index.js';
import { app } from '../state.js';
import { $, fmt, pct, toast, hero, cls, inParty, itemStatText, itemName, partyPower, avgPartyIlvl, avgPartyLv } from '../helpers.js';

export function openModal(m) { app.modal = m; renderModal(); }
export function closeModal() { app.modal = null; renderModal(); }
export function renderModal() {
  const el = $('#modal');
  if (!app.modal) { el.innerHTML = ''; return; }
  let body = '';
  if (app.modal.type === 'hero') body = sheetHero(hero(app.modal.id));
  if (app.modal.type === 'item') body = sheetItem(app.S.items[app.modal.id]);
  if (app.modal.type === 'pick') body = sheetPick();
  if (app.modal.type === 'text') body = app.modal.html;
  if (!body) { app.modal = null; el.innerHTML = ''; return; }
  el.innerHTML = `<div class="scrim" data-act="close"><div class="sheet" role="dialog" aria-modal="true">${body}</div></div>`;
}
function sheetHero(x) {
  if (!x) return '';
  const c = cls(x), st = G.heroStats(x, app.S.items);
  let h = `<h3>${c.icon} ${x.name}</h3><div class="sub" style="margin:0">${c.name}・${G.ROLE_NAME[c.role]}　${c.desc}</div>
    <div class="statgrid num"><div><b>${x.level}</b><span>等級</span></div><div><b>${fmt(st.hp)}</b><span>生命</span></div><div><b>${st.pow}</b><span>威力</span></div><div><b>${Math.round(st.crit * 100)}%</b><span>暴擊</span></div></div>
    <div class="sub" style="margin:0">經驗 <span class="num">${fmt(x.xp)} / ${fmt(G.xpNeed(x.level))}</span>・護甲減傷 ${Math.round(st.armor * 100)}%</div><div>`;
  for (const [slot, sn] of Object.entries(G.SLOTS)) {
    const it = x.gear[slot] && app.S.items[x.gear[slot]];
    const n = app.S.bag.filter(id => app.S.items[id].slot === slot).length;
    h += `<div class="gearrow"><span class="sl">${sn}</span><span>${it ? `${itemName(it)} <span class="sub num">${it.ilvl}</span><br><span class="sub num" style="font-size:12px">${itemStatText(it)}</span>` : '<span class="sub">（空）</span>'}</span>
      <span class="row">${it ? `<button class="btn sm" data-act="up" data-id="${it.id}" ${it.up >= G.GEAR.maxUp ? 'disabled' : ''}>強化 <span class="num">${it.up >= G.GEAR.maxUp ? 'MAX' : G.upgradeCost(it)}</span></button>` : ''}
      <button class="btn sm" data-act="pick" data-id="${x.id}" data-slot="${slot}" ${n ? '' : 'disabled'}>更換</button></span></div>`;
  }
  h += `</div><div class="row">${inParty(x)
    ? `<button class="btn grow" data-act="bench" data-id="${x.id}">移出隊伍</button>`
    : `<button class="btn main grow" data-act="join" data-id="${x.id}" ${app.S.party.length >= G.ECONOMY.partyMax ? 'disabled' : ''}>${app.S.party.length >= G.ECONOMY.partyMax ? '隊伍已滿' : '加入隊伍'}</button>`}
    ${app.S.heroes.length > 1 ? `<button class="btn" data-act="fire" data-id="${x.id}" style="color:var(--bad)">${app.modal.confirmFire ? '確定解雇？' : '解雇'}</button>` : ''}</div>`;
  return h;
}
function sheetPick() {
  const x = hero(app.modal.id), slot = app.modal.slot, cur = x.gear[slot] && app.S.items[x.gear[slot]];
  const list = app.S.bag.map(id => app.S.items[id]).filter(it => it.slot === slot).sort((a, b) => G.itemScore(b) - G.itemScore(a));
  return `<h3>為 ${x.name} 選擇${G.SLOTS[slot]}</h3><div class="sub" style="margin:0">目前：${cur ? itemName(cur) + '・' + itemStatText(cur) : '無'}</div>
    <div class="choices">${list.map(it => `<button class="item rar${it.rarity}" data-act="equip" data-hero="${x.id}" data-id="${it.id}"><div class="in">${itemName(it)}${!cur || G.itemScore(it) > G.itemScore(cur) ? '<span class="better">▲</span>' : ''}</div><div class="il"><b class="num">${it.ilvl}</b></div><div class="is num">${itemStatText(it)}</div></button>`).join('')}</div>
    <div class="row">${cur ? `<button class="btn" data-act="unequip" data-hero="${x.id}" data-slot="${slot}">卸下</button>` : ''}<button class="btn" data-act="hero" data-id="${x.id}">返回</button></div>`;
}
function sheetItem(it) {
  if (!it) return '';
  const party = G.partyHeroes(app.S);
  return `<h3>${itemName(it)}</h3><div class="sub num" style="margin:0">${G.RARITY[it.rarity].name}${G.SLOTS[it.slot]}・裝等 ${it.ilvl}・強化 +${it.up}/${G.GEAR.maxUp}<br>${itemStatText(it)}</div>
    <span class="label">裝備給</span><div class="stack">${party.map(x => {
      const cur = x.gear[it.slot] && app.S.items[x.gear[it.slot]];
      const better = !cur || G.itemScore(it) > G.itemScore(cur);
      return `<button class="hero" data-act="equip" data-hero="${x.id}" data-id="${it.id}"><div class="ic">${cls(x).icon}</div><div class="nm">${x.name}<small>${cls(x).name}</small></div><span class="tag ${better ? 'in' : ''}">${better ? '▲ 提升' : '較差'}</span><div class="st">目前：${cur ? `${cur.name}（${cur.ilvl}）` : '空'}</div></button>`;
    }).join('')}</div>
    <div class="row"><button class="btn" data-act="up" data-id="${it.id}" ${it.up >= G.GEAR.maxUp || app.S.gold < G.upgradeCost(it) ? 'disabled' : ''}>強化（<span class="num">${it.up >= G.GEAR.maxUp ? 'MAX' : G.upgradeCost(it)}</span> 金）</button>
    <button class="btn" data-act="salvage" data-id="${it.id}">分解 +<span class="num">${G.salvageValue(it)}</span> 金</button></div>`;
}
