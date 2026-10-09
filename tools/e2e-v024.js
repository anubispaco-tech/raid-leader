// v0.24 測試：團長天賦樹（一格一點、前置、分岔、只能加點、重置、v0.23 配點退回）、團長指令（效果、最多帶兩個、自動下達）、
// 英雄主動技能（各職業、冷卻、自動時機、點卡片施放）、後勤效果、天賦樹與戰鬥畫面操作（v0.23 的 e2e-v023 併入這支）
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

// ---------- 1. 等級與天賦樹規則 ----------
const s0 = G.migrate(G.newGame());
check(G.leaderLevel(s0) === 0 && G.leaderPoints(s0) === 0 && Array.isArray(s0.leader.cmds), '新存檔團長 Lv0、0 點');
s0.stats.runs = 500; for (let i = 0; i < 7; i++) s0.clears[i] = 1;
check(G.leaderXp(s0) === 640 && G.leaderLevel(s0) === G.leaderLevel(640), `經驗＝場數＋首通 ×20（Lv${G.leaderLevel(s0)}）`);
const total = Object.keys(G.NODE).length;
check(total === 39 && G.LEADER.baseMax === 30, `三棵樹共 ${total} 格、上限 30 點（點不滿）`);
check(G.canAdd({}, 't0', 30) && !G.canAdd({}, 't1', 30), '從樹根開始：沒點樹根不能點上一層');
check(G.canAdd({ t0: 1, t2: 1 }, 't4', 30) && G.canAdd({ t0: 1, t1: 1 }, 't4', 30), '有兩個前置的格子，任一個亮著就能點');
check(G.whyNot({ t0: 1, t1: 1, t4: 1, t7: 1, t10: 1 }, 't12', 30) === 'soon', '散開、集中先鎖住');
const fk = { m0: 1, m1: 1, m4: 1, m7: 1, m9: 1, m10: 1 };
check(G.whyNot(fk, 'm11', 30) === 'fork', '分岔：戰地救援與堅守陣線只能選一個');
check(!G.canRemove({ t0: 1, t1: 1 }, 't0') && G.canRemove({ t0: 1, t1: 1, t2: 1, t4: 1 }, 't1'), '拿掉一格不能讓上面的格子斷掉（還有另一條路連著就可以）');
check(G.whyNot({ t0: 1 }, 't1', 1) === 'points', '點數用完不能再點');
check(G.validAlloc({ t1: 1 }, 30) === false && G.validAlloc({ m10: 1, m11: 1, m0: 1, m1: 1, m4: 1, m7: 1, m9: 1 }, 30) === false, '載入時檢查：缺前置、分岔兩邊都點＝不合法');
const s1 = G.migrate(G.newGame()); s1.stats.runs = 2000; s1.gold = 1e6;
check(G.commitAlloc(s1, { t0: 1, t1: 1 }) && !G.commitAlloc(s1, { t0: 1 }) && G.commitAlloc(s1, { t0: 1, t1: 1, t3: 1 }), '確認配點只能加、不能直接減');
const cost = G.resetCost(s1), g0 = s1.gold;
check(G.resetLeader(s1) && s1.gold === g0 - cost && G.spentPts(G.leaderAlloc(s1)) === 0, `重置花 ${cost} 金、點數全部收回`);
// v0.23 的配點（多格節點）退回
const old = G.newGame(); old.stats.runs = 3000; old.leader = { alloc: { grit: 3, hornDur: 2, rally: 1 } };
const mig = G.migrate(G.sanitizeSave(JSON.parse(JSON.stringify(old))));
check(G.spentPts(G.leaderAlloc(mig)) === 0 && mig.leader.refunded === 1, 'v0.23 的配點全部退回並記下提示旗標');

// ---------- 2. 團長指令 ----------
const sc = G.migrate(G.newGame()); sc.stats.runs = 99999; for (let i = 0; i < 14; i++) sc.clears[i] = 1;
G.commitAlloc(sc, { t0: 1, t1: 1, t3: 1, t6: 1, t2: 1, t5: 1, t8: 1, t4: 1, t7: 1, t10: 1 });
check(G.learnedCmds(sc).join() === 'rally,shatter,assault' && G.equippedCmds(sc).length === 2, `學會 3 個指令、預設帶 2 個（${G.equippedCmds(sc).join()}）`);
G.toggleCmd(sc, 'assault');
check(G.equippedCmds(sc).includes('assault') && G.equippedCmds(sc).length === 2, '切換帶的指令：最多 2 個');
setSeed(31);
const { s } = playthrough({ talents: true, stopAt: 3 });
const party = G.partyHeroes(s);
const cb = new G.Battle(party, s.items, 3, { leader: { cmds: ['rally', 'assault'] } });
cb.units.forEach(u => { u.hp = Math.round(u.max * 0.5); });
check(cb.useCommand('rally') && cb.units.every(u => Math.abs(u.hp - Math.round(u.max * 0.65)) <= 1) && !cb.useCommand('rally'), '集結號令：全隊回 15%、每場一次');
check(!cb.useCommand('shatter'), '沒帶的指令不能用');
cb.useCommand('assault');
check(cb.assault && cb.assault.until === cb.tick + 10, '總攻號令：10 秒傷害加成');
const ab = new G.Battle(party, s.items, 3, { leader: { cmds: ['inspire'] }, autoCmd: true });
ab.units.forEach(u => { u.hp = Math.round(u.max * 0.3); }); ab.step();
check(ab.cmdUsed.inspire, '自動下達：全隊血量低時自動激勵');

// ---------- 3. 英雄主動技能 ----------
const roles = G.partyHeroes(s).map(h => G.activeKey(h.cls, G.roleOf(h)));
check(roles.every(Boolean), `每位隊員都有主動技能（${roles.join('、')}）`);
check(G.activeKey('druid', 'tank') === 'roar' && G.activeKey('druid', 'heal') === 'grove' && G.activeKey('shaman', 'heal') === 'tide' && G.activeKey('shaman', 'dps') === 'storm', '德魯伊、薩滿依專精換技能');
const mb = new G.Battle(party, s.items, 3, { actives: 'manual' });
const u0 = mb.units[0];
check(!mb.useActive(u0.id), `開場 ${G.ACTIVE.first} 秒內不能用`);
for (let i = 0; i < G.ACTIVE.first; i++) mb.step();
check(mb.useActive(u0.id) && u0.act.ready === mb.tick + G.ACTIVE.cd && !mb.useActive(u0.id), `施放後冷卻 ${G.ACTIVE.cd} 秒`);
const off = new G.Battle(party, s.items, 3, {});
check(!off.units.some(u => u.act), '沒給 actives 的戰鬥（模擬、回歸測試）沒有主動技能');
setSeed(7); const auto = new G.Battle(party, s.items, 3, { actives: 'auto' }).runToEnd();
check(auto.units.some(u => u.act && u.act.used), '自動模式會自己施放');
setSeed(7); const man = new G.Battle(party, s.items, 3, { actives: 'manual' }).runToEnd();
check(!man.units.some(u => u.act && u.act.used), '手動模式不點就不放');

// ---------- 4. 後勤效果 ----------
const e = G.migrate(G.newGame()); e.stats.runs = 99999; for (let i = 0; i < 14; i++) e.clears[i] = 1;
const max0 = G.staminaMax(e), cap0 = G.offlineCap(e), vd0 = G.vaultDaily(e);
G.commitAlloc(e, { l0: 1, l1: 1, l2: 1, l3: 1, l4: 1, l5: 1, l6: 1, l7: 1, l8: 1, l9: 1, l10: 1, l12: 1 });
check(G.staminaMax(e) === max0 + 1 && G.offlineCap(e) === cap0 + 2 && G.vaultDaily(e) === vd0 + 1, '補給、長征、巢穴熟客');
const it = G.makeItem('head', 200, 3);
check(G.salvDust(e, it) === Math.round(G.salvageDust(it) * 1.2), '精煉 I＋II：分解精華 +20%');
setSeed(5); const plain = G.migrate(G.newGame()); plain.clears[3] = 1; const r0 = G.applyResult(plain, 3, { win: true });
setSeed(5); const rich = G.migrate(G.newGame()); rich.clears[3] = 1; rich.stats.runs = 99999; G.commitAlloc(rich, { l0: 1, l1: 1, l2: 1, l4: 1, l9: 1 }); const r1 = G.applyResult(rich, 3, { win: true });
check(Math.abs(r1.gold - Math.round(r0.gold * 1.15)) <= 1, `戰利品 I～III：金幣 +15%（${r0.gold} → ${r1.gold}）`);

// ---------- 5. 瀏覽器：天賦樹、戰鬥卡片 ----------
const sv = JSON.parse(JSON.stringify(s)); sv.stats.runs = 3000; sv.gold = 99999; sv.lastSeen = Date.now(); sv.idle = null;
sv.leader = { alloc: { grit: 3 }, cmds: [] }; // v0.23 的舊配點 → 載入時退回
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
await page.click('#tabs [data-tab="team"]'); await page.waitForTimeout(300);
await page.click('[data-act="teamview"][data-v="leader"]'); await page.waitForTimeout(300);
check(/改成天賦樹/.test(await page.locator('#view').textContent()), '舊配點退回後顯示改版提示');
await page.click('[data-act="lrefundok"]'); await page.waitForTimeout(200);
check(await page.locator('.ltree .lnode2').count() === 14, '戰術樹 14 格');
const node = id => page.locator(`.lnode2[data-v="${id}"]`);
{ const y0 = (await node('t0').boundingBox()).y, y6 = (await node('t6').boundingBox()).y; check(y0 < y6, `v0.24.1 樹由上往下長（樹根 y=${Math.round(y0)} < 下層 y=${Math.round(y6)}）`); }
await node('t1').click(); await page.waitForTimeout(150);
check(/要先點亮/.test(await page.locator('.ldetail').textContent()), '點了還不能點的格子會說明原因');
{ const nb = await node('t1').boundingBox(), pb = await page.locator('.ldetail.lpop').boundingBox();
  check(pb && pb.x >= nb.x + nb.width - 2 && Math.abs((pb.y + pb.height / 2) - (nb.y + nb.height / 2)) < pb.height, 'v0.24.1 說明卡浮在節點旁邊（左半邊的節點→卡片在右邊）'); }
await page.locator('.ltreebox').click({ position: { x: 8, y: 8 } }); await page.waitForTimeout(150);
check(await page.locator('.ldetail.lpop').count() === 0, '點樹的空白處關閉說明卡');
await node('t0').click(); await page.waitForTimeout(150);
check(/號角手/.test(await page.locator('.ldetail').textContent()) && !(await node('t0').getAttribute('class')).includes(' on'), '第一次點：只顯示說明');
await node('t0').click(); await page.waitForTimeout(150);
check((await node('t0').getAttribute('class')).includes(' on'), '再點一次就點亮');
for (const id of ['t1', 't3', 't6']) { await node(id).click(); await page.waitForTimeout(100); await page.click('[data-act="ladd"]'); await page.waitForTimeout(120); }
await page.click('[data-act="lcommit"]'); await page.waitForTimeout(300);
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('raid-leader-save-v1')).leader);
check(saved.alloc.t0 && saved.alloc.t6 && saved.cmds.includes('rally'), '確認後寫進存檔，學會的集結號令自動帶上');
check(await page.locator('[data-act="lcmd"][data-v="rally"].sel').count() === 1, '戰鬥指令區顯示已帶的指令');
await page.screenshot({ path: '/tmp/v024-tree.png', fullPage: true });
// 戰鬥：卡片可以點、指令列
await page.click('#tabs [data-tab="dungeon"]'); await page.waitForTimeout(300);
await page.evaluate(() => { const b = document.createElement('button'); b.dataset.act = 'fight'; b.dataset.d = '1'; document.body.appendChild(b); b.click(); b.remove(); });
await page.waitForTimeout(800);
check(await page.locator('.pstrip button.pc.act').count() === 5 && await page.locator('.cmdrow [data-act="cmd"][data-v="rally"]').count() === 1, '戰鬥：5 張可點的隊員卡片＋團長指令列');
await page.evaluate(() => { const b = document.createElement('button'); b.dataset.act = 'speed'; b.dataset.x = '4'; document.body.appendChild(b); b.click(); b.remove(); });
for (let k = 0; k < 20 && !(await page.locator('.pstrip .pc.ready').count()); k++) await page.waitForTimeout(500);
const ready = page.locator('.pstrip .pc.ready').first();
if (await ready.count()) { await ready.click(); await page.waitForTimeout(300); }
check(/✨/.test(await page.locator('.log').textContent()), '點亮著的卡片會施放主動技能（紀錄出現 ✨）');
check(await page.locator('.gcast').count() >= 1 && /\S/.test(await page.locator('.gcast').first().textContent()), 'v0.24.1 施放時格子上跳出技能名標籤（4 倍速）');
await page.waitForTimeout(700);
check(await page.locator('.gcast').count() >= 1, 'v0.24.1 標籤用真實時間：4 倍速 0.7 秒後還看得到');
{ const names = await page.locator('.pstrip .pc .pn').allTextContents(); check(names.length === 5 && names.every(n => n.trim().length >= 1), `v0.24.1 隊員卡片保留名字（${names.join('、')}），技能改成圖示`);
  check(await page.locator('.pstrip .pc .skic').count() === 5, '每張卡片有技能圖示（冷卻環）'); }
await page.screenshot({ path: '/tmp/v024-battle.png' });
check(!errs.length, '沒有錯誤' + (errs.length ? '：' + errs[0] : ''));
await browser.close();
console.log(fails.length ? `\n❌ ${fails.length} 項失敗` : '\n全部通過');
process.exit(fails.length ? 1 : 0);
