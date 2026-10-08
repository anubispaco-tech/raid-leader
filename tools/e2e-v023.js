// v0.23 測試：團長等級（由場數推算、舊存檔補齊）、配點規則（上限、終極前置、兩選一、只能加點、重置）、
// 戰鬥效果（號角、生命、不屈、戰地救援）、後勤效果（金幣、體力、寶庫次數、離線上限、分解精華）、團長分頁操作
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

// ---------- 1. 等級與配點規則 ----------
const s0 = G.migrate(G.newGame());
check(G.leaderLevel(s0) === 0 && G.leaderPoints(s0) === 0 && s0.leader && s0.leader.alloc, '新存檔團長 Lv0、0 點');
s0.stats.runs = 500; for (let i = 0; i < 7; i++) s0.clears[i] = 1;
const lv = G.leaderLevel(s0);
check(G.leaderXp(s0) === 500 + 7 * G.LEADER.xpFirst && lv === G.leaderLevel(640) && lv >= 10, `經驗＝場數＋首通 ×20（${G.leaderXp(s0)} → Lv${lv}）`);
const big = G.migrate(G.newGame()); big.stats.runs = 99999;
check(G.leaderLevel(big) === G.LEADER.baseMax, `等級上限 ${G.LEADER.baseMax}`);
const a = {};
check(!G.canAdd(a, 'rally', 30), '終極沒有前置點數時不能點');
check(!G.canAdd(a, 'scatter', 30), '「散開」還沒開放');
['hornDur', 'hornDur', 'hornPow', 'hornPow', 'kick', 'breaker', 'bossDmg', 'bossDmg'].forEach(id => { if (G.canAdd(a, id, 30)) a[id] = (a[id] || 0) + 1; });
check(G.branchPts(a, 'tactics') === 8 && G.canAdd(a, 'rally', 30), '同系 8 點後可以點終極');
a.rally = 1;
check(!G.canAdd(a, 'shatter', 30), '終極兩選一');
check(!G.canRemove(a, 'bossDmg'), '拿掉前置點會讓終極失效時不能減');
check(!G.canAdd({ grit: 3 }, 'grit', 30), '每個節點有格數上限');
check(!G.canAdd({ grit: 3 }, 'wall', 3), '點數用完不能再加');
check(G.validAlloc({ rally: 1 }, 30) === false && G.validAlloc({ grit: 9, nope: 2 }, 30).grit === 3, '載入時檢查配點（終極缺前置＝不合法；超過格數截掉、未知節點移除）');
// commit 只能加點
const s1 = G.migrate(G.newGame()); s1.stats.runs = 2000; s1.gold = 1e6;
check(G.commitAlloc(s1, { grit: 2 }) && !G.commitAlloc(s1, { grit: 1 }) && G.commitAlloc(s1, { grit: 3, unity: 1 }), '確認配點只能加、不能直接減');
const pts = G.leaderPoints(s1), cost = G.resetCost(s1), g0 = s1.gold;
check(G.resetLeader(s1) && s1.gold === g0 - cost && G.leaderPoints(s1) === pts + 4, `重置花 ${cost} 金、點數全部收回`);
// 存檔竄改：超過點數的配點會被清掉
const bad = G.migrate(G.newGame()); bad.stats.runs = 10; bad.leader.alloc = { grit: 3, wall: 2, mend: 2, unity: 2 };
const fixed = G.migrate(G.sanitizeSave(JSON.parse(JSON.stringify(bad))));
check(G.spentPts(G.leaderAlloc(fixed)) <= G.leaderLevel(fixed), '點數超過等級的存檔被清掉');

// ---------- 2. 戰鬥效果 ----------
setSeed(31);
const { s } = playthrough({ talents: true, stopAt: 3 });
const party = G.partyHeroes(s);
const base = new G.Battle(party, s.items, 3, {}), withHp = new G.Battle(party, s.items, 3, { leader: G.leaderMods({ grit: 3 }) });
check(withHp.units.every((u, i) => u.max === Math.round(base.units[i].max * 1.045)), '堅毅：全隊生命 +4.5%');
const hb = new G.Battle(party, s.items, 3, { leader: G.leaderMods({ hornDur: 2, hornPow: 2 }) }); hb.useHorn();
check(hb.horn.until - hb.tick === 19 && Math.abs(hb.hornBonus() - 0.38) < 1e-9, '長鳴＋激昂：號角 19 秒、+38%');
const hold = new G.Battle(party, s.items, 3, { leader: G.leaderMods({ hold: 1 }) }), u0 = hold.units[0];
hold.hitHero(u0, 1e9, 'magic'); const firstHp = u0.hp; hold.hitHero(hold.units[1], 1e9, 'magic');
check(firstHp === 1 && hold.units[1].hp === 0, '不屈：每場只擋第一次致命傷');
const rv = new G.Battle(party, s.items, 3, { leader: G.leaderMods({ grit: 3, wall: 2, mend: 2, unity: 1, revive: 1 }) }), u1 = rv.units[1];
rv.hitHero(u1, 1e9, 'magic');
check(u1.hp === Math.round(u1.max * 0.3), '戰地救援：第一位陣亡隊員以 30% 生命復活');
check(new G.Battle(party, s.items, 3, {}).L && Object.keys(new G.Battle(party, s.items, 3, {}).L).length === 0, '沒點天賦時戰鬥不受影響');

// ---------- 3. 後勤效果 ----------
const e = G.migrate(G.newGame()); e.stats.runs = 99999; for (let i = 0; i < 14; i++) e.clears[i] = 1;
const max0 = G.staminaMax(e), cap0 = G.offlineCap(e), vd0 = G.vaultDaily(e);
G.commitAlloc(e, { gold: 3, xp: 2, march: 2, stamina: 1, dust: 2, haul: 0 });
check(G.staminaMax(e) === max0 + 1 && G.offlineCap(e) === cap0 + 2, `補給、長征：體力上限 ${max0}→${G.staminaMax(e)}、離線 ${cap0}→${G.offlineCap(e)} 小時`);
G.commitAlloc(e, { ...G.leaderAlloc(e), vaultx: 1 });
check(G.vaultDaily(e) === vd0 + 1, '巢穴熟客：寶庫每天 +1 次');
const it = G.makeItem('head', 200, 3);
check(G.salvDust(e, it) === Math.round(G.salvageDust(it) * 1.2), '精煉：分解精華 +20%');
setSeed(5); const plain = G.migrate(G.newGame()); plain.clears[3] = 1; const r0 = G.applyResult(plain, 3, { win: true });
setSeed(5); const rich = G.migrate(G.newGame()); rich.clears[3] = 1; rich.stats.runs = 99999; G.commitAlloc(rich, { gold: 3 }); const r1 = G.applyResult(rich, 3, { win: true });
check(Math.abs(r1.gold - Math.round(r0.gold * 1.15)) <= 1, `戰利品：金幣 +15%（${r0.gold} → ${r1.gold}）`);

// ---------- 4. 團長分頁（瀏覽器）----------
const sv = JSON.parse(JSON.stringify(s)); sv.stats.runs = 3000; sv.gold = 99999; sv.lastSeen = Date.now(); sv.idle = null;
sv.player = { pid: 'leadertest1', name: '測試', asked: true, playSec: 600, src: 'old', bindAsked: 1 };
sv.story = sv.story || { seen: [] }; for (let i = 0; i < 14; i++) sv.story.seen.push('pre' + i, 'post' + i);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.addInitScript(v => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('raid-leader-save-v1', v); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(sv));
const errs = []; page.on('pageerror', e2 => errs.push(e2.message));
await page.route('**/*', r => { const u = new URL(r.request().url()); if (u.host !== 'app.test') return r.abort();
  const f = path.join(root, 'public', u.pathname === '/' ? 'index.html' : u.pathname.slice(1));
  return r.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); });
await page.goto('https://app.test/'); await page.waitForTimeout(1500);
if (await page.locator('[data-act="titlego"]').count()) { await page.click('[data-act="titlego"]'); await page.waitForTimeout(800); }
for (let i = 0; i < 4 && await page.locator('.sheet').count(); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
const expLv = G.leaderLevel(G.migrate(JSON.parse(JSON.stringify(sv))));
check(await page.locator('#tabs [data-tab="team"] .dot').count() === 1, '有可用點數時團隊分頁亮綠點');
await page.click('#tabs [data-tab="team"]'); await page.waitForTimeout(300);
check(await page.locator('[data-act="teamview"][data-v="leader"] .tpip').textContent() === String(expLv), `團長分頁標出可用點數 ${expLv}`);
await page.click('[data-act="teamview"][data-v="leader"]'); await page.waitForTimeout(300);
check((await page.locator('.lhead').textContent()).includes(`Lv${expLv}`), `團長頁顯示 Lv${expLv}`);
for (let i = 0; i < 2; i++) { await page.click('[data-act="ladd"][data-v="hornDur"]'); await page.waitForTimeout(150); }
check(await page.locator('[data-act="ladd"][data-v="hornDur"][disabled]').count() === 1, '長鳴點滿 2 格後不能再加');
check(await page.locator('[data-act="lcommit"]').count() === 1, '有草稿時出現「確認配點」');
await page.click('[data-act="lsub"][data-v="hornDur"]'); await page.waitForTimeout(150);
await page.click('[data-act="lcommit"]'); await page.waitForTimeout(300);
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('raid-leader-save-v1')).leader.alloc);
check(saved.hornDur === 1, '確認後寫進存檔（加 2 減 1 → 1 格）');
check(await page.locator('[data-act="lsub"][data-v="hornDur"][disabled]').count() === 1, '已確認的點不能直接減');
await page.click('[data-act="lbranch"][data-v="morale"]'); await page.waitForTimeout(200);
check(await page.locator('.lnode.ult .lwhy').first().textContent().then(t => /8/.test(t)), '終極顯示需要同系 8 點');
await page.screenshot({ path: '/tmp/v023-leader.png', fullPage: true });
await page.click('[data-act="lreset"]'); await page.waitForTimeout(300); await page.click('[data-act="ldoreset"]'); await page.waitForTimeout(300);
const after = await page.evaluate(() => JSON.parse(localStorage.getItem('raid-leader-save-v1')));
check(Object.keys(after.leader.alloc).length === 0 && after.gold === 99999 - 500 * expLv, '重置清空配點並扣金幣');
// 英文
await page.evaluate(() => { const b = document.createElement('button'); b.dataset.act = 'lang'; b.dataset.v = 'en'; document.body.appendChild(b); b.click(); });
await page.waitForTimeout(800); await page.click('#tabs [data-tab="team"]'); await page.waitForTimeout(300);
await page.click('[data-act="teamview"][data-v="leader"]').catch(() => {}); await page.waitForTimeout(300);
const en = await page.locator('#view').textContent();
check(!/[一-鿿]/.test(en.replace(/[^\S]+/g, ' ').replace(/·/g, '')), '英文團長頁沒有中文殘留');
check(!errs.length, '沒有錯誤' + (errs.length ? '：' + errs[0] : ''));
await browser.close();
console.log(fails.length ? `\n❌ ${fails.length} 項失敗` : '\n全部通過');
process.exit(fails.length ? 1 : 0);
