// v0.20 測試：格子戰場（站位、事件播放、跨重繪不中斷）、設定頁戰鬥畫面偏好、音效開關、窄螢幕不溢出
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
s.lastSeen = Date.now(); s.idle = null; s.story = s.story || { seen: [] }; for (let i = 0; i < 14; i++) s.story.seen.push('pre' + i, 'post' + i); s.player = { pid: 'abcdefgh1234', name: '測試', asked: true, playSec: 0 };
const fails = [], check = (ok, msg) => { console.log((ok ? '✅ ' : '❌ ') + msg); if (!ok) fails.push(msg); };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 360, height: 780 } });
await page.addInitScript(v => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('raid-leader-save-v1', v); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(s));
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.route('**/*', r => { const u = new URL(r.request().url()); if (u.host !== 'app.test') return r.abort();
  const f = path.join(root, 'public', u.pathname === '/' ? 'index.html' : u.pathname.slice(1));
  return r.fulfill({ body: fs.readFileSync(f), contentType: types[path.extname(f)] }); });
await page.goto('https://app.test/'); await page.waitForTimeout(1500);
if (await page.locator('[data-act="titlego"]').count()) { await page.click('[data-act="titlego"]'); await page.waitForTimeout(800); }

// 1. 開打：格子出現、站位正確
const d = Math.max(0, s.unlocked - 2);
await page.evaluate(d => { const b = document.createElement('button'); b.dataset.act = 'fight'; b.dataset.d = d; document.body.appendChild(b); b.click(); b.remove(); }, d);
await page.waitForTimeout(600);
check(await page.locator('#gridSlot .gstage .gboard').count() === 1, '戰鬥分頁出現格子戰場');
check(await page.locator('.gcell').count() === 63, '7×9 共 63 格');
const heroCells = await page.evaluate(() => [...document.querySelectorAll('.gcell')].map((c, i) => ({ i, n: c.querySelectorAll('.gslab').length })).filter(x => x.i >= 35 && x.n > 0).length);
check(heroCells >= 4, `我方區域有 ${heroCells} 位隊員`);
check(await page.locator('.arena.compact').count() === 1, '血條列表改成精簡版');
// 2. 播放：一段時間內有動畫，且跨過每秒重繪仍在跑
await page.click('[data-act="speed"][data-x="2"]');
let seenAnims = 0;
for (let k = 0; k < 8; k++) { await page.waitForTimeout(300); seenAnims = Math.max(seenAnims, await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length)); }
check(seenAnims > 0, `戰鬥中有格子動畫在播放（最多同時 ${seenAnims} 個）`);
const sameNode = await page.evaluate(() => { const a = document.querySelector('.gboard'); return new Promise(r => setTimeout(() => r(a === document.querySelector('.gboard') && a.isConnected), 1200)); });
check(sameNode, '格子 DOM 常駐，每秒重繪不會重建');
await page.screenshot({ path: '/tmp/v020-battle.png', fullPage: true });
await page.click('[data-act="speed"][data-x="4"]');
for (let k = 0; k < 60; k++) { const last = await page.evaluate(() => { const w = [...document.querySelectorAll('.waves i')]; return w.length && w[w.length - 1].classList.contains('cur'); }); if (last) break; await page.waitForTimeout(500); }
await page.waitForTimeout(2500);
const bc = await page.evaluate(() => [...document.querySelectorAll('.gcell')].slice(0, 21).map(c => c.querySelectorAll('.gslab').length).join(''));
check((bc.match(/[3-9]/g) || []).length >= 9, `首領佔 3×3 且疊得比較高（${bc}）`);
await page.screenshot({ path: '/tmp/v020-boss.png' });
await page.click('[data-act="speed"][data-x="1"]');
// 3. 底部控制列在 360px 不溢出
const over = await page.evaluate(() => { const c = document.querySelector('.ctrl'); if (!c) return 'none'; const R = c.getBoundingClientRect();
  return [...c.querySelectorAll('button')].filter(b => { const r = b.getBoundingClientRect(); return r.width < 28 || r.right > R.right + 1 || r.left < R.left - 1; }).map(b => b.textContent.trim()).join(',') || 0; });
check(over === 0, `控制列每顆按鈕在 360px 都完整顯示（${over}）`);
const pageOver = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check(pageOver <= 0, `頁面沒有橫向捲動（${pageOver}）`);
// 3b. 戰鬥中 2D／3D 快速切換
check((await page.locator('[data-act="isotog"]').innerText()).trim() === '2D', '戰鬥標題列有 2D／3D 切換鍵（預設 2D）');
await page.click('[data-act="isotog"]'); await page.waitForTimeout(300);
check(await page.locator('.gstage.iso').count() === 1 && (await page.locator('[data-act="isotog"]').innerText()).trim() === '3D', '按一下切成立體');
const hbOver = await page.evaluate(() => { const h = document.querySelector('.bhead'); return h.scrollWidth - h.clientWidth; });
check(hbOver <= 0, `標題列在 360px 不溢出（${hbOver}）`);
await page.click('[data-act="isotog"]'); await page.waitForTimeout(300);
check(await page.locator('.gstage.iso').count() === 0, '再按一下切回平面');
// 4. 音效快速開關
await page.click('[data-act="mute"]'); await page.waitForTimeout(200);
check(JSON.parse(await page.evaluate(() => localStorage.getItem('raid-leader-prefs'))).sound === false, '戰鬥中按喇叭可以關音效，並記在這台裝置');
check(await page.locator('[data-act="mute"].off').count() === 1, '喇叭顯示為關閉');
// 5. 設定頁：立體視角、簡化、關
await page.click('.brand'); await page.waitForTimeout(400);
check(await page.locator('#modal [data-act="pref"][data-k="fx"]').count() === 3, '設定頁有格子特效三段');
await page.click('#modal [data-act="pref"][data-k="iso"][data-v="1"]'); await page.waitForTimeout(200);
await page.click('#modal [data-act="close-settings"]'); await page.waitForTimeout(1300);
check(await page.locator('.gstage.iso').count() === 1, '開啟立體視角後格子變立體');
await page.screenshot({ path: '/tmp/v020-iso.png' });
await page.click('.brand'); await page.waitForTimeout(300);
await page.click('#modal [data-act="pref"][data-k="fx"][data-v="off"]'); await page.waitForTimeout(200);
await page.click('#modal [data-act="close-settings"]'); await page.waitForTimeout(1300);
check(await page.locator('.gstage').count() === 0 && await page.locator('.arena:not(.compact)').count() === 1, '特效「關」改回原本的文字列表');
await page.click('.brand'); await page.waitForTimeout(300);
await page.click('#modal [data-act="pref"][data-k="fx"][data-v="lite"]'); await page.waitForTimeout(200);
await page.click('#modal [data-act="close-settings"]'); await page.waitForTimeout(1300);
check(await page.locator('.gstage.lite').count() === 1, '特效「簡化」顯示格子');
const prefs = JSON.parse(await page.evaluate(() => localStorage.getItem('raid-leader-prefs')));
check(prefs.fx === 'lite' && prefs.iso === true, '偏好設定存在裝置');
// 6. 打到結束（直接結算或等待），結算畫面正常
await page.evaluate(() => sessionStorage.setItem('rl-e2e', '1'));
await page.click('[data-act="speed"][data-x="4"]');
for (let k = 0; k < 60 && !(await page.locator('.result').count()); k++) await page.waitForTimeout(1000);
check(await page.locator('.result').count() === 1, '戰鬥正常結束並顯示結算');
// 7. 重新整理後偏好保留
await page.reload(); await page.waitForTimeout(1500);
check(JSON.parse(await page.evaluate(() => localStorage.getItem('raid-leader-prefs'))).fx === 'lite', '重新整理後偏好保留');
check(errs.length === 0, '沒有 JS 錯誤' + (errs.length ? '：' + errs.join(' | ') : ''));
await browser.close();
console.log(fails.length ? `\n${fails.length} 項失敗` : '\n全部通過');
process.exit(fails.length ? 1 : 0);
