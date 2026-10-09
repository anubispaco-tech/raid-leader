// v0.25 測試：第三章資料、三個新機制（潮汐、魅惑、登船）、章節解鎖、劇情（渡海、補對話、劇情回顧）、世界地圖、成就、潮紋材質
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as G from '../src/core/index.js';
import { setSeed } from '../src/core/rng.js';
import { playthrough } from './sim-lib.js';
import { STORY, STORY_LOG, storyLines } from '../src/ui/story.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [], check = (ok, msg) => { console.log((ok ? '✅ ' : '❌ ') + msg); if (!ok) fails.push(msg); };

// ---------- 1. 資料 ----------
check(G.DUNGEONS.length === 21 && G.CHAPTERS.length === 3 && G.CHAPTERS[2].floors.join() === '14,20', '第三章 7 層（XV–XXI）');
check(G.ROMAN[20] === 'XXI' && G.DUNGEON.difficulty.length === 21 && G.DUNGEON.recLevel.length === 21, '羅馬數字、難度與建議等級表補到 XXI');
const ilv = [13, 14, 20].map(i => G.dungeonInfo(i).dropIlvl);
check(ilv[1] > ilv[0] && ilv[2] > ilv[1], `第三章掉落裝等往上接（XIV ${ilv[0]} → XV ${ilv[1]} → XXI ${ilv[2]}）`);
const w13 = G.buildWaves(13)[2][0], w14 = G.buildWaves(14)[2][0];
check(w14.hp > w13.hp && w14.atk > w13.atk, '第三章首領比第二章最後一層強');
check(G.mechHints(16).includes('charm') && G.mechHints(16).includes('cast') && G.mechHints(14).includes('summon') && G.mechHints(15).includes('buster'), '備戰提示：魅惑→打斷、登船→範圍、潮汐→坦克');
check(G.itemLabel(G.makeItem('head', 170, 2)).includes('潮紋') && !G.itemLabel(G.makeItem('head', 150, 2)).includes('潮紋'), '裝等 160 以上叫「潮紋」，舊裝備名稱不變');
check(G.VAULT.par.length === 14, '寶庫還是 14 層（海岸巢穴在 v0.25.1）');

// ---------- 2. 機制 ----------
setSeed(31);
const { s } = playthrough({ talents: true, stopAt: 6 });
const party = G.partyHeroes(s);
const bossOnly = d => ({ waves: [G.buildWaves(d)[2].map(e => ({ ...e, atk: e.atk * 0.02, addAtk: e.addAtk * 0.02 }))] }); // 首領攻擊壓低，讓戰鬥撐得夠久來觀察機制
// 潮汐
const tb = new G.Battle(party, s.items, 15, bossOnly(15));
for (let i = 0; i < 20; i++) tb.step();
check(tb.tideHigh() && !tb.tideLow(), '第 20 秒漲潮');
const tank = tb.units.find(u => u.role === 'tank') || tb.units[0];
setSeed(5); const hHigh = (() => { const hp = tank.hp; tank.hp = tank.max; const d = tb.hitHero(tank, 100, 'phys'); tank.hp = hp; return d; })();
const saved = tb.tide; tb.tide = null;
setSeed(5); const hNorm = (() => { const hp = tank.hp; tank.hp = tank.max; const d = tb.hitHero(tank, 100, 'phys'); tank.hp = hp; return d; })();
tb.tide = saved;
check(tank.role !== 'tank' || hHigh > hNorm * 1.3, `漲潮時坦克受到傷害變高（${hNorm} → ${hHigh}）`);
for (let i = 0; i < 9 && !tb.over; i++) tb.step();
check(tb.over || tb.tideLow(), '漲潮 8 秒後退潮');
check(tb.over || tb.log.some(l => l.msg.includes('退潮')), '退潮有紀錄');
// 魅惑
const kicks = Object.fromEntries(Object.entries(G.CLASSES).map(([k, p]) => [k, p.kick]));
for (const p of Object.values(G.CLASSES)) p.kick = () => false;
const cb = new G.Battle(party, s.items, 16, bossOnly(16));
for (let i = 0; i < 25 && !cb.over && !cb.charms; i++) cb.step();
const ch = cb.units.find(u => u.charmed > cb.tick);
check(cb.charms >= 1 && ch && ch.role !== 'tank', `沒打斷 → 魅惑輸出最高的非坦克（${ch ? ch.name : '無'}）`);
for (const [k, p] of Object.entries(G.CLASSES)) p.kick = kicks[k];
const kb = new G.Battle(party, s.items, 16, bossOnly(16));
for (let i = 0; i < 25 && !kb.over; i++) kb.step();
const kickers = kb.units.some(u => u.pack.kick && u.pack.kick(u));
check(!kickers || !kb.charms, `有會打斷的隊員就不會被魅惑（打斷職業：${kickers ? '有' : '無'}）`);
// 登船
const bb = new G.Battle(party, s.items, 14, bossOnly(14));
const boss = bb.enemies.find(e => e.boss); boss.hp = Math.round(boss.max * 0.7);
const n0 = bb.enemies.length; bb.step();
check(bb.enemies.length === n0 + 3 && boss.boarded === 1, '首領血量跌破 75%：3 隻海盜登船');
boss.hp = Math.round(boss.max * 0.2); bb.step(); bb.step();
check(boss.boarded === 3 || bb.over, '跌破 50%、25% 再各來一批（每秒最多一批）');
// 舊章節不受影響
const ob = new G.Battle(party, s.items, 3, {}); ob.runToEnd();
check(!ob.tide && !ob.charms, '第一章沒有潮汐與魅惑');

// ---------- 3. 解鎖、成就、劇情資料 ----------
const g = G.migrate(G.newGame()); g.unlocked = 14; for (let i = 0; i < 14; i++) g.clears[i] = 1;
const win = { win: true, tick: 100, units: [], log: [], charms: 0 };
G.applyResult(g, 13, win);
check(g.unlocked === 15, '通關 XIV 後解鎖 XV');
g.unlocked = 17; G.applyResult(g, 16, { ...win, charms: 0 });
check(g.stats.nocharm === 1, '「不為歌聲所動」：XVII 沒人被魅惑');
const ids = G.ACHIEVEMENTS.map(a => a.id);
check(['clear15', 'clear18', 'clear21', 'nocharm', 'story3'].every(i => ids.includes(i)), '新成就 5 個');
check(['sail', ...Array.from({ length: 7 }, (_, k) => ['pre' + (14 + k), 'post' + (14 + k)]).flat()].every(k => STORY[k] && STORY[k].length), '渡海＋第三章每層戰前／通關劇情');
check(['post0', 'pre1', 'post1', 'pre6'].every(k => STORY[k]) && STORY.post6 && STORY.post13.at(-1).text.includes('島嶼篇'), '第一章補對話、第二章結尾加「島嶼篇完」');
check(STORY_LOG.length === 3 && STORY_LOG.every(c => c.some(x => storyLines(x.key).length)), '劇情回顧三章');

// ---------- 4. 瀏覽器 ----------
setSeed(31);
const sv = JSON.parse(JSON.stringify(s)); sv.lastSeen = Date.now(); sv.idle = null; sv.gold = 99999;
sv.unlocked = 15; for (let i = 0; i < 14; i++) sv.clears[i] = 1;
sv.player = { pid: 'v025test1', name: '測試', asked: true, playSec: 600, src: 'old', bindAsked: 1 };
sv.story = { seen: ['post6'] }; for (let i = 7; i < 14; i++) sv.story.seen.push('pre' + i, 'post' + i);
sv.leader = sv.leader || { alloc: {}, cmds: [] };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +(process.env.W || 390), height: 844 } });
await page.addInitScript(v => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('raid-leader-save-v1', v); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(sv));
const errs = []; page.on('pageerror', e2 => errs.push(e2.message));
await page.route('**/*', r => { const u = new URL(r.request().url()); if (u.host !== 'app.test') return r.abort();
  const f = path.join(root, 'public', u.pathname === '/' ? 'index.html' : u.pathname.slice(1));
  return r.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); });
await page.goto('https://app.test/'); await page.waitForTimeout(1500);
if (await page.locator('[data-act="titlego"]').count()) { await page.click('[data-act="titlego"]'); await page.waitForTimeout(800); }
for (let i = 0; i < 4 && await page.locator('.sheet').count(); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
await page.click('#tabs [data-tab="dungeon"]'); await page.waitForTimeout(300);
check(await page.locator('.worldmap svg').count() === 1 && /維爾達/.test(await page.locator('.worldmap').textContent()), '副本頁有世界地圖');
check(await page.locator('.worldmap .wm-hit[data-v="2"]').count() === 1, '潮痕海岸在地圖上可以點');
await page.screenshot({ path: '/tmp/v025-map.png' });
// 點地圖上的潮痕海岸 → 第三章＋渡海劇情
await page.locator('.worldmap .wm-hit[data-v="2"]').click(); await page.waitForTimeout(400);
check(/海鷗/.test(await page.locator('.sheet').textContent().catch(() => '')), '第一次切到第三章播放渡海劇情');
for (let i = 0; i < 12 && await page.locator('.sheet .dlg').count(); i++) { await page.locator('.sheet .dlg').click(); await page.waitForTimeout(120); }
check((await page.locator('.dg h3').first().textContent()).includes('鹽冠碼頭'), '第三章列表從鹽冠碼頭開始');
await page.screenshot({ path: '/tmp/v025-ch3.png', fullPage: true });
// 劇情回顧
await page.click('[data-act="storylog"]'); await page.waitForTimeout(300);
const rows = await page.locator('.slog').count(), locked = await page.locator('.slog.locked').count();
check(rows === 15 && locked >= 13, `劇情回顧：第三章 15 段、還沒打的鎖住（${rows - locked} 段可看）`);
await page.locator('[data-act="storyplay"][data-v="sail"]').click(); await page.waitForTimeout(300);
check(/海鷗/.test(await page.locator('.sheet').textContent()), '回顧可以重播渡海');
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
for (let i = 0; i < 3 && await page.locator('.sheet').count(); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(200); }
// 開打 XV：戰前劇情
await page.evaluate(() => { const b = document.createElement('button'); b.dataset.act = 'fight'; b.dataset.d = '14'; document.body.appendChild(b); b.click(); b.remove(); });
await page.waitForTimeout(400);
check(/葛蘭|倉庫/.test(await page.locator('.sheet').textContent().catch(() => '')), '第一次挑戰 XV 播放戰前劇情');
for (let i = 0; i < 8 && await page.locator('.sheet .dlg').count(); i++) { await page.locator('.sheet .dlg').click(); await page.waitForTimeout(120); }
await page.waitForTimeout(500);
check(await page.locator('#gridSlot .gstage').count() === 1, '戰鬥開始（格子戰場）');
await page.evaluate(() => { const b = document.createElement('button'); b.dataset.act = 'speed'; b.dataset.x = '4'; document.body.appendChild(b); b.click(); b.remove(); });
await page.waitForTimeout(6000);
await page.screenshot({ path: '/tmp/v025-battle.png' });
// 舊玩家回頭打已通關的第一章：不跳補的對話
await page.evaluate(() => { const b = document.createElement('button'); b.dataset.act = 'fight'; b.dataset.d = '1'; document.body.appendChild(b); b.click(); b.remove(); });
await page.waitForTimeout(400);
check(!(await page.locator('.sheet .dlg').count()), '已通關的層不播補的戰前對話');
check(!errs.length, '沒有錯誤' + (errs.length ? '：' + errs[0] : ''));
await browser.close();
console.log(fails.length ? `\n❌ ${fails.length} 項失敗` : '\n全部通過');
process.exit(fails.length ? 1 : 0);
