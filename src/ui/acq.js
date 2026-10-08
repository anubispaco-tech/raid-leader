// ===== v0.21.1 推廣準備：來源追蹤、分享連結、內建瀏覽器偵測、主畫面模式 =====
// 連結帶 ?src=ig_story（或 threads、line…）與 ?ref=<分享者玩家 ID>；只在「第一次建立存檔」時記下（first-touch），
// 讀完就從網址拿掉，玩家再分享出去時不會把別人的來源帶走。
import { NEW_ORIGIN } from './move.js';

const KEY = 'rl-acq';
const SRC_RE = /^[a-z0-9_]{1,24}$/, REF_RE = /^[a-z0-9]{8,24}$/;

// 開啟時先讀網址參數（在任何 replaceState 之前），存到 sessionStorage：重新整理或搬家流程都還拿得到
export function captureParams() {
  let q; try { q = new URLSearchParams(location.search); } catch (e) { return; }
  const src = (q.get('src') || '').toLowerCase().trim(), ref = (q.get('ref') || '').toLowerCase().trim();
  if (!src && !ref) return;
  const v = { src: SRC_RE.test(src) ? src : src ? 'other' : '', ref: REF_RE.test(ref) ? ref : '' };
  try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* ignore */ }
  q.delete('src'); q.delete('ref');
  const rest = q.toString();
  try { history.replaceState(null, '', location.pathname + (rest ? '?' + rest : '') + location.hash); } catch (e) { /* ignore */ }
}
export function acqParams() { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null') || {}; } catch (e) { return {}; } }

// 存檔第一次記來源：新存檔用連結上的來源（沒有就是 direct），v0.21.1 以前的舊存檔記 old
// 回傳 true 代表這次剛記下（要送一次「來源」事件）
export function applyAcq(S, fresh) {
  const p = S.player; if (p.src) return false;
  const a = acqParams();
  p.src = fresh ? (a.src || (a.ref ? 'share' : 'direct')) : 'old';
  if (fresh && a.ref && a.ref !== p.pid) p.ref = a.ref;
  return true;
}

// ---------- 裝置與瀏覽器 ----------
const UA = () => (typeof navigator !== 'undefined' ? navigator.userAgent || '' : '');
export function platform() {
  const ua = UA();
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}
// App 內建瀏覽器：存檔與 Safari／Chrome 分開、Google 登入常被擋、也不能加入主畫面
export function inApp() {
  const ua = UA();
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/Barcelona|Threads/i.test(ua)) return 'Threads';
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return 'Facebook';
  if (/\bLine\//i.test(ua)) return 'LINE';
  return '';
}
export function standalone() {
  try { return !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; } catch (e) { return false; }
}

// ---------- 連結 ----------
// 分享給朋友：固定用正式網址（預覽頁或舊網址也一樣），帶上自己的玩家 ID 當推薦人
export const shareUrl = pid => `${NEW_ORIGIN}/?src=share&ref=${encodeURIComponent(pid)}`;
// 從內建瀏覽器改用外部瀏覽器開啟時，把原本的來源一起帶過去
export function outsideUrl() {
  const a = acqParams(), q = new URLSearchParams();
  if (a.src) q.set('src', a.src); if (a.ref) q.set('ref', a.ref);
  const s = q.toString();
  return `${NEW_ORIGIN}/${s ? '?' + s : ''}`;
}
// LINE 支援 openExternalBrowser=1；Android 可用 intent 叫 Chrome；iOS 的 IG／FB 只能請玩家從選單開啟
export function outsideHref(app) {
  const url = outsideUrl();
  if (app === 'LINE') return url + (url.includes('?') ? '&' : '?') + 'openExternalBrowser=1';
  if (platform() === 'android') return `intent://${url.replace(/^https:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
  return '';
}
