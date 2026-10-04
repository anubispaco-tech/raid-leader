// ===== 成就頁（抽屜）=====
import { tx } from '../../core/i18n.js';
import * as G from '../../core/index.js';
import { app } from '../state.js';
import { svg, TROPHY } from '../icons.js';

const fmtDate = t => { const d = new Date(t); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };
export function sheetAchievements() {
  const S = app.S, done = (S.ach && S.ach.done) || {}, cat = app.achCat || 'story';
  const pts = G.achPoints(S), total = G.achTotal(), n = G.ACHIEVEMENTS.filter(a => done[a.id]).length;
  let h = tx('<h3>{0} 成就</h3><div class="achsum"><b class="num">{1}</b><span class="sub num" style="margin:0">/ {2} 點・已完成 {3}/{4}</span></div>', svg(TROPHY, 'gi-boss'), pts, total, n, G.ACHIEVEMENTS.length);
  h += `<div class="seg achcats">${G.ACH_CATS.map(c => {
    const list = G.ACHIEVEMENTS.filter(a => a.cat === c.id), d = list.filter(a => done[a.id]).length;
    return `<button data-act="achcat" data-v="${c.id}" class="${cat === c.id ? 'sel' : ''}">${c.name}<small class="num">${d}/${list.length}</small></button>`;
  }).join('')}</div><div class="achlist">`;
  const list = G.ACHIEVEMENTS.filter(a => a.cat === cat).sort((x, y) => (!!done[y.id]) - (!!done[x.id]) || 0);
  for (const a of list) {
    const ok = !!done[a.id], [c, g] = G.achProgress(S, a), bar = g > 1 && !ok;
    h += `<div class="ach ${ok ? 'ok' : ''}"><div class="achpts num">${a.pts}</div><div class="achbody"><b>${a.name}</b><span class="sub" style="margin:0">${a.desc}</span>${bar ? `<span class="achbar"><i style="width:${Math.round(100 * c / g)}%"></i></span><small class="sub num" style="margin:0">${c.toLocaleString()} / ${g.toLocaleString()}</small>` : ''}</div><div class="achwhen sub num" style="margin:0">${ok ? fmtDate(done[a.id]) : ''}</div></div>`;
  }
  return h + `</div><div class="row"><button class="btn grow" data-act="close-settings">${tx("關閉")}</button></div>`;
}
