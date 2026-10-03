// ===== 底部抽屜：英雄、裝備、選裝、文字 =====
import * as G from '../../core/index.js';
import { app } from '../state.js';
import { $, fmt, pct, toast, hero, cls, inParty, itemStatText, itemName, partyPower, avgPartyIlvl, avgPartyLv, heroName, rarityTag } from '../helpers.js';

export function openModal(m) { app.modal = m; renderModal(); }
export function closeModal() { app.modal = null; renderModal(); }
export function renderModal() {
  const el = $('#modal');
  if (!app.modal) { el.innerHTML = ''; el.dataset.key = ''; return; }
  let body = '';
  if (app.modal.type === 'hero') body = sheetHero(hero(app.modal.id));
  if (app.modal.type === 'item') body = sheetItem(app.S.items[app.modal.id]);
  if (app.modal.type === 'pick') body = sheetPick();
  if (app.modal.type === 'text') body = app.modal.html;
  if (!body) { app.modal = null; el.innerHTML = ''; return; }
  // 只有新開抽屜時播放滑入動畫；在抽屜內操作（選天賦、換頁）不重播，並保留捲動位置
  const key = app.modal.type + ':' + (app.modal.id || ''), old = el.querySelector('.sheet');
  const fresh = !old || el.dataset.key !== key, scroll = old ? old.scrollTop : 0;
  el.dataset.key = key;
  el.innerHTML = `<div class="scrim" data-act="close"><div class="sheet ${fresh ? 'anim' : ''}" role="dialog" aria-modal="true">${body}</div></div>`;
  if (!fresh) el.querySelector('.sheet').scrollTop = scroll;
}
function sheetHero(x) {
  if (!x) return '';
  const c = cls(x), st = G.heroStats(x, app.S.items), view = app.modal.view || 'gear', pend = G.pendingPicks(x);
  const sp = x.spec && G.SPECS[x.cls][x.spec];
  const R = G.HERO_RARITY[x.rarity || 0], L = x.legend && G.LEGENDS[x.cls];
  let h = `<h3>${c.icon} ${heroName(x)} ${rarityTag(x)}</h3><div class="sub" style="margin:0">${c.name}${sp ? `・${sp.name}` : ''}・${G.ROLE_NAME[c.role]}　${c.desc}</div>
    ${x.rarity ? `<div class="raritycard r-${x.rarity}"><b class="c${x.rarity}">${R.name}加成</b><span>基礎屬性 ×${R.mult.toFixed(2)}${R.crit ? `・暴擊 +${Math.round(R.crit * 100)}%` : ''}${R.baseCdMult ? '・基礎技能冷卻 −10%' : ''}</span>${L ? `<span><b class="c4">${L.pname}</b>：${L.desc}</span>` : ''}</div>` : ''}
    <div class="statgrid num"><div><b>${x.level}</b><span>等級</span></div><div><b>${fmt(st.hp)}</b><span>生命</span></div><div><b>${st.pow}</b><span>威力</span></div><div><b>${Math.round(st.crit * 100)}%</b><span>暴擊</span></div></div>
    <div class="sub" style="margin:0">經驗 <span class="num">${fmt(x.xp)} / ${fmt(G.xpNeed(x.level))}</span>・護甲減傷 ${Math.round(st.armor * 100)}%</div>
    <div class="seg wide"><button data-act="heroview" data-id="${x.id}" data-v="gear" class="${view === 'gear' ? 'sel' : ''}">裝備</button><button data-act="heroview" data-id="${x.id}" data-v="talent" class="${view === 'talent' ? 'sel' : ''}">天賦${pend ? `<span class="pip">${pend}</span>` : ''}</button></div>`;
  if (view === 'talent') return h + talentView(x) + heroActions(x);
  h += `<div>`;
  for (const [slot, sn] of Object.entries(G.SLOTS)) {
    const it = x.gear[slot] && app.S.items[x.gear[slot]];
    const n = app.S.bag.filter(id => app.S.items[id].slot === slot).length;
    h += `<div class="gearrow"><span class="sl">${sn}</span><span>${it ? `${itemName(it)} <span class="sub num">${it.ilvl}</span><br><span class="sub num" style="font-size:12px">${itemStatText(it)}</span>` : '<span class="sub">（空）</span>'}</span>
      <span class="row">${it ? `<button class="btn sm" data-act="up" data-id="${it.id}" ${it.up >= G.GEAR.maxUp ? 'disabled' : ''}>強化 <span class="num">${it.up >= G.GEAR.maxUp ? 'MAX' : G.upgradeCost(it)}</span></button>` : ''}
      <button class="btn sm" data-act="pick" data-id="${x.id}" data-slot="${slot}" ${n ? '' : 'disabled'}>更換</button></span></div>`;
  }
  const plan = G.upgradeAll(app.S, x.id, true), hasGear = Object.values(x.gear).some(Boolean);
  h += `</div><div class="row">
    <button class="btn grow" data-act="upall" data-id="${x.id}" ${plan.count ? '' : 'disabled'}>${plan.empty ? '沒有裝備' : plan.count ? `一鍵強化 ${plan.count} 次（${fmt(plan.spent)} 金）` : plan.maxed ? '已全部強化到 +5' : '金幣不夠強化'}</button>
    <button class="btn" data-act="unequipall" data-id="${x.id}" ${hasGear ? '' : 'disabled'}>全部卸下</button></div>`;
  return h + heroActions(x);
}
function heroActions(x) {
  const locked = G.partyLocked(app.S);
  if (locked) return `<div class="row"><button class="btn grow" disabled>${inParty(x) ? '出戰中' : '待命中'}・掛機時無法更換隊員</button></div>`;
  return `<div class="row">${inParty(x)
    ? `<button class="btn grow" data-act="bench" data-id="${x.id}">移出隊伍</button>`
    : `<button class="btn main grow" data-act="join" data-id="${x.id}" ${app.S.party.length >= G.ECONOMY.partyMax ? 'disabled' : ''}>${app.S.party.length >= G.ECONOMY.partyMax ? '隊伍已滿' : '加入隊伍'}</button>`}
    ${app.S.heroes.length > 1 ? `<button class="btn" data-act="fire" data-id="${x.id}" style="color:var(--bad)">${app.modal.confirmFire ? `確定解雇？退 ${fmt(Math.round(G.hireCost(x) * G.RECRUIT.fireRefund))} 金` : '解雇'}</button>` : ''}</div>`;
}
// ---------- 天賦頁 ----------
function talentView(x) {
  const B = G.BASE_SKILLS[x.cls], specs = G.SPECS[x.cls], t = x.talents || {};
  const top = Math.max(0, app.S.unlocked - 1), dn = G.DUNGEONS[top];
  const opt = (act, v, on, locked, name, desc, extra = '') =>
    `<button class="opt ${on ? 'sel' : ''}" data-act="${act}" data-id="${x.id}" data-v="${v}" ${extra} ${locked ? 'disabled' : ''}><b>${name}</b><span>${desc}</span></button>`;
  const specRow = `<div class="trow ${x.level < G.SPEC_LEVEL ? 'locked' : ''}"><span class="tlv num">Lv${G.SPEC_LEVEL}<small>${x.level < G.SPEC_LEVEL ? '未解鎖' : '專精'}</small></span>
      ${Object.entries(specs).map(([k, sp]) => opt('spec', k, x.spec === k, x.level < G.SPEC_LEVEL, `${sp.name}・${sp.skill}`, sp.desc)).join('')}</div>`;
  let h = `<div class="skillcard"><span class="label">基礎技能</span><b>${B.name}</b><span class="sub" style="margin:0">${B.desc}</span></div>`;
  G.TALENTS[x.cls].forEach((row, i) => {
    const lv = G.TALENT_ROWS[i], locked = x.level < lv;
    if (lv > G.SPEC_LEVEL && !h.includes('data-act="spec"')) h += specRow; // 專精插在 Lv5 與 Lv15 之間
    h += `<div class="trow ${locked ? 'locked' : ''}"><span class="tlv num">Lv${lv}${locked ? '<small>未解鎖</small>' : ''}</span>
      ${['a', 'b'].map(k => opt('talent', k, t[lv] === k && !locked, locked, row[k].name, row[k].desc, `data-lv="${lv}"`)).join('')}</div>`;
  });
  h += `<div class="row"><button class="btn grow" data-act="recommend" data-id="${x.id}" data-d="${top}">依「${dn.name}」推薦配置</button></div>
    <p class="sub" style="margin:0">隨時可以免費更換，下一場戰鬥生效。</p>`;
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
