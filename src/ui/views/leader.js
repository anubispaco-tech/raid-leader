// ===== v0.23 團長分頁（團隊頁「英雄｜團長」）：團長等級、三系天賦（之後各大陸的地區戰法也放這裡）=====
import { tx } from '../../core/i18n.js';
import * as G from '../../core/index.js';
import { app } from '../state.js';
import { fmt, pct } from '../helpers.js';

// 草稿：玩家按 ＋／− 先改草稿，按「確認」才寫進存檔（已確認的點只能用重置拿回來）
export const draft = () => app.leaderDraft || G.leaderAlloc(app.S);
const dirty = () => !!app.leaderDraft && G.spentPts(app.leaderDraft) !== G.spentPts(G.leaderAlloc(app.S));
const pips = (r, max) => `<span class="lpips">${Array.from({ length: max }, (_, i) => `<i class="${i < r ? 'on' : ''}"></i>`).join('')}</span>`;

function nodeCard(n, a, level) {
  const r = a[n.id] || 0, saved = G.leaderAlloc(app.S)[n.id] || 0, b = n.branch;
  const add = G.canAdd(a, n.id, level, app.S), sub = r > saved && G.canRemove(a, n.id);
  let why = '';
  if (n.soon) why = tx('即將開放');
  else if (n.ult && G.branchPts(a, b) < G.LEADER.ultNeed) why = tx('同系投入 {0} 點後可選（目前 {1}）', G.LEADER.ultNeed, G.branchPts(a, b));
  else if (n.ult && !r && G.LEADER_TREE[b].nodes.some(o => o.ult && a[o.id])) why = tx('已選另一個終極');
  const text = G.nodeText(n, Math.max(1, r)) + (n.ranks > 1 ? `<small class="sub" style="margin:0">${tx('滿 {0} 格：{1}', n.ranks, G.nodeText(n))}</small>` : '');
  return `<div class="lnode ${r ? 'on' : ''} ${n.ult ? 'ult' : ''} ${n.soon ? 'soon' : ''}">
    <div class="lnb"><b>${n.ult ? `<span class="ulttag">${tx('終極')}</span>` : ''}${n.name}</b>${pips(r, n.ranks)}<span class="ltext">${text}</span>${why ? `<small class="lwhy">${why}</small>` : ''}</div>
    <div class="lbtns"><button class="btn sm" data-act="lsub" data-v="${n.id}" ${sub ? '' : 'disabled'} aria-label="${tx('減一格')}">−</button><button class="btn sm main" data-act="ladd" data-v="${n.id}" ${add ? '' : 'disabled'} aria-label="${tx('加一格')}">＋</button></div></div>`;
}
// 目前（含草稿）效果總覽
function summary(a) {
  const m = G.leaderMods(a), p = v => `${+(v * 100).toFixed(1)}%`, out = [];
  if (m.hornDur || m.hornBonus) out.push(tx('號角 {0} 秒・+{1}', 15 + (m.hornDur || 0), p(0.3 + (m.hornBonus || 0))));
  if (m.dmg) out.push(tx('全隊傷害 +{0}', p(m.dmg))); if (m.bossDmg) out.push(tx('對首領 +{0}', p(m.bossDmg)));
  if (m.hp) out.push(tx('全隊生命 +{0}', p(m.hp))); if (m.heal) out.push(tx('治療 +{0}', p(m.heal))); if (m.tankTaken) out.push(tx('坦克減傷 {0}', p(m.tankTaken)));
  if (m.gold) out.push(tx('金幣 +{0}', p(m.gold))); if (m.xp) out.push(tx('經驗 +{0}', p(m.xp))); if (m.dust) out.push(tx('分解精華 +{0}', p(m.dust)));
  if (m.offlineH) out.push(tx('離線上限 {0} 小時', G.ECONOMY.offlineCapHours + m.offlineH)); if (m.stamina) out.push(tx('體力上限 {0}', G.MYTHIC.stamina.max + m.stamina));
  for (const n of Object.values(G.NODE)) if ((n.ult || n.id === 'kick' || n.id === 'breaker' || n.id === 'hold') && a[n.id]) out.push(n.name);
  return out.length ? `<div class="lsum">${out.map(x => `<span>${x}</span>`).join('')}</div>` : `<p class="sub" style="margin:0">${tx('還沒有點任何天賦。')}</p>`;
}
export function viewLeader() {
  const S = app.S, lv = G.leaderLevel(S), max = G.leaderMax(S), xp = G.leaderXp(S), a = draft();
  const lo = G.leaderXpFor(lv), hi = G.leaderXpFor(lv + 1), left = lv - G.spentPts(a);
  const br = G.LEADER_TREE[app.leaderBranch] ? app.leaderBranch : 'tactics';
  let h = `<div class="lhead"><div><span class="label">${tx('團長')}</span><b class="num">Lv${lv}<small class="sub"> / ${max}</small></b></div>
    <div class="lpts ${left ? 'has' : ''}"><b class="num">${left}</b><small>${tx('可用點數')}</small></div>
    <div class="xpbar" style="grid-column:1/-1"><i style="width:${lv >= max ? 100 : pct(xp - lo, hi - lo)}%"></i></div>
    <small class="sub" style="grid-column:1/-1;margin:0">${lv >= max ? tx('已達目前上限（出海後每打通一個地區 +{0} 級）', G.LEADER.perRegion) : tx('團長經驗 {0} / {1}・每場戰鬥 +1、首次通關 +{2}', fmt(xp), fmt(hi), G.LEADER.xpFirst)}</small></div>`;
  h += `<div class="seg modes lbranch">${Object.entries(G.LEADER_TREE).map(([k, b]) => `<button data-act="lbranch" data-v="${k}" class="${k === br ? 'sel' : ''}" ${G.branchOpen(S, k) ? '' : 'disabled'}>${b.name}<small class="num"> ${G.branchPts(a, k)}</small></button>`).join('')}</div>`;
  h += `<div class="lnodes">${G.LEADER_TREE[br].nodes.map(n => nodeCard({ ...n, branch: br }, a, lv)).join('')}</div>`;
  h += `<span class="label">${tx('目前效果')}</span>${summary(a)}`;
  if (dirty()) h += `<div class="ctrlbar mselbar"><div class="ctrl"><span class="mcount">${tx('新增 {0} 點', G.spentPts(a) - G.spentPts(G.leaderAlloc(S)))}<small>${tx('確認後要重置才能收回')}</small></span><button class="btn" data-act="lcancel">${tx('取消')}</button><button class="btn main" data-act="lcommit">${tx('確認配點')}</button></div></div>`;
  const spent = G.spentPts(G.leaderAlloc(S));
  h += `<div class="howto" style="margin-top:14px">${tx('<b>團長天賦</b>是公會傳授的指揮學：戰術、士氣、後勤三系，點數不夠全部點滿，要自己取捨。每系投入 {0} 點後，可以在兩個終極中選一個。出海之後，各地的勢力會再傳授當地的戰法。', G.LEADER.ultNeed)}</div>`;
  h += `<div class="row" style="margin-top:10px"><button class="btn sm" data-act="lreset" ${spent ? '' : 'disabled'}>${tx('重置天賦（{0} 金）', fmt(G.resetCost(S)))}</button></div>`;
  return h;
}
