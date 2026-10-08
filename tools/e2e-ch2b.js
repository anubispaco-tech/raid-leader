// v0.9.1 測試：雙首領（兩坦各扛一隻）、轉階段、第二章完結劇情
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
s.lastSeen = Date.now(); s.idle = null; s.gold = 60000; s.player = { pid: 'abcdefgh1234', name: '測試', asked: true, playSec: 0, bindAsked: 1 };
for (let d = 7; d <= 12; d++) s.clears[d] = 1; s.unlocked = 14; s.story.seen.push('post6', 'pre7', 'post7', 'pre8', 'post8', 'pre9', 'post9');
const g2 = G.makeHero('guardian', 60, 0); g2.name = '第二坦'; s.heroes.push(g2);
for (const h of s.heroes) { h.level = 60; for (const sl of Object.keys(G.SLOTS)) { const it = G.makeItem(sl, 150, 3); it.up = 10; s.items[it.id] = it; h.gear[sl] = it.id; } }
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 375, height: 760 } }); await page.addInitScript(() => (sessionStorage.setItem('rl-title', '1'), sessionStorage.setItem('rl-e2e', '1'), localStorage.setItem('raid-leader-prefs', '{"fx":"off"}'))); // v0.20 起預設格子戰場；這支測試看文字列表的敵方區
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(v => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('raid-leader-save-v1', v); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(s));
await page.route('**/*', r => { const u = new URL(r.request().url()); if (u.host !== 'app.test') return r.abort();
  const f = path.join(root, u.pathname === '/' ? entry : u.pathname.slice(1));
  return r.fulfill({ body: fs.readFileSync(f), contentType: types[path.extname(f)] }); });
await page.goto('https://app.test/'); await page.waitForTimeout(500);
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('raid-leader-save-v1')));
const fails = [], check = (ok, msg) => { console.log((ok ? '✅ ' : '❌ ') + msg); if (!ok) fails.push(msg); };
const shot = n => (process.env.SHOTS || '/tmp/claude-0') + '/' + n;
check(await page.locator('.dg').count() === 7, '第二章顯示 VIII~XIV');
await page.click('.dg [data-act="prepare"][data-d="10"]'); await page.waitForTimeout(200);
const sv = await saved(); const tanks = sv.party.map(id => sv.heroes.find(h => h.id === id)).filter(h => h.cls === 'guardian');
check(tanks.length === 2, '雙首領備戰帶 2 坦：' + tanks.map(h => h.name).join('、'));
await page.click('.dg [data-act="fight"][data-d="10"]'); await page.waitForTimeout(200);
check((await page.locator('.dlg p').innerText()).includes('殺了龍'), 'XI 戰前對話'); await page.click('[data-act="dlgskip"]');
await page.click('[data-act="speed"][data-x="4"]');
for (let i = 0; i < 30 && !(await page.locator('.side.foes').innerText()).includes('日之先知'); i++) await page.waitForTimeout(500);
check((await page.locator('.side.foes').innerText()).includes('日之先知') && (await page.locator('.side.foes').innerText()).includes('月之先知'), '首領戰兩隻首領同時出現');
await page.screenshot({ path: shot('twin.png') });
await page.click('[data-act="skip"]'); await page.waitForTimeout(400);
const log = await page.locator('.log').innerText();
check((await page.locator('.result h3').innerText()) === '通關', 'XI 通關');
check(/悲憤/.test(log), '一隻先倒，另一隻悲憤');
await page.click('[data-act="dlgskip"]').catch(() => {});
// XIV：完結劇情
await page.click('[data-tab="dungeon"]'); await page.click('.dg [data-act="fight"][data-d="13"]'); await page.click('[data-act="dlgskip"]');
await page.click('[data-act="skip"]'); await page.waitForTimeout(400);
const log2 = await page.locator('.log').innerText();
check(/第二階段/.test(log2), 'XIV 轉階段');
check((await page.locator('.result h3').innerText()) === '通關', 'XIV 通關');
const lines = []; for (let i = 0; i < 4; i++) { lines.push(await page.locator('.dlg p').innerText()); await page.click('.dlg .btn[data-act="dlgnext"]'); await page.waitForTimeout(100); }
check(lines[3].includes('完'), '第二章完結對話：' + lines[3]);
check(!errs.length, '無 JS 錯誤 ' + errs.join(';'));
await browser.close();
if (fails.length) process.exit(1);
