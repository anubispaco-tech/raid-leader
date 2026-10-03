// ===== 酒館分頁：名單招募、招募令、保底 =====
import * as G from '../../core/index.js';
import { app } from '../state.js';
import { fmt, cls, heroName, rarityTag } from '../helpers.js';

export function viewTavern() {
  const S = app.S, E = G.ECONOMY, full = S.heroes.length >= E.rosterMax;
  const one = G.scrollCost(S, 1), ten = G.scrollCost(S, 10), P = S.recruit, legendsLeft = G.legendsAvailable(S).length;
  let h = `<h2>酒館</h2><p class="sub">名冊 <b class="num">${S.heroes.length}/${E.rosterMax}</b>。新英雄的等級會接近你隊伍的平均。</p>
    <div class="recruit"><div><span class="label">招募令</span><b>直接抽一位英雄加入名冊</b>
      <span class="sub num" style="margin:0">第 ${Math.max(1, G.RECRUIT.pityEpic - P.sinceEpic + 1)} 抽內必出史詩以上${legendsLeft ? `・第 ${Math.max(1, G.RECRUIT.pityLegend - P.sinceLegend + 1)} 抽內必出傳說` : ''}</span></div>
      <div class="row"><button class="btn main grow" data-act="scroll" data-n="1" ${full || S.gold < one ? 'disabled' : ''}>單抽 <span class="num">${fmt(one)}</span> 金</button>
      <button class="btn main grow" data-act="scroll" data-n="10" ${S.heroes.length + 10 > E.rosterMax || S.gold < ten ? 'disabled' : ''}>十連 <span class="num">${fmt(ten)}</span> 金</button></div>
      ${full ? '<span class="sub" style="margin:0;color:var(--warn)">名冊滿了，先到「團隊」解雇一些英雄</span>' : S.heroes.length + 10 > E.rosterMax ? `<span class="sub" style="margin:0">十連需要名冊還有 10 個空位</span>` : ''}
      <div class="rates">${G.HERO_RARITY.map((r, i) => `<span class="c${i}">${r.name} ${+(r.weight * 100).toFixed(1)}%</span>`).join('')}</div></div>
    <h2 style="font-size:18px">今日名單</h2><div class="stack">`;
  for (const x of S.tavern) {
    const c = cls(x), cost = G.hireCost(x);
    h += `<div class="hero r-${x.rarity || 0}"><div class="ic">${c.icon}</div><div class="nm">${heroName(x)}${rarityTag(x)}<small>${c.name}${x.spec ? `・${G.SPECS[x.cls][x.spec].name}` : ''}・${G.ROLE_NAME[c.role]}・<span class="num">Lv${x.level}</span></small></div>
      <button class="btn sm main" data-act="hire" data-id="${x.id}" ${S.gold < cost || full ? 'disabled' : ''} style="grid-row:span 2"><span class="num">${fmt(cost)}</span> 金</button>
      <div class="st">${x.legend ? `<b class="c4">${G.LEGENDS[x.cls].pname}</b>：${G.LEGENDS[x.cls].desc}` : c.desc}</div></div>`;
  }
  const rc = G.refreshCost(S);
  h += `</div><div class="row" style="margin-top:12px"><button class="btn" data-act="reroll" ${S.gold < rc ? 'disabled' : ''}>換一批（<span class="num">${fmt(rc)}</span> 金）</button><span class="sub" style="margin:0;align-self:center">換一批也算進保底</span></div>
    <h2 style="font-size:18px">傳奇英雄</h2><div class="stack">${Object.entries(G.LEGENDS).map(([k, L]) => {
      const owned = S.heroes.some(x => x.legend && x.cls === k);
      return `<div class="hero ${owned ? 'r-4' : 'unowned'}"><div class="ic">${G.CLASSES[k].icon}</div><div class="nm"><span class="c4">${L.title}・${L.name}</span><small>${G.CLASSES[k].name}・${owned ? '已招募' : '未招募'}</small></div><span></span><div class="st"><b>${L.pname}</b>：${L.desc}</div></div>`;
    }).join('')}</div>
    <h2 style="font-size:18px">職業圖鑑</h2><div class="stack">${Object.values(G.CLASSES).map(c => `<div class="hero"><div class="ic">${c.icon}</div><div class="nm">${c.name}<small>${G.ROLE_NAME[c.role]}</small></div><span></span><div class="st">${c.desc}</div></div>`).join('')}</div>`;
  return h;
}
