// v0.18.1 測試：標題英文優先、單件強化 +5（不足時鎖住、剩不到 5 級改成「強化至」）、史詩以上／套裝分解要二次確認
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { playthrough } from './sim-lib.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const { s } = playthrough({ talents: true, stopAt: 2 });
s.lastSeen = Date.now(); s.idle = null; s.player = { pid: 'abcdefgh1234', name: '測試', asked: true, playSec: 0, bindAsked: 1 };
// 塞 3 件背包裝備：普通、史詩、套裝（拿掉 base 以免名稱被重組）
const mk = (id, rarity, extra = {}) => ({ id, slot: 'head', ilvl: 10, rarity, up: 0, pow: 5, sta: 5, crit: 0, ...extra });
s.items.t_common = mk('t_common', 0); s.items.t_epic = mk('t_epic', 3); s.items.t_set = mk('t_set', 3, { set: 'mage' });
s.bag.push('t_common', 't_epic', 't_set');
s.gold = 100000; s.dust = 0;
const fails = [], check = (ok, msg) => { console.log((ok ? '✅ ' : '❌ ') + msg); if (!ok) fails.push(msg); };
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 375, height: 760 } });
await page.addInitScript(v => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('raid-leader-save-v1', v); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(s));
// 重新整理前要改存檔：放進 sessionStorage，下次載入前套用（避免離開頁面時的自動存檔蓋掉）
await page.addInitScript(() => { const p = sessionStorage.getItem('patch'); if (!p) return; sessionStorage.removeItem('patch');
  const v = JSON.parse(localStorage.getItem('raid-leader-save-v1')); const f = JSON.parse(p); v.items.t_epic.up = f.up; v.gold = f.gold; localStorage.setItem('raid-leader-save-v1', JSON.stringify(v)); });
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.route('**/*', r => { const u = new URL(r.request().url()); if (u.host !== 'app.test') return r.abort();
  const f = path.join(root, 'public', u.pathname === '/' ? 'index.html' : u.pathname.slice(1));
  return r.fulfill({ body: fs.readFileSync(f), contentType: types[path.extname(f)] }); });
// 1. 標題
await page.goto('https://app.test/'); await page.waitForTimeout(1500);
check((await page.locator('#title .tlogo').innerText()) === 'RAID LEADER', '開始畫面主標題是 RAID LEADER');
check((await page.locator('#title .tsub').innerText()).includes('副本團長'), '中文副標題是副本團長');
const box = await page.locator('#title .tlogo').boundingBox(); check(box && box.width <= 375, `主標題不超出手機寬度（${Math.round(box.width)}px）`);
await page.screenshot({ path: '/tmp/v0181-title.png' });
await page.click('[data-act="titlego"]'); await page.waitForTimeout(800);
check(await page.locator('.brand-t svg.gi-brand').count() === 1 && (await page.locator('.brand').getAttribute('title')) === 'RAID LEADER', '左上角改成雙劍圖示');
const hb = await page.locator('.brand').boundingBox(); check(hb && hb.width <= 60, `左上角寬度精簡（${Math.round(hb.width)}px）`);
check((await page.title()).startsWith('RAID LEADER'), '分頁標題');
const openItem = async id => { await page.evaluate(id => { const b = document.createElement('button'); b.dataset.act = 'item'; b.dataset.id = id; document.body.appendChild(b); b.click(); b.remove(); }, id); await page.waitForTimeout(300); };
const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('raid-leader-save-v1')));
// 2. 強化 +5（第一章未解鎖秘境 → 上限 +5，0 → 5 剛好 5 級，不需精華）
await openItem('t_common');
const up5 = page.locator('#modal [data-act="up5"]');
check(await up5.count() === 1 && (await up5.innerText()).includes('強化 ×5'), '有「強化 ×5」按鈕');
await up5.click(); await page.waitForTimeout(400);
check((await save()).items.t_common.up === 5, '一次強化到 +5');
await openItem('t_common');
check(await page.locator('#modal [data-act="up5"]').count() === 0, '已到上限就不顯示 +5');
// 剩不到 5 級 → 「強化至」；金幣不足 → 鎖住
await page.evaluate(() => sessionStorage.setItem('patch', JSON.stringify({ up: 2, gold: 1 })));
await page.reload(); await page.waitForTimeout(1500);
await openItem('t_epic');
const b2 = page.locator('#modal [data-act="up5"]');
check((await b2.innerText()).includes('強化至 +5'), '剩 3 級時顯示「強化至 +5」');
check(await b2.isDisabled(), '金幣不足時按鈕鎖住');
// 3. 分解確認：史詩要按兩次；普通一次
const salv = () => page.locator('#modal [data-act="salvage"]');
await salv().click(); await page.waitForTimeout(300);
check((await salv().innerText()).includes('確定分解') && (await save()).items.t_epic, '史詩第一次只變成確認鍵，沒有分解');
await salv().click(); await page.waitForTimeout(400);
check(!(await save()).items.t_epic, '再按一次才分解');
await openItem('t_set'); await salv().click(); await page.waitForTimeout(300);
check((await save()).items.t_set && (await salv().innerText()).includes('確定分解'), '套裝也要確認');
await page.click('#modal [data-act="lock"]').catch(() => {}); await page.waitForTimeout(200);
await openItem('t_common'); await salv().click(); await page.waitForTimeout(400);
check(!(await save()).items.t_common, '普通裝備一次就分解');
// 4. 英文
await page.evaluate(() => { sessionStorage.removeItem('rl-title'); localStorage.setItem('raid-leader-lang', 'en'); });
await page.reload(); await page.waitForTimeout(1500);
check(await page.locator('#title .tsub').count() === 0 && (await page.locator('#title .tlogo').innerText()) === 'RAID LEADER', '英文模式只顯示 RAID LEADER');
check(!errs.length, '沒有頁面錯誤 ' + errs.join('; '));
await browser.close();
console.log(fails.length ? `❌ ${fails.length} 項失敗` : '✅ 全部通過'); process.exit(fails.length ? 1 : 0);
