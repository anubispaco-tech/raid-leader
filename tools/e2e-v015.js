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
// v0.15：秘境引導、團隊分區與篩選、金幣擴充背包、分解返還、套裝簡述
import * as G from '../src/core/index.js';
import { playthrough } from './sim-lib.js';
(async () => {
  const fails = [], check = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) fails.push(m); };
  // 核心：分解返還 80%
  const it = { id: 'x', slot: 'weapon', name: 'x', rarity: 1, ilvl: 40, up: 0, stats: {} }, base = G.salvageValue(it);
  it.up = 5; check(G.salvageValue(it) === base + Math.floor(G.upSpent(it) * 0.8), `強化 +5 分解返還 80%（${base} → ${G.salvageValue(it)}）`);
  // 存檔：通關第 7 層、秘境還沒限時過、金幣充足
  const { s } = playthrough({ talents: true }); s.gold = 50000; s.mythic.best = {}; s.player.asked = true; s.story.seen.push('pre0', 'post6');
  for (const [i, h] of s.heroes.slice(0, 4).entries()) s.heroes.push({ ...h, id: 'bench' + i, gear: Object.fromEntries(Object.keys(h.gear).map(k => [k, null])) }); // 4 位待命英雄
  const browser = await chromium.launch(), errs = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 820 } });
  await page.addInitScript(v => { sessionStorage.setItem('rl-title', '1'); if (!sessionStorage.getItem('seeded')) { localStorage.setItem('raid-leader-save-v1', v); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(s));
  page.on('pageerror', e => errs.push(e.message)); await page.route('**/*', serve);
  await page.goto('https://app.test/'); await page.waitForTimeout(1200);
  for (let i = 0; i < 3; i++) await page.locator('[data-act="dlgskip"]').click({ timeout: 500 }).catch(() => {});
  await page.click('[data-tab="dungeon"]'); await page.click('[data-act="mode"][data-v="mythic"]'); await page.waitForTimeout(200);
  check(await page.locator('.mguide').count() === 1, '第一次進秘境：顯示說明卡');
  check(await page.locator('.mrow2').count() === 1 && await page.locator('.mrow2.sug .sugtag').count() === 1, '還沒限時過：只顯示 1 個推薦副本');
  await page.screenshot({ path: '/tmp/claude-0/v015-mythic.png', fullPage: true });
  await page.click('[data-act="mythicall"]'); await page.waitForTimeout(150);
  check(await page.locator('.mrow2').count() === G.CH1_TOP + 1, '展開後顯示全部副本');
  await page.click('[data-act="mythichelpok"]'); await page.waitForTimeout(150);
  check(await page.locator('.mguide').count() === 0 && await page.locator('[data-act="mythichelp"]').count() === 1, '按「知道了」收起說明，留下說明連結');
  await page.click('[data-tab="team"]'); await page.waitForTimeout(200);
  check(await page.locator('.rhead').count() === 2, '團隊頁分成出戰隊伍與待命兩區');
  const benchAll = await page.locator('.rhead:not(.in) ~ .hero').count();
  await page.click('[data-act="teamfilter"][data-v="heal"]'); await page.waitForTimeout(150);
  const benchHeal = await page.locator('.rhead:not(.in) ~ .hero').count();
  check(benchAll >= 4 && benchHeal >= 1 && benchHeal < benchAll, `職業篩選生效（待命 ${benchAll} → 補 ${benchHeal}）`);
  await page.screenshot({ path: '/tmp/claude-0/v015-team.png', fullPage: true });
  await page.click('[data-tab="bag"]'); await page.waitForTimeout(200);
  const cap0 = await page.evaluate(() => document.querySelector('h2 .sub').textContent);
  await page.click('[data-act="buybag"]'); await page.waitForTimeout(200);
  const cap1 = await page.evaluate(() => document.querySelector('h2 .sub').textContent);
  check(+cap1.split('/')[1] === +cap0.split('/')[1] + 10, `金幣擴充背包 +10 格（${cap0} → ${cap1}）`);
  check(!errs.length, '無 JS 錯誤 ' + errs.join(';'));
  await browser.close(); process.exit(fails.length ? 1 : 0);
})();
