// 補充測試：解雇、分解普通、匯出 / 匯入存檔、重新開始
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = process.argv[2] || 'index.html';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 400, height: 820 } });
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.route('**/*', r => { const u = new URL(r.request().url()); if (u.host !== 'app.test') return r.abort();
  const f = path.join(root, u.pathname === '/' ? entry : u.pathname.slice(1));
  return r.fulfill({ body: fs.readFileSync(f), contentType: types[path.extname(f)] }); });
await page.goto('https://app.test/'); await page.waitForTimeout(400);
const out = [], gold = async () => +(await page.locator('#gold').innerText()).replace(/,/g, '');
for (let i = 0; i < 6; i++) { await page.click('[data-act="fight"][data-d="0"]').catch(() => page.click('.result [data-act="fight"]')); await page.click('[data-act="skip"]'); }
await page.click('[data-tab="bag"]');
const before = await page.locator('.item').count(), g0 = await gold();
await page.click('[data-act="salvageupto"][data-v="1"]');
out.push(`分解精良以下：背包 ${before} → ${await page.locator('.item').count()}，金幣 ${g0} → ${await gold()}`);
await page.click('[data-act="autosalv"][data-v="2"]'); await page.click('[data-act="keeprar"][data-v="1"]');
out.push('設定：' + JSON.stringify(await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('raid-leader-save-v1')); return [s.autoSalvageBelow, s.keepRarity]; })));
// 塞滿背包測試戰利品箱
await page.evaluate(() => { const k = 'raid-leader-save-v1', s = JSON.parse(localStorage.getItem(k)); s.autoSalvageBelow = 0; s.keepRarity = 0;
  for (let i = 0; i < 60; i++) { const id = 'x' + i; s.items[id] = { id, slot: 'weapon', ilvl: 3, rarity: i % 4, up: 0, pow: 2, sta: 3, crit: 0, name: '測試劍' }; (s.bag.length < 50 ? s.bag : s.stash).push(id); }
  localStorage.setItem(k, JSON.stringify(s)); Storage.prototype.setItem = () => {}; }); // 擋住離開頁面時的自動存檔
await page.reload(); await page.waitForTimeout(400); await page.click('[data-tab="bag"]');
out.push('戰利品箱：' + (await page.locator('.stashbox').innerText()).split('\n').slice(0, 2).join(' '));
await page.click('[data-act="salvageupto"][data-v="0"]'); await page.click('[data-act="takestash"]');
out.push('取出後背包：' + await page.locator('h2 .sub').first().innerText() + '，箱內剩 ' + await page.evaluate(() => JSON.parse(localStorage.getItem('raid-leader-save-v1')).stash.length));
await page.click('[data-act="salvagestash"]').catch(() => {}); out.push('分解箱後還有箱子：' + await page.locator('.stashbox').count());
await page.click('[data-tab="team"]');
const n0 = await page.locator('.stack .hero').count();
await page.locator('.stack .hero').last().click();
await page.click('.sheet [data-act="fire"]'); out.push('解雇確認文字：' + await page.locator('.sheet [data-act="fire"]').innerText());
await page.click('.sheet [data-act="fire"]');
out.push(`解雇：名冊 ${n0} → ${await page.locator('.stack .hero').count()}`);
await page.click('[data-act="export"]'); const code = await page.locator('#expTxt').inputValue();
await page.click('[data-act="closebtn"]'); out.push('匯出存檔碼長度：' + code.length);
await page.click('[data-act="reset"]'); await page.click('[data-act="doreset"]');
await page.click('[data-tab="team"]'); out.push('重新開始後名冊：' + await page.locator('.stack .hero').count());
await page.click('[data-act="import"]'); await page.fill('#impTxt', code); await page.click('[data-act="doimport"]');
out.push('匯入後名冊：' + await page.locator('.stack .hero').count());
console.log(out.join('\n') + '\nERRORS: ' + JSON.stringify(errs));
await browser.close();
