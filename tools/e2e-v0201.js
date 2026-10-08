// v0.20.1 測試：格子模式手機排版（敵方一行、我方橫排、紀錄在第一屏）、結算置頂、背包長按多選分解
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { playthrough } from './sim-lib.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const { s } = playthrough({ talents: true, stopAt: 6 });
s.lastSeen = Date.now(); s.idle = null; s.player = { pid: 'abcdefgh1234', name: '測試', asked: true, playSec: 0, bindAsked: 1 };
s.story = s.story || { seen: [] }; for (let i = 0; i < 14; i++) s.story.seen.push('pre' + i, 'post' + i);
// 背包塞 6 件可分解的裝備（含 1 件鎖定、1 件史詩）
const mk = (id, rarity, extra = {}) => ({ id, slot: 'head', ilvl: 20, rarity, up: 0, pow: 5, sta: 5, crit: 0, ...extra });
['m1', 'm2', 'm3', 'm4'].forEach(id => { s.items[id] = mk(id, 1); s.bag.push(id); });
s.items.mlock = mk('mlock', 1, { locked: true }); s.bag.push('mlock');
s.items.mepic = mk('mepic', 3); s.bag.push('mepic');
const fails = [], check = (ok, msg) => { console.log((ok ? '✅ ' : '❌ ') + msg); if (!ok) fails.push(msg); };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: false });
await page.addInitScript(v => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('raid-leader-save-v1', v); sessionStorage.setItem('seeded', '1'); sessionStorage.setItem('rl-e2e', '1'); } }, JSON.stringify(s));
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.route('**/*', r => { const u = new URL(r.request().url()); if (u.host !== 'app.test') return r.abort();
  const f = path.join(root, 'public', u.pathname === '/' ? 'index.html' : u.pathname.slice(1));
  return r.fulfill({ body: fs.readFileSync(f), contentType: types[path.extname(f)] }); });
await page.goto('https://app.test/'); await page.waitForTimeout(1500);
if (await page.locator('[data-act="titlego"]').count()) { await page.click('[data-act="titlego"]'); await page.waitForTimeout(800); }
const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('raid-leader-save-v1')));

// 1. 戰鬥頁排版
await page.evaluate(d => { const b = document.createElement('button'); b.dataset.act = 'fight'; b.dataset.d = d; document.body.appendChild(b); b.click(); b.remove(); }, Math.max(0, s.unlocked - 2));
await page.waitForTimeout(1200);
check(await page.locator('.arena').count() === 0 && await page.locator('.foebar .fb').count() >= 1, '敵方改成一行血條（沒有列表）');
check(await page.locator('.pstrip .pc').count() === 5, '我方 5 人一排');
const geo = await page.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(); const bar = document.querySelector('.ctrlbar').getBoundingClientRect();
  return { grid: r('#gridSlot').top, strip: r('.pstrip').top, log: r('.log').top, logBottom: r('.log').bottom, barTop: bar.top, ok: r('.foebar').top < r('#gridSlot').top && r('#gridSlot').top < r('.pstrip').top && r('.pstrip').top < r('.log').top }; });
check(geo.ok, '順序：敵方血條 → 格子 → 我方 → 紀錄');
check(geo.log + 60 < geo.barTop, `不捲動就看得到戰鬥紀錄（紀錄頂端 ${Math.round(geo.log)}px，控制列 ${Math.round(geo.barTop)}px）`);
await page.screenshot({ path: '/tmp/v0201-battle.png' });
// 2. 打完：結算在最上面、捲回頂端
await page.evaluate(() => window.scrollTo(0, 600));
await page.click('[data-act="speed"][data-x="4"]');
for (let k = 0; k < 90 && !(await page.locator('.result').count()); k++) await page.waitForTimeout(1000);
await page.waitForTimeout(900);
const res = await page.evaluate(() => ({ y: window.scrollY, above: document.querySelector('.result').getBoundingClientRect().top < document.querySelector('#gridSlot').getBoundingClientRect().top }));
check(res.above, '結算卡在格子上方');
check(res.y < 40, `打完自動捲回頂端（scrollY ${Math.round(res.y)}）`);
await page.screenshot({ path: '/tmp/v0201-result.png' });

// 3. 背包長按多選
await page.click('#tabs [data-tab="bag"]'); await page.waitForTimeout(400);
check((await page.locator('[data-act="mselon"]').count()) === 1, '背包有「多選」入口與長按提示');
const first = page.locator('.bagitem[data-id="m1"]');
await first.scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
const b1 = await first.boundingBox();
await page.mouse.move(b1.x + 40, b1.y + 15); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up(); await page.waitForTimeout(300);
check(await page.locator('.mselbar').count() === 1, '長按進入多選，出現底部操作列');
check(await page.locator('.bagitem.picked').count() === 1 && await page.locator('.bagitem[data-id="m1"].picked').count() === 1, '長按的那件被選起（放開時沒有又取消）');
check(await page.locator('#modal .item-sheet, #modal [data-act="salvage"]').count() === 0, '長按不會打開物品視窗');
await page.click('.bagitem[data-id="m2"]'); await page.waitForTimeout(200);
check(await page.locator('.bagitem.picked').count() === 2, '點第二件加入選取');
await page.click('.bagitem[data-id="m2"]'); await page.waitForTimeout(200);
check(await page.locator('.bagitem.picked').count() === 1, '再點一次取消');
await page.click('.bagitem[data-id="mlock"]'); await page.waitForTimeout(200);
check(await page.locator('.bagitem[data-id="mlock"].picked').count() === 0, '鎖定的裝備選不起來');
await page.click('[data-act="mselcancel"]'); await page.waitForTimeout(200);
check(await page.locator('.mselbar').count() === 0, '取消離開多選');
// 「多選」按鈕 → 選 m3、m4 → 分解
await page.click('[data-act="mselon"]'); await page.waitForTimeout(200);
await page.click('.bagitem[data-id="m3"]'); await page.click('.bagitem[data-id="m4"]'); await page.waitForTimeout(200);
check((await page.locator('.mselbar .mcount').innerText()).includes('已選 2 件'), '操作列顯示件數與可得金幣');
const g0 = (await save()).gold;
await page.click('[data-act="mselgo"]'); await page.waitForTimeout(400);
let sv = await save();
check(!sv.items.m3 && !sv.items.m4 && sv.gold > g0 && sv.items.m1 && sv.items.mlock, '一次分解選取的 2 件，其他保留');
check(await page.locator('.mselbar').count() === 0, '分解後離開多選');
// 含史詩：要按兩次
await page.click('[data-act="mselon"]'); await page.click('.bagitem[data-id="mepic"]'); await page.waitForTimeout(150);
await page.click('[data-act="mselgo"]'); await page.waitForTimeout(300);
check((await save()).items.mepic && (await page.locator('[data-act="mselgo"]').innerText()).includes('確定'), '含史詩時第一次只變成確認');
await page.click('[data-act="mselgo"]'); await page.waitForTimeout(300);
check(!(await save()).items.mepic, '再按一次才分解');
// 全選：選起所有看得到且沒鎖定的
await page.click('[data-act="mselon"]'); await page.click('[data-act="mselall"]'); await page.waitForTimeout(200);
const visible = await page.locator('.bagitem').count(), lockedN = await page.locator('.bagitem.nopick').count();
check(await page.locator('.bagitem.picked').count() === visible - lockedN, `全選選起 ${visible - lockedN} 件（鎖定 ${lockedN} 件不選）`);
await page.screenshot({ path: '/tmp/v0201-bag.png' });
const over = await page.evaluate(() => { const c = document.querySelector('.mselbar .ctrl'), R = c.getBoundingClientRect(); return [...c.querySelectorAll('button')].filter(b => b.getBoundingClientRect().right > R.right + 1).length; });
check(over === 0, '操作列在 390px 不溢出');
await page.click('#tabs [data-tab="team"]'); await page.waitForTimeout(200); await page.click('#tabs [data-tab="bag"]'); await page.waitForTimeout(200);
check(await page.locator('.mselbar').count() === 0, '切換分頁後自動離開多選');
check(errs.length === 0, '沒有 JS 錯誤' + (errs.length ? '：' + errs.join(' | ') : ''));
await browser.close();
console.log(fails.length ? `\n${fails.length} 項失敗` : '\n全部通過');
process.exit(fails.length ? 1 : 0);
