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
// v0.14：讀取畫面、首通禁止直接結算、鎖定防誤分解／解雇
(async () => {
  const browser = await chromium.launch(); const errs = [];
  const mk = async init => { const p = await browser.newPage({ viewport: { width: 400, height: 820 } });
    await p.addInitScript(() => sessionStorage.setItem('rl-title', '1')); // 注意：不設 rl-e2e，要測真實的結算限制
    if (init) await p.addInitScript(v => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('raid-leader-save-v1', v); sessionStorage.setItem('seeded', '1'); } }, init);
    p.on('pageerror', e => errs.push(e.message));
    await p.route('**/*', serve); return p; };
  let page = await mk();
  const reopen = async fn => { const v = await page.evaluate(f => { const s = JSON.parse(localStorage.getItem('raid-leader-save-v1')); return JSON.stringify(new Function('s', f)(s) || s); }, `(${fn})(s)`);
    await page.close(); page = await mk(v); await page.goto('https://app.test/'); await page.waitForTimeout(1200); };
  const ok = (c, m) => console.log((c ? '✅ ' : '❌ ') + m), fails = [];
  const check = (c, m) => { ok(c, m); if (!c) fails.push(m); };
  await page.goto('https://app.test/');
  check(await page.locator('#boot').count() === 1, '開啟時顯示讀取畫面');
  await page.waitForTimeout(1200);
  check(await page.locator('#boot').count() === 0, '讀取畫面自動消失');
  await page.locator('[data-act="dlgskip"]').click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(400);
  await page.locator('[data-act="skipnick"]').click({ timeout: 1500 }).catch(() => {});
  await page.click('[data-act="fight"][data-d="0"]'); await page.waitForTimeout(600);
  check(await page.locator('[data-act="skip"]').count() === 0 && await page.locator('.ctrlbar button[disabled]', { hasText: '結算' }).count() === 1, '首通：直接結算按鈕停用');
  // 存檔改成已通關第 1 層 → 再打一次就能直接結算
  await reopen(s => { s.clears = { 0: 1 }; return s; });
  await page.locator('[data-act="dlgskip"]').click({ timeout: 1000 }).catch(() => {});
  await page.click('[data-act="fight"][data-d="0"]'); await page.waitForTimeout(600);
  check(await page.locator('[data-act="skip"]').count() === 1, '已通關：可以直接結算');
  await page.click('[data-act="skip"]'); await page.waitForTimeout(300);
  // 鎖定裝備：分解按鈕消失、批次分解跳過
  const r = 'lk1';
  await reopen(s => { const any = Object.values(s.items)[0]; s.items.lk1 = { ...any, id: 'lk1', name: '測試之劍', base: undefined, affix: undefined, rarity: 0, ilvl: 1, up: 0, set: null, locked: true }; s.bag.push('lk1'); return s; });
  await page.locator('[data-act="dlgskip"]').click({ timeout: 1000 }).catch(() => {});
  await page.click('[data-tab="bag"]'); await page.waitForTimeout(200);
  await page.locator('.item', { hasText: '測試之劍' }).first().click(); await page.waitForTimeout(200);
  check(await page.locator('.sheet [data-act="salvage"]').count() === 0 && await page.locator('.sheet [data-act="lock"]', { hasText: '已鎖定' }).count() === 1, '鎖定裝備：沒有分解按鈕');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  const kept = r;
  await page.evaluate(() => document.querySelector('[data-act="salvageupto"]') && document.querySelector('[data-act="salvageupto"]').click());
  await page.waitForTimeout(200); await page.evaluate(() => document.querySelector('[data-act="salvageupto"]') && document.querySelector('[data-act="salvageupto"]').click()); await page.waitForTimeout(300);
  const still = await page.evaluate(id => !!JSON.parse(localStorage.getItem('raid-leader-save-v1')).items[id], kept);
  check(still, '批次分解後鎖定裝備仍在');
  // 鎖定英雄：沒有解雇按鈕
  await page.click('[data-tab="team"]'); await page.waitForTimeout(200);
  await page.locator('.hero').first().click(); await page.waitForTimeout(200);
  await page.click('.sheet [data-act="lock"]'); await page.waitForTimeout(300);
  check(await page.locator('.sheet [data-act="fire"]').count() === 0, '鎖定英雄：沒有解雇按鈕');
  check(!errs.length, '無 JS 錯誤 ' + errs.join(' | '));
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
