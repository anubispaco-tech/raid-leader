// v0.17.1 測試：雲端上傳失敗分開提示（限流／斷線／其他）、限流後自動重試、失敗埋點
import { createRequire } from 'module';
import { nav } from './e2e-nav.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { playthrough } from './sim-lib.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = process.argv[2] || 'index.html';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const { s } = playthrough({ talents: true, stopAt: 2 });
s.lastSeen = Date.now(); s.idle = null; s.gold = 1234; s.player = { pid: 'abcdefgh1234', name: '測試', asked: true, playSec: 0 };
const cloudSave = JSON.parse(JSON.stringify(s)); cloudSave.gold = 99999;
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 375, height: 760 } });
await page.addInitScript(() => { (sessionStorage.setItem('rl-title', '1'), sessionStorage.setItem('rl-e2e', '1')); window.__RL_TEST_CLOUD_CID = 'test.apps.googleusercontent.com'; });
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(v => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('raid-leader-save-v1', v); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(s));
// 一般檔案（先登記；後登記的假 GAS／假 Google 優先）
await page.route('**/*', r => { const u = new URL(r.request().url()); if (u.host !== 'app.test') return r.abort();
  const f = path.join(root, u.pathname === '/' ? entry : u.pathname.slice(1));
  return r.fulfill({ body: fs.readFileSync(f), contentType: types[path.extname(f)] }); });
// 假 GAS（毫秒時間戳＋衝突偵測，同 gas/Code.gs）
const calls = [], events = []; let srv = { save: null, updated: 0, summary: '' }, expired = false, mode = '';
await page.route('https://script.google.com/**', async r => {
  if (r.request().method() !== 'POST') return r.fulfill({ body: JSON.stringify({ ok: true, list: [] }), contentType: 'application/json' });
  const d = JSON.parse(r.request().postData()); calls.push(d.type + (d.force ? '!' : ''));
  if (d.type === 'event') { events.push(d.kind + '|' + d.detail); return r.fulfill({ body: '{"ok":true}', contentType: 'application/json' }); }
  if (d.type === 'cloudsave' && mode === 'net') return r.abort();
  if (d.type === 'cloudsave' && mode === 'fast') { mode = ''; return r.fulfill({ body: '{"ok":false,"error":"too fast"}', contentType: 'application/json' }); }
  if (d.type === 'cloudsave' && mode === 'err') return r.fulfill({ body: '{"ok":false,"error":"Exception: Drive busy"}', contentType: 'application/json' });
  let out = { ok: true };
  if (d.type === 'login') out = { ok: d.idToken === 'fake-jwt', token: 'tok123', updated: srv.updated, summary: srv.summary };
  else if (expired || d.token !== 'tok123') out = { ok: false, error: 'login' };
  else if (d.type === 'cloudinfo') out = { ok: true, updated: srv.updated, summary: srv.summary };
  else if (d.type === 'cloudload') out = { ok: true, save: srv.save, updated: srv.updated, summary: srv.summary };
  else if (d.type === 'cloudsave') {
    if (!d.force && d.base != null && srv.updated && Number(d.base) !== srv.updated) out = { ok: false, error: 'conflict', updated: srv.updated, summary: srv.summary };
    else { srv = { save: d.save, updated: Date.now(), summary: d.summary }; out = { ok: true, updated: srv.updated }; }
  }
  return r.fulfill({ body: JSON.stringify(out), contentType: 'application/json' });
});
// 假 Google Identity Services：畫一顆按鈕，點了就回傳假的 credential
await page.route('https://accounts.google.com/gsi/client', r => r.fulfill({ contentType: 'text/javascript', body: `
  window.google = { accounts: { id: { initialize(o) { this.cb = o.callback; }, disableAutoSelect() {},
    renderButton(el) { const b = document.createElement('button'); b.id = 'fakeGsi'; b.textContent = 'Sign in with Google'; b.onclick = () => this.cb({ credential: 'fake-jwt' }); el.appendChild(b); } } } };` }));
await page.goto('https://app.test/'); await page.waitForTimeout(1200);
const fails = [], check = (ok, msg) => { console.log((ok ? '✅ ' : '❌ ') + msg); if (!ok) fails.push(msg); };
const toastText = () => page.locator('#toast').innerText().catch(() => '');
await page.click('[data-act="settings"]'); await page.waitForTimeout(500);
await page.click('#fakeGsi'); await page.waitForTimeout(800);
check(!!srv.save, '登入後建立雲端存檔');
const up = async () => { if (!(await page.locator('[data-act="cloudup"]').isVisible().catch(() => false))) { await page.click('[data-act="settings"]'); await page.waitForTimeout(300); } await page.click('[data-act="cloudup"]'); await page.waitForTimeout(500); };
// 1. 限流 → 專屬提示，16 秒後自動重試成功
mode = 'fast'; const n0 = calls.filter(c => c.startsWith('cloudsave')).length;
await up();
check((await toastText()).includes('剛剛已同步過'), '限流提示：' + await toastText());
check(events.some(e => e.includes('save:too fast')), '手動上傳被限流有埋點');
await page.waitForTimeout(16500);
check(calls.filter(c => c.startsWith('cloudsave')).length >= n0 + 2, '16 秒後自動重試');
check((await toastText()).includes('已上傳'), '重試成功提示：' + await toastText());
// 2. 斷線 → 網路提示（同一分鐘不重複埋點）
mode = 'net'; await page.waitForTimeout(200); await up();
check((await toastText()).includes('連不上伺服器'), '斷線提示：' + await toastText());
check(!events.some(e => e.includes('save:net')), '一分鐘內只記一筆埋點');
// 3. 其他錯誤 → 通用提示；隔一分鐘後埋點帶錯誤內容
mode = 'err';
await up();
check((await toastText()).includes('上傳失敗'), '其他錯誤提示：' + await toastText());
check(events.length === 1, '一分鐘內共 1 筆埋點：' + events.length);
mode = '';
console.log('呼叫：' + calls.join(',')); console.log('事件：' + events.join(' / '));
check(!errs.length, '無 JS 錯誤 ' + errs.join(';'));
await browser.close();
if (fails.length) process.exit(1);
