// ===== 副本分頁 =====
import * as G from '../../core/index.js';
import { app } from '../state.js';
import { $, fmt, pct, toast, hero, cls, inParty, itemStatText, itemName, partyPower, avgPartyIlvl, avgPartyLv } from '../helpers.js';

export function viewDungeons() {
  const lv = avgPartyLv(), il = avgPartyIlvl();
  let h = `<h2>副本</h2><p class="sub">隊伍平均 <b class="num">Lv${lv}</b>・裝等 <b class="num">${il}</b>・戰力 <b class="num">${fmt(partyPower())}</b>　｜　每隻首領考驗一種職責，打不過就換陣容或回頭刷裝。</p><div class="dlist">`;
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
         <button class="btn ${idleHere ? 'on' : ''}" data-act="idle" data-d="${i}" ${clears ? '' : 'disabled title="通關一次後才能掛機"'}>${idleHere ? '掛機中・停止' : '掛機刷'}</button>`}
      </div></div>`;
  });
  h += `</div><div class="howto" style="margin-top:16px"><b>掛機刷</b>：自動重複挑戰，關掉頁面也會累積（最多 ${G.ECONOMY.offlineCapHours} 小時），回來時一次結算。<br><b>存檔</b>存在這台裝置的瀏覽器，換裝置請到「團隊」最下方匯出存檔碼。</div>`;
  return h;
}
