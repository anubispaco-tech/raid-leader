// v0.21 測試：T0.5 升級（核心＋畫面）、套裝防重複掉落、套裝圖示、圖鑑兩本、「可能掉落」面板
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { playthrough } from './sim-lib.js';
import * as G from '../src/core/index.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const fails = [], check = (ok, msg) => { console.log((ok ? '✅ ' : '❌ ') + msg); if (!ok) fails.push(msg); };

// ---------- 核心 ----------
const { s } = playthrough({ talents: true, stopAt: 6 });
const cls = G.partyHeroes(s)[0].cls;
// 防重複：已有 head/chest/hands → 一定掉 legs
for (const sl of ['head', 'chest', 'hands']) { const it = G.makeSetItem(cls, sl, 100); s.items[it.id] = it; s.bag.push(it.id); }
check(Array.from({ length: 30 }, () => G.setDropSlot(s, cls)).every(sl => sl === 'legs'), '防重複：只缺腿 → 30 次都掉腿');
const all4 = new Set(Array.from({ length: 200 }, () => G.setDropSlot({ items: {} }, cls)));
check(all4.size === 4, '沒有任何部件時四個部位都會掉');
const pid = s.bag.find(id => s.items[id].set === cls && s.items[id].slot === 'head');
s.codex = s.codex || {}; s.dust = 1000; s.mythic.best = { 3: { level: 10, time: 100 } };
check(G.setT5Check(s, pid).why === 'key', 'T0.5：傳奇秘境最佳 +10 → 鎖住（key）');
s.mythic.best = { 3: { level: 18, time: 100 } }; s.dust = 199;
check(G.setT5Check(s, pid).why === 'dust', 'T0.5：精華 199 → 不足');
s.dust = 350; const sc0 = G.itemScore(s.items[pid]), d0 = G.salvageDust(s.items[pid]);
check(G.upgradeSetT5(s, pid) && s.dust === 150 && s.items[pid].rarity === 4 && s.items[pid].t5 === 1, 'T0.5：扣 200 精華、變傳說');
check(Math.abs(G.itemScore(s.items[pid]) / sc0 - 2.1 / 1.75) < 1e-9, 'T0.5：裝備分數 ×1.2');
check(G.salvageDust(s.items[pid]) === G.GEAR.salvageDust[4] + Math.floor(200 * G.GEAR.salvageRefund) && G.salvageDust(s.items[pid]) > d0, 'T0.5：分解會退部分精華');
check(!G.upgradeSetT5(s, pid) && G.setT5Check(s, pid).why === 'done', 'T0.5：不能重複升級');
check(s.codex[`set:${cls}:head:5`] === 1 && G.setCodexStats(s).total === 48, '圖鑑：T0.5 記錄、套裝圖鑑 48 格');
const h = G.partyHeroes(s).find(x => x.cls === cls);
h.gear.head = pid; h.gear.chest = s.bag.find(id => s.items[id].set === cls && s.items[id].slot === 'chest');
check(G.setCount(h, s.items) === 2, '混穿 T0＋T0.5 算 2 件');
h.gear.head = null; h.gear.chest = null;
// 竄改存檔：非套裝不能有 t5；有 t5 一定是傳說
{ const t = JSON.parse(JSON.stringify(s)); const any = t.bag.find(id => !t.items[id].set); t.items[any].t5 = 1; t.items[pid].rarity = 0;
  const l = G.loadSave ? null : null; void l;
  const m = G.migrate(G.sanitizeSave(t)); check(!m.items[any].t5 && m.items[pid].rarity === 4, '載入：一般裝備的 t5 清掉、T0.5 固定傳說'); }

// ---------- 畫面 ----------
s.dust = 350; s.items[pid].locked = false;
// 第二件給畫面測升級：再放一件胸甲以外的、讓第一件已是 T0.5
s.lastSeen = Date.now(); s.idle = null; s.player = { pid: 'abcdefgh1234', name: '測試', asked: true, playSec: 0, bindAsked: 1 };
s.story = s.story || { seen: [] }; for (let i = 0; i < 14; i++) s.story.seen.push('pre' + i, 'post' + i);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 360, height: 780 } });
await page.addInitScript(v => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('raid-leader-save-v1', v); sessionStorage.setItem('seeded', '1'); sessionStorage.setItem('rl-e2e', '1'); } }, JSON.stringify(s));
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.route('**/*', r => { const u = new URL(r.request().url()); if (u.host !== 'app.test') return r.abort();
  const f = path.join(root, 'public', u.pathname === '/' ? 'index.html' : u.pathname.slice(1));
  return r.fulfill({ body: fs.readFileSync(f), contentType: types[path.extname(f)] }); });
await page.goto('https://app.test/'); await page.waitForTimeout(1500);
if (await page.locator('[data-act="titlego"]').count()) { await page.click('[data-act="titlego"]'); await page.waitForTimeout(800); }
const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('raid-leader-save-v1')));
const over = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

// 1. 可能掉落（主線）
const dg = page.locator('.dg:not(.locked)').first();
await dg.locator('[data-act="drops"]').click(); await page.waitForTimeout(300);
check(await page.locator('.dropbody').count() === 1 && /普通 55%/.test(await page.locator('.dropbody').innerText()), '主線「可能掉落」展開，顯示稀有度機率');
await page.waitForTimeout(1300);
check(await page.locator('.dropbody').count() === 1, '每秒重繪後仍保持展開');
check(await over() <= 0, '可能掉落在 360px 不溢出');
await page.screenshot({ path: '/tmp/v021-drops.png' });
await page.click('[data-act="mode"][data-v="mythic"]'); await page.waitForTimeout(300);
await page.locator('.mythic [data-act="drops"]').click(); await page.waitForTimeout(300);
check(/T0\.5/.test(await page.locator('.mythic .dropbody').innerText()), '秘境「可能掉落」顯示 T0.5 解鎖狀態');
await page.click('[data-act="mode"][data-v="story"]'); await page.waitForTimeout(200);

// 2. 背包：套裝圖示依職業上色、T0.5 標籤
await page.click('#tabs [data-tab="bag"]'); await page.waitForTimeout(400);
check(await page.locator(`.item svg.gi-${cls}`).count() >= 3, '套裝在背包用職業色的專屬圖示');
check(await page.locator('.settag.t5').count() === 1, 'T0.5 那件顯示金色 T0.5 標籤');
// 3. 升級一件 T0
const chest = s.bag.find(id => s.items[id].set === cls && s.items[id].slot === 'chest');
await page.click(`.item[data-id="${chest}"]`); await page.waitForTimeout(300);
const btn = page.locator('[data-act="sett5"]');
check(await btn.isEnabled(), '物品視窗有「升級 T0.5」且可按');
await btn.click(); await page.waitForTimeout(300);
let sv = await save();
check(sv.items[chest].t5 === 1 && sv.items[chest].rarity === 4 && sv.dust === 150, '升級後存檔：T0.5、傳說、精華 150');
check(await page.locator('.t5done').count() === 1, '視窗顯示已升級');
await page.keyboard.press('Escape'); await page.evaluate(() => { const c = document.querySelector('[data-act="close"]'); if (c) c.click(); }); await page.waitForTimeout(300);
const hands = s.bag.find(id => s.items[id].set === cls && s.items[id].slot === 'hands');
await page.click(`.item[data-id="${hands}"]`); await page.waitForTimeout(300);
check(!(await page.locator('[data-act="sett5"]').isEnabled()) && /精華不足/.test(await page.locator('.t5box').innerText()), '精華不夠時按鈕鎖住並說明');
await page.screenshot({ path: '/tmp/v021-item.png' });
await page.evaluate(() => { const c = document.querySelector('[data-act="close"]'); if (c) c.click(); }); await page.waitForTimeout(300);

// 4. 圖鑑：預設套裝、T0.5 金框、一般裝備分頁有里程碑
await page.click('[data-act="bagview"][data-v="codex"]'); await page.waitForTimeout(300);
check(await page.locator('.cxset').count() === 6 && await page.locator('.cxp').count() === 24, '圖鑑預設顯示 6 套 × 4 部位');
check(await page.locator('.cxp.on').count() >= 3 && await page.locator('.cxp.t5').count() === 2, '有的部位亮起、T0.5 加金框');
check(await over() <= 0, '套裝圖鑑 360px 不溢出');
await page.screenshot({ path: '/tmp/v021-codex.png', fullPage: true });
await page.click('[data-act="cxview"][data-v="base"]'); await page.waitForTimeout(300);
check(await page.locator('.cxm').count() === 4 && await page.locator('.cxrow').count() > 30, '一般裝備分頁：里程碑＋基底表');
check(errs.length === 0, '沒有 JS 錯誤' + (errs.length ? '：' + errs.join(' | ') : ''));
await browser.close();
console.log(fails.length ? `\n${fails.length} 項失敗` : '\n全部通過');
process.exit(fails.length ? 1 : 0);
