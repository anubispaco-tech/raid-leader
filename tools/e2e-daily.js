// v0.9.4 測試：每日任務、每日首勝、累積簽到、離線首勝
import { createRequire } from 'module';
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
const { s } = playthrough({ talents: true, stopAt: 3 });
s.lastSeen = Date.now(); s.idle = null; s.gold = 5000; s.player = { pid: 'abcdefgh1234', name: '測試', asked: true, playSec: 0, bindAsked: 1 };
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
const toastText = () => page.locator('#toast').innerText().catch(() => '');

check(await page.locator('.daily.open').count() === 1, '有可領取時每日卡預設展開');
check((await page.locator('.daily .dbadge').innerText()) === '1', '待領數 1（簽到）');
check(await page.locator('.daily .drow .dbar').count() === 3, '三個任務：' + (await page.locator('.daily .drow:has(.dbar) > span:first-child').allInnerTexts()).join('、'));
await page.screenshot({ path: shot('daily.png'), fullPage: false });
const g0 = (await saved()).gold;
await page.click('[data-act="dsign"]'); await page.waitForTimeout(200);
check((await toastText()).includes('簽到第 1 天'), '簽到：' + await toastText());
let sv = await saved(); check(sv.daily.signDays === 1 && sv.daily.signed && sv.gold > g0, `簽到後 signDays=1、金幣 ${g0}→${sv.gold}`);
check(await page.locator('.daily.open').count() === 0, '沒有可領的就收起');
// 打一場主線 → 首勝
await page.click('[data-act="mode"][data-v="story"]').catch(() => {});
await page.click('[data-act="fight"][data-d="0"]'); await page.waitForTimeout(400);
await page.click('[data-act="skip"]').catch(() => {}); await page.waitForTimeout(600);
const res = await page.locator('.result').innerText().catch(() => '');
check(res.includes('今日首勝'), '結算顯示首勝：' + (res.split('\n').find(l => l.includes('首勝')) || ''));
sv = await saved(); check(sv.daily.firstWin === true, '存檔記錄首勝');
const winQ = sv.daily.q.find(q => q.id === 'win'); if (winQ) check(winQ.n === 1, '主線勝利任務 +1');
// 第二場不再給首勝
await page.click('[data-act="fight"][data-d="0"]').catch(() => {}); await page.waitForTimeout(400);
await page.click('[data-act="skip"]').catch(() => {}); await page.waitForTimeout(600);
check(!(await page.locator('.result').innerText().catch(() => '')).includes('今日首勝'), '第二場沒有首勝');
// 任務完成可領
await page.evaluate(() => { const v = JSON.parse(localStorage.getItem('raid-leader-save-v1')); sessionStorage.setItem('patchq', '1'); });
await page.addInitScript(() => { if (sessionStorage.getItem('patchq')) { const v = JSON.parse(localStorage.getItem('raid-leader-save-v1')); v.daily.q.forEach(q => q.n = 99); localStorage.setItem('raid-leader-save-v1', JSON.stringify(v)); sessionStorage.removeItem('patchq'); } });
await page.reload(); await page.waitForTimeout(600); await page.click('[data-tab="dungeon"]').catch(() => {}); await page.waitForTimeout(200);
check((await page.locator('.daily .dbadge').innerText().catch(() => '')) === '3', '三個任務都可領');
for (let i = 0; i < 3; i++) { await page.click('[data-act="dq"]'); await page.waitForTimeout(150); }
check((await toastText()).includes('任務獎勵'), '領任務：' + await toastText());
await page.click('[data-act="dchest"]'); await page.waitForTimeout(150);
check((await toastText()).includes('每日寶箱'), '開寶箱：' + await toastText());
sv = await saved(); check(sv.daily.chest && sv.daily.q.every(q => q.claimed), '存檔：任務與寶箱都已領');
// 換日：重抽任務、可再簽到，簽到天數累積
await page.addInitScript(() => { if (sessionStorage.getItem('patchday')) { const v = JSON.parse(localStorage.getItem('raid-leader-save-v1')); v.daily.day = '2000-01-01'; localStorage.setItem('raid-leader-save-v1', JSON.stringify(v)); sessionStorage.removeItem('patchday'); } });
await page.evaluate(() => sessionStorage.setItem('patchday', '1')); await page.reload(); await page.waitForTimeout(600);
await page.click('[data-tab="dungeon"]').catch(() => {}); await page.waitForTimeout(200);
await page.click('[data-act="dsign"]'); await page.waitForTimeout(150);
sv = await saved(); check(sv.daily.signDays === 2 && !sv.daily.chest && sv.daily.q.every(q => !q.claimed), '換日：簽到第 2 天、任務重置：' + await toastText());
// 英文
await page.evaluate(() => localStorage.setItem('raid-leader-lang', 'en')); await page.reload(); await page.waitForTimeout(600);
await page.click('[data-tab="dungeon"]').catch(() => {}); await page.click('[data-act="dtoggle"]').catch(() => {}); await page.waitForTimeout(200);
check((await page.locator('.daily').innerText()).includes('Check-in'), '英文每日卡：' + (await page.locator('.daily .dsum').innerText()));
check(errs.length === 0, '無 JS 錯誤 ' + errs.join(' | '));
await browser.close();
process.exit(fails.length ? 1 : 0);
