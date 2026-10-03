// ===== 團隊分頁 =====
import * as G from '../../core/index.js';
import { app } from '../state.js';
import { enabled } from '../telemetry.js';
import { $, fmt, pct, toast, hero, cls, inParty, itemStatText, itemName, partyPower, avgPartyIlvl, avgPartyLv , esc, heroName, rarityTag } from '../helpers.js';

function roleCount() {
  const c = { tank: 0, heal: 0, dps: 0 }; G.partyHeroes(app.S).forEach(h => c[cls(h).role]++); return c;
}
export function viewTeam() {
  const party = G.partyHeroes(app.S), c = roleCount();
  let h = `<h2>團隊</h2><p class="sub">出戰最多 ${G.ECONOMY.partyMax} 人。${G.partyLocked(app.S) ? '<b style="color:var(--warn)">掛機中，陣容已鎖定</b>，停止掛機後才能換人。' : '點英雄查看裝備與調整陣容。'}</p>
    <div class="party">${Array.from({ length: G.ECONOMY.partyMax }, (_, i) => {
      const x = party[i];
      if (!x) return `<div class="slot emptyslot">空位</div>`;
      return `<button class="slot r-${x.rarity || 0}" data-act="hero" data-id="${x.id}"><div class="ic">${cls(x).icon}</div><div class="n c${x.rarity || 0}">${x.name}</div><div class="lv num">Lv${x.level}</div><div class="rl role-${cls(x).role}"></div></button>`;
    }).join('')}</div>
    <div class="comp"><span><b style="color:var(--tank)">坦克</b> ${c.tank}</span><span><b style="color:var(--heal)">治療</b> ${c.heal}</span><span><b style="color:var(--dps)">輸出</b> ${c.dps}</span><span>戰力 <b class="num" style="color:var(--fg)">${fmt(partyPower())}</b></span>
    ${!c.tank ? '<span style="color:var(--warn)">缺坦克</span>' : ''}${!c.heal ? '<span style="color:var(--warn)">缺治療</span>' : ''}</div>
    <h2 style="font-size:18px">名冊 <span class="sub num">${app.S.heroes.length}/${G.ECONOMY.rosterMax}</span></h2>${fireBar()}<div class="stack">`;
  const sorted = [...app.S.heroes].sort((a, b) => (inParty(b) - inParty(a)) || (b.rarity || 0) - (a.rarity || 0) || b.level - a.level);
  for (const x of sorted) h += heroCard(x);
  h += `</div>` + (enabled() ? `<h2 style="font-size:18px">意見回饋</h2><div class="settings">
    <textarea id="fbText" class="fb" maxlength="1000" placeholder="哪裡好玩、哪裡卡住、想要什麼功能都可以寫">${esc(app.fbDraft || '')}</textarea>
    <div class="row" style="align-items:center"><span class="sub" style="margin:0">會附上暱稱「${esc(app.S.player.name || '匿名')}」與目前進度</span><button class="btn main" data-act="sendfb" style="margin-left:auto">送出</button></div></div>` : '') + `<h2 style="font-size:18px">暱稱</h2><div class="settings"><div class="set"><span>天梯上顯示為 <b>${esc(app.S.player.name || '匿名')}</b></span><button class="btn sm" data-act="nick">修改</button></div></div>
    <h2 style="font-size:18px">存檔</h2><div class="row"><button class="btn" data-act="export">匯出存檔碼</button><button class="btn" data-act="import">匯入</button><button class="btn" data-act="reset" style="margin-left:auto;color:var(--bad)">重新開始</button></div>
    <p class="sub" style="margin-top:8px">共挑戰 ${app.S.stats.runs} 次・通關 ${app.S.stats.wins} 次</p>`;
  return h;
}
function heroCard(x) {
  const st = G.heroStats(x, app.S.items);
  const need = G.xpNeed(x.level);
  return `<button class="hero r-${x.rarity || 0}" data-act="hero" data-id="${x.id}"><div class="ic">${cls(x).icon}</div>
    <div class="nm">${heroName(x)}${rarityTag(x)}<small>${cls(x).name}${x.spec ? `・${G.SPECS[x.cls][x.spec].name}` : ''}・<span class="num">Lv${x.level}</span></small>${G.pendingPicks(x) ? '<span class="newpick">可選天賦</span>' : ''}</div>
    <span class="tag ${inParty(x) ? 'in' : ''}">${inParty(x) ? '出戰中' : '待命'}</span>
    <div class="st num"><span>生命 ${fmt(st.hp)}</span><span>威力 ${st.pow}</span><span>暴擊 ${Math.round(st.crit * 100)}%</span><span>裝等 ${G.heroIlvl(x, app.S.items)}</span></div>
    <div class="xpbar"><i style="width:${x.level >= G.HERO.maxLevel ? 100 : pct(x.xp, need)}%"></i></div></button>`;
}
// 一鍵解雇：只解雇待命英雄（出戰中、傳說不會被選到），裝備自動卸下
function fireBar() {
  const sel = app.fireSel ?? 0, d = G.fireMany(app.S, sel, true);
  return `<div class="toolbar"><label class="selwrap"><span>解雇待命</span><select id="fireSel" aria-label="解雇品質">${[0, 1, 2, 3].map(r => `<option value="${r}" ${sel === r ? 'selected' : ''}>${G.HERO_RARITY[r].name}${r ? '以下' : ''}</option>`).join('')}</select></label>
    <button class="btn sm ${app.fireConfirm ? 'danger' : ''}" data-act="firemany" ${d.count ? '' : 'disabled'}>${!d.count ? '沒有符合的英雄' : app.fireConfirm ? `確定解雇 ${d.count} 人？退 ${fmt(d.refund)} 金` : `一鍵解雇（${d.count} 人）`}</button></div>
    <p class="sub" style="margin:4px 0 8px">只解雇待命中的英雄，傳說不會被選到；身上裝備自動卸回背包。</p>`;
}
