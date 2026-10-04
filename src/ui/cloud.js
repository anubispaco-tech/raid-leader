// ===== 雲端存檔（v0.13.2 自動同步）：Google 登入 → GAS 驗證 → 存檔放在 Drive =====
// 同步規則（每台裝置記住「上次同步時雲端的版本 base」與「當時的本機指紋 fp」）：
//   開啟遊戲／切回遊戲：雲端比 base 新 → 本機沒新進度就自動載入；兩邊都有新進度就問玩家要哪一份
//   本機有新進度：每 autoMin 分鐘、以及離開頁面時自動上傳；上傳時帶 base，雲端被別台改過就不覆蓋（衝突）
import { tx } from '../core/i18n.js';
import * as G from '../core/index.js';
import { app } from './state.js';
import { post, progressText } from './telemetry.js';
import { save } from './save.js';
import { toast } from './helpers.js';
import { VERSION } from '../core/version.js';

const KEY = 'raid-leader-cloud';
export const cloudEnabled = () => !!G.CLOUD.clientId && !!G.TELEMETRY.url;
export const cloud = { info: null, busy: false, lastAuto: Date.now(), lastCheck: 0 };
const session = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
const setSession = v => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch (e) {} };
const patch = o => { const s = session(); if (s) setSession({ ...s, ...o }); };
export const loggedIn = () => !!(session() && session().token);
const rerender = () => { if (app.modal && app.modal.type === 'settings') app.renderModal(); };
// 舊版 GAS 回傳日期字串，新版回傳毫秒
const toMs = v => (typeof v === 'number' ? v : v ? Date.parse(String(v).replace(' ', 'T') + '+08:00') || 0 : 0);
export const fmtTime = ms => { if (!ms) return '—'; const d = new Date(ms), p = n => String(n).padStart(2, '0'); return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`; };
// 本機進度指紋：挑戰次數＋存檔長度（玩過、換裝、升級都會變）
const fp = () => (app.S ? `${app.S.stats.runs}:${JSON.stringify(app.S).length}` : '');
const dirty = () => { const s = session(); return !!s && s.fp !== fp(); };
const synced = updated => patch({ base: toMs(updated), fp: fp() });

// ---------- Google 登入按鈕 ----------
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
  const updated = toMs(r.updated);
  setSession({ token: r.token, at: Date.now(), base: 0, fp: '' });
  cloud.info = { updated, summary: r.summary };
  if (updated) chooser(tx('雲端已有存檔'), updated, r.summary); // 雲端已有存檔：問要用哪一份
  else { toast(tx('已登入，正在建立雲端存檔')); upload(true, true); }
  rerender();
}
const expired = r => {
  if (r && r.error === 'login') { setSession(null); cloud.info = null; toast(tx('登入已過期，請重新登入')); rerender(); return true; }
  return false;
};

// ---------- 兩份進度二選一 ----------
function chooser(title, updated, summary) {
  cloud.choosing = Date.now(); // 問過之後 5 分鐘內不再自動跳出
  app.openModal({ type: 'text', html: tx('<h3>{0}</h3><p class="sub" style="margin:0">雲端：{1}（{2} 上傳）<br>這台裝置：{3}</p><div class="row"><button class="btn main grow" data-act="cloudpick" data-v="cloud">載入雲端</button><button class="btn grow" data-act="cloudpick" data-v="local">保留這台並上傳</button></div>', title, summary || '—', fmtTime(updated), progressText()) });
}
export async function pick(which) {
  app.modal = null; cloud.choosing = 0;
  if (which === 'cloud') await download(true);
  else await upload(false, true);
  app.render();
}

// ---------- 檢查／上傳／下載 ----------
// 開啟遊戲、切回遊戲、打開設定時呼叫（30 秒內不重複）
export async function check(force = false) {
  if (!cloudEnabled() || !loggedIn() || cloud.busy || app.fresh) return;
  if (!force && Date.now() - cloud.lastCheck < 30000) return;
  if (Date.now() - (cloud.choosing || 0) < 300000) return;
  cloud.lastCheck = Date.now();
  const r = await post({ type: 'cloudinfo', token: session().token });
  if (!r || !r.ok) { expired(r); return; }
  const updated = toMs(r.updated), base = session().base || 0;
  cloud.info = { updated, summary: r.summary };
  if (updated && updated !== base) {
    if (!base) chooser(tx('雲端已有存檔'), updated, r.summary);           // 這台第一次同步
    else if (!dirty()) await download(true, true);                          // 這台沒新進度：直接用雲端的
    else chooser(tx('兩邊都有新進度'), updated, r.summary);                // 兩邊都玩過：問玩家
  }
  rerender();
}
export async function upload(quiet = false, force = false) {
  if (!loggedIn() || cloud.busy || app.fresh) return;
  cloud.busy = true; if (!quiet) rerender();
  const s = session();
  const r = await post({ type: 'cloudsave', token: s.token, save: JSON.stringify(app.S), summary: progressText(), ver: VERSION, base: s.base || 0, force });
  cloud.busy = false; cloud.lastAuto = Date.now();
  if (r && r.ok) { synced(r.updated); cloud.info = { updated: toMs(r.updated), summary: progressText() }; if (!quiet) toast(tx('已上傳到雲端')); }
  else if (r && r.error === 'conflict') chooser(tx('雲端在別的裝置更新過'), toMs(r.updated), r.summary);
  else if (!expired(r) && !quiet) toast(tx('上傳失敗，請稍後再試'));
  rerender();
}
// 離開頁面時：有新進度就用 keepalive 送出（存檔一般遠小於 64 KB 上限）
export function uploadOnHide() {
  if (!cloudEnabled() || !loggedIn() || !dirty() || app.fresh) return;
  const s = session(), body = { type: 'cloudsave', token: s.token, save: JSON.stringify(app.S), summary: progressText(), ver: VERSION, base: s.base || 0 };
  post(body, true).then(r => { if (r && r.ok) synced(r.updated); });
}
export async function download(confirmed = false, auto = false) {
  if (!loggedIn()) return;
  const r = await post({ type: 'cloudload', token: session().token });
  if (!r || !r.ok) { if (!expired(r)) toast(tx('下載失敗，請稍後再試')); return; }
  if (!r.save) { toast(tx('雲端還沒有存檔')); return; }
  if (!confirmed) { chooser(tx('從雲端下載'), toMs(r.updated), r.summary); return; }
  app.S = G.migrate(G.sanitizeSave(JSON.parse(r.save)));
  app.battle = null; save(); synced(r.updated);
  cloud.info = { updated: toMs(r.updated), summary: r.summary };
  toast(auto ? tx('已自動載入雲端較新的進度（{0}）', r.summary || '') : tx('已從雲端載入進度'));
  app.render();
}
export function logout() { setSession(null); cloud.info = null; try { window.google && window.google.accounts.id.disableAutoSelect(); } catch (e) {} }
// 每 5 秒的 tick：本機有新進度時，每 autoMin 分鐘自動上傳
export function autoTick() {
  if (cloudEnabled() && loggedIn() && dirty() && Date.now() - cloud.lastAuto > G.CLOUD.autoMin * 60000) upload(true);
}
