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
// v0.16：裝備基底＋詞綴、舊存檔補基底、圖鑑與收集獎勵
import * as G from '../src/core/index.js';
(async () => {
  const fails = [], check = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) fails.push(m); };
  // 核心：新裝備有基底與詞綴，名稱由代號組成；詞綴總量大致守恆
  const its = Array.from({ length: 400 }, () => G.makeItem('weapon', 40, 3));
  check(its.every(i => G.BASE_INFO[i.base] && G.GEAR_AFFIX[i.affix]), '新裝備都有基底與詞綴');
  check(new Set(its.map(i => i.affix)).size >= 7, '史詩可以出現多種詞綴（含完美的）：' + [...new Set(its.map(i => i.affix))].join(','));
  const st = G.makeSetItem('mage', 'head', 60); check(!st.base && !st.affix && G.codexKey(st) === 'set:mage:head', '套裝沒有詞綴，圖鑑以職業＋部位計');
  check(G.codexAllKeys().length === 42 * 5 + 24, '圖鑑共 234 格（v0.19 +2 種基底）');
  // 舊存檔：沒有 base 的裝備由名稱回填
  const s = G.newGame(); s.player.asked = true; s.story.seen.push('pre0');
  s.items.old1 = { id: 'old1', slot: 'weapon', ilvl: 20, rarity: 2, up: 0, pow: 10, sta: 10, crit: 0, name: '灼熱的長劍' }; s.bag.push('old1');
  const m = G.migrate(JSON.parse(JSON.stringify(s)));
  check(m.items.old1.base === 'longsword' && m.codex['longsword:2'], '舊裝備回填基底並登錄圖鑑');
  // 頁面：圖鑑分頁與領獎
  s.codex = {}; const keys = G.codexAllKeys(); for (const k of keys.slice(0, Math.ceil(keys.length * 0.26))) s.codex[k] = 1;
  const browser = await chromium.launch(), errs = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 820 } });
  await page.addInitScript(v => { sessionStorage.setItem('rl-title', '1'); if (!sessionStorage.getItem('seeded')) { localStorage.setItem('raid-leader-save-v1', v); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(s));
  page.on('pageerror', e => errs.push(e.message)); await page.route('**/*', serve);
  await page.goto('https://app.test/'); await page.waitForTimeout(1200);
  for (let i = 0; i < 3; i++) await page.locator('[data-act="dlgskip"]').click({ timeout: 500 }).catch(() => {});
  await page.click('[data-tab="bag"]'); await page.waitForTimeout(150);
  check((await page.locator('.item', { hasText: '長劍' }).first().innerText()).includes('灼焰長劍'), '舊裝備改用新命名顯示');
  await page.click('[data-act="bagview"][data-v="codex"]'); await page.waitForTimeout(150);
  check(await page.locator('.cxrow').count() === 42 + 6, '圖鑑列出 42 種基底＋6 套套裝');
  check(await page.locator('.cxm.ready').count() === 1, '收集 26%：25% 獎勵可領');
  const g0 = await page.locator('#gold').innerText();
  await page.click('.cxm.ready'); await page.waitForTimeout(200);
  check(await page.locator('.cxm.done').count() === 1 && (await page.locator('#gold').innerText()) !== g0, '領取 25% 獎勵');
  await page.screenshot({ path: '/tmp/claude-0/v016-codex.png', fullPage: true });
  check(!errs.length, '無 JS 錯誤 ' + errs.join(';'));
  await browser.close(); process.exit(fails.length ? 1 : 0);
})();
