// v0.9.2 測試：護甲四件、T0 套裝（掉落、配裝、效果顯示）、舊存檔護甲轉胸甲
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
const fails = [], check = (ok, msg) => { console.log((ok ? '✅ ' : '❌ ') + msg); if (!ok) fails.push(msg); };
// Node：第二章掉落套裝、舊存檔轉換
{
  G.setSeed(9);
  const { s } = playthrough({ talents: true });
  let sets = 0; const b = { win: true, tick: 60 };
  for (let i = 0; i < 200; i++) { const r = G.applyResult(s, 8, b); sets += r.loot.filter(it => it.set).length; }
  check(sets > 15 && sets < 50, `第二章 200 場勝利掉落套裝 ${sets} 件（約 15%）`);
  const old = JSON.parse(JSON.stringify(s)); const h = old.heroes[0]; const id = h.gear.chest || Object.keys(old.items)[0];
  old.items[id].slot = 'armor'; h.gear = { weapon: h.gear.weapon, armor: id, trinket: h.gear.trinket };
  G.migrate(old);
  check(old.items[id].slot === 'chest' && old.heroes[0].gear.chest === id && !('armor' in old.heroes[0].gear) && 'head' in old.heroes[0].gear, '舊存檔：護甲 → 胸甲、補上頭手腿欄位');
  G.setSeed(null);
}
const { s } = playthrough({ talents: true });
s.lastSeen = Date.now(); s.idle = null; s.gold = 60000; s.player = { pid: 'abcdefgh1234', name: '測試', asked: true, playSec: 0 };
const g = G.partyHeroes(s).find(h => h.cls === 'guardian');
for (const sl of G.ARMOR_SLOTS) { const it = G.makeSetItem('guardian', sl, 60); s.items[it.id] = it; s.bag.push(it.id); }
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 375, height: 760 } }); await page.addInitScript(() => (sessionStorage.setItem('rl-title', '1'), sessionStorage.setItem('rl-e2e', '1')));
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(v => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('raid-leader-save-v1', v); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(s));
await page.route('**/*', r => { const u = new URL(r.request().url()); if (u.host !== 'app.test') return r.abort();
  const f = path.join(root, u.pathname === '/' ? entry : u.pathname.slice(1));
  return r.fulfill({ body: fs.readFileSync(f), contentType: types[path.extname(f)] }); });
await page.goto('https://app.test/'); await page.waitForTimeout(500);
const shot = n => (process.env.SHOTS || '/tmp/claude-0') + '/' + n;
await page.click('[data-tab="bag"]'); await page.click('[data-act="filter"][data-v="set"]');
check(await page.locator('.item').count() === 4 && (await page.locator('.item .settag').count()) === 4, '背包「套裝」篩選：4 件');
await page.locator('.item').first().click(); await page.waitForTimeout(150);
check((await page.locator('.sheet').innerText()).includes('深淵守望者'), '裝備抽屜顯示套裝效果');
await page.click('.scrim', { position: { x: 5, y: 5 } });
await page.click('[data-tab="team"]'); await page.locator('.party .slot').first().click(); await page.waitForTimeout(150);
check(await page.locator('.sheet .gearrow').count() === 6, '裝備欄 6 格（武器、頭、胸、手、腿、飾品）');
await page.click('.sheet [data-act="autoequip1"]'); await page.waitForTimeout(200);
const line = await page.locator('.sheet .setline').innerText();
check(line.includes('4/4') && (await page.locator('.sheet .setline .on').count()) === 2, '一鍵配裝穿上 4 件：' + line.replace(/\n/g, ' '));
await page.screenshot({ path: shot('sets-hero.png') });
const sv = await page.evaluate(() => JSON.parse(localStorage.getItem('raid-leader-save-v1')));
const gh = sv.heroes.find(h => h.cls === 'guardian' && sv.party.includes(h.id));
check(G.setCount(gh, sv.items) === 4 && G.setMods(gh, sv.items).setDmg === 0.15, '套裝效果生效（4 件：受傷 −15%、傷害 +15%）');
check(!errs.length, '無 JS 錯誤 ' + errs.join(';'));
await browser.close();
if (fails.length) process.exit(1);
