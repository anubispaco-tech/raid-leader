// v0.18 測試：公告（假 GAS ?action=news）：按鈕與紅點、開啟時彈出一次、已讀、版本提醒、連結與跳脫、讀取失敗用快取
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { playthrough } from './sim-lib.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const { s } = playthrough({ talents: true, stopAt: 2 });
s.lastSeen = Date.now(); s.idle = null; s.player = { pid: 'abcdefgh1234', name: '測試', asked: true, playSec: 0 };
const fails = [], check = (ok, msg) => { console.log((ok ? '✅ ' : '❌ ') + msg); if (!ok) fails.push(msg); };
const t = Date.now();
let list = [], down = false; const events = [];
const N1 = { id: 'n001', type: '更新', title: '遊戲搬家了', body: '新網址：https://raid-leader.anubispaco.workers.dev\n<script>alert(1)</script>', titleEn: 'We moved', bodyEn: '', start: t - 1000, end: 0, pin: true, pop: true, minVer: '' };
const N2 = { id: 'n002', type: '維修', title: '需要新版', body: '請更新', start: t - 2000, end: 0, pin: false, pop: false, minVer: '9.0.0' };
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 375, height: 760 } });
await page.addInitScript(() => { sessionStorage.setItem('rl-title', '1'); });
await page.addInitScript(v => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('raid-leader-save-v1', v); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(s));
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.route('**/*', r => { const u = new URL(r.request().url()); if (u.host !== 'app.test') return r.abort();
  const f = path.join(root, 'public', u.pathname === '/' ? 'index.html' : u.pathname.slice(1));
  return r.fulfill({ body: fs.readFileSync(f), contentType: types[path.extname(f)] }); });
await page.route('https://script.google.com/**', r => {
  const u = new URL(r.request().url());
  if (r.request().method() === 'POST') { const d = JSON.parse(r.request().postData()); if (d.type === 'event') events.push(d.kind + '|' + d.detail); return r.fulfill({ body: '{"ok":true}', contentType: 'application/json' }); }
  if (u.searchParams.get('action') === 'news') return down ? r.abort() : r.fulfill({ body: JSON.stringify({ ok: true, at: Date.now(), list }), contentType: 'application/json' });
  return r.fulfill({ body: JSON.stringify({ ok: true, list: [] }), contentType: 'application/json' });
});
const modal = () => page.locator('#modal').innerText().catch(() => '');
// 1. 沒有公告 → 按鈕藏起來
await page.goto('https://app.test/'); await page.waitForTimeout(2000);
check(await page.locator('#newsBtn').isHidden(), '沒有公告時不顯示按鈕');
// 2. 有公告（彈出）→ 重新開啟：自動彈出一次、內容跳脫、網址成連結
list = [N1];
await page.reload(); await page.waitForTimeout(2500);
check((await modal()).includes('遊戲搬家了'), '開啟時彈出公告');
check(await page.locator('#modal .nbody a[href="https://raid-leader.anubispaco.workers.dev"]').count() === 1, '網址變成連結');
check(await page.locator('#modal script').count() === 0 && (await modal()).includes('<script>'), '內文 HTML 被跳脫');
check(events.some(e => e.includes('pop:n001')), '彈出有埋點');
await page.click('[data-act="closebtn"]'); await page.waitForTimeout(300);
check(await page.locator('#newsBtn').isVisible() && await page.locator('#newsDot').isHidden(), '彈出後算已讀，紅點消失');
// 3. 再開一次不會再彈
await page.reload(); await page.waitForTimeout(2500);
check(!(await modal()).includes('遊戲搬家了'), '同一則不會重複彈出');
// 4. 新公告（不彈出、需要新版）→ 紅點；開列表看到版本提醒；開完紅點消失
list = [N1, N2];
await page.evaluate(() => localStorage.removeItem('raid-leader-news')); // 讓重新開啟時立刻重抓
await page.reload(); await page.waitForTimeout(2500);
check(await page.locator('#newsDot').isVisible(), '新公告 → 紅點');
check(!(await modal()).includes('需要新版'), '沒勾彈出的不會自動彈');
await page.click('#newsBtn'); await page.waitForTimeout(300);
const m = await modal();
check(m.includes('需要新版') && m.includes('遊戲搬家了'), '列表顯示全部公告');
check(m.includes('較舊') && await page.locator('[data-act="newsreload"]').count() === 1, '最低版本 → 顯示重新整理');
check(m.indexOf('遊戲搬家了') < m.indexOf('需要新版'), '置頂排前面');
await page.click('[data-act="closebtn"]'); await page.waitForTimeout(200);
check(await page.locator('#newsDot').isHidden(), '看過列表 → 紅點消失');
// 5. GAS 讀不到 → 沿用快取
down = true;
await page.reload(); await page.waitForTimeout(2500);
check(await page.locator('#newsBtn').isVisible(), 'GAS 讀不到時沿用快取公告');
// 6. 過期公告不顯示
down = false; list = [{ ...N2, id: 'n003', title: '過期', end: Date.now() - 1000 }];
await page.evaluate(() => localStorage.removeItem('raid-leader-news'));
await page.reload(); await page.waitForTimeout(2500);
check(await page.locator('#newsBtn').isHidden(), '只有過期公告 → 不顯示按鈕');
// 7. 英文
list = [N1];
await page.evaluate(() => { localStorage.removeItem('raid-leader-news'); localStorage.setItem('raid-leader-lang', 'en'); });
await page.reload(); await page.waitForTimeout(2500);
await page.click('#newsBtn').catch(() => {}); await page.waitForTimeout(300);
check((await modal()).includes('We moved'), '英文顯示英文標題：' + (await modal()).slice(0, 40));
check(!errs.length, '無 JS 錯誤 ' + errs.join(';'));
await browser.close();
if (fails.length) process.exit(1);
