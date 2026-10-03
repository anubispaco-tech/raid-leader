// 遊玩數據測試：用假的 GAS 回應，檢查暱稱、送出內容、排行榜、回饋、HTML 跳脫
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = process.argv[2] || 'index.html';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const posts = [];
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 375, height: 760 }, deviceScaleFactor: 2 });
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.route('**/*', r => {
  const u = new URL(r.request().url());
  if (u.host === 'script.google.com') {
    if (r.request().method() === 'POST') { posts.push(JSON.parse(r.request().postData())); return r.fulfill({ body: '{"ok":true}', contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } }); }
    return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ ok: true, list: [{ name: '<img src=x onerror=alert(1)>', best: 9, top: 7, level: 40 }, { name: '測試員', best: 0, top: 3, level: 6 }] }) });
  }
  if (u.host !== 'app.test') return r.abort();
  const f = path.join(root, u.pathname === '/' ? entry : u.pathname.slice(1));
  return r.fulfill({ body: fs.readFileSync(f), contentType: types[path.extname(f)] });
});
await page.goto('https://app.test/'); await page.waitForTimeout(500);
const out = [];
out.push('暱稱視窗：' + await page.locator('#nickInp').count());
await page.fill('#nickInp', '測試員'); await page.click('[data-act="savenick"]'); await page.waitForTimeout(500);
out.push('送出 snapshot：' + JSON.stringify(posts.find(p => p.type === 'snapshot')));
await page.click('[data-act="fight"][data-d="0"]'); await page.click('[data-act="skip"]'); await page.waitForTimeout(500);
out.push('首通事件：' + JSON.stringify(posts.find(p => p.type === 'event')));
await page.click('[data-tab="dungeon"]'); await page.waitForTimeout(800);
out.push('排行榜：' + (await page.locator('.board li').allInnerTexts()).map(t => t.replace(/\n/g, ' ')).join('｜'));
out.push('自己被標示：' + await page.locator('.board li.me').count() + '｜惡意名稱沒變成圖片：' + (await page.locator('.board img').count() === 0));
await page.locator('.boardcard').screenshot({ path: '/tmp/claude-0/m-board.png' });
await page.click('[data-tab="team"]');
await page.fill('#fbText', '第六層好難\n但很好玩');
await page.click('[data-act="fight"]').catch(() => {}); // 不該發生；只是確認草稿
await page.click('[data-tab="team"]');
out.push('切頁後草稿保留：' + (await page.locator('#fbText').inputValue()).includes('第六層'));
await page.click('[data-act="sendfb"]'); await page.waitForTimeout(500);
out.push('回饋：' + JSON.stringify(posts.find(p => p.type === 'feedback')));
out.push('送出後清空：' + ((await page.locator('#fbText').inputValue()) === ''));
console.log(out.join('\n') + '\nERRORS: ' + JSON.stringify(errs));
await browser.close();
