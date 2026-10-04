// v0.7.3 測試：一鍵解雇（只動待命、傳說保留、自動卸裝、背包滿進戰利品箱）、名冊上限 30
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
const { s } = playthrough({ talents: true });
s.lastSeen = Date.now(); s.idle = null; s.gold = 60000; s.player = { pid: 'abcdefgh1234', name: '測試', asked: true, playSec: 0 };
s.party = s.heroes.slice(0, 5).map(h => h.id);
// 把出戰隊員的裝備複製成 3 位待命英雄（普通／精良／傳說），各穿 3 件裝備
const proto = s.heroes[0];
[0, 1, 4].forEach((r, i) => { const h = JSON.parse(JSON.stringify(proto)); h.id = 'bench' + i; h.rarity = r; h.legend = r === 4; h.gear = {};
  for (const sl of ['weapon', 'chest', 'trinket']) { const it = { ...s.items[proto.gear[sl]], id: `bi${i}${sl}` }; s.items[it.id] = it; h.gear[sl] = it.id; }
  s.heroes.push(h); });
s.idle = 0; // 掛機中也能一鍵解雇待命英雄

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
const sv0 = await saved(), roster0 = sv0.heroes.length, bag0 = sv0.bag.length, gold0 = sv0.gold;
await page.click('[data-tab="team"]');
check((await page.locator('main').innerText()).includes(`${roster0}/30`), '名冊上限 30');
const sel = page.locator('#fireSel'); await sel.selectOption('1'); await page.waitForTimeout(150);
const b1 = await page.locator('[data-act="firemany"]').innerText();
await page.click('[data-act="firemany"]'); await page.waitForTimeout(150);
const b2 = await page.locator('[data-act="firemany"]').innerText();
await page.click('[data-act="firemany"]'); await page.waitForTimeout(250);
const sv = await saved(), msg = await toastText();
check(b1.includes('2 人') && b2.includes('確定解雇 2 人'), '按鈕與確認｜' + b1 + '→' + b2);
check(sv.heroes.length === roster0 - 2 && sv.heroes.some(h => h.id === 'bench2') && sv.party.length === 5, '只解雇普通、精良待命，傳說與出戰保留');
check(sv.bag.length + sv.stash.length === bag0 + sv0.stash.length + 6 || msg.includes('分解'), '6 件裝備自動卸下｜' + msg);
check(sv.gold > gold0, '有退款');
await sel.selectOption('3'); await page.waitForTimeout(150);
check(await page.locator('[data-act="firemany"]').isDisabled(), '剩傳說時按鈕停用');
await page.screenshot({ path: (process.env.SHOTS || '/tmp/claude-0') + '/m73-team.png' });
check(!errs.length, '無 JS 錯誤 ' + errs.join(';'));
await browser.close();
if (fails.length) process.exit(1);
