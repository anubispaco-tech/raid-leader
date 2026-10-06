// v0.10.0 測試：薩滿（專精二選一、職責切換、嗜血、英文）
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
const G = await import('../src/core/index.js');
s.party = G.partyHeroes(s).map(h => h.id).slice(0, 5);
const sh = G.makeHero('shaman', 20, 0); sh.name = '薩滿測'; s.heroes.push(sh);
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 375, height: 760 } }); await page.addInitScript(() => (sessionStorage.setItem('rl-title', '1'), sessionStorage.setItem('rl-e2e', '1')));
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(v => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('raid-leader-save-v1', v); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(s));
await page.route('**/*', r => { const u = new URL(r.request().url()); if (u.host !== 'app.test') return r.abort();
  const f = path.join(root, u.pathname === '/' ? entry : u.pathname.slice(1));
  return r.fulfill({ body: fs.readFileSync(f), contentType: types[path.extname(f)] }); });
await page.goto('https://app.test/'); await page.waitForTimeout(500);
await page.click('[data-act="dtoggle"]').catch(() => {});
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('raid-leader-save-v1')));
const fails = [], check = (ok, msg) => { console.log((ok ? '✅ ' : '❌ ') + msg); if (!ok) fails.push(msg); };
const shot = n => (process.env.SHOTS || '/tmp/claude-0') + '/' + n;
await page.click('[data-tab="tavern"]');
check((await page.locator('main').innerText()).includes('薩滿'), '職業圖鑑有薩滿');
await page.click('[data-tab="team"]');
await page.locator('.hero', { hasText: '薩滿測' }).click(); await page.waitForTimeout(200);
await page.click('.sheet [data-v="talent"]'); await page.waitForTimeout(200);
check(await page.locator('.sheet [data-act="spec"]').count() === 2, '專精二選一');
await page.screenshot({ path: shot('shaman-talent.png') });
for (const [k, role] of [['resto', '・治療'], ['elemental', '・輸出']]) {
  await page.click(`.sheet [data-act="spec"][data-v="${k}"]`); await page.waitForTimeout(150);
  const sub = await page.locator('.sheet .sub').first().innerText();
  check(sub.includes(role), `${k} → ${role}：${sub.slice(0, 30)}`);
}
await page.click('.scrim', { position: { x: 5, y: 5 } });
// 換掉一位法師，元素薩滿上場
const sv = await saved(); const m = sv.heroes.find(h => h.cls === 'mage' && sv.party.includes(h.id)) || sv.heroes.find(h => sv.party.includes(h.id) && h.cls === 'rogue');
await page.locator('.hero', { hasText: m.name }).first().click(); await page.click('.sheet [data-act="bench"]'); await page.click('.scrim', { position: { x: 5, y: 5 } });
await page.locator('.hero', { hasText: '薩滿測' }).click(); await page.click('.sheet [data-act="join"]'); await page.click('.scrim', { position: { x: 5, y: 5 } });
check((await saved()).party.length === 5, '薩滿入隊');
await page.click('[data-tab="dungeon"]'); await nav(page, 'story0'); await page.click('.dg [data-act="fight"][data-d="1"]'); await page.waitForTimeout(800);
await page.click('[data-act="skip"]'); await page.waitForTimeout(600);
await page.click('[data-tab="battle"]').catch(() => {}); await page.waitForTimeout(200);
const res = await page.locator('main').innerText();
check(res.includes('薩滿測'), '結算有薩滿');
// 直接檢查核心：首領戰有嗜血，一隊只一次
const st = await saved();
const party = G.partyHeroes(st);
const b = new G.Battle(party, st.items, 1, { autoHorn: true }).runToEnd();
const lust = b.log.filter(l => l.msg.includes('嗜血')).length;
check(lust === 1, '嗜血一場一次：' + (b.log.find(l => l.msg.includes('嗜血')) || {}).msg);
const two = [...party, { ...G.makeHero('shaman', 20, 4), spec: 'resto' }].slice(-5);
const b2 = new G.Battle(two, st.items, 1, { autoHorn: true }).runToEnd();
check(b2.log.filter(l => l.msg.includes('施放嗜血')).length <= 1, '兩位薩滿也只發動一次');
// 英文
await page.evaluate(() => localStorage.setItem('raid-leader-lang', 'en')); await page.reload(); await page.waitForTimeout(600);
await page.click('[data-tab="tavern"]');
check((await page.locator('main').innerText()).includes('Shaman'), '英文顯示 Shaman');
check(!errs.length, '無 JS 錯誤 ' + errs.join(';'));
await browser.close();
if (fails.length) process.exit(1);
