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
// 假 GAS：login / cloudsave / cloudload / cloudinfo
const calls = []; let stored = JSON.stringify(cloudSave), expired = false;
await page.route('https://script.google.com/**', async r => {
  if (r.request().method() !== 'POST') return r.fulfill({ body: JSON.stringify({ ok: true, list: [] }), contentType: 'application/json' });
  const d = JSON.parse(r.request().postData()); calls.push(d.type);
  let out = { ok: true };
  if (d.type === 'login') out = { ok: d.idToken === 'fake-jwt', token: 'tok123', updated: '2026-10-04 20:00:00', summary: 'Lv50・第 14 層' };
  if (['cloudsave', 'cloudload', 'cloudinfo'].includes(d.type) && (expired || d.token !== 'tok123')) out = { ok: false, error: 'login' };
  else if (d.type === 'cloudsave') { stored = d.save; out = { ok: true, updated: '2026-10-04 21:00:00' }; }
  else if (d.type === 'cloudload') out = { ok: true, save: stored, updated: '2026-10-04 20:00:00', summary: 'Lv50・第 14 層' };
  else if (d.type === 'cloudinfo') out = { ok: true, updated: '2026-10-04 20:00:00', summary: 'Lv50・第 14 層' };
  return r.fulfill({ body: JSON.stringify(out), contentType: 'application/json' });
});
// 假 Google Identity Services：畫一顆按鈕，點了就回傳假的 credential
await page.route('https://accounts.google.com/gsi/client', r => r.fulfill({ contentType: 'text/javascript', body: `
  window.google = { accounts: { id: { initialize(o) { this.cb = o.callback; }, disableAutoSelect() {},
    renderButton(el) { const b = document.createElement('button'); b.id = 'fakeGsi'; b.textContent = 'Sign in with Google'; b.onclick = () => this.cb({ credential: 'fake-jwt' }); el.appendChild(b); } } } };` }));
await page.goto('https://app.test/'); await page.waitForTimeout(500);
const fails = [], check = (ok, msg) => { console.log((ok ? '✅ ' : '❌ ') + msg); if (!ok) fails.push(msg); };
const toastText = () => page.locator('#toast').innerText().catch(() => '');
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('raid-leader-save-v1')));
await page.click('[data-act="settings"]'); await page.waitForTimeout(500);
check((await page.locator('#modal').innerText()).includes('雲端存檔'), '設定有雲端存檔');
check(await page.locator('#fakeGsi').count() === 1, 'Google 登入按鈕已放上');
await page.click('#fakeGsi'); await page.waitForTimeout(400);
check((await toastText()).includes('已登入'), '登入：' + await toastText());
check((await page.locator('#modal').innerText()).includes('雲端最後備份'), '顯示雲端狀態：' + ((await page.locator('#modal').innerText()).match(/已登入[^\n]*/) || [''])[0]);
await page.click('[data-act="cloudup"]'); await page.waitForTimeout(400);
check((await toastText()).includes('已上傳'), '上傳：' + await toastText());
check(JSON.parse(stored).gold === 1234, '上傳的是目前進度');
// 雲端換成另一份（金幣 99999），下載覆蓋
const other = JSON.parse(stored); other.gold = 99999; stored = JSON.stringify(other);
await page.click('[data-act="settings"]').catch(() => {}); await page.waitForTimeout(200);
await page.click('[data-act="clouddown"]'); await page.waitForTimeout(400);
check((await page.locator('#modal').innerText()).includes('下載會覆蓋'), '下載前先確認');
await page.click('[data-act="clouddo"]'); await page.waitForTimeout(400);
check((await saved()).gold === 99999, '下載後進度被覆蓋：' + (await saved()).gold);
// 過期 → 自動登出
expired = true;
await page.click('[data-act="settings"]'); await page.waitForTimeout(200);
await page.click('[data-act="cloudup"]'); await page.waitForTimeout(400);
check((await toastText()).includes('過期'), '憑證過期提示：' + await toastText());
check(await page.locator('#fakeGsi').count() === 1, '回到登入按鈕');
// 重新登入再登出
expired = false; await page.click('#fakeGsi'); await page.waitForTimeout(400);
await page.click('[data-act="cloudout"]'); await page.waitForTimeout(300);
check(!(await page.evaluate(() => localStorage.getItem('raid-leader-cloud'))), '登出清掉憑證');
check(calls.includes('login') && calls.includes('cloudsave') && calls.includes('cloudload'), '呼叫：' + [...new Set(calls)].join(','));
check(!errs.length, '無 JS 錯誤 ' + errs.join(';'));
await browser.close();
if (fails.length) process.exit(1);
