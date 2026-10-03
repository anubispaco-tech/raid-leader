// ===== 酒館分頁 =====
import * as G from '../../core/index.js';
import { app } from '../state.js';
import { $, fmt, pct, toast, hero, cls, inParty, itemStatText, itemName, partyPower, avgPartyIlvl, avgPartyLv } from '../helpers.js';

export function viewTavern() {
  let h = `<h2>酒館</h2><p class="sub">招募新英雄，等級會接近你隊伍的平均。名冊最多 ${G.ECONOMY.rosterMax} 人。</p><div class="stack">`;
  for (const x of app.S.tavern) {
    const c = cls(x), cost = G.hireCost(x);
    h += `<div class="hero"><div class="ic">${c.icon}</div><div class="nm">${x.name}<small>${c.name}${x.spec ? `・${G.SPECS[x.cls][x.spec].name}` : ''}・${G.ROLE_NAME[c.role]}・<span class="num">Lv${x.level}</span></small></div>
      <button class="btn sm main" data-act="hire" data-id="${x.id}" ${app.S.gold < cost || app.S.heroes.length >= G.ECONOMY.rosterMax ? 'disabled' : ''} style="grid-row:span 2"><span class="num">${cost}</span> 金</button>
      <div class="st">${c.desc}</div></div>`;
  }
  h += `</div><div class="row" style="margin-top:12px"><button class="btn" data-act="reroll" ${app.S.gold < G.ECONOMY.refreshCost ? 'disabled' : ''}>換一批（<span class="num">${G.ECONOMY.refreshCost}</span> 金）</button></div>
    <h2 style="font-size:18px">職業圖鑑</h2><div class="stack">${Object.values(G.CLASSES).map(c => `<div class="hero"><div class="ic">${c.icon}</div><div class="nm">${c.name}<small>${G.ROLE_NAME[c.role]}</small></div><span></span><div class="st">${c.desc}</div></div>`).join('')}</div>`;
  return h;
}
