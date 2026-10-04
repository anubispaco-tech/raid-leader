// ===== 酒館分頁：名單招募、招募令、保底 =====
import { tx } from '../../core/i18n.js';
import * as G from '../../core/index.js';
import { app } from '../state.js';
import { fmt, cls, heroName, rarityTag } from '../helpers.js';

export function viewTavern() {
  const S = app.S, E = G.ECONOMY, full = S.heroes.length >= E.rosterMax;
  const one = G.scrollCost(S, 1), ten = G.scrollCost(S, 10), P = S.recruit, legendsLeft = G.legendsAvailable(S).length;
  let h = tx('<h2>酒館</h2><p class="sub">名冊 <b class="num">{0}/{1}</b>。新英雄的等級會接近你隊伍的平均。</p> <div class="recruit"><div><span class="label">招募令</span><b>直接抽一位英雄加入名冊</b> <span class="sub num" style="margin:0">第 {2} 抽內必出史詩以上{3}</span></div> <div class="row"><button class="btn main grow" data-act="scroll" data-n="1" {4}>單抽 <span class="num">{5}</span> 金</button> <button class="btn main grow" data-act="scroll" data-n="10" {6}>十連 <span class="num">{7}</span> 金</button></div> {8} <div class="rates">{9}</div></div> <h2 style="font-size:18px">今日名單</h2><div class="stack">', S.heroes.length, E.rosterMax, Math.max(1, G.RECRUIT.pityEpic - P.sinceEpic + 1), legendsLeft ? tx('・第 {0} 抽內必出傳說', Math.max(1, G.RECRUIT.pityLegend - P.sinceLegend + 1)) : '', full || S.gold < one ? 'disabled' : '', fmt(one), S.heroes.length + 10 > E.rosterMax || S.gold < ten ? 'disabled' : '', fmt(ten), full ? tx('<span class="sub" style="margin:0;color:var(--warn)">名冊滿了，先到「團隊」解雇一些英雄</span>') : S.heroes.length + 10 > E.rosterMax ? tx('<span class="sub" style="margin:0">十連需要名冊還有 10 個空位</span>') : '', G.HERO_RARITY.map((r, i) => `<span class="c${i}">${r.name} ${+(r.weight * 100).toFixed(1)}%</span>`).join(''));
  for (const x of S.tavern) {
    const c = cls(x), cost = G.hireCost(x);
    h += tx('<div class="hero r-{0}"><div class="ic">{1}</div><div class="nm">{2}{3}<small>{4}{5}・{6}・<span class="num">Lv{7}</span></small></div> <button class="btn sm main" data-act="hire" data-id="{8}" {9} style="grid-row:span 2"><span class="num">{10}</span> 金</button> <div class="st">{11}</div></div>', x.rarity || 0, c.icon, heroName(x), rarityTag(x), c.name, x.spec ? `・${G.SPECS[x.cls][x.spec].name}` : '', G.ROLE_NAME[G.roleOf(x)], x.level, x.id, S.gold < cost || full ? 'disabled' : '', fmt(cost), x.legend ? tx('<b class="c4">{0}</b>：{1}', G.LEGENDS[x.cls].pname, G.LEGENDS[x.cls].desc) : c.desc);
  }
  const rc = G.refreshCost(S);
  h += tx('</div><div class="row" style="margin-top:12px"><button class="btn" data-act="reroll" {0}>換一批（<span class="num">{1}</span> 金）</button><span class="sub" style="margin:0;align-self:center">換一批也算進保底</span></div> <h2 style="font-size:18px">傳奇英雄</h2><div class="stack">{2}</div> <h2 style="font-size:18px">職業圖鑑</h2><div class="stack">{3}</div>', S.gold < rc ? 'disabled' : '', fmt(rc), Object.entries(G.LEGENDS).map(([k, L]) => {
      const owned = S.heroes.some(x => x.legend && x.cls === k);
      return tx('<div class="hero {0}"><div class="ic">{1}</div><div class="nm"><span class="c4">{2}・{3}</span><small>{4}・{5}</small></div><span></span><div class="st"><b>{6}</b>：{7}</div></div>', owned ? 'r-4' : 'unowned', G.CLASSES[k].icon, L.title, L.name, G.CLASSES[k].name, owned ? tx('已招募') : tx('未招募'), L.pname, L.desc);
    }).join(''), Object.values(G.CLASSES).map(c => `<div class="hero"><div class="ic">${c.icon}</div><div class="nm">${c.name}<small>${G.ROLE_NAME[c.role]}</small></div><span></span><div class="st">${c.desc}</div></div>`).join(''));
  return h;
}
