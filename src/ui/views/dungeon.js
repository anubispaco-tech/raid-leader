// ===== 副本分頁 =====
import { tx } from '../../core/i18n.js';
import * as G from '../../core/index.js';
import { app, e2eMode } from '../state.js';
import { dungeonIcon, svg, setGlyph } from '../icons.js';
import { fmt, mmss, esc, partyPower, avgPartyIlvl, avgPartyLv, dailyOpenNow, gearRuleCard } from '../helpers.js';
import { leaderboard } from '../telemetry.js';

// ---------- v0.21 可能掉落 ----------
// 稀有度機率：rollRarity 由高往低累加 weight；minR 以下併進 minR
function rarityOdds(minR = 0, legend = 0) {
  const w = G.RARITY.map(r => r.weight), out = G.RARITY.map(() => 0);
  w.forEach((x, i) => { out[Math.max(i, minR)] += x * (1 - legend); });
  out[G.RARITY.length - 1] += legend;
  return out.map((p, i) => (p > 0.0005 ? `<span class="c${i}">${G.RARITY[i].name} ${p >= 0.1 ? Math.round(p * 100) : (p * 100).toFixed(1).replace(/\.0$/, '')}%</span>` : '')).filter(Boolean).join(' ');
}
// 出戰職業的套裝收集：亮 = 有、暗 = 缺（缺的部位優先掉）、T0.5 加外框
function setChips() {
  const S = app.S, cl = [...new Set(G.partyHeroes(S).map(h => h.cls))];
  return `<div class="dsets">${cl.map(c => { const own = {}; Object.values(S.items).forEach(it => { if (it.set === c) own[it.slot] = Math.max(own[it.slot] || 0, it.t5 ? 2 : 1); });
    return `<span class="dset"><b>${G.CLASSES[c].name}</b>${G.ARMOR_SLOTS.map(sl => `<i class="${own[sl] ? 'on' : ''} ${own[sl] === 2 ? 't5' : ''}" title="${G.SLOTS[sl]}">${svg(setGlyph(c, sl), 'gi-' + c)}</i>`).join('')}</span>`; }).join('')}</div>`;
}
export function dropsBox(key, rows, sets) {
  const open = app.dropOpen === key;
  return `<div class="drops ${open ? 'open' : ''}"><button class="dropbtn" data-act="drops" data-v="${key}" aria-expanded="${open}">${tx('可能掉落')} <span aria-hidden="true">${open ? '▴' : '▾'}</span></button>${open ? `<div class="dropbody">${rows.map(([k, v]) => `<div class="drow"><span class="label">${k}</span><span>${v}</span></div>`).join('')}${sets ? setChips() : ''}</div>` : ''}</div>`;
}
function storyDrops(i) {
  const d = G.dungeonInfo(i), R = G.REWARD, rows = [
    [tx('裝備'), tx('{0}～{1} 件・裝等 {2}～{3}', R.baseDrops, R.baseDrops + 1, d.dropIlvl - 1, d.dropIlvl + 2) + `<small class="sub">${tx('（{0}% 多一件）', Math.round(R.doubleDropChance * 100))}</small>`],
    [tx('稀有度'), rarityOdds(0)],
  ];
  if (!(app.S.clears[i])) rows.push([tx('首通'), tx('第一件至少{0}', G.RARITY[R.firstClearMinRarity].name)]);
  const ch2 = i > G.CH1_TOP;
  if (ch2) rows.push([tx('T0 套裝'), tx('勝利 {0}% 掉一件（出戰職業、缺的部位優先）', Math.round(G.SET_DROP.chance * 100))]);
  return dropsBox('d' + i, rows, ch2);
}
function mythicDrops(tier, key) {
  const M = G.MYTHIC, il = tier === 2 ? M.ch2.dropBase + M.ch2.dropPerLevel * key : M.dropBase + M.dropPerLevel * key;
  const legend = key >= M.legendFrom ? Math.min(M.legendMax, M.legendBase + M.legendPerLevel * (key - M.legendFrom)) : 0;
  const rows = [[tx('裝備'), tx('限時 3 件、超時 2 件・裝等約 {0}', il)], [tx('稀有度'), rarityOdds(1, legend)]];
  if (!legend) rows.push([tx('傳說'), tx('+{0} 起有機會掉落', M.legendFrom)]);
  if (tier === 2) rows.push([tx('T0 套裝'), tx('限時通關 {0}%、掛機勝利 {1}% 掉一件（出戰職業、缺的部位優先）', Math.round(G.SET_DROP.chance * 100), Math.round(G.SET_DROP.idle * 100))]);
  else rows.push([tx('T0.5 升級'), G.mythicBestLevel(app.S, 1) >= G.SET_T5.key ? tx('已解鎖（最佳 +{0}）', G.mythicBestLevel(app.S, 1)) : tx('傳奇秘境限時 +{0} 解鎖（目前最佳 +{1}）', G.SET_T5.key, G.mythicBestLevel(app.S, 1))]);
  return dropsBox('m' + tier, rows, tier === 2);
}
// ---------- 下一步建議卡 ----------
// ---------- 每日：任務、首勝、簽到 ----------
function signinText(r) {
  const g = G.runGold(app.S);
  return r.t === 'gold' ? tx('{0} 金', fmt(g * r.runs)) : r.t === 'dust' ? tx('精華 {0}', r.n) : r.t === 'sta' ? tx('秘境體力 +{0}', r.n)
    : r.set ? tx('史詩裝備 1 件（第二章起為套裝）') : tx('{0}裝備 1 件', G.RARITY[r.r].name);
}
function dailyCard() {
  const S = app.S, d = G.dailyToday(S), pend = G.dailyPending(S), open = dailyOpenNow();
  const doneN = d.q.filter(q => q.claimed).length;
  const head = tx('<button class="dhead" data-act="dtoggle"><span class="label">每日</span><span class="dsum">任務 {0}/{1}・首勝 {2}・簽到 {3}</span>{4}<span class="chev">{5}</span></button>',
    doneN, d.q.length, d.firstWin ? '✓' : '—', d.signed ? '✓' : '—', pend ? `<span class="dbadge num">${pend}</span>` : '', open ? '▴' : '▾');
  if (!open) return `<div class="daily">${head}</div>`;
  const rows = d.q.map((q, i) => {
    const t = G.QUESTS[q.id].n, done = G.questDone(q);
    const btn = q.claimed ? `<span class="dok">✓</span>` : done ? `<button class="btn sm main" data-act="dq" data-i="${i}">${tx('領取')}</button>` : `<span class="sub num" style="margin:0">${q.n}/${t}</span>`;
    return `<div class="drow"><span>${G.questText(q)}</span><span class="dbar"><i style="width:${Math.round(100 * q.n / t)}%"></i></span>${btn}</div>`;
  }).join('');
  const reward = tx('每項：{0} 金、精華 {1}', fmt(G.runGold(S) * G.DAILY.questGoldRuns), G.DAILY.questDust);
  const chest = tx('<div class="drow"><span>每日寶箱：三項都領完，送史詩裝備 1 件{0}</span>{1}</div>', '',
    d.chest ? '<span class="dok">✓</span>' : G.canChest(S) ? `<button class="btn sm main" data-act="dchest">${tx('開啟')}</button>` : `<span class="sub" style="margin:0">🔒</span>`);
  const fw = tx('<div class="drow"><span>每日首勝：今天第一場勝利，加送 {0} 金＋稀有以上裝備 1 件</span>{1}</div>', fmt(G.runGold(S) * G.DAILY.firstWinGoldRuns), d.firstWin ? '<span class="dok">✓</span>' : `<span class="sub" style="margin:0">—</span>`);
  const next = G.signinReward(d.signDays + (d.signed ? 0 : 1));
  const sign = tx('<div class="drow"><span>累積簽到第 {0} 天：{1}<small class="sub" style="display:block;margin:0">7 天一輪，斷簽不歸零；第 7 天送史詩</small></span>{2}</div>',
    d.signDays + (d.signed ? 0 : 1), signinText(next), d.signed ? '<span class="dok">✓</span>' : `<button class="btn sm main" data-act="dsign">${tx('簽到')}</button>`);
  return `<div class="daily open">${head}<div class="dbody">${sign}${rows}<p class="sub" style="margin:0">${reward}</p>${chest}${fw}<p class="sub" style="margin:0">${tx('每天 00:00（台灣時間）換新任務。')}</p></div></div>`;
}
function nextStepCard() {
  const n = G.nextStep(app.S); if (!n) return '';
  const b = n.btn;
  const btn = !b ? '' : b.tab ? `<button class="btn main" data-tab="${b.tab}">${b.label}</button>`
    : `<button class="btn main" data-act="${b.act}" ${b.d != null ? `data-d="${b.d}"` : ''}>${b.label}</button>`;
  return tx('<div class="nextstep"><div><span class="label">下一步</span><b>{0}</b><span class="sub" style="margin:0">{1}</span></div>{2}</div>', n.text, n.sub, btn);
}
// ---------- 寶庫 ----------
function vaultSection() {
  const S = app.S;
  if (!G.vaultUnlocked(S)) return tx('<div class="vault locked"><b>寶庫</b><span class="sub" style="margin:0">通關第 3 層「沉沒神殿」後開放：每天 3 次，打寶藏哥布林賺大量金幣。</span></div>');
  const floors = G.vaultFloors(S), left = G.vaultLeft(S);
  const f = floors.includes(app.vaultFloor) ? app.vaultFloor : floors[floors.length - 1];
  const best = S.vault.best[f] || 0;
  // v0.22 第二章樓層另產精華：顯示「打到上限可得多少」
  const dustMax = G.vaultDust(f, G.vaultMaxKills(f)), ch2Hint = G.vaultDustPar(f) ? tx('另得精華，最多 <b class="num">{0}</b>。', dustMax) : (S.clears[G.VAULT.dust.from] ? '' : tx('第二章的樓層通關後也會開放，還會額外掉精華。'));
  return (G.vaultUnlocked(S) ? infoCard('vault', tx('寶庫是什麼'), tx('島上到處都有豐饒哥布林的巢穴，寶庫就是其中最肥的一窩：每天 {0} 次、每次 60 秒，打寶藏哥布林換金幣。層數越高每隻越值錢，第二章的樓層還會掉精華。打你目前最高的那層通常最賺。', G.vaultDaily(S))) : '') + tx('<div class="vault"><div class="mhead"><div><span class="label">寶庫</span><b>60 秒打寶藏哥布林</b></div><span class="vleft num">今天剩 {0}/{1}</span></div> <div class="seg vfloors">{2}</div> <p class="sub" style="margin:0">第 {3} 層：每隻 <b class="num">{4}</b> 金，最多算 {5} 隻・最佳 {6} 隻。{10}打你目前最高的那層通常最賺。</p> <div class="row"><button class="btn main grow" data-act="vault" data-d="{7}" {8}>{9}</button><button class="btn" data-act="prepare-vault">備戰</button></div></div>', left, G.vaultDaily(S), floors.map(i => `<button data-act="vaultfloor" data-d="${i}" class="${i === f ? 'sel' : ''}">${G.ROMAN[i]}</button>`).join(''), G.ROMAN[f], fmt(G.vaultGoldPerKill(f)), G.vaultMaxKills(f), best, f, left ? '' : 'disabled', left ? tx('進入寶庫') : tx('明天 00:00 再來'), ch2Hint);
}
// ---------- 傳奇秘境 ----------
function mythicSection() {
  const S = app.S;
  if (!G.mythicUnlocked(S)) return tx('<div class="mythic locked"><b>傳奇秘境</b><span class="sub" style="margin:0">通關第 7 層「龍眠高塔」後解鎖：無限層數、限時挑戰、每日詞綴。</span></div>');
  // 傳奇秘境（第一章副本）／深淵秘境（第二章副本）：各自一顆鑰石，共用體力
  const open2 = G.tierUnlocked(S, 2), tier = open2 && app.mtier !== 1 ? 2 : 1;
  const tabs = `<div class="seg mtiers"><button data-act="mtier" data-v="1" class="${tier === 1 ? 'sel' : ''}">${tx('傳奇秘境')}</button><button data-act="mtier" data-v="2" class="${tier === 2 ? 'sel' : ''}" ${open2 ? '' : 'disabled'}>${tx('深淵秘境')}${open2 ? '' : ' 🔒'}</button></div>`;
  const st = G.stamina(S), nx = G.staminaNext(S), max = G.staminaMax(S);
  const sta = tx('<div class="stamina"><span class="label">秘境體力</span><b class="num">{0}/{1}</b><span class="sub num" style="margin:0">{2}</span></div>', st.pts, max, nx ? tx('{0} 後 +1', mmss(Math.ceil(nx / 1000))) : tx('已滿'));
  const key = G.tierKey(S, tier), today = G.dailyAffixes(), active = G.activeAffixes(key);
  let h = tabs + (tier === 2 ? infoCard('abyss', tx('深淵秘境'), tx('規則和傳奇秘境一樣，但副本換成第二章、強度以第 14 層為基準，有自己的一顆鑰石（體力共用）。掉落裝等更高，限時通關有機會掉 T0 職業套裝。')) : '') + mythicGuide() + tx('<div class="mythic"><div class="mhead"><div><span class="label">{4}</span><b>目前鑰石</b></div><span class="keystone num">+{0}</span></div> {5} <div class="affixes">{1}</div> <p class="sub" style="margin:0">今日詞綴，每天 00:00 更換。手動挑戰每場耗 1 點體力，每 {6} 分鐘回 1 點、上限 {7}。<b>秘境掛機</b>：限時通關過的副本可以掛機，固定打該副本最佳 −{2}，不耗體力、鑰石不變、獎勵 {3}%，離線也會累積。</p> {8} <div class="mlist">',
    key, today.map((a, i) => `<div class="affix ${active.includes(a) ? 'on' : ''}"><b>${G.AFFIXES[a].name}</b><span>${G.AFFIXES[a].desc}</span><small>${active.includes(a) ? tx('考驗{0}', G.AFFIXES[a].test) : tx('+{0} 起生效', G.MYTHIC.affixAt[i])}</small></div>`).join(''), G.MYTHIC.idleBelow, Math.round(G.MYTHIC.idleMult * 100),
    tier === 2 ? tx('深淵秘境') : tx('傳奇秘境'), sta, G.MYTHIC.stamina.regenMin, max,
    (tier === 2 ? tx('<p class="sub" style="margin:0">深淵秘境以第 14 層的強度為基準，掉落裝等更高，限時通關有機會掉職業套裝。</p>') : open2 ? '' : tx('<p class="sub" style="margin:0">通關第 14 層「深淵之心」後解鎖深淵秘境。</p>')) + mythicDrops(tier, key));
  const [f0, f1] = G.tierFloors(tier), sug = G.mythicSuggest(S, f0, f1);
  // v0.15 這一階還沒限時通關過：只顯示推薦的副本，其他收起來，避免一下子亮一整排
  const fresh = !Array.from({ length: f1 - f0 + 1 }, (_, k) => S.mythic.best[f0 + k]).some(Boolean), all = !fresh || app.mythicAll || e2eMode(); // 舊的自動化測試（rl-e2e）直接顯示全部
  for (let i = f0; i <= f1; i++) {
    if (!all && i !== sug) continue;
    const d = G.DUNGEONS[i], best = S.mythic.best[i];
    h += tx('<div class="mrow2 {7}"><div class="mname"><b>{0}{8}</b><span class="sub num" style="margin:0">限時 {1}・{2}</span></div> {3} <button class="btn sm" data-act="recommend-mythic" data-d="{4}" aria-label="一鍵備戰：陣容、天賦、裝備">備戰</button> <button class="btn sm main" data-act="mythic" data-d="{5}">挑戰 +{6}</button></div>', d.name, mmss(G.mythicTimer(i)), best ? tx('最佳 +{0}（{1}）', best.level, mmss(best.time)) : tx('還沒限時通關'), G.mythicIdleLevel(S, i) ? `<button class="btn sm ${S.idleMythic === i ? 'on' : ''}" data-act="idlemythic" data-d="${i}">${S.idleMythic === i ? tx('掛機中・停止') : tx('掛機 +{0}', G.mythicIdleLevel(S, i))}</button>` : '', i, i, key, i === sug ? 'sug' : '', i === sug ? tx('<span class="sugtag">推薦</span>') : '');
  }
  if (!all) h += tx('<button class="btn sm grow" data-act="mythicall">顯示其他 {0} 個副本</button><p class="sub" style="margin:0">先從推薦的副本限時通關一次，其他副本隨時都能打，鑰石等級共用。</p>', f1 - f0);
  return h + `</div></div>`;
}
// v0.17 新系統說明卡：第一次看到時顯示，按「知道了」後不再出現
function infoCard(id, title, body) {
  if (G.seenCard(app.S, id)) return '';
  return `<div class="mguide"><b class="mgt">${title}</b><p class="sub" style="margin:0">${body}</p><div class="row"><button class="btn sm main" data-act="cardok" data-v="${id}">${tx('知道了')}</button></div></div>`;
}
// v0.15 秘境說明卡：第一次進秘境自動展開，按「知道了」收起，之後點「？秘境怎麼玩」再打開
function mythicGuide() {
  const S = app.S, open = !S.mythicHelp || app.mythicHelpOpen;
  if (!open) return tx('<div class="row" style="justify-content:flex-end;margin:-4px 0 8px"><button class="linkbtn" data-act="mythichelp">？秘境怎麼玩</button></div>');
  return tx('<div class="mguide"><b class="mgt">秘境怎麼玩</b> <div class="mcmp"><span></span><b>主線</b><b>秘境</b> <span>目的</span><span>推進劇情、解鎖新層</span><span>重複刷同一批副本，拿更高裝等的裝備</span> <span>難度</span><span>每層固定</span><span>看鑰石等級：越高敵人越硬，+{0} 起有詞綴</span> <span>時間</span><span>不限時</span><span>有限時，限時內通關才升級</span> <span>獎勵</span><span>首通保底稀有</span><span>鑰石越高裝等越高，+{1} 起可能掉傳說</span></div> <ol class="msteps"><li>點<b>推薦</b>副本的「挑戰」，用目前鑰石等級開打。</li><li>限時內通關：鑰石 +1，打得夠快 +2；超時、失敗或撤退：鑰石 −1。</li><li>所有秘境副本共用同一顆鑰石，換副本打不會重來。</li><li>限時通關過的副本可以開「秘境掛機」，離線也會慢慢刷。</li></ol> <div class="row"><button class="btn sm main" data-act="mythichelpok">知道了</button></div></div>', G.MYTHIC.affixAt[0], G.MYTHIC.legendFrom);
}
// ---------- 天梯（排行榜）----------
function boardCard() {
  const lb = leaderboard(); if (!lb) return '';
  const me = app.S.player.name;
  let body;
  if (!lb.data) body = `<p class="sub" style="margin:0">${lb.error ? tx('天梯暫時讀不到，稍後再試。') : tx('讀取中…')}</p>`;
  else if (!lb.data.length) body = tx('<p class="sub" style="margin:0">還沒有人上榜，搶第一吧。</p>');
  else body = `<ol class="board">${lb.data.map((p, i) => `<li class="${me && p.name === me ? 'me' : ''}"><span class="rk num">${i + 1}</span><b>${esc(p.name)}</b>
      <span class="num">${p.best2 ? tx('深淵 +{0}', p.best2) : p.best ? tx('秘境 +{0}', p.best) : tx('第 {0} 層', p.top)}</span><span class="sub num" style="margin:0">Lv${p.level}</span></li>`).join('')}</ol>`;
  return tx('<div class="boardcard"><div class="row" style="align-items:baseline"><b>天梯</b><span class="sub" style="margin:0 0 0 auto">{0}・<button class="linkbtn" data-act="nick">{1}</button></span></div>{2} <p class="sub" style="margin:0">先比深淵秘境、再比傳奇秘境的最高限時等級。你的成績每 5 分鐘上傳一次。</p></div>', me ? tx('你是「{0}」', esc(me)) : tx('匿名'), me ? tx('改暱稱') : tx('設定暱稱'), body);
}
// v0.21.1 邀請朋友（新手教學結束後才出現）
const inviteCard = () => (G.tutActive(app.S) ? '' : `<div class="invite"><span>${tx('找朋友一起爬天梯')}</span><button class="btn sm" data-act="share">${tx('邀請朋友')}</button></div>`);
// ---------- v0.25 世界地圖：龍眠島 → 霧帆海 → 維爾達（目前只開放潮痕海岸）----------
const REGIONS = [ // [名稱, x, y, 章節 index（沒有＝即將開放）]
  [tx('潮痕海岸'), 236, 92, 2], [tx('灰燼高原'), 292, 98], [tx('霜牙山脈'), 296, 38], [tx('低語密林'), 248, 52], [tx('沉沒王都'), 338, 72], [tx('蝕之門'), 344, 30],
];
function worldMap(ch, open) {
  const sea = open(2), isle = open(1) ? 1 : 0;
  let g = `<path class="wm-land" d="M18 70 C 16 44, 44 28, 70 36 C 96 44, 112 60, 104 84 C 96 104, 58 112, 36 102 C 22 96, 19 84, 18 70 Z"/>`;
  g += `<g class="wm-hit ${ch < 2 ? 'sel' : ''}" data-act="chapter" data-v="${isle}" role="button" aria-label="${tx('龍眠島')}"><circle cx="62" cy="70" r="40" fill="transparent"/><circle class="wm-dot on" cx="62" cy="66" r="5"/><text x="62" y="88">${tx('龍眠島')}</text></g>`;
  g += `<path class="wm-route ${sea ? 'on' : ''}" d="M100 72 C 140 50, 180 104, 226 92"/>`;
  g += `<text class="wm-sea" x="160" y="58">${tx('霧帆海')}</text>`;
  g += `<path class="wm-land" d="M222 108 C 214 76, 226 38, 252 22 C 280 6, 330 4, 352 18 C 368 30, 366 70, 358 94 C 350 114, 300 118, 262 116 C 244 115, 226 116, 222 108 Z"/>`;
  g += `<text class="wm-cont" x="300" y="121">${tx('維爾達')}</text>`;
  for (const [n, x, y, c] of REGIONS) {
    const on = c != null && open(c);
    g += c != null && on
      ? `<g class="wm-hit ${ch === c ? 'sel' : ''}" data-act="chapter" data-v="${c}" role="button" aria-label="${n}"><circle cx="${x}" cy="${y}" r="16" fill="transparent"/><circle class="wm-dot on" cx="${x}" cy="${y}" r="5"/><text x="${x}" y="${y - 9}">${n}</text></g>`
      : `<g class="wm-off"><circle class="wm-dot" cx="${x}" cy="${y}" r="3.5"/><text x="${x}" y="${y - 7}">${n}</text></g>`;
  }
  return `<div class="worldmap"><svg viewBox="0 0 372 126" role="group" aria-label="${tx('世界地圖')}">${g}</svg>${sea ? '' : `<small class="sub">${tx('通關第二章後，霧帆海的航線會打開')}</small>`}</div>`;
}
export function viewDungeons() {
  const lv = avgPartyLv(), il = avgPartyIlvl();
  let h = gearRuleCard('home') + (G.tutActive(app.S) ? '' : dailyCard()) + nextStepCard() + tx('<h2>副本</h2><p class="sub">隊伍平均 <b class="num">Lv{0}</b>・裝等 <b class="num">{1}</b>・戰力 <b class="num">{2}</b>　｜　每隻首領都有弱點，打不過就換陣容，或回頭刷裝備。</p>', lv, il, fmt(partyPower()));
  // 遊玩分類：主線／秘境／寶庫／活動（之後的節慶、裝備副本放「活動」）
  const S = app.S, mode = app.mode || 'story';
  const modes = [['story', tx('主線')], ['mythic', tx('秘境')], ['vault', tx('寶庫')], ['event', tx('活動')]];
  h += `<div class="seg modes">${modes.map(([k, n]) => `<button data-act="mode" data-v="${k}" class="${mode === k ? 'sel' : ''}">${n}</button>`).join('')}</div>`;
  if (mode === 'mythic') return h + mythicSection() + boardCard() + inviteCard();
  if (mode === 'vault') return h + vaultSection();
  if (mode === 'event') return h + `<div class="mythic locked"><b>${tx('活動')}</b><span class="sub" style="margin:0">${tx('即將推出：節慶副本、裝備副本等限時活動會放在這裡。')}</span></div>`;
  // 主線：章節分頁
  const chs = G.CHAPTERS, open = c => S.unlocked - 1 >= chs[c].floors[0];
  const ch = app.chapter != null && open(app.chapter) ? app.chapter : chs.reduce((a, c, i) => (open(i) ? i : a), 0);
  h += worldMap(ch, open);
  h += `<div class="chaprow"><div class="seg chapters">${chs.map((c, i) => `<button data-act="chapter" data-v="${i}" class="${ch === i ? 'sel' : ''}" ${open(i) ? '' : 'disabled'}><small>${c.name}${open(i) ? '' : ' 🔒'}</small>${c.sub}</button>`).join('')}</div><button class="btn sm storybtn" data-act="storylog" data-v="${ch}" aria-label="${tx('劇情回顧')}">${svg('open-book')}${tx('劇情')}</button></div>`;
  h += `<div class="dlist">`;
  G.DUNGEONS.forEach((_, i) => {
    if (i < chs[ch].floors[0] || i > chs[ch].floors[1]) return;
    const d = G.dungeonInfo(i), locked = i >= app.S.unlocked, clears = app.S.clears[i] || 0;
    const idleHere = app.S.idle === i;
    h += tx('<div class="dg {0}"> <div class="tier">{1}<small>第 {2} 層</small></div> <h3>{3}<span class="boss">首領・{4}</span></h3> <div class="tip">{5}</div> <div class="meta"> <span>建議 <b class="num {6}">Lv{7}</b></span> <span>裝等 <b class="num {8}">{9}</b></span> <span>掉落 <b class="num">{10}</b></span> <span>通關 <b class="num">{11}</b> 次</span> </div> <div class="acts">{12} </div>{13}</div>', locked ? 'locked' : '', `<span class="rn rn${Math.min(5, G.ROMAN[i].length)}">${G.ROMAN[i]}</span>` + dungeonIcon(i), i + 1, d.name, d.boss, d.tip, lv >= d.recLevel ? 'ok' : 'low', d.recLevel, il >= d.recIlvl ? 'ok' : 'low', d.recIlvl, d.dropIlvl, clears, locked ? tx('<span class="sub" style="margin:0">先通關上一層</span>') :
        tx('<button class="btn main grow" data-act="fight" data-d="{0}">挑戰</button> <button class="btn {1}" data-act="idle" data-d="{2}" {3}>{4}</button> <button class="btn" data-act="prepare" data-d="{5}" aria-label="{6}">備戰</button>', i, idleHere ? 'on' : '', i, clears ? '' : tx('disabled title="通關一次後才能掛機"'), idleHere ? tx('掛機中・停止') : tx('掛機刷'), i, G.partyLocked(app.S) ? tx('一鍵備戰：掛機中只調天賦、裝備') : tx('一鍵備戰：陣容、天賦、裝備')), locked ? '' : storyDrops(i));
  });
  h += `</div>` + tx('<div class="howto" style="margin-top:16px"><b>備戰</b>：依這層首領的弱點，自動排好陣容、天賦與裝備（掛機中陣容鎖定，只調天賦與裝備）。<br><b>掛機刷</b>：自動重複挑戰，關掉頁面也會累積（最多 {0} 小時），回來時一次結算。<br><b>存檔</b>：進度存在這支手機的瀏覽器。要換手機玩，點左上角的雙劍圖示開啟設定，匯出存檔碼。</div>', G.offlineCap(app.S));
  return h + inviteCard();
}
