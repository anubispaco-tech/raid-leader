// ===== 團隊分頁 =====
import { tx } from '../../core/i18n.js';
import * as G from '../../core/index.js';
import { app } from '../state.js';
import { enabled } from '../telemetry.js';
import { $, fmt, pct, toast, hero, cls, inParty, itemStatText, itemName, partyPower, avgPartyIlvl, avgPartyLv , esc, heroName, rarityTag } from '../helpers.js';

function roleCount() {
  const c = { tank: 0, heal: 0, dps: 0 }; G.partyHeroes(app.S).forEach(h => c[G.roleOf(h)]++); return c;
}
export function viewTeam() {
  const party = G.partyHeroes(app.S), c = roleCount();
  let h = tx('<h2>團隊</h2><p class="sub">出戰最多 {0} 人。{1}</p> <div class="party">{2}</div> <div class="comp"><span><b style="color:var(--tank)">坦克</b> {3}</span><span><b style="color:var(--heal)">治療</b> {4}</span><span><b style="color:var(--dps)">輸出</b> {5}</span><span>戰力 <b class="num" style="color:var(--fg)">{6}</b></span> {7}{8}</div> <h2 style="font-size:18px">名冊 <span class="sub num">{9}/{10}</span></h2>{11}<div class="stack">', G.ECONOMY.partyMax, G.partyLocked(app.S) ? tx('<b style="color:var(--warn)">掛機中，陣容已鎖定</b>，停止掛機後才能換人。') : tx('點英雄查看裝備與調整陣容。'), Array.from({ length: G.ECONOMY.partyMax }, (_, i) => {
      const x = party[i];
      if (!x) return tx('<div class="slot emptyslot">空位</div>');
      return `<button class="slot r-${x.rarity || 0}" data-act="hero" data-id="${x.id}"><div class="ic">${cls(x).icon}</div><div class="n c${x.rarity || 0}">${x.name}</div><div class="lv num">Lv${x.level}</div><div class="rl role-${G.roleOf(x)}"></div></button>`;
    }).join(''), c.tank, c.heal, c.dps, fmt(partyPower()), !c.tank ? tx('<span style="color:var(--warn)">缺坦克</span>') : '', !c.heal ? tx('<span style="color:var(--warn)">缺治療</span>') : '', app.S.heroes.length, G.ECONOMY.rosterMax, fireBar());
  const sorted = [...app.S.heroes].sort((a, b) => (inParty(b) - inParty(a)) || (b.rarity || 0) - (a.rarity || 0) || b.level - a.level);
  for (const x of sorted) h += heroCard(x);
  h += `</div>` + (enabled() ? tx('<h2 style="font-size:18px">意見回饋</h2><div class="settings"> <textarea id="fbText" class="fb" maxlength="1000" placeholder="哪裡好玩、哪裡卡住、想要什麼功能都可以寫">{0}</textarea> <div class="row" style="align-items:center"><span class="sub" style="margin:0">會附上暱稱「{1}」與目前進度</span><button class="btn main" data-act="sendfb" style="margin-left:auto">送出</button></div></div>', esc(app.fbDraft || ''), esc(app.S.player.name || tx('匿名'))) : '') + langBar() + tx('<h2 style="font-size:18px">暱稱</h2><div class="settings"><div class="set"><span>天梯上顯示為 <b>{0}</b></span><button class="btn sm" data-act="nick">修改</button></div></div> <h2 style="font-size:18px">存檔</h2><div class="row"><button class="btn" data-act="export">匯出存檔碼</button><button class="btn" data-act="import">匯入</button><button class="btn" data-act="reset" style="margin-left:auto;color:var(--bad)">重新開始</button></div> <p class="sub" style="margin-top:8px">共挑戰 {1} 次・通關 {2} 次</p>', esc(app.S.player.name || tx('匿名')), app.S.stats.runs, app.S.stats.wins);
  return h;
}
function heroCard(x) {
  const st = G.heroStats(x, app.S.items);
  const need = G.xpNeed(x.level);
  return tx('<button class="hero r-{0}" data-act="hero" data-id="{1}"><div class="ic">{2}</div> <div class="nm">{3}{4}<small>{5}{6}・<span class="num">Lv{7}</span></small>{8}</div> <span class="tag {9}">{10}</span> <div class="st num"><span>生命 {11}</span><span>威力 {12}</span><span>暴擊 {13}%</span><span>裝等 {14}</span></div> <div class="xpbar"><i style="width:{15}%"></i></div></button>', x.rarity || 0, x.id, cls(x).icon, heroName(x), rarityTag(x), cls(x).name, x.spec ? `・${G.SPECS[x.cls][x.spec].name}` : '', x.level, G.pendingPicks(x) ? tx('<span class="newpick">可選天賦</span>') : '', inParty(x) ? 'in' : '', inParty(x) ? tx('出戰中') : tx('待命'), fmt(st.hp), st.pow, Math.round(st.crit * 100), G.heroIlvl(x, app.S.items), x.level >= G.HERO.maxLevel ? 100 : pct(x.xp, need));
}
// 一鍵解雇：只解雇待命英雄（出戰中、傳說不會被選到），裝備自動卸下
function fireBar() {
  const sel = app.fireSel ?? 0, d = G.fireMany(app.S, sel, true);
  return tx('<div class="toolbar"><label class="selwrap"><span>解雇待命</span><select id="fireSel" aria-label="解雇品質">{0}</select></label> <button class="btn sm {1}" data-act="firemany" {2}>{3}</button></div> <p class="sub" style="margin:4px 0 8px">只解雇待命中的英雄，傳說不會被選到；身上裝備自動卸回背包。</p>', [0, 1, 2, 3].map(r => `<option value="${r}" ${sel === r ? 'selected' : ''}>${G.HERO_RARITY[r].name}${r ? tx('以下') : ''}</option>`).join(''), app.fireConfirm ? 'danger' : '', d.count ? '' : 'disabled', !d.count ? tx('沒有符合的英雄') : app.fireConfirm ? tx('確定解雇 {0} 人？退 {1} 金', d.count, fmt(d.refund)) : tx('一鍵解雇（{0} 人）', d.count));
}
// 語言切換（切換後重新載入）
function langBar() {
  return `<h2 style="font-size:18px">${tx('語言')} · Language</h2><div class="seg">${G.LANGS.map(l => `<button data-act="lang" data-v="${l.id}" class="${l.id === G.getLang() ? 'sel' : ''}">${l.name}</button>`).join('')}</div>`;
}
