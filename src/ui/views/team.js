// ===== 團隊分頁 =====
import * as G from '../../core/index.js';
import { app } from '../state.js';
import { $, fmt, pct, toast, hero, cls, inParty, itemStatText, itemName, partyPower, avgPartyIlvl, avgPartyLv } from '../helpers.js';

function roleCount() {
  const c = { tank: 0, heal: 0, dps: 0 }; G.partyHeroes(app.S).forEach(h => c[cls(h).role]++); return c;
}
export function viewTeam() {
  const party = G.partyHeroes(app.S), c = roleCount();
  let h = `<h2>團隊</h2><p class="sub">出戰最多 ${G.ECONOMY.partyMax} 人。點英雄查看裝備與調整陣容。</p>
    <div class="party">${Array.from({ length: G.ECONOMY.partyMax }, (_, i) => {
      const x = party[i];
      if (!x) return `<div class="slot emptyslot">空位</div>`;
      return `<button class="slot" data-act="hero" data-id="${x.id}"><div class="ic">${cls(x).icon}</div><div class="n">${x.name}</div><div class="lv num">Lv${x.level}</div><div class="rl role-${cls(x).role}"></div></button>`;
    }).join('')}</div>
    <div class="comp"><span><b style="color:var(--tank)">坦克</b> ${c.tank}</span><span><b style="color:var(--heal)">治療</b> ${c.heal}</span><span><b style="color:var(--dps)">輸出</b> ${c.dps}</span><span>戰力 <b class="num" style="color:var(--fg)">${fmt(partyPower())}</b></span>
    ${!c.tank ? '<span style="color:var(--warn)">缺坦克</span>' : ''}${!c.heal ? '<span style="color:var(--warn)">缺治療</span>' : ''}</div>
    <h2 style="font-size:18px">名冊 <span class="sub num">${app.S.heroes.length}/${G.ECONOMY.rosterMax}</span></h2><div class="stack">`;
  const sorted = [...app.S.heroes].sort((a, b) => (inParty(b) - inParty(a)) || b.level - a.level);
  for (const x of sorted) h += heroCard(x);
  h += `</div><h2 style="font-size:18px">存檔</h2><div class="row"><button class="btn" data-act="export">匯出存檔碼</button><button class="btn" data-act="import">匯入</button><button class="btn" data-act="reset" style="margin-left:auto;color:var(--bad)">重新開始</button></div>
    <p class="sub" style="margin-top:8px">共挑戰 ${app.S.stats.runs} 次・通關 ${app.S.stats.wins} 次</p>`;
  return h;
}
function heroCard(x) {
  const st = G.heroStats(x, app.S.items);
  const need = G.xpNeed(x.level);
  return `<button class="hero" data-act="hero" data-id="${x.id}"><div class="ic">${cls(x).icon}</div>
    <div class="nm">${x.name}<small>${cls(x).name}${x.spec ? `・${G.SPECS[x.cls][x.spec].name}` : ''}・<span class="num">Lv${x.level}</span></small>${G.pendingPicks(x) ? '<span class="newpick">可選天賦</span>' : ''}</div>
    <span class="tag ${inParty(x) ? 'in' : ''}">${inParty(x) ? '出戰中' : '待命'}</span>
    <div class="st num"><span>生命 ${fmt(st.hp)}</span><span>威力 ${st.pow}</span><span>暴擊 ${Math.round(st.crit * 100)}%</span><span>裝等 ${G.heroIlvl(x, app.S.items)}</span></div>
    <div class="xpbar"><i style="width:${x.level >= G.HERO.maxLevel ? 100 : pct(x.xp, need)}%"></i></div></button>`;
}
