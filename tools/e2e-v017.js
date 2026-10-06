// 端對端測試：node tools/e2e.js [index.html|dist/raid-leader.html]
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = process.argv[2] || 'index.html';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const serve = r => { const u = new URL(r.request().url()); if (u.host !== 'app.test') return r.abort();
  const f = path.join(root, u.pathname === '/' ? entry : u.pathname.slice(1));
  return fs.existsSync(f) ? r.fulfill({ body: fs.readFileSync(f), contentType: types[path.extname(f)] || 'text/plain' }) : r.fulfill({ status: 404 }); };
// v0.17：短教學（4 步）、卡關指引、新系統說明卡
import * as G from '../src/core/index.js';
(async () => {
  const fails = [], check = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) fails.push(m); };
  // 核心：連輸 3 場推一次指引，再輸 1 場不重複
  const c = G.newGame(); c.tut.done = true; c.unlocked = 5; c.failStreak = 3;
  check(G.stuckCheck(c, 'battle') && G.stuckCheck(c, 'battle') === null, '連輸 3 場推一次指引，不會連續重複');
  c.failStreak = 5; check(!!G.stuckCheck(c, 'battle'), '再多輸 2 場會再提醒');
  const old = G.newGame(); old.stats.runs = 9; delete old.tut; check(G.migrate(old).tut.done, '舊存檔視為已完成教學');

  const browser = await chromium.launch(), errs = [];
  const mk = async init => { const p = await browser.newPage({ viewport: { width: 390, height: 820 } });
    await p.addInitScript(v => { sessionStorage.setItem('rl-title', '1'); sessionStorage.setItem('rl-e2e', '1'); if (v && !sessionStorage.getItem('seeded')) { localStorage.setItem('raid-leader-save-v1', v); sessionStorage.setItem('seeded', '1'); } }, init || '');
    p.on('pageerror', e => errs.push(e.message)); await p.route('**/*', serve); await p.goto('https://app.test/'); await p.waitForTimeout(1200); return p; };
  // A) 全新玩家走完教學
  let page = await mk();
  for (let i = 0; i < 30; i++) { const b = page.locator('[data-act="dlgskip"]'); if (await b.count()) await b.click().catch(() => {}); else break; await page.waitForTimeout(150); }
  await page.locator('[data-act="skipnick"]').click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(200);
  check((await page.locator('.coach').innerText()).includes('1/4'), '新玩家看到教學 1/4');
  check(await page.locator('[data-act="fight"][data-d="0"].tut-hl').count() === 1, '高亮第 1 層的挑戰按鈕');
  await page.screenshot({ path: '/tmp/claude-0/v017-coach.png' });
  const fight = async d => { await page.click('[data-tab="dungeon"]'); await page.click(`[data-act="fight"][data-d="${d}"]`); await page.waitForTimeout(150); await page.click('[data-act="skip"]'); await page.waitForTimeout(150); await page.click('[data-tab="dungeon"]'); };
  await fight(0);
  const step = async () => page.evaluate(() => JSON.parse(localStorage.getItem('raid-leader-save-v1')).tut);
  if ((await step()).step === 1) { await page.click('[data-act="autoequip"]'); await page.waitForTimeout(150); }
  check((await step()).step >= 2, '開打＋配裝後進到第 3 步');
  for (let i = 0; i < 8 && (await step()).step === 2; i++) {
    await page.click('[data-tab="tavern"]'); await page.waitForTimeout(100);
    const h = page.locator('[data-act="hire"]:not([disabled])');
    if (await h.count()) { await h.first().click(); await page.waitForTimeout(150); await page.locator('[data-act="closebtn"]').click({ timeout: 500 }).catch(() => {}); } else await fight(0);
  }
  check((await step()).step === 3, '招募第 4 人後進到第 4 步');
  for (let i = 0; i < 12 && !(await step()).done; i++) { await fight(1); await page.locator('[data-act="dlgskip"]').click({ timeout: 300 }).catch(() => {}); await page.locator('[data-act="closebtn"]').click({ timeout: 300 }).catch(() => {}); if (!(await step()).done) { await fight(0); await page.click('[data-act="autoequip"]').catch(() => {}); } }
  check((await step()).done && await page.locator('.coach').count() === 0, '通關第 2 層，教學完成、教學卡消失');
  await page.close();
  // B) 卡關指引：20 分鐘沒有新進度 → 5 秒內跳出指引
  const s = G.newGame(); s.tut.done = true; s.player.asked = true; s.story.seen.push('pre0'); s.prog = { top: 0, at: -1300, warned: false, failWarned: 0 };
  page = await mk(JSON.stringify(s));
  await page.waitForTimeout(5500);
  check(await page.locator('.stucklist .stuck').count() >= 1, '一段時間沒進度：跳出卡關指引');
  await page.screenshot({ path: '/tmp/claude-0/v017-stuck.png' });
  await page.click('.stuck [data-tab], .stuck [data-act]'); await page.waitForTimeout(200);
  check(await page.locator('.stucklist').count() === 0, '點指引按鈕會關閉視窗並執行');
  await page.close();
  // C) 寶庫說明卡只出現一次
  const v = G.newGame(); v.tut.done = true; v.player.asked = true; v.clears = { 0: 1, 1: 1, 2: 1 }; v.unlocked = 4; v.story.seen.push('pre0');
  page = await mk(JSON.stringify(v));
  await page.click('[data-act="mode"][data-v="vault"]'); await page.waitForTimeout(150);
  check(await page.locator('.mguide', { hasText: '寶庫是什麼' }).count() === 1, '第一次進寶庫顯示說明卡');
  await page.click('[data-act="cardok"]'); await page.waitForTimeout(150);
  check(await page.locator('.mguide').count() === 0, '按「知道了」後不再顯示');
  check(!errs.length, '無 JS 錯誤 ' + errs.join(';'));
  await browser.close(); process.exit(fails.length ? 1 : 0);
})();
