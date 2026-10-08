// v0.13.3 回歸測試：「下一步：進入寶庫」不能帶到沒有寶庫數值的樓層（曾造成金幣 NaN）；v0.22 寶庫延伸到第二章＋精華
import * as G from '../src/core/index.js';
const fails = [], check = (ok, msg) => { console.log((ok ? '✅ ' : '❌ ') + msg); if (!ok) fails.push(msg); };
const s = G.newGame(); for (let i = 0; i <= 13; i++) s.clears[i] = 3; s.unlocked = 14; s.stats.runs = 50; s.party = []; s.tavern = [];
// v0.22 起寶庫延伸到第二章：第二章玩家的「下一步」帶到第 XIV 層，超出 par 範圍的樓層退回最高層
const n = G.nextStep(s);
check(n && n.btn.act === 'vault' && n.btn.d === G.VAULT_TOP, `下一步寶庫按鈕帶可進入的最高層（d=${n && n.btn.d}，VAULT_TOP=${G.VAULT_TOP}）`);
check(G.vaultBattleOpts(13).vault.floor === 13, '第二章樓層可以直接進入寶庫');
check(G.vaultBattleOpts(99).vault.floor === G.VAULT_TOP && G.vaultBattleOpts(-1).vault.floor === G.VAULT_TOP, '不合法樓層退回最高層');
const before = s.gold; G.applyVaultResult(s, { vault: { floor: 99 }, kills: 12 }, () => []);
check(Number.isFinite(s.gold) && s.gold > before, `不合法樓層結算也不會 NaN（${before} → ${s.gold}）`);
for (let f = 0; f <= G.VAULT_TOP; f++) check(Number.isFinite(G.vaultGoldPerKill(f)) && G.vaultGoldPerKill(f) > 0, `第 ${f + 1} 層每隻金幣 ${G.vaultGoldPerKill(f)}・打滿精華 ${G.vaultDust(f, G.vaultMaxKills(f))}`);
check(G.vaultDust(6, 99) === 0 && G.vaultDust(7, 0) === 0 && G.vaultDust(13, G.VAULT.par[13]) === G.VAULT.dust.base + 6 * G.VAULT.dust.step, '第一章不產精華；第二章打到 par 隻＝ base + step × 層差');
const d0 = s.dust || 0; const r = G.applyVaultResult(s, { vault: { floor: 13 }, kills: 999 }, () => []);
check(r.dust === G.vaultDust(13, G.vaultMaxKills(13)) && s.dust === d0 + r.dust, `精華最多算到上限隻數，並加進存檔（+${r.dust}）`);
if (fails.length) { console.log(`\n${fails.length} 項失敗`); process.exit(1); } else console.log('\n全部通過');
