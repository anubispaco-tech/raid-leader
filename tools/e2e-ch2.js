// v0.9.0 測試：遊玩分類、第二章（劇情、詛咒／讀條／護盾）、依裝等分解、名字組合
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
const G = await import('../src/core/index.js');
const { s } = playthrough({ talents: true });
s.lastSeen = Date.now(); s.idle = null; s.gold = 60000; s.player = { pid: 'abcdefgh1234', name: '測試', asked: true, playSec: 0 };
// 隊伍拉到 Lv40、換上裝等 100 稀有 +5，確保打得過第 VIII 層
for (const h of G.partyHeroes(s)) { h.level = 40; for (const sl of Object.keys(G.SLOTS)) { const it = G.makeItem(sl, 100, 2); it.up = 5; s.items[it.id] = it; h.gear[sl] = it.id; } }
for (let i = 0; i < 6; i++) { const it = G.makeItem('weapon', 40, 2); s.items[it.id] = it; s.bag.push(it.id); } // 6 件低裝等
G.rollTavern(s);
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 375, height: 760 } }); await page.addInitScript(() => (sessionStorage.setItem('rl-title', '1'), sessionStorage.setItem('rl-e2e', '1')));
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(v => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('raid-leader-save-v1', v); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(s));
await page.route('**/*', r => { const u = new URL(r.request().url()); if (u.host !== 'app.test') return r.abort();
  const f = path.join(root, u.pathname === '/' ? entry : u.pathname.slice(1));
  return r.fulfill({ body: fs.readFileSync(f), contentType: types[path.extname(f)] }); });
await page.goto('https://app.test/'); await page.waitForTimeout(500);
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('raid-leader-save-v1')));
const fails = [], check = (ok, msg) => { console.log((ok ? '✅ ' : '❌ ') + msg); if (!ok) fails.push(msg); };
const shot = n => (process.env.SHOTS || '/tmp/claude-0') + '/' + n;
// 分類與章節
check(await page.locator('.seg.modes button').count() === 4, '遊玩分類 4 個：' + (await page.locator('.seg.modes').innerText()).replace(/\n/g, '｜'));
check((await page.locator('.seg.chapters button.sel').innerText()).includes('第二章'), '已解鎖第二章時預設顯示第二章');
check(await page.locator('.dg').count() === 7 && (await page.locator('.dg .tier').first().innerText()).startsWith('VIII'), '第二章顯示 VIII~XIV');
await page.screenshot({ path: shot('ch2-list.png') });
await page.click('[data-act="mode"][data-v="mythic"]'); check(await page.locator('.mythic .keystone').count() === 1, '秘境分類');
await page.click('[data-act="mode"][data-v="vault"]'); check(await page.locator('.vault').count() === 1, '寶庫分類');
await page.click('[data-act="mode"][data-v="event"]'); check((await page.locator('main').innerText()).includes('即將推出'), '活動分類（即將推出）');
await page.click('[data-act="mode"][data-v="story"]');
// 第 VIII 層：序章＋戰前對話 → 戰鬥 → 首通對話
await page.click('.dg [data-act="fight"][data-d="7"]'); await page.waitForTimeout(200);
const l1 = await page.locator('.dlg p').innerText(), n1 = await page.locator('.dlg .sub.num').innerText();
check(l1.includes('紅龍倒下') && n1.endsWith('/6'), `第一次打 VIII：序章＋戰前對話 ${n1}`);
await page.screenshot({ path: shot('ch2-dialog.png') });
await page.click('[data-act="dlgskip"]'); await page.waitForTimeout(300);
await page.click('[data-act="speed"][data-x="4"]'); await page.waitForTimeout(6000);
await page.screenshot({ path: shot('ch2-battle.png') });
await page.click('[data-act="skip"]'); await page.waitForTimeout(400);
const log = await page.locator('.log').innerText();
check(/詛咒/.test(log), '詛咒出現在戰鬥紀錄');
check((await page.locator('.result h3').innerText()) === '通關' && (await page.locator('.dlg p').innerText()).includes('裂縫'), '首通 → 播放通關對話');
await page.click('[data-act="dlgskip"]');
const sv = await saved();
check(sv.story.seen.includes('post6') && sv.story.seen.includes('pre7') && sv.story.seen.includes('post7') && sv.unlocked === 9, '劇情紀錄與解鎖 IX：' + sv.story.seen.join(','));
await page.click('[data-tab="dungeon"]'); await page.click('.dg [data-act="fight"][data-d="7"]'); await page.waitForTimeout(200);
check(!(await page.locator('.dlg').count()), '看過的劇情不再播');
// IX：讀條與打斷
await page.click('[data-act="retreat"]'); await page.click('[data-tab="dungeon"]'); await page.click('.dg [data-act="fight"][data-d="8"]'); await page.click('[data-act="dlgskip"]');
await page.click('[data-act="skip"]'); await page.waitForTimeout(300);
const log2 = await page.locator('.log').innerText(); check(/讀條|打斷/.test(log2) || (await page.locator('.result h3').innerText()).length > 0, 'IX 戰鬥可結算');
// 背包：依裝等分解
await page.click('[data-tab="bag"]');
const lowBtn = page.locator('[data-act="salvlow"]'); const lowTxt = await lowBtn.innerText();
await lowBtn.click(); await page.waitForTimeout(200);
check(/（\d+ 件）/.test(lowTxt) && +lowTxt.match(/（(\d+) 件）/)[1] >= 6, '分解低裝等：' + lowTxt);
check((await page.locator('main').innerText()).includes('依裝等自動分解'), '依裝等自動分解設定');
// 酒館名字
await page.click('[data-tab="tavern"]');
const names = await page.locator('.stack .hero .nm').allInnerTexts();
check(names.slice(0, 3).every(n => n.includes('・')), '新招募名字為「名字・稱號」：' + names.slice(0, 3).map(n => n.split('\n')[0]).join('、'));
check(!errs.length, '無 JS 錯誤 ' + errs.join(';'));
await browser.close();
if (fails.length) process.exit(1);
