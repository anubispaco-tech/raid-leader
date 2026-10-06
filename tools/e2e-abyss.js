// v0.9.3 測試：深淵秘境（第二章秘境）、秘境體力、撤退扣鑰石、天梯欄位
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
for (let i = 0; i <= 13; i++) s.clears[i] = true; s.unlocked = 14;
for (const h of G.partyHeroes(s)) { h.level = 60; for (const sl of Object.keys(G.SLOTS)) { const it = G.makeItem(sl, 160, 3); it.up = 10; s.items[it.id] = it; h.gear[sl] = it.id; } }
s.mythic.key2 = 4; s.mythic.best[7] = { level: 5, time: 100 };
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 375, height: 760 } }); await page.addInitScript(() => (sessionStorage.setItem('rl-title', '1'), sessionStorage.setItem('rl-e2e', '1')));
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(v => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('raid-leader-save-v1', v); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(s));
// 重新整理前在 sessionStorage 放 patch，下一次載入前套用到存檔（避免被離開頁面時的自動存檔蓋掉）
await page.addInitScript(() => { const p = sessionStorage.getItem('patch'); if (p) { const v = JSON.parse(localStorage.getItem('raid-leader-save-v1')); v.mythic.sta = JSON.parse(p); localStorage.setItem('raid-leader-save-v1', JSON.stringify(v)); sessionStorage.removeItem('patch'); } });
const patchReload = async sta => { await page.evaluate(x => sessionStorage.setItem('patch', JSON.stringify(x)), sta); await page.reload(); await page.waitForTimeout(500); await nav(page, 'mythic'); };
await page.route('**/*', r => { const u = new URL(r.request().url()); if (u.host !== 'app.test') return r.abort();
  const f = path.join(root, u.pathname === '/' ? entry : u.pathname.slice(1));
  return r.fulfill({ body: fs.readFileSync(f), contentType: types[path.extname(f)] }); });
await page.goto('https://app.test/'); await page.waitForTimeout(500);
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('raid-leader-save-v1')));
const fails = [], check = (ok, msg) => { console.log((ok ? '✅ ' : '❌ ') + msg); if (!ok) fails.push(msg); };
const shot = n => (process.env.SHOTS || '/tmp/claude-0') + '/' + n;

await nav(page, 'mythic');
check((await page.locator('.seg.mtiers button.sel').innerText()).includes('深淵'), '解鎖後預設顯示深淵秘境');
check(await page.locator('.mythic .mrow2').count() === 7, '深淵秘境 7 個副本：' + (await page.locator('.mrow2 .mname b').allInnerTexts()).join('、'));
check((await page.locator('.mhead .keystone').innerText()) === '+4', '深淵鑰石 +4');
check((await page.locator('.stamina b').innerText()) === '10/10', '體力 10/10');
check(await page.locator('[data-act="idlemythic"][data-d="7"]').count() === 1, 'VIII 可掛機（最佳 +5 → +3）：' + await page.locator('[data-act="idlemythic"][data-d="7"]').innerText());
await page.screenshot({ path: shot('abyss.png'), fullPage: true });
await page.click('[data-act="recommend-mythic"][data-d="13"]');
await page.click('[data-act="mythic"][data-d="13"]'); await page.waitForTimeout(800);
check((await page.locator('.bhead h2').innerText()).includes('深淵之心'), '開打深淵之心 +4');
let sv = await saved(); check(sv.mythic.sta.pts === 9, '扣 1 點體力：' + sv.mythic.sta.pts);
await page.click('[data-act="retreat"]'); await page.waitForTimeout(400);
sv = await saved(); check(sv.mythic.key2 === 3 && sv.mythic.key === 2, `撤退：深淵鑰石 −1（${sv.mythic.key2}），傳奇鑰石不變（${sv.mythic.key}）`);
check((await page.locator('.result').innerText()).includes('體力 9'), '再挑戰按鈕顯示剩餘體力');
// 體力用完
await patchReload({ pts: 0, at: Date.now() - 4 * 60000 });
check((await page.locator('.stamina').innerText()).includes('0/10'), '體力 0：' + (await page.locator('.stamina').innerText()).replace(/\n/g, ' '));
await page.click('[data-act="mythic"][data-d="8"]'); await page.waitForTimeout(300);
check((await page.locator('#toast, .toast').first().innerText().catch(() => '')).includes('體力不足'), '體力不足時不能開打');
check(!(await page.locator('.bhead').count()) || !(await page.locator('.bhead h2').innerText()).includes('迴聲礦脈'), '沒有進入戰鬥');
// 切回傳奇秘境
await page.click('[data-act="mtier"][data-v="1"]');
check((await page.locator('.mhead .label').innerText()).includes('傳奇') && (await page.locator('.mrow2').count()) === 7, '傳奇秘境 7 個副本');
// 離線回復
await patchReload({ pts: 3, at: Date.now() - 35 * 60000 });
check((await page.locator('.stamina b').innerText()) === '6/10', '離開 35 分鐘回 3 點：' + await page.locator('.stamina b').innerText());
check(errs.length === 0, '無 JS 錯誤 ' + errs.join(' | '));
await browser.close();
process.exit(fails.length ? 1 : 0);
