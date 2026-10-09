// ===== 團長分頁（團隊頁「英雄｜團長」）：團長等級、天賦樹（v0.24 一格一點；v0.24.1 改成由上往下長）、戰鬥指令 =====
import { tx } from '../../core/i18n.js';
import * as G from '../../core/index.js';
import { app } from '../state.js';
import { fmt, pct } from '../helpers.js';
import DATA from '../icon-data.js';

// 草稿：玩家先點亮（草稿），按「確認」才寫進存檔；已確認的點只能用重置拿回來
export const draft = () => app.leaderDraft || G.leaderAlloc(app.S);
const dirty = () => !!app.leaderDraft && G.spentPts(app.leaderDraft) !== G.spentPts(G.leaderAlloc(app.S));
const VW = 420, VH = 590, X = c => 46 + c * 82, Y = r => 56 + r * 92, R = 27; // v0.24.1 樹根在上、往下長
const WHY = {
  soon: () => tx('站位玩法開放後才能點'),
  region: () => tx('打通這個地區後才能學'),
  pre: n => tx('要先點亮：{0}', n.pre.map(p => G.NODE[p].n).join(tx(' 或 '))),
  fork: () => tx('這是分岔，已經選了另一條路'),
  points: () => tx('點數不夠，團長升級可以拿到更多點數'),
};
const iconPath = name => DATA[name] || '';

// 一系的樹：樹根在最上面，樹枝往下分（越下層越細）＋節點（圓＝被動、菱形＝團長指令）
function treeSvg(br, a, level) {
  const nodes = G.LEADER_TREE[br].nodes, root = nodes[0];
  let h = `<path class="lbranch ${a[root.id] ? 'on' : ''}" style="stroke-width:18" d="M${X(root.c)} 4 L ${X(root.c)} ${Y(0)}"/>`;
  for (const n of nodes) for (const p of n.pre || []) {
    const o = G.NODE[p], lit = a[p] && a[n.id], w = Math.max(5, 15 - o.r * 2.4);
    const x1 = X(o.c), y1 = Y(o.r), x2 = X(n.c), y2 = Y(n.r), dy = (y2 - y1) * 0.5;
    h += `<path class="lbranch ${lit ? 'on' : ''}" style="stroke-width:${w}" d="M${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}"/>`;
  }
  const sel = selIn(br);
  for (const n of nodes) {
    const on = !!a[n.id], can = G.canAdd(a, n.id, level, app.S), cmd = !!n.cmd;
    const cls = ['lnode2', cmd ? 'cmd' : '', on ? 'on' : '', can ? 'can' : '', n.soon ? 'soon' : '', n.fork ? 'fork' : '', n.id === sel ? 'sel' : ''].join(' ');
    const shape = cmd ? `<path class="bg" d="M0 ${-R - 6} L${R + 6} 0 L0 ${R + 6} L${-R - 6} 0 Z"/>` : `<circle class="bg" r="${R}"/>`;
    h += `<g class="${cls}" transform="translate(${X(n.c)} ${Y(n.r)})" data-act="lnode" data-v="${n.id}" tabindex="0" role="button" aria-label="${n.n}${on ? tx('（已點）') : ''}">${shape}<g transform="translate(-15 -15) scale(${30 / 512})"><path class="ic" d="${iconPath(n.icon)}"/></g></g>`;
  }
  return `<svg class="ltree" viewBox="0 0 ${VW} ${VH}" role="group" aria-label="${G.LEADER_TREE[br].name}">${h}</svg>`;
}
const selIn = br => (app.leaderSel && G.NODE[app.leaderSel] && G.NODE[app.leaderSel].branch === br ? app.leaderSel : null);
// 點了節點後，說明卡浮在節點旁邊（節點在左半邊就放右邊，反之放左邊）；點樹的空白處關閉
function detail(a, level, br) {
  const id = selIn(br); if (!id) return '';
  const n = G.NODE[id], on = !!a[id], saved = !!G.leaderAlloc(app.S)[id], why = G.whyNot(a, id, level, app.S);
  const reason = why && why !== 'on' && WHY[why] ? `<span class="lwhy">${WHY[why](n)}</span>` : '';
  const btns = on
    ? (saved ? `<span class="sub" style="margin:0">${tx('已點亮（要改需重置）')}</span>` : `<button class="btn sm" data-act="lsub" data-v="${id}" ${G.canRemove(a, id) ? '' : 'disabled'}>${tx('取消這格')}</button>`)
    : `<button class="btn sm main" data-act="ladd" data-v="${id}" ${why ? 'disabled' : ''}>${tx('點亮（1 點）')}</button>`;
  const x = X(n.c) / VW * 100, y = Y(n.r) / VH * 100, gap = (R + 12) / VW * 100;
  const side = n.c <= 2 ? `left:${(x + gap).toFixed(1)}%;right:2%` : `left:2%;right:${(100 - x + gap).toFixed(1)}%`;
  const ty = n.r < 0.6 ? '-20%' : n.r > 4.4 ? '-85%' : '-50%';
  return `<div class="ldetail lpop ${n.c <= 2 ? 'r' : 'l'}" data-act="lkeep" style="${side};top:${y.toFixed(1)}%;transform:translateY(${ty})"><b>${n.cmd ? `<span class="ltag cmd">${tx('團長指令')}</span>` : `<span class="ltag">${tx('被動')}</span>`}${n.n}</b><p>${n.desc}</p>${n.fork ? `<small class="sub" style="margin:0">${tx('分岔：和另一格只能選一格')}</small>` : ''}${reason}<div class="row" style="align-items:center">${btns}</div></div>`;
}
// 戰鬥指令：學會的指令裡選最多兩個帶進戰鬥
function cmdPicker() {
  const learned = G.learnedCmds(app.S); if (!learned.length) return '';
  const eq = G.equippedCmds(app.S);
  return `<span class="label">${tx('戰鬥指令（最多帶 {0} 個）', G.LEADER.maxCmds)}</span><div class="lcmds">${learned.map(c => `<button class="tf ${eq.includes(c) ? 'sel' : ''}" data-act="lcmd" data-v="${c}" aria-pressed="${eq.includes(c)}" title="${G.COMMANDS[c].desc}">${G.COMMANDS[c].name}</button>`).join('')}</div>
    <p class="sub" style="margin:0">${tx('戰鬥中在隊員下方按，每場一次；掛機時自動下達。')}</p>`;
}
export function viewLeader() {
  const S = app.S, lv = G.leaderLevel(S), max = G.leaderMax(S), xp = G.leaderXp(S), a = draft();
  const lo = G.leaderXpFor(lv), hi = G.leaderXpFor(lv + 1), left = lv - G.spentPts(a);
  const br = G.LEADER_TREE[app.leaderBranch] ? app.leaderBranch : 'tactics';
  let h = '';
  if (S.leader && S.leader.refunded) h += `<div class="nextstep"><div><span class="label">${tx('天賦樹改版')}</span><b>${tx('團長天賦改成天賦樹了')}</b><span class="sub" style="margin:0">${tx('之前的點數已經全部退回，可以免費重新分配。')}</span></div><button class="btn sm main" data-act="lrefundok">${tx('知道了')}</button></div>`;
  h += `<div class="lhead"><div><span class="label">${tx('團長')}</span><b class="num">Lv${lv}<small class="sub"> / ${max}</small></b></div>
    <div class="lpts ${left ? 'has' : ''}"><b class="num">${left}</b><small>${tx('可用點數')}</small></div>
    <div class="xpbar" style="grid-column:1/-1"><i style="width:${lv >= max ? 100 : pct(xp - lo, hi - lo)}%"></i></div>
    <small class="sub" style="grid-column:1/-1;margin:0">${lv >= max ? tx('已達目前上限（出海後每打通一個地區 +{0} 級）', G.LEADER.perRegion) : tx('團長經驗 {0} / {1}・每場戰鬥 +1、首次通關 +{2}', fmt(xp), fmt(hi), G.LEADER.xpFirst)}</small></div>`;
  h += `<div class="seg modes lbranch">${Object.entries(G.LEADER_TREE).map(([k, b]) => `<button data-act="lbranch" data-v="${k}" class="${k === br ? 'sel' : ''}" ${G.branchOpen(S, k) ? '' : 'disabled'}>${b.name}<small class="num"> ${G.branchPts(a, k)}/${b.nodes.length}</small></button>`).join('')}</div>`;
  h += `<div class="ltreebox" data-act="lclose"><div class="ltreewrap">${treeSvg(br, a, lv)}${detail(a, lv, br)}</div></div>`;
  if (!selIn(br)) h += `<p class="sub lhint">${tx('點樹上的圖示看說明。圓形是被動，菱形是戰鬥中可以按的團長指令。')}</p>`;
  if (dirty()) h += `<div class="ctrlbar mselbar"><div class="ctrl"><span class="mcount">${tx('新增 {0} 點', G.spentPts(a) - G.spentPts(G.leaderAlloc(S)))}<small>${tx('確認後要重置才能收回')}</small></span><button class="btn" data-act="lcancel">${tx('取消')}</button><button class="btn main" data-act="lcommit">${tx('確認配點')}</button></div></div>`;
  h += cmdPicker();
  const spent = G.spentPts(G.leaderAlloc(S));
  h += `<div class="howto" style="margin-top:14px">${tx('<b>團長天賦</b>是公會傳授的指揮學：戰術、士氣、後勤三棵樹，從最上面的樹根往下點，每格 1 點。點數不夠全部點亮，要自己決定先走哪條路；虛線的格子是分岔，只能選一格。出海之後，各地的勢力會再傳授當地的戰法。')}</div>`;
  h += `<div class="row" style="margin-top:10px"><button class="btn sm" data-act="lreset" ${spent ? '' : 'disabled'}>${tx('重置天賦（{0} 金）', fmt(G.resetCost(S)))}</button></div>`;
  return h;
}
