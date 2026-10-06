// v0.8.1 測試：開始畫面、切換英文、序章對話、英文介面殘留中文檢查與截圖
import { createRequire } from 'module';
import { nav } from './e2e-nav.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { playthrough } from './sim-lib.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = process.argv[2] || 'index.html', shots = process.env.SHOTS || '/tmp/claude-0';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const fails = [], check = (ok, msg) => { console.log((ok ? '✅ ' : '❌ ') + msg); if (!ok) fails.push(msg); };
const CJK = /[　-〿一-鿿＀-￯]/;
const browser = await chromium.launch();
const route = p => p.route('**/*', r => { const u = new URL(r.request().url()); if (u.host !== 'app.test') return r.abort();
  const f = path.join(root, u.pathname === '/' ? entry : u.pathname.slice(1));
  return r.fulfill({ body: fs.readFileSync(f), contentType: types[path.extname(f)] }); });

// A) 全新玩家：開始畫面 → 切英文 → 序章 → 暱稱
{
  const page = await browser.newPage({ viewport: { width: 375, height: 760 } }); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await route(page); await page.goto('https://app.test/'); await page.waitForTimeout(1000);
  check(await page.locator('#title').isVisible() && (await page.locator('#title .tgo').innerText()) === '開始冒險', '開始畫面（中文）');
  await page.screenshot({ path: `${shots}/i18n-title-zh.png` });
  await page.click('#title [data-act="lang"][data-v="en"]'); await page.waitForTimeout(600);
  check((await page.locator('#title .tgo').innerText()) === 'New adventure' && (await page.locator('#title .tlogo').innerText()) === 'Raid Leader', '切換英文後重新載入');
  await page.screenshot({ path: `${shots}/i18n-title-en.png` });
  await page.click('#title .tgo'); await page.waitForTimeout(400);
  const l1 = await page.locator('.dlg p').innerText();
  check(l1.startsWith('The frontier guild'), '序章第一句：' + l1);
  await page.screenshot({ path: `${shots}/i18n-dialog.png` });
  for (let i = 0; i < 4; i++) { await page.click('.dlg [data-act="dlgnext"].btn'); await page.waitForTimeout(150); }
  check((await page.locator('.sheet h3').innerText()) === 'Your nickname', '序章後跳出暱稱（英文）');
  await page.click('[data-act="skipnick"]'); await page.waitForTimeout(200);
  const txt = await page.locator('body').innerText();
  check(!CJK.test(txt), '新遊戲副本頁沒有中文' + (CJK.test(txt) ? '：' + txt.split('\n').filter(l => CJK.test(l)).slice(0, 5).join(' / ') : ''));
  await page.reload(); await page.waitForTimeout(400);
  check(!(await page.locator('#title').count()), '同一工作階段重新整理不再顯示開始畫面');
  check(!errs.length, '無 JS 錯誤 ' + errs.join(';'));
  await page.close();
}
// B) 後期存檔（英文）：各分頁截圖、找殘留中文
{
  const { s } = playthrough({ talents: true });
  s.lastSeen = Date.now(); s.idle = null; s.player = { pid: 'abcdefgh1234', name: 'Tester', asked: true, playSec: 0 };
  s.mythic.best = { 0: { level: 5, time: 120 } }; s.dust = 40;
  const page = await browser.newPage({ viewport: { width: 375, height: 760 } }); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(v => { (sessionStorage.setItem('rl-title', '1'), sessionStorage.setItem('rl-e2e', '1')); localStorage.setItem('raid-leader-lang', 'en'); if (!sessionStorage.getItem('seeded')) { localStorage.setItem('raid-leader-save-v1', v); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(s));
  await route(page); await page.goto('https://app.test/'); await page.waitForTimeout(500);
  const leftovers = new Set();
  const scan = async tag => { for (const l of (await page.locator('body').innerText()).split('\n')) if (CJK.test(l) && !l.includes('繁體中文')) leftovers.add(tag + ': ' + l.trim().slice(0, 80)); };
  for (const tab of ['dungeon', 'team', 'bag', 'tavern']) {
    await page.click(`[data-tab="${tab}"]`); await page.waitForTimeout(200); await scan(tab);
    await page.screenshot({ path: `${shots}/i18n-${tab}.png`, fullPage: true });
  }
  await page.click('[data-tab="team"]'); await page.locator('.party .slot').first().click(); await page.waitForTimeout(200); await scan('hero');
  await page.screenshot({ path: `${shots}/i18n-hero.png` });
  await page.click('.sheet [data-v="talent"]'); await page.waitForTimeout(200); await scan('talent');
  await page.screenshot({ path: `${shots}/i18n-talent.png` });
  await page.click('.scrim', { position: { x: 5, y: 5 } });
  await page.click('[data-act="settings"]'); await page.waitForTimeout(200); await scan('settings');
  check((await page.locator('.sheet h3').innerText()) === 'Settings', '點標題開啟設定（英文）');
  await page.screenshot({ path: `${shots}/i18n-settings.png` });
  await page.click('[data-act="close-settings"]');
  await page.click('[data-tab="dungeon"]'); await nav(page, 'story0'); await page.click('.dg [data-act="fight"][data-d="3"]'); await page.waitForTimeout(2500); await scan('battle');
  await page.screenshot({ path: `${shots}/i18n-battle.png` });
  await page.click('[data-act="skip"]'); await page.waitForTimeout(300); await scan('result');
  await page.screenshot({ path: `${shots}/i18n-result.png`, fullPage: true });
  console.log('殘留中文（人名、舊存檔的裝備名除外）：'); for (const l of leftovers) console.log('  ', l);
  check(!errs.length, '無 JS 錯誤 ' + errs.join(';'));
}
await browser.close();
if (fails.length) process.exit(1);
