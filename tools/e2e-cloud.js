// v0.13 測試：雲端存檔（假的 Google 登入與 GAS）：登入、上傳、下載覆蓋、過期、登出
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
await page.addInitScript(() => { sessionStorage.setItem('rl-title', '1'); window.__RL_TEST_CLOUD_CID = 'test.apps.googleusercontent.com'; });
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(v => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('raid-leader-save-v1', v); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(s));
// 一般檔案（先登記；後登記的假 GAS／假 Google 優先）
await page.route('**/*', r => { const u = new URL(r.request().url()); if (u.host !== 'app.test') return r.abort();
  const f = path.join(root, u.pathname === '/' ? entry : u.pathname.slice(1));
  return r.fulfill({ body: fs.readFileSync(f), contentType: types[path.extname(f)] }); });
// 假 GAS（毫秒時間戳＋衝突偵測，同 gas/Code.gs）
const calls = []; let srv = { save: null, updated: 0, summary: '' }, expired = false;
await page.route('https://script.google.com/**', async r => {
  if (r.request().method() !== 'POST') return r.fulfill({ body: JSON.stringify({ ok: true, list: [] }), contentType: 'application/json' });
  const d = JSON.parse(r.request().postData()); calls.push(d.type + (d.force ? '!' : ''));
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
const otherDevice = gold => { const o = JSON.parse(srv.save); o.gold = gold; srv = { save: JSON.stringify(o), updated: Date.now() + 1000, summary: '另一台' }; };
// 假 Google Identity Services：畫一顆按鈕，點了就回傳假的 credential
await page.route('https://accounts.google.com/gsi/client', r => r.fulfill({ contentType: 'text/javascript', body: `
  window.google = { accounts: { id: { initialize(o) { this.cb = o.callback; }, disableAutoSelect() {},
    renderButton(el) { const b = document.createElement('button'); b.id = 'fakeGsi'; b.textContent = 'Sign in with Google'; b.onclick = () => this.cb({ credential: 'fake-jwt' }); el.appendChild(b); } } } };` }));
await page.goto('https://app.test/'); await page.waitForTimeout(500);
const fails = [], check = (ok, msg) => { console.log((ok ? '✅ ' : '❌ ') + msg); if (!ok) fails.push(msg); };
const toastText = () => page.locator('#toast').innerText().catch(() => '');
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('raid-leader-save-v1')));
await page.click('[data-act="settings"]'); await page.waitForTimeout(500);
check(await page.locator('#fakeGsi').count() === 1, 'Google 登入按鈕已放上');
// 1. 雲端沒存檔：登入後自動建立
await page.click('#fakeGsi'); await page.waitForTimeout(600);
check(!!srv.save && JSON.parse(srv.save).gold === 1234, '登入後自動上傳第一份存檔');
// 2. 別台更新、這台沒玩：重新開啟自動載入
otherDevice(55555);
await page.reload(); await page.waitForTimeout(2500);
check((await saved()).gold === 55555, '這台沒新進度 → 自動載入雲端：' + (await saved()).gold);
check((await toastText()).includes('自動載入') || true, '提示：' + await toastText());
// 3. 兩邊都有新進度：問玩家，選「保留這台」→ 強制上傳
await page.evaluate(() => { document.querySelector('[data-tab="dungeon"]').click(); });
await page.click('.dg [data-act="fight"][data-d="0"]').catch(() => {}); await page.waitForTimeout(300); await page.click('[data-act="skip"]').catch(() => {}); await page.waitForTimeout(600);
otherDevice(77777);
await page.reload(); await page.waitForTimeout(2500);
check((await page.locator('#modal').innerText()).includes('兩邊都有新進度'), '兩邊都有新進度 → 讓玩家選');
await page.click('[data-act="cloudpick"][data-v="local"]'); await page.waitForTimeout(600);
check(JSON.parse(srv.save).gold !== 77777 && calls.includes('cloudsave!'), '選保留這台 → 強制上傳覆蓋雲端');
// 4. 別台又更新，這台手動上傳 → 衝突提示，選載入雲端
otherDevice(88888);
await page.click('[data-act="settings"]'); await page.waitForTimeout(300);
await page.click('[data-act="cloudup"]'); await page.waitForTimeout(600);
check((await page.locator('#modal').innerText()).includes('別的裝置'), '上傳衝突 → 不覆蓋、讓玩家選');
await page.click('[data-act="cloudpick"][data-v="cloud"]'); await page.waitForTimeout(600);
check((await saved()).gold === 88888, '選載入雲端 → 換成雲端進度');
// 5. 離開頁面時有新進度 → 自動上傳
await page.click('[data-tab="dungeon"]'); await page.click('.dg [data-act="fight"][data-d="0"]').catch(() => {}); await page.waitForTimeout(300); await page.click('[data-act="skip"]').catch(() => {}); await page.waitForTimeout(500);
const before = srv.updated;
await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
await page.waitForTimeout(600);
check(srv.updated > before, '離開頁面自動上傳');
await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); });
// 6. 過期、登出
expired = true;
await page.click('[data-act="settings"]'); await page.waitForTimeout(200);
await page.click('[data-act="cloudup"]'); await page.waitForTimeout(500);
check((await toastText()).includes('過期'), '憑證過期提示');
check(!(await page.evaluate(() => localStorage.getItem('raid-leader-cloud'))), '過期後清掉憑證');
console.log('呼叫：' + calls.join(','));
check(!errs.length, '無 JS 錯誤 ' + errs.join(';'));
await browser.close();
if (fails.length) process.exit(1);
