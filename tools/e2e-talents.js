// 天賦與號角測試：舊存檔（v2，Lv12 英雄、無天賦）升級 → 選專精與天賦 → 推薦 → 戰鬥吹號角
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as G from '../src/core/index.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = process.argv[2] || 'index.html';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

// 做一份 v2 格式的舊存檔
const old = G.newGame();
for (const h of old.heroes) { h.level = 12; delete h.spec; delete h.talents; }
old.v = 2; old.unlocked = 5; old.clears = { 0: 3, 1: 3, 2: 3, 3: 3 };

const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 375, height: 760 }, deviceScaleFactor: 2 }); await page.addInitScript(() => (sessionStorage.setItem('rl-title', '1'), sessionStorage.setItem('rl-e2e', '1')));
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(v => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('raid-leader-save-v1', v); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(old));
await page.route('**/*', r => { const u = new URL(r.request().url()); if (u.host !== 'app.test') return r.abort();
  const f = path.join(root, u.pathname === '/' ? entry : u.pathname.slice(1));
  return r.fulfill({ body: fs.readFileSync(f), contentType: types[path.extname(f)] }); });
await page.goto('https://app.test/'); await page.waitForTimeout(400); await page.locator('[data-act=\"skipnick\"]').click({ timeout: 1500 }).catch(() => {});
const out = [], saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('raid-leader-save-v1')));
out.push('團隊分頁紅點：' + await page.locator('[data-tab="team"] .dot').count());
await page.click('[data-tab="team"]');
out.push('可選天賦標籤：' + await page.locator('.newpick').count());
await page.locator('.stack .hero').first().click();
await page.click('[data-act="heroview"][data-v="talent"]');
out.push('天賦頁待選數：' + await page.locator('.pip').innerText());
await page.locator('[data-act="spec"]').first().click();
await page.locator('[data-act="talent"][data-lv="5"][data-v="b"]').click();
let s = await saved(); const h0 = s.heroes.find(h => h.spec);
out.push(`選擇後：${h0.cls} 專精=${h0.spec} 天賦=${JSON.stringify(h0.talents)}`);
out.push('Lv15 列鎖住：' + await page.locator('[data-act="talent"][data-lv="15"]').first().isDisabled());
await page.screenshot({ path: '/tmp/claude-0/m-talent.png' });
await page.keyboard.press('Escape');
await page.click('[data-tab="dungeon"]');
await page.click('[data-act="prepare"][data-d="4"]');
s = await saved(); out.push('一鍵備戰（第 5 層）：' + s.heroes.map(h => `${h.cls}:${h.spec}/${Object.values(h.talents).join('')}`).join(' '));
out.push('推薦後紅點：' + await page.locator('[data-tab="team"] .dot').count());
await page.click('[data-act="fight"][data-d="4"]'); await page.waitForTimeout(1500);
await page.click('[data-act="horn"]'); await page.waitForTimeout(300);
out.push('號角按鈕：' + await page.locator('[data-act="horn"]').innerText() + '｜紀錄：' + (await page.locator('.log').innerText()).includes('英勇號角'));
await page.click('[data-act="speed"][data-x="4"]'); await page.waitForTimeout(3000);
await page.screenshot({ path: '/tmp/claude-0/m-battle3.png' });
out.push('技能紀錄筆數：' + await page.locator('.log .skill').count());
await page.click('[data-act="skip"]');
out.push('結果：' + await page.locator('.result h3').innerText() + '｜技能佔比：' + (await page.locator('.mrow small').allInnerTexts()).join(','));
await page.screenshot({ path: '/tmp/claude-0/m-result3.png', fullPage: true });
console.log(out.join('\n') + '\nERRORS: ' + JSON.stringify(errs));
await browser.close();
