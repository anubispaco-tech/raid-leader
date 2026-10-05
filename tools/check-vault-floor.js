// v0.13.3 回歸測試：第二章玩家的「下一步：進入寶庫」不能帶到沒有寶庫數值的樓層（曾造成金幣 NaN）
import * as G from '../src/core/index.js';
const fails = [], check = (ok, msg) => { console.log((ok ? '✅ ' : '❌ ') + msg); if (!ok) fails.push(msg); };
const s = G.newGame(); for (let i = 0; i <= 13; i++) s.clears[i] = 3; s.unlocked = 14; s.stats.runs = 50; s.party = []; s.tavern = [];
const n = G.nextStep(s);
check(n && n.btn.act === 'vault' && n.btn.d === G.CH1_TOP, `下一步寶庫按鈕帶第一章最高層（d=${n && n.btn.d}）`);
check(G.vaultBattleOpts(13).vault.floor === G.CH1_TOP, '寶庫開打時第二章樓層會被改回第一章');
const before = s.gold; G.applyVaultResult(s, { vault: { floor: 13 }, kills: 12 }, () => []);
check(Number.isFinite(s.gold) && s.gold > before, `結算第二章樓層也不會 NaN（${before} → ${s.gold}）`);
for (let f = 0; f <= G.CH1_TOP; f++) check(Number.isFinite(G.vaultGoldPerKill(f)) && G.vaultGoldPerKill(f) > 0, `第 ${f + 1} 層每隻金幣 ${G.vaultGoldPerKill(f)}`);
if (fails.length) { console.log(`\n${fails.length} 項失敗`); process.exit(1); } else console.log('\n全部通過');
