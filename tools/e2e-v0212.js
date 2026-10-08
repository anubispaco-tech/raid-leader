// v0.21.2 測試：深淵秘境掛機勝利會掉職業套裝（機率約 SET_DROP.idle，裝等跟著秘境）、傳奇秘境掛機不掉、
// 主畫面名稱英文、每日卡片在手機寬度不再被「可能掉落」樣式擠成 64px
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as G from '../src/core/index.js';
import { setSeed } from '../src/core/rng.js';
import { playthrough } from './sim-lib.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [], check = (ok, msg) => { console.log((ok ? '✅ ' : '❌ ') + msg); if (!ok) fails.push(msg); };

// 1. 深淵掛機套裝（直接呼叫核心結算，不跑戰鬥）
setSeed(4242);
const { s } = playthrough({ talents: true, stopAt: 3 });
const abyss = G.DUNGEONS.findIndex((_, i) => G.mythicTier(i) === 2), myth = G.DUNGEONS.findIndex((_, i) => G.mythicTier(i) === 1);
const runIdle = (dIdx, level, win) => {
  s.bag = []; s.stash = []; // 不讓背包滿影響計數
  return G.applyMythicIdleResult(s, { mythic: { level, dIdx }, win });
};
let sets = 0, wins = 2000, ilvlOk = true;
for (let i = 0; i < wins; i++) {
  const r = runIdle(abyss, 20, true);
  const st = r.loot.filter(it => it.set);
  sets += st.length;
  if (st.length && st[0].ilvl !== r.loot[0].ilvl) ilvlOk = false;
}
const rate = sets / wins;
check(Math.abs(rate - G.SET_DROP.idle) < 0.025, `深淵掛機勝利掉套裝機率 ${(rate * 100).toFixed(1)}%（設定 ${G.SET_DROP.idle * 100}%）`);
check(ilvlOk, '套裝裝等跟秘境掉落一樣（+20 約 ' + (G.MYTHIC.ch2.dropBase + G.MYTHIC.ch2.dropPerLevel * 20) + '）');
let lose = 0; for (let i = 0; i < 300; i++) lose += runIdle(abyss, 20, false).loot.filter(it => it.set).length;
check(lose === 0, '掛機失敗不掉套裝');
let m1 = 0; for (let i = 0; i < 500; i++) m1 += runIdle(myth, 10, true).loot.filter(it => it.set).length;
check(m1 === 0, '傳奇秘境（第一章）掛機不掉套裝');

// 2. 部署檔案：主畫面名稱
const man = JSON.parse(fs.readFileSync(path.join(root, 'public/manifest.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
check(man.name === 'RAID LEADER' && man.short_name === 'RAID LEADER' && html.includes('apple-mobile-web-app-title" content="RAID LEADER"'), '加到主畫面的名稱是 RAID LEADER');

// 3. 每日卡片排版（390px）
const { s: sv } = playthrough({ talents: true, stopAt: 3 });
sv.lastSeen = Date.now(); sv.idle = null; sv.player = { pid: 'dailytest01', name: '測試', asked: true, playSec: 600, src: 'old', bindAsked: 1 };
sv.story = sv.story || { seen: [] }; for (let i = 0; i < 14; i++) sv.story.seen.push('pre' + i, 'post' + i);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.addInitScript(v => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('raid-leader-save-v1', v); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(sv));
await page.route('**/*', r => { const u = new URL(r.request().url()); if (u.host !== 'app.test') return r.abort();
  const f = path.join(root, 'public', u.pathname === '/' ? 'index.html' : u.pathname.slice(1));
  return r.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); });
await page.goto('https://app.test/'); await page.waitForTimeout(1500);
if (await page.locator('[data-act="titlego"]').count()) { await page.click('[data-act="titlego"]'); await page.waitForTimeout(800); }
const w = await page.evaluate(() => { const r = document.querySelector('.daily .drow > span'); return r ? Math.round(r.getBoundingClientRect().width) : 0; });
check(w > 180, `每日卡片文字欄寬 ${w}px（不再被擠成 64px）`);
await page.screenshot({ path: '/tmp/v0212-daily.png' });
await browser.close();
console.log(fails.length ? `\n❌ ${fails.length} 項失敗` : '\n全部通過');
process.exit(fails.length ? 1 : 0);
