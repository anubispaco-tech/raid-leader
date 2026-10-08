// ===== 遊玩數據、排行榜、意見回饋（送到 GAS；失敗時安靜忽略，不影響遊戲）=====
import { tx } from '../core/i18n.js';
import * as G from '../core/index.js';
import { app } from './state.js';
import { VERSION } from '../core/version.js';

const URL_ = G.TELEMETRY.url;
export const enabled = () => !!URL_;
const lb = { at: 0, data: null, loading: false, error: false };

export function post(body, keepalive = false) {
  if (!URL_ || !app.S) return Promise.resolve(null);
  const p = app.S.player;
  return fetch(URL_, { method: 'POST', keepalive, headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ pid: p.pid, name: p.name || tx('匿名'), ver: VERSION, ...body }) })
    .then(r => r.json()).catch(() => null);
}
// 目前進度：隊伍平均等級、最高通關層、秘境鑰石與最高限時等級
export function progress() {
  const S = app.S, party = G.partyHeroes(S);
  const top = Math.max(0, ...Object.keys(S.clears).filter(k => S.clears[k]).map(k => +k + 1));
  const best = G.mythicBestLevel(S, 1), best2 = G.mythicBestLevel(S, 2);
  return { level: party.length ? Math.round(party.reduce((a, h) => a + h.level, 0) / party.length) : 1,
    top, key: G.mythicUnlocked(S) ? S.mythic.key : 0, best, key2: G.tierUnlocked(S, 2) ? S.mythic.key2 : 0, best2, playMin: Math.round(S.player.playSec / 60) };
}
export const progressText = () => { const p = progress(); return tx('Lv{0}・第 {1} 層{2}', p.level, p.top, (p.best ? tx('・秘境 +{0}', p.best) : '') + (p.best2 ? tx('・深淵 +{0}', p.best2) : '')); };

// v0.21.1 來源（first-touch）、推薦人、是否從主畫面開過
const acq = () => { const p = app.S.player; return { src: p.src || '', ref: p.ref || '', pwa: p.pwa ? 1 : 0 }; };
export const sendSnapshot = keepalive => post({ type: 'snapshot', ...progress(), ...acq() }, keepalive);
// v0.21.1 事件排隊送出：GAS 同一位玩家 2 秒內只收一筆，啟動時連續幾筆事件以前會被丟掉
const evQ = []; let evBusy = false, evLast = 0;
const EV_GAP = 2100;
function pump() {
  if (evBusy || !evQ.length) return;
  evBusy = true;
  setTimeout(() => { evBusy = false; evLast = Date.now(); post({ type: 'event', ...evQ.shift() }); pump(); }, Math.max(0, evLast + EV_GAP - Date.now()));
}
export function sendEvent(kind, detail) {
  if (!URL_ || evQ.length >= 20) return;
  evQ.push({ kind, detail }); pump();
}
export const sendFeedback = text => post({ type: 'feedback', text, progress: progressText() });

// 排行榜：讀過且未過期就用快取；讀完只重畫頁面（不重畫抽屜，避免打字中的內容被清掉）
export function leaderboard() {
  if (!URL_) return null;
  const fresh = Date.now() - lb.at < G.TELEMETRY.leaderboardSec * 1000;
  if (!fresh && !lb.loading) {
    lb.loading = true;
    fetch(URL_ + '?action=leaderboard').then(r => r.json()).then(d => { lb.data = d.ok ? d.list : lb.data; lb.error = !d.ok; })
      .catch(() => { lb.error = true; })
      .finally(() => { lb.at = Date.now(); lb.loading = false; if (app.tab === 'dungeon') app.render(true); });
  }
  return lb;
}

// 每 5 秒呼叫一次（頁面在前景時）：累計遊玩時間，每 N 分鐘送一次進度
let sinceSnap = 0;
export function tick(sec) {
  if (!app.S) return;
  app.S.player.playSec += sec;
  sinceSnap += sec;
  if (sinceSnap >= G.TELEMETRY.snapshotMin * 60) { sinceSnap = 0; sendSnapshot(); }
}
