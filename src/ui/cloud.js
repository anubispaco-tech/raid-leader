// ===== 雲端存檔（v0.13）：Google 登入 → GAS 驗證 → 存檔放在 Drive =====
// 只有 G.CLOUD.clientId 有填才會出現。登入憑證（不是 Google 密碼）存在這台裝置，30 天有效
import { tx } from '../core/i18n.js';
import * as G from '../core/index.js';
import { app } from './state.js';
import { post, progressText } from './telemetry.js';
import { save } from './save.js';
import { toast } from './helpers.js';
import { VERSION } from '../core/version.js';

const KEY = 'raid-leader-cloud';
export const cloudEnabled = () => !!G.CLOUD.clientId && !!G.TELEMETRY.url;
export const cloud = { info: null, busy: false, lastAuto: Date.now() };
const session = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
const setSession = v => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch (e) {} };
export const loggedIn = () => !!(session() && session().token);
const rerender = () => { if (app.modal && app.modal.type === 'settings') app.renderModal(); };

// Google 登入按鈕（Google Identity Services）：設定頁畫好後把按鈕放進 #gsiBtn
let gis = null;
function loadGis() {
  if (gis) return gis;
  gis = new Promise((ok, fail) => {
    const sc = document.createElement('script');
    sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true;
    sc.onload = () => { window.google.accounts.id.initialize({ client_id: G.CLOUD.clientId, callback: onCredential, ux_mode: 'popup' }); ok(); };
    sc.onerror = () => { gis = null; fail(new Error('gsi')); };
    document.head.appendChild(sc);
  });
  return gis;
}
export function mountButton() {
  const el = document.getElementById('gsiBtn'); if (!el || el.dataset.done) return;
  el.dataset.done = '1';
  loadGis().then(() => window.google.accounts.id.renderButton(el, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with', locale: document.documentElement.lang === 'en' ? 'en' : 'zh-TW' }))
    .catch(() => { el.textContent = tx('Google 登入暫時無法載入，稍後再試。'); });
}
async function onCredential(resp) {
  const r = await post({ type: 'login', idToken: resp.credential });
  if (!r || !r.ok) { toast(tx('登入失敗，請再試一次')); return; }
  setSession({ token: r.token, at: Date.now() });
  cloud.info = { updated: r.updated, summary: r.summary };
  toast(r.updated ? tx('已登入。雲端有 {0} 的存檔', r.updated) : tx('已登入。目前雲端還沒有存檔，先上傳一次吧'));
  rerender();
}
const fail = r => {
  if (r && r.error === 'login') { setSession(null); cloud.info = null; toast(tx('登入已過期，請重新登入')); rerender(); return true; }
  return false;
};
export async function refreshInfo() {
  if (!loggedIn() || cloud.busy) return;
  const r = await post({ type: 'cloudinfo', token: session().token });
  if (r && r.ok) { cloud.info = { updated: r.updated, summary: r.summary }; rerender(); } else fail(r);
}
export async function upload(quiet = false) {
  if (!loggedIn() || cloud.busy || app.fresh) return;
  cloud.busy = true; if (!quiet) rerender();
  const r = await post({ type: 'cloudsave', token: session().token, save: JSON.stringify(app.S), summary: progressText(), ver: VERSION });
  cloud.busy = false; cloud.lastAuto = Date.now();
  if (r && r.ok) { cloud.info = { updated: r.updated, summary: progressText() }; if (!quiet) toast(tx('已上傳到雲端')); }
  else if (!fail(r) && !quiet) toast(tx('上傳失敗，請稍後再試'));
  rerender();
}
// 下載：先問清楚（雲端 vs 這台裝置），確認後才覆蓋
export async function askDownload(openModal) {
  if (!loggedIn()) return;
  const r = await post({ type: 'cloudload', token: session().token });
  if (!r || !r.ok) { if (!fail(r)) toast(tx('下載失敗，請稍後再試')); return; }
  if (!r.save) { toast(tx('雲端還沒有存檔')); return; }
  cloud.pending = r.save;
  openModal({ type: 'text', html: tx('<h3>從雲端下載</h3><p class="sub" style="margin:0">雲端：{0}（{1}）<br>這台裝置：{2}<br>下載會覆蓋這台裝置的進度。</p><div class="row"><button class="btn main grow" data-act="clouddo">下載並覆蓋</button><button class="btn" data-act="closebtn">取消</button></div>', r.summary || '—', r.updated || '—', progressText()) });
}
export function applyDownload() {
  const raw = cloud.pending; cloud.pending = null; if (!raw) return false;
  app.S = G.migrate(G.sanitizeSave(JSON.parse(raw)));
  app.battle = null; save();
  return true;
}
export function logout() { setSession(null); cloud.info = null; try { window.google && window.google.accounts.id.disableAutoSelect(); } catch (e) {} }
// 每 5 秒的 tick 呼叫：登入中每 autoMin 分鐘自動上傳
export function autoTick() {
  if (cloudEnabled() && loggedIn() && Date.now() - cloud.lastAuto > G.CLOUD.autoMin * 60000) upload(true);
}
