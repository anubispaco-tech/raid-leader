// ===== 副本分頁 =====
import * as G from '../../core/index.js';
import { app } from '../state.js';
import { fmt, mmss, partyPower, avgPartyIlvl, avgPartyLv } from '../helpers.js';

// ---------- 下一步建議卡 ----------
function nextStepCard() {
  const n = G.nextStep(app.S); if (!n) return '';
  const b = n.btn;
  const btn = !b ? '' : b.tab ? `<button class="btn main" data-tab="${b.tab}">${b.label}</button>`
    : `<button class="btn main" data-act="${b.act}" ${b.d != null ? `data-d="${b.d}"` : ''}>${b.label}</button>`;
  return `<div class="nextstep"><div><span class="label">下一步</span><b>${n.text}</b><span class="sub" style="margin:0">${n.sub}</span></div>${btn}</div>`;
}
// ---------- 傳奇秘境 ----------
function mythicSection() {
  const S = app.S;
  if (!G.mythicUnlocked(S)) return `<div class="mythic locked"><b>傳奇秘境</b><span class="sub" style="margin:0">通關第 7 層「龍眠高塔」後解鎖：無限層數、限時挑戰、每日詞綴。</span></div>`;
  const key = S.mythic.key, today = G.dailyAffixes(), active = G.activeAffixes(key);
  let h = `<div class="mythic"><div class="mhead"><div><span class="label">傳奇秘境</span><b>目前鑰石</b></div><span class="keystone num">+${key}</span></div>
    <div class="affixes">${today.map((a, i) => `<div class="affix ${active.includes(a) ? 'on' : ''}"><b>${G.AFFIXES[a].name}</b><span>${G.AFFIXES[a].desc}</span><small>${active.includes(a) ? `考驗${G.AFFIXES[a].test}` : `+${G.MYTHIC.affixAt[i]} 起生效`}</small></div>`).join('')}</div>
    <p class="sub" style="margin:0">今天的詞綴，所有人相同；明天換一組。限時內通關鑰石 +1，用不到 80% 時間 +2；超時或失敗 −1。秘境不能掛機。</p>
    <div class="mlist">`;
  G.DUNGEONS.forEach((d, i) => {
    const best = S.mythic.best[i];
    h += `<div class="mrow2"><div class="mname"><b>${d.name}</b><span class="sub num" style="margin:0">限時 ${mmss(G.mythicTimer(i))}・${best ? `最佳 +${best.level}（${mmss(best.time)}）` : '尚未限時'}</span></div>
      <button class="btn sm" data-act="recommend-mythic" data-d="${i}" aria-label="套用推薦天賦">天賦</button>
      <button class="btn sm main" data-act="mythic" data-d="${i}">挑戰 +${key}</button></div>`;
  });
  return h + `</div></div>`;
}
export function viewDungeons() {
  const lv = avgPartyLv(), il = avgPartyIlvl();
  let h = nextStepCard() + `<h2>副本</h2><p class="sub">隊伍平均 <b class="num">Lv${lv}</b>・裝等 <b class="num">${il}</b>・戰力 <b class="num">${fmt(partyPower())}</b>　｜　每隻首領考驗一種職責，打不過就換陣容或回頭刷裝。</p>`;
  h += mythicSection() + `<div class="dlist">`;
  const talentsOpen = G.partyHeroes(app.S).some(x => x.level >= G.TALENT_ROWS[0]);
  G.DUNGEONS.forEach((_, i) => {
    const d = G.dungeonInfo(i), locked = i >= app.S.unlocked, clears = app.S.clears[i] || 0;
    const idleHere = app.S.idle === i;
    h += `<div class="dg ${locked ? 'locked' : ''}">
      <div class="tier">${['壹','貳','參','肆','伍','陸','柒'][i]}<small>第 ${i + 1} 層</small></div>
      <h3>${d.name}<span class="boss">首領・${d.boss}</span></h3>
      <div class="tip">${d.tip}</div>
      <div class="meta">
        <span>建議 <b class="num ${lv >= d.recLevel ? 'ok' : 'low'}">Lv${d.recLevel}</b></span>
        <span>裝等 <b class="num ${il >= d.recIlvl ? 'ok' : 'low'}">${d.recIlvl}</b></span>
        <span>掉落 <b class="num">${d.dropIlvl}</b></span>
        <span>通關 <b class="num">${clears}</b> 次</span>
      </div>
      <div class="acts">${locked ? `<span class="sub" style="margin:0">先通關上一層</span>` :
        `<button class="btn main grow" data-act="fight" data-d="${i}">挑戰</button>
         <button class="btn ${idleHere ? 'on' : ''}" data-act="idle" data-d="${i}" ${clears ? '' : 'disabled title="通關一次後才能掛機"'}>${idleHere ? '掛機中・停止' : '掛機刷'}</button>
         ${talentsOpen ? `<button class="btn" data-act="recommend-party" data-d="${i}" aria-label="全隊套用推薦天賦">推薦天賦</button>` : ''}`}
      </div></div>`;
  });
  h += `</div><div class="howto" style="margin-top:16px"><b>推薦天賦</b>：依這層首領的機制，替出戰隊員一鍵配好專精與天賦。<br><b>掛機刷</b>：自動重複挑戰，關掉頁面也會累積（最多 ${G.ECONOMY.offlineCapHours} 小時），回來時一次結算。<br><b>存檔</b>存在這台裝置的瀏覽器，換裝置請到「團隊」最下方匯出存檔碼。</div>`;
  return h;
}
