// v0.19 測試：裝備職業限制（武器／布皮鎧）、本職甲類 +10%、加權掉落、舊存檔卸下違規裝備＋說明卡、背包「▲ 適合／潛力」、基底圖示
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
const mk = (id, slot, base, extra = {}) => ({ id, slot, base, ilvl: 20, rarity: 2, up: 0, pow: 10, sta: 10, crit: 0, affix: 'balanced', ...extra });
const helm = mk('a', 'head', 'helm'), hood = mk('b', 'head', 'hood'), band = mk('c', 'head', 'bandana'), bow = mk('d', 'weapon', 'shortbow'), ring = mk('e', 'trinket', 'ring');
check(G.canEquip('guardian', helm) && G.canEquip('guardian', band) && G.canEquip('guardian', hood), '騎士：鎧／皮／布都能穿');
check(!G.canEquip('rogue', helm) && G.canEquip('rogue', band) && G.canEquip('rogue', hood), '盜賊：不能穿鎧甲，皮／布可以');
check(!G.canEquip('mage', helm) && !G.canEquip('mage', band) && G.canEquip('mage', hood), '法師：只能穿布甲');
check(G.canEquip('rogue', bow) && !G.canEquip('mage', bow) && G.canEquip('mage', ring), '短弓只有盜賊；飾品不限');
check(!G.canEquip('mage', { ...hood, set: 'cleric', base: undefined }) && G.canEquip('cleric', { ...hood, set: 'cleric', base: undefined }), '套裝只有該職業能穿');
check(G.canEquip('mage', { ...helm, base: undefined }), '沒有基底的舊裝備不限');
{ const h = G.makeHero('guardian', 10, 0), items = { a: helm, b: hood };
  h.gear.head = 'a'; const s1 = G.heroStats(h, items); h.gear.head = 'b'; const s2 = G.heroStats(h, items);
  const base = G.heroStats({ ...h, gear: { ...h.gear, head: null } }, items);
  check(Math.abs((s1.pow - base.pow) - (s2.pow - base.pow) * 1.1) <= 1, `本職鎧甲屬性 +10%（${s1.pow - base.pow} vs ${s2.pow - base.pow}）`); }
{ G.setSeed(5); const save = G.LOOT.smart; G.LOOT.smart = 1; let bad = 0;
  for (let i = 0; i < 2000; i++) { const it = G.rollLoot(['mage'], 30, 1); if (it.slot !== 'trinket' && !G.canEquip('mage', it)) bad++; if (G.armorOf(it) && G.armorOf(it) !== 'cloth') bad++; }
  check(bad === 0, '加權 100% 時法師只拿到可用武器與布甲');
  G.LOOT.smart = 0; let cloth = 0, armor = 0; for (let i = 0; i < 6000; i++) { const it = G.rollLoot(['mage'], 30, 1); const a = G.armorOf(it); if (a) { armor++; if (a === 'cloth') cloth++; } }
  check(Math.abs(cloth / armor - 1 / 3) < 0.03, `純隨機時布甲約 1/3（${(cloth / armor * 100).toFixed(1)}%）`);
  G.LOOT.smart = save; G.setSeed(null); }
check(G.ITEM_BASES.hands.length === 6 && G.ITEM_BASES.legs.length === 6 && ['head', 'chest', 'hands', 'legs'].every(sl => ['cloth', 'leather', 'plate'].every(t => G.ITEM_BASES[sl].filter(([k]) => G.BASE_INFO[k].armor === t).length === 2)), '每個部位布／皮／鎧各 2 種基底');
check(Object.values(G.CLASSES).every(c => c.weapons.length === 4 && c.weapons.every(w => G.BASE_INFO[w] && G.BASE_INFO[w].slot === 'weapon')), '每個職業 4 種可用武器');

// ---------- 舊存檔：違規裝備卸下 ----------
const { s } = playthrough({ talents: true, stopAt: 2 });
s.lastSeen = Date.now(); s.idle = null; s.player = { pid: 'abcdefgh1234', name: '測試', asked: true, playSec: 0 };
const H = c => s.heroes.find(h => h.cls === c);
const mage = H('mage'), rogue = H('rogue'), guard = H('guardian');
s.items.x_helm = mk('x_helm', 'head', 'helm', { ilvl: 40 }); mage.gear.head = 'x_helm';
s.items.x_bow = mk('x_bow', 'weapon', 'shortbow', { ilvl: 40 }); s.bag = s.bag.filter(i => i !== mage.gear.weapon); if (mage.gear.weapon) s.bag.push(mage.gear.weapon); mage.gear.weapon = 'x_bow';
// 潛力測試：騎士腿部身上 +5 裝等 20；背包一件裝等 22 +0（目前較差、強化到 +5 會更好）
s.items.x_cur = mk('x_cur', 'legs', 'legplates', { ilvl: 20, up: 5 }); if (guard.gear.legs) s.bag.push(guard.gear.legs); guard.gear.legs = 'x_cur';
s.items.x_pot = mk('x_pot', 'legs', 'tassets', { ilvl: 22, up: 0 }); s.bag.push('x_pot');
for (const h of s.heroes) for (const sl of ['legs']) if (h !== guard && h.gear[sl] && s.items[h.gear[sl]].ilvl > 10) { /* 不影響 */ }
s.items.x_robe = mk('x_robe', 'chest', 'robe', { ilvl: 60, rarity: 3 }); s.bag.push('x_robe');
const migrated = G.migrate(JSON.parse(JSON.stringify(s)));
check(migrated.gearFix === 2 && !migrated.heroes.find(h => h.cls === 'mage').gear.head && migrated.bag.includes('x_helm') && migrated.bag.includes('x_bow'), 'migrate：法師的鎧甲頭盔、短弓卸回背包，記錄 2 件');
check(G.migrate(JSON.parse(JSON.stringify(migrated))).gearFix === 2, '再載入一次不會重複計算');
{ const t = JSON.parse(JSON.stringify(migrated)); G.autoEquip(t);
  check(t.heroes.every(h => Object.values(h.gear).every(id => !id || G.canEquip(h, t.items[id]))), '一鍵配裝不會穿上違規裝備');
  check(G.equip(t, t.heroes.find(h => h.cls === 'mage').id, 'x_helm') === false, 'equip() 擋下違規裝備'); }

// ---------- 畫面 ----------
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
await page.addInitScript(() => sessionStorage.setItem('rl-title', '1'));
await page.addInitScript(v => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('raid-leader-save-v1', v); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(s));
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.route('**/*', r => { const u = new URL(r.request().url()); if (u.host !== 'app.test') return r.abort();
  const f = path.join(root, 'public', u.pathname === '/' ? 'index.html' : u.pathname.slice(1));
  return r.fulfill({ body: fs.readFileSync(f), contentType: types[path.extname(f)] }); });
const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('raid-leader-save-v1')));
await page.goto('https://app.test/'); await page.waitForTimeout(1800);
const body = () => page.locator('#view').innerText();
check((await body()).includes('裝備職業限制') && (await body()).includes('已把 2 件'), '首頁顯示說明卡與卸下件數');
await page.screenshot({ path: '/tmp/v019-home.png' });
await page.click('[data-tab="bag"]').catch(() => {}); await page.waitForTimeout(400);
check((await body()).includes('裝備職業限制'), '背包也顯示說明卡');
const row = id => page.locator(`#view [data-act="item"][data-id="${id}"]`);
check((await row('x_helm').innerText()).includes('鎧'), '背包列顯示甲類標籤「鎧」');
check((await row('x_robe').innerText()).includes('▲') && (await row('x_robe').innerText()).match(/▲ .+ (\+\d+%|空位)/), '布甲法袍顯示「▲ 名字 +N%」');
check((await row('x_pot').innerText()).includes('潛力'), '裝等較高但未強化：顯示「潛力」');
check(await row('x_robe').locator('svg path').getAttribute('d') !== await row('x_helm').locator('svg path').getAttribute('d'), '不同基底不同圖示');
await page.screenshot({ path: '/tmp/v019-bag.png', fullPage: true });
// 物品視窗：法師按鈕鎖住、騎士顯示本職
await row('x_helm').click(); await page.waitForTimeout(300);
const m = () => page.locator('#modal').innerText();
check((await m()).includes('鎧甲') && (await m()).includes('可裝備：守護騎士'), '物品視窗顯示甲類與可裝備職業');
check(await page.locator(`#modal button.hero.off`).count() >= 3 && (await m()).includes('只能穿布甲以下'), '不能穿的英雄變灰並說明原因');
check((await m()).includes('本職 +10%'), '騎士顯示本職 +10%');
await page.screenshot({ path: '/tmp/v019-item.png' });
await page.keyboard.press('Escape'); await page.evaluate(() => document.querySelector('[data-act="close"]')?.click()); await page.waitForTimeout(200);
// 一鍵配裝並關卡
await page.click('[data-act="gearfixok"]'); await page.waitForTimeout(400);
const sv = await save();
check(sv.gearFix === 0 && !(await body()).includes('裝備職業限制'), '按一鍵配裝後說明卡消失');
check(sv.heroes.every(h => Object.values(h.gear).every(id => !id || G.canEquip(h, sv.items[id]))), '配裝後沒有人穿違規裝備');
// 挑選視窗：法師選頭部不會列出鎧甲
await page.evaluate(id => { const b = document.createElement('button'); b.dataset.act = 'pick'; b.dataset.id = id; b.dataset.slot = 'head'; document.body.appendChild(b); b.click(); b.remove(); }, mage.id);
await page.waitForTimeout(300);
check(await page.locator('#modal [data-id="x_helm"]').count() === 0 && (await m()).includes('不能穿'), '法師挑頭部時不列出鎧甲，並註明有幾件不能穿');
check(!errs.length, '沒有頁面錯誤 ' + errs.join('; '));
await browser.close();
console.log(fails.length ? `❌ ${fails.length} 項失敗` : '✅ 全部通過'); process.exit(fails.length ? 1 : 0);
