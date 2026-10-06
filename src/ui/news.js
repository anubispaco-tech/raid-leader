// ===== v0.18 公告：內容放在試算表「公告」分頁，GAS 以 ?action=news 提供 =====
// 讀不到時沿用上次快取；已讀／已彈出記在這台裝置（localStorage），不進存檔
import { tx, getLang } from '../core/i18n.js';
import * as G from '../core/index.js';
import { app } from './state.js';
import { esc } from './helpers.js';
import { sendEvent } from './telemetry.js';
import { VERSION } from '../core/version.js';

const URL_ = G.TELEMETRY.url;
const LS = 'raid-leader-news', READ = 'raid-leader-news-read', POP = 'raid-leader-news-pop';
const REFRESH_MS = 10 * 60 * 1000;
const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch (e) { return d; } };
const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };
const cached = get(LS, {});
export const news = { list: Array.isArray(cached.list) ? cached.list : [], at: Number(cached.at) || 0, loading: false };
export const TYPE_CLASS = { 公告: 'n-info', 活動: 'n-event', 更新: 'n-update', 維修: 'n-maint' };
const typeLabel = t => ({ 公告: tx('公告'), 活動: tx('活動'), 更新: tx('更新'), 維修: tx('維修') })[t] || tx('公告');

// 版本比較：a > b 回傳正數
export const cmpVer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };
const now = () => Date.now();
const live = () => news.list.filter(n => (!n.start || n.start <= now()) && (!n.end || n.end > now()));
const readIds = () => get(READ, []);
export const unread = () => { const r = readIds(); return live().filter(n => !r.includes(n.id)).length; };
const tooOld = n => n.minVer && cmpVer(n.minVer, VERSION) > 0;

export function updateDot() {
  const d = document.getElementById('newsDot'); if (d) d.hidden = !unread();
  const b = document.getElementById('newsBtn'); if (b) b.hidden = !URL_ || !live().length;
}
// 開遊戲、切回遊戲時呼叫；10 分鐘內不重抓（force 例外）
export function refresh(force = false) {
  if (!URL_ || news.loading || (!force && now() - news.at < REFRESH_MS)) return Promise.resolve();
  news.loading = true;
  return fetch(URL_ + '?action=news').then(r => r.json()).then(d => {
    if (d && d.ok && Array.isArray(d.list)) { news.list = d.list.filter(n => n && n.id && n.title); news.at = now(); put(LS, { at: news.at, list: news.list }); }
  }).catch(() => { /* 沿用快取 */ }).finally(() => {
    news.loading = false; updateDot();
    if (app.modal && app.modal.type === 'news') app.renderModal();
    maybePop();
  });
}

const L = n => (getLang() === 'en' && n.titleEn ? { title: n.titleEn, body: n.bodyEn || n.body } : { title: n.title, body: n.body });
const md = ms => { const d = new Date(ms); return `${d.getMonth() + 1}/${d.getDate()}`; };
// 內文：先跳脫再把網址變成連結、換行變 <br>
const bodyHtml = s => esc(s).replace(/https?:\/\/[^\s<"']+/g, u => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`).replace(/\n/g, '<br>');
function card(n) {
  const t = L(n);
  return `<article class="ncard${n.pin ? ' pin' : ''}"><div class="nhead"><span class="ntag ${TYPE_CLASS[n.type] || 'n-info'}">${typeLabel(n.type)}</span>${n.pin ? `<span class="npin">${tx('置頂')}</span>` : ''}<span class="ndate num">${n.start ? md(n.start) : ''}</span></div>`
    + `<b class="ntitle">${esc(t.title)}</b>${t.body ? `<p class="nbody">${bodyHtml(t.body)}</p>` : ''}`
    + (tooOld(n) ? `<div class="nold"><span>${tx('你的版本 v{0} 較舊，請重新整理取得 v{1} 以上', VERSION, esc(n.minVer))}</span><button class="btn sm main" data-act="newsreload">${tx('重新整理')}</button></div>` : '')
    + '</article>';
}
// 公告列表（renderModal 依 type 'news' 呼叫）
export function newsHtml(only) {
  const list = only ? live().filter(n => n.id === only) : live();
  const body = list.length ? list.map(card).join('') : `<p class="sub">${tx('目前沒有公告')}</p>`;
  return `<h3>${only ? tx('最新公告') : tx('公告')}</h3><div class="nlist">${body}</div><div class="row">${only && live().length > 1 ? `<button class="btn grow" data-act="news">${tx('看全部公告')}</button>` : ''}<button class="btn main grow" data-act="closebtn">${tx('知道了')}</button></div>`;
}
function markRead(ids) { const r = readIds(); put(READ, [...new Set([...ids, ...r])].slice(0, 200)); updateDot(); }
let lastLog = 0;
export function openNews() {
  app.openModal({ type: 'news' });
  markRead(live().map(n => n.id));
  if (now() - lastLog > 10 * 60 * 1000) { lastLog = now(); sendEvent(tx('公告'), 'open'); }
}
// 有「開啟時彈出」且這台沒彈過的公告：等開始畫面、教學、其他視窗都結束後彈一次
export function maybePop() {
  if (!app.S || app.modal || app.fresh || document.getElementById('title') || document.getElementById('boot')) return;
  if (G.tutActive(app.S)) return;
  const popped = get(POP, []), n = live().find(x => x.pop && !popped.includes(x.id));
  if (!n) return;
  put(POP, [n.id, ...popped].slice(0, 200));
  app.openModal({ type: 'news', only: n.id });
  markRead([n.id]);
  sendEvent(tx('公告'), 'pop:' + n.id);
}
