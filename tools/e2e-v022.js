// v0.22 測試：寶庫延伸到第二章（14 層按鈕、羅馬數字）、第二章樓層打完會得精華、結算顯示精華、英文模式沒有缺字
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as G from '../src/core/index.js';
import { setSeed } from '../src/core/rng.js';
import { playthrough } from './sim-lib.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [], check = (ok, msg) => { console.log((ok ? '✅ ' : '❌ ') + msg); if (!ok) fails.push(msg); };

setSeed(77);
const a = playthrough({ talents: true });
const { s } = playthrough({ talents: true, s: a.s, stopAt: 13, maxRuns: 3000 });
check(!!s.clears[13], '模擬存檔已通關第 XIV 層');
s.lastSeen = Date.now(); s.idle = null; s.idleMythic = null; s.vault = { day: '', used: 0, runs: 0, best: {} };
s.player = { pid: 'vaulttest01', name: '測試', asked: true, playSec: 6000, src: 'old', bindAsked: 1 };
s.story = s.story || { seen: [] }; for (let i = 0; i < 14; i++) s.story.seen.push('pre' + i, 'post' + i);
s.tut = { step: 99, done: true };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.addInitScript(v => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('raid-leader-save-v1', v); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(s));
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.route('**/*', r => { const u = new URL(r.request().url()); if (u.host !== 'app.test') return r.abort();
  const f = path.join(root, 'public', u.pathname === '/' ? 'index.html' : u.pathname.slice(1));
  return r.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); });
await page.goto('https://app.test/'); await page.waitForTimeout(1500);
if (await page.locator('[data-act="titlego"]').count()) { await page.click('[data-act="titlego"]'); await page.waitForTimeout(800); }
for (let i = 0; i < 5 && await page.locator('.sheet').count(); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
await page.click('[data-act="mode"][data-v="vault"]'); await page.waitForTimeout(400);
const btns = await page.locator('.vfloors button').allTextContents();
check(btns.length === 14 && btns[0] === 'I' && btns[13] === 'XIV', `寶庫 14 層按鈕、羅馬數字（${btns.join(' ')}）`);
check(await page.locator('.vfloors button.sel').textContent() === 'XIV', '預設選最高層 XIV');
const card = await page.locator('.vault').textContent();
check(/另得精華，最多 \d+/.test(card), '第二章樓層顯示可得精華');
await page.click('.vfloors button:has-text("VII")'); await page.waitForTimeout(300);
check(!/另得精華/.test(await page.locator('.vault').textContent()), '第一章樓層不顯示精華');
await page.click('.vfloors button:has-text("XIV")'); await page.waitForTimeout(300);
const dust0 = await page.evaluate(() => JSON.parse(localStorage.getItem('raid-leader-save-v1')).dust || 0);
await page.click('[data-act="vault"]'); await page.waitForTimeout(500);
check(/寶庫・第 XIV 層/.test(await page.locator('.bhead h2').textContent()), '戰鬥標題「寶庫・第 XIV 層」');
await page.click('[data-act="speed"][data-x="4"]').catch(() => {});
for (let k = 0; k < 40 && !(await page.locator('.result').count()); k++) await page.waitForTimeout(1000);
const res = await page.locator('.result').textContent().catch(() => '');
const after = await page.evaluate(() => JSON.parse(localStorage.getItem('raid-leader-save-v1')).dust || 0);
check(/\+\d+ 精華/.test(res) && after > dust0, `結算顯示精華、存檔精華增加（${dust0} → ${after}）`);
await page.screenshot({ path: '/tmp/v022-result.png' });
// 英文模式
await page.evaluate(() => { const b = document.createElement('button'); b.dataset.act = 'lang'; b.dataset.v = 'en'; document.body.appendChild(b); b.click(); });
await page.waitForTimeout(800);
await page.click('[data-tab="dungeon"]'); await page.waitForTimeout(300);
await page.click('[data-act="mode"][data-v="vault"]'); await page.waitForTimeout(300);
const en = await page.locator('.vault').last().textContent(); console.log('   EN: ' + en.replace(/\s+/g, ' ').slice(0, 260));
check(/Also drops essence, up to \d+/.test(en) && !/[一-鿿]/.test(en), '英文寶庫卡片沒有中文殘留');
check(!errs.length, '沒有錯誤' + (errs.length ? '：' + errs[0] : ''));
await page.screenshot({ path: '/tmp/v022-vault-en.png' });
await browser.close();
console.log(fails.length ? `\n❌ ${fails.length} 項失敗` : '\n全部通過');
process.exit(fails.length ? 1 : 0);
