// v0.7 測試：寶庫（三次用完）、招募令單抽/十連、保底倒數、傳奇顯示、英雄稀有度、解雇退款
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
const { s } = playthrough({ talents: true });
s.lastSeen = Date.now(); s.idle = null; s.gold = 60000; s.player = { pid: 'abcdefgh1234', name: '測試', asked: true, playSec: 0, bindAsked: 1 };
s.heroes = s.heroes.slice(0, 5); s.party = s.party.filter(id => s.heroes.some(h => h.id === id));
s.recruit = { sinceEpic: 0, sinceLegend: 95, total: 95 }; // 再 5 抽保底傳說

const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 375, height: 760 }, deviceScaleFactor: 2 }); await page.addInitScript(() => (sessionStorage.setItem('rl-title', '1'), sessionStorage.setItem('rl-e2e', '1')));
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(v => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('raid-leader-save-v1', v); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(s));
await page.route('**/*', r => { const u = new URL(r.request().url()); if (u.host !== 'app.test') return r.abort();
  const f = path.join(root, u.pathname === '/' ? entry : u.pathname.slice(1));
  return r.fulfill({ body: fs.readFileSync(f), contentType: types[path.extname(f)] }); });
await page.goto('https://app.test/'); await page.waitForTimeout(500);
const out = [], saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('raid-leader-save-v1')));
await nav(page, 'vault');
out.push('寶庫區塊：' + (await page.locator('.vault .vleft').innerText()) + '｜樓層按鈕 ' + await page.locator('.vfloors button').count());
await page.screenshot({ path: `${shots}/m7-dungeon.png` });
await page.click('.vault [data-act="prepare-vault"]');
for (let i = 0; i < 3; i++) {
  await page.click('[data-tab="dungeon"]'); await nav(page, 'vault'); await page.click('.vault [data-act="vault"]'); await page.waitForTimeout(1200);
  if (i === 0) { await page.click('[data-act="horn"]'); await page.click('[data-act="speed"][data-x="4"]'); await page.waitForTimeout(3000); out.push('寶庫戰鬥：' + (await page.locator('.vaultcount').innerText()).replace(/\n/g, ' ')); await page.screenshot({ path: `${shots}/m7-vault.png` }); }
  await page.click('[data-act="skip"]'); await page.waitForTimeout(300);
  out.push(`第 ${i + 1} 次：` + await page.locator('.result h3').innerText() + '｜' + (await page.locator('.rew').innerText()).replace(/\n/g, ' '));
}
out.push('次數用完後：' + await page.locator('.result .row').innerText());
await page.click('[data-tab="dungeon"]'); await nav(page, 'vault'); out.push('寶庫按鈕：' + await page.locator('.vault [data-act="vault"]').innerText() + '｜停用 ' + await page.locator('.vault [data-act="vault"]').isDisabled());
await page.click('[data-tab="tavern"]');
out.push('保底倒數：' + await page.locator('.recruit .sub').first().innerText());
await page.click('[data-act="scroll"][data-n="10"]'); await page.waitForTimeout(300);
out.push('十連結果：' + await page.locator('.sheet h3').innerText() + '｜' + (await page.locator('.drawcard .rtag').allInnerTexts()).join(','));
await page.screenshot({ path: `${shots}/m7-draw.png` });
await page.click('[data-act="closebtn"]');
let sv = await saved(); const leg = sv.heroes.find(h => h.legend);
out.push('傳奇入隊：' + (leg ? `${leg.name}（${leg.cls}）` : '無') + '｜保底計數 ' + JSON.stringify(sv.recruit));
out.push('傳奇清單已招募數：' + await page.locator('.hero.r-4 .nm small').filter({ hasText: '已招募' }).count());
out.push('名冊滿時單抽停用：' + await page.locator('[data-act="scroll"][data-n="1"]').isDisabled());
await page.click('[data-tab="team"]');
if (leg) { await page.locator(`[data-act="hero"][data-id="${leg.id}"]`).first().click(); out.push('英雄抽屜：' + (await page.locator('.raritycard').innerText()).replace(/\n/g, ' ')); await page.screenshot({ path: `${shots}/m7-legend.png` }); await page.keyboard.press('Escape'); }
const g0 = (await saved()).gold; await page.locator('.stack .hero').last().click(); await page.click('.sheet [data-act="fire"]');
out.push('解雇確認：' + await page.locator('.sheet [data-act="fire"]').innerText()); await page.click('.sheet [data-act="fire"]');
out.push('退款：' + ((await saved()).gold - g0));
await page.click('[data-tab="tavern"]'); await page.click('[data-act="scroll"][data-n="1"]'); await page.waitForTimeout(200);
out.push('解雇後單抽：' + (await page.locator('.drawcard .rtag').allInnerTexts()).join(','));
console.log(out.join('\n') + '\nERRORS: ' + JSON.stringify(errs));
await browser.close();
