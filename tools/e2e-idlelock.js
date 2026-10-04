// v0.7.1 測試：掛機中鎖定陣容（加入／移出／解雇出戰者擋下、備戰只調天賦裝備、招募不自動入隊、挑戰別層會停掛機）
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
const { s } = playthrough({ talents: true });
s.lastSeen = Date.now(); s.idle = null; s.gold = 60000; s.player = { pid: 'abcdefgh1234', name: '測試', asked: true, playSec: 0 };
s.heroes = s.heroes.slice(0, 6); s.party = s.heroes.slice(0, 4).map(h => h.id); // 4 人出戰、2 人待命、1 空位

const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 375, height: 760 } }); await page.addInitScript(() => sessionStorage.setItem('rl-title', '1'));
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(v => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('raid-leader-save-v1', v); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(s));
await page.route('**/*', r => { const u = new URL(r.request().url()); if (u.host !== 'app.test') return r.abort();
  const f = path.join(root, u.pathname === '/' ? entry : u.pathname.slice(1));
  return r.fulfill({ body: fs.readFileSync(f), contentType: types[path.extname(f)] }); });
await page.goto('https://app.test/'); await page.waitForTimeout(500);
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('raid-leader-save-v1')));
const toastText = async () => (await page.locator('#toast').innerText().catch(() => '')).trim();
const fails = [], check = (ok, msg) => { console.log((ok ? '✅ ' : '❌ ') + msg); if (!ok) fails.push(msg); };
const party0 = (await saved()).party.join(), roster0 = (await saved()).heroes.length;

// 開始掛機第 1 層
await page.click('[data-tab="dungeon"]'); await nav(page, 'story0'); await page.click('.dg [data-act="idle"][data-d="0"]'); await page.waitForTimeout(300);
check((await saved()).idle === 0, '掛機開始');
// 備戰第 3 層：陣容不變
await page.click('[data-tab="dungeon"]'); await nav(page, 'story0'); await page.click('.dg [data-act="prepare"][data-d="2"]'); await page.waitForTimeout(200);
check((await saved()).party.join() === party0, '掛機中備戰不換陣容｜' + await toastText());
// 團隊頁：鎖定提示、英雄抽屜按鈕停用
await page.click('[data-tab="team"]');
check((await page.locator('main').innerText()).includes('陣容已鎖定'), '團隊頁顯示鎖定');
await page.locator('.stack .hero').last().click(); await page.waitForTimeout(200);
const lockBtn = page.locator('.sheet button', { hasText: '掛機時無法更換隊員' });
check(await lockBtn.count() === 1 && await lockBtn.isDisabled(), '待命英雄抽屜：加入按鈕停用');
check(await page.locator('.sheet [data-act="join"], .sheet [data-act="bench"], .sheet [data-act="fire"]').count() === 0, '抽屜沒有加入/移出/解雇');
await page.click('.scrim', { position: { x: 5, y: 5 } });
// 招募不會自動入隊
await page.click('[data-tab="tavern"]'); await page.click('[data-act="scroll"][data-n="1"]'); await page.waitForTimeout(300);
let sv = await saved();
check(sv.party.join() === party0 && sv.heroes.length === roster0 + 1, '掛機中招募只進名冊｜' + sv.heroes.length + ' ' + sv.party.length + ' ' + await toastText());
await page.keyboard.press('Escape'); await page.goto('https://app.test/'); await page.waitForTimeout(400);
// 挑戰別層會停掛機，之後可以換人
await page.click('[data-tab="dungeon"]'); await nav(page, 'story0'); await page.click('.dg [data-act="fight"][data-d="1"]'); await page.waitForTimeout(300);
sv = await saved(); check(sv.idle == null, '挑戰別層自動停止掛機｜idle=' + sv.idle + ' unlocked=' + sv.unlocked);
await page.click('[data-tab="dungeon"]'); await nav(page, 'story0'); await page.click('.dg [data-act="prepare"][data-d="2"]'); await page.waitForTimeout(200);
check((await saved()).party.length === 5, '停掛機後備戰會補滿陣容');
// 英雄抽屜：單人一鍵配裝（全部卸下後再配回來）
await page.click('[data-tab="team"]'); await page.locator('.party .slot').first().click(); await page.waitForTimeout(200);
await page.click('.sheet [data-act="unequipall"]'); await page.waitForTimeout(200);
const btnTxt = await page.locator('.sheet [data-act="autoequip1"]').innerText();
await page.click('.sheet [data-act="autoequip1"]'); await page.waitForTimeout(200);
const sv2 = await saved(), h0 = sv2.heroes.find(h => h.id === sv2.party[0]);
check(/一鍵配裝（\d+ 件更好）/.test(btnTxt) && Object.values(h0.gear).filter(Boolean).length >= 3 && await page.locator('.sheet [data-act="autoequip1"]').isDisabled(), '單人一鍵配裝｜' + btnTxt + '→' + await toastText());
await page.screenshot({ path: (process.env.SHOTS || '/tmp/claude-0') + '/m72-hero.png' });
check(!errs.length, '無 JS 錯誤 ' + errs.join(';'));
await browser.close();
if (fails.length) process.exit(1);
