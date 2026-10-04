// ===== 設定（點左上角標題開啟）：帳號、存檔、語言、意見回饋、關於 =====
import { tx, LANGS, getLang } from '../../core/i18n.js';
import { VERSION } from '../../core/version.js';
import * as G from '../../core/index.js';
import { app } from '../state.js';
import { enabled } from '../telemetry.js';
import { esc, fmt } from '../helpers.js';

const row = (label, value) => `<div class="set"><span>${label}</span>${value}</div>`;
export function sheetSettings() {
  const S = app.S, p = S.player, sec = p.playSec || 0;
  const play = sec >= 3600 ? tx('{0} 小時 {1} 分', Math.floor(sec / 3600), Math.floor(sec % 3600 / 60)) : tx('{0} 分鐘', Math.floor(sec / 60));
  let h = `<h3>${tx('設定')}</h3>
    <span class="label">${tx('帳號')}</span><div class="settings">
      ${row(tx('暱稱'), `<span class="row" style="align-items:center;margin:0"><b>${esc(p.name || tx('匿名'))}</b><button class="btn sm" data-act="nick">${tx('修改')}</button></span>`)}
      ${row(tx('玩家 ID'), `<span class="num sub" style="margin:0">${esc(p.pid)}</span>`)}
      ${row(tx('遊玩時間'), `<span class="num">${play}</span>`)}
      ${row(tx('成就'), `<button class="btn sm" data-act="ach">${tx('{0} 點・查看', G.achPoints(S))}</button>`)}
      ${row(tx('戰績'), `<span class="num">${tx('共挑戰 {0} 次・通關 {1} 次', fmt(S.stats.runs), fmt(S.stats.wins))}</span>`)}
    </div>
    <span class="label">${tx('存檔')}</span>
    <p class="sub" style="margin:0">${tx('進度存在這台裝置的瀏覽器。換裝置前，先匯出存檔碼。')}</p>
    <div class="row"><button class="btn" data-act="export">${tx('匯出存檔碼')}</button><button class="btn" data-act="import">${tx('匯入')}</button><button class="btn" data-act="reset" style="margin-left:auto;color:var(--bad)">${tx('重新開始')}</button></div>
    <span class="label">${getLang() === 'en' ? 'Language' : '語言 · Language'}</span>
    <div class="seg">${LANGS.map(l => `<button data-act="lang" data-v="${l.id}" class="${l.id === getLang() ? 'sel' : ''}">${l.name}</button>`).join('')}</div>`;
  if (enabled()) h += `<span class="label">${tx('意見回饋')}</span>
    <textarea id="fbText" class="fb" maxlength="1000" placeholder="${tx('哪裡好玩、哪裡卡住、想要什麼功能都可以寫')}">${esc(app.fbDraft || '')}</textarea>
    <div class="row" style="align-items:center"><span class="sub" style="margin:0">${tx('會附上暱稱「{0}」與目前進度', esc(p.name || tx('匿名')))}</span><button class="btn main" data-act="sendfb" style="margin-left:auto">${tx('送出')}</button></div>`;
  h += `<span class="label">${tx('隱私與數據')}</span>
    <p class="sub" style="margin:0">${tx('遊戲不需要帳號。為了改善平衡，會匿名送出：隨機玩家 ID、暱稱、隊伍等級、最高層與秘境成績、遊玩時間與版本；以及你主動送出的意見回饋。不收集姓名、Email、位置或裝置資訊。暱稱會顯示在天梯上，請不要填真實姓名。')}</p>`;
  h += `<span class="label">${tx('關於')}</span><div class="settings">
      ${row(tx('版本'), `<span class="num">v${VERSION}</span>`)}
      ${row(tx('圖示'), `<span><a href="https://game-icons.net" target="_blank" rel="noopener noreferrer">game-icons.net</a> <small class="sub" style="margin:0">${tx('Lorc、Delapouite 等作者・CC BY 3.0')}</small></span>`)}
      ${row(tx('故事'), `<button class="btn sm" data-act="replaystory">${tx('重看序章')}</button>`)}
    </div>
    <div class="row"><button class="btn grow" data-act="close-settings">${tx('關閉')}</button></div>`;
  return h;
}
