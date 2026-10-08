// v0.17.2 測試：舊網址（GitHub Pages）自動帶存檔跳到新網址（Cloudflare）
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { playthrough } from './sim-lib.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OLD = 'https://anubispaco-tech.github.io/raid-leader/', SEED = OLD + '__seed', NEW = 'https://raid-leader.anubispaco.workers.dev/';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const { s } = playthrough({ talents: true, stopAt: 2 });
s.lastSeen = Date.now(); s.idle = null; s.gold = 4321; s.player = { pid: 'abcdefgh1234', name: '測試', asked: true, playSec: 0, bindAsked: 1 };
const fails = [], check = (ok, msg) => { console.log((ok ? '✅ ' : '❌ ') + msg); if (!ok) fails.push(msg); };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 760 } });
await ctx.route('**/*', r => {
  const u = new URL(r.request().url());
  let p = null;
  if (u.host === 'anubispaco-tech.github.io' && u.pathname.startsWith('/raid-leader/')) p = u.pathname.slice('/raid-leader/'.length);
  else if (u.host === 'raid-leader.anubispaco.workers.dev') p = u.pathname.slice(1);
  if (p === null) return r.abort();
  const f = path.join(root, 'public', p || 'index.html');
  if (!fs.existsSync(f)) return r.fulfill({ body: '<!doctype html><title>seed</title>', contentType: 'text/html' });
  return r.fulfill({ body: fs.readFileSync(f), contentType: types[path.extname(f)] });
});
const page = await ctx.newPage();  const errs = []; page.on('pageerror', e => errs.push(e.message));
const getSave = () => page.evaluate(() => JSON.parse(localStorage.getItem('raid-leader-save-v1') || 'null'));
const toastText = () => page.locator('#toast').innerText().catch(() => '');
const waitToast = async () => { for (let i = 0; i < 30; i++) { const t = await toastText(); if (t) return t; await page.waitForTimeout(200); } return ''; };
// 0. public/ 只有遊戲本體
const pub = []; const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => e.isDirectory() ? walk(path.join(d, e.name)) : pub.push(path.relative(path.join(root, 'public'), path.join(d, e.name))));
walk(path.join(root, 'public'));
// v0.21.1 另有 manifest.json 與主畫面圖示
check(pub.sort().join(',') === 'dist/app.js,icons/apple-touch-icon.png,icons/icon-192.png,icons/icon-512.png,icons/icon-maskable-512.png,index.html,manifest.json,src/styles.css', 'public/ 只有遊戲本體：' + pub.join(','));
// 1. 舊網址有存檔 → 跳到新網址並帶過去
await page.goto(SEED); await page.evaluate(v => localStorage.setItem('raid-leader-save-v1', v), JSON.stringify(s));
await page.goto(OLD); await page.waitForURL(u => u.host === 'raid-leader.anubispaco.workers.dev', { timeout: 5000 }).catch(() => {});
await page.waitForTimeout(1500);
check(page.url() === NEW, '跳到新網址且 # 已清掉：' + page.url());
check((await getSave())?.gold === 4321, '新網址收到存檔（金幣 4321）');
await page.click('#title .tgo', { timeout: 1000 }).catch(() => {});
const t1 = await waitToast(); check(t1.includes('已搬到新網址'), '搬家成功提示');
// 2. 新網址已有進度 → 舊網址再跳一次也不覆蓋
await page.goto(SEED); await page.evaluate(v => { const o = JSON.parse(v); o.gold = 1; localStorage.setItem('raid-leader-save-v1', JSON.stringify(o)); }, JSON.stringify(s));
await page.goto(OLD); await page.waitForURL(u => u.host === 'raid-leader.anubispaco.workers.dev', { timeout: 5000 }).catch(() => {}); await page.waitForTimeout(1500);
check((await getSave())?.gold !== 1, '新網址已有進度 → 不被覆蓋');
await page.click('#title .tgo', { timeout: 1000 }).catch(() => {});
check((await waitToast()).includes('沒有覆蓋'), '不覆蓋提示');
// 3. 亂塞的 #move → 不寫入
await page.goto(NEW + '__seed'); await page.evaluate(() => localStorage.clear());
await page.goto(NEW + '#move=zAAAA'); await page.waitForTimeout(1500);
check(!(await page.evaluate(() => localStorage.getItem('raid-leader-save-v1'))) || (await getSave())?.gold !== 4321, '壞掉的搬家碼不會寫入存檔');
// 4. 舊網址沒有存檔 → 直接跳新網址
await page.goto(SEED); await page.evaluate(() => localStorage.clear());
await page.goto(OLD); await page.waitForURL(u => u.host === 'raid-leader.anubispaco.workers.dev', { timeout: 5000 }).catch(() => {}); await page.waitForTimeout(800);
check(page.url() === NEW, '沒存檔也跳到新網址');
check(!errs.length, '無 JS 錯誤 ' + errs.join(';'));
await browser.close();
if (fails.length) process.exit(1);
