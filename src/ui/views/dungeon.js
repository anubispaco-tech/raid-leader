// ===== 副本分頁 =====
import { tx } from '../../core/i18n.js';
import * as G from '../../core/index.js';
import { app } from '../state.js';
import { fmt, mmss, esc, partyPower, avgPartyIlvl, avgPartyLv } from '../helpers.js';
import { leaderboard } from '../telemetry.js';

// ---------- 下一步建議卡 ----------
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
  return tx('<div class="vault"><div class="mhead"><div><span class="label">寶庫</span><b>60 秒打寶藏哥布林</b></div><span class="vleft num">今天剩 {0}/{1}</span></div> <div class="seg vfloors">{2}</div> <p class="sub" style="margin:0">第 {3} 層：每隻 <b class="num">{4}</b> 金，最多算 {5} 隻・最佳 {6} 隻。打你目前最高的那層通常最賺。</p> <div class="row"><button class="btn main grow" data-act="vault" data-d="{7}" {8}>{9}</button><button class="btn" data-act="prepare-vault">備戰</button></div></div>', left, G.VAULT.daily, floors.map(i => `<button data-act="vaultfloor" data-d="${i}" class="${i === f ? 'sel' : ''}">${i + 1}</button>`).join(''), f + 1, fmt(G.vaultGoldPerKill(f)), G.vaultMaxKills(f), best, f, left ? '' : 'disabled', left ? tx('進入寶庫') : tx('明天 00:00 再來'));
}
// ---------- 傳奇秘境 ----------
function mythicSection() {
  const S = app.S;
  if (!G.mythicUnlocked(S)) return tx('<div class="mythic locked"><b>傳奇秘境</b><span class="sub" style="margin:0">通關第 7 層「龍眠高塔」後解鎖：無限層數、限時挑戰、每日詞綴。</span></div>');
  const key = S.mythic.key, today = G.dailyAffixes(), active = G.activeAffixes(key);
  let h = tx('<div class="mythic"><div class="mhead"><div><span class="label">傳奇秘境</span><b>目前鑰石</b></div><span class="keystone num">+{0}</span></div> <div class="affixes">{1}</div> <p class="sub" style="margin:0">今日詞綴，每天 00:00 更換。限時內通關，鑰石 +1，打得夠快 +2；超時或失敗，鑰石 −1。<b>秘境掛機</b>：限時通關過的副本可以掛機，固定打該副本最佳 −{2}，鑰石不變、獎勵 {3}%，離線也會累積。</p> <div class="mlist">', key, today.map((a, i) => `<div class="affix ${active.includes(a) ? 'on' : ''}"><b>${G.AFFIXES[a].name}</b><span>${G.AFFIXES[a].desc}</span><small>${active.includes(a) ? tx('考驗{0}', G.AFFIXES[a].test) : tx('+{0} 起生效', G.MYTHIC.affixAt[i])}</small></div>`).join(''), G.MYTHIC.idleBelow, Math.round(G.MYTHIC.idleMult * 100));
  G.DUNGEONS.forEach((d, i) => {
    const best = S.mythic.best[i];
    h += tx('<div class="mrow2"><div class="mname"><b>{0}</b><span class="sub num" style="margin:0">限時 {1}・{2}</span></div> {3} <button class="btn sm" data-act="recommend-mythic" data-d="{4}" aria-label="一鍵備戰：陣容、天賦、裝備">備戰</button> <button class="btn sm main" data-act="mythic" data-d="{5}">挑戰 +{6}</button></div>', d.name, mmss(G.mythicTimer(i)), best ? tx('最佳 +{0}（{1}）', best.level, mmss(best.time)) : tx('還沒限時通關'), G.mythicIdleLevel(S, i) ? `<button class="btn sm ${S.idleMythic === i ? 'on' : ''}" data-act="idlemythic" data-d="${i}">${S.idleMythic === i ? tx('掛機中・停止') : tx('掛機 +{0}', G.mythicIdleLevel(S, i))}</button>` : '', i, i, key);
  });
  return h + `</div></div>`;
}
// ---------- 天梯（排行榜）----------
function boardCard() {
  const lb = leaderboard(); if (!lb) return '';
  const me = app.S.player.name;
  let body;
  if (!lb.data) body = `<p class="sub" style="margin:0">${lb.error ? tx('天梯暫時讀不到，稍後再試。') : tx('讀取中…')}</p>`;
  else if (!lb.data.length) body = tx('<p class="sub" style="margin:0">還沒有人上榜，搶第一吧。</p>');
  else body = `<ol class="board">${lb.data.map((p, i) => `<li class="${me && p.name === me ? 'me' : ''}"><span class="rk num">${i + 1}</span><b>${esc(p.name)}</b>
      <span class="num">${p.best ? tx('秘境 +{0}', p.best) : tx('第 {0} 層', p.top)}</span><span class="sub num" style="margin:0">Lv${p.level}</span></li>`).join('')}</ol>`;
  return tx('<div class="boardcard"><div class="row" style="align-items:baseline"><b>天梯</b><span class="sub" style="margin:0 0 0 auto">{0}・<button class="linkbtn" data-act="nick">{1}</button></span></div>{2} <p class="sub" style="margin:0">依秘境最高限時等級排名。你的成績每 5 分鐘上傳一次。</p></div>', me ? tx('你是「{0}」', esc(me)) : tx('匿名'), me ? tx('改暱稱') : tx('設定暱稱'), body);
}
export function viewDungeons() {
  const lv = avgPartyLv(), il = avgPartyIlvl();
  let h = nextStepCard() + tx('<h2>副本</h2><p class="sub">隊伍平均 <b class="num">Lv{0}</b>・裝等 <b class="num">{1}</b>・戰力 <b class="num">{2}</b>　｜　每隻首領都有弱點，打不過就換陣容，或回頭刷裝備。</p>', lv, il, fmt(partyPower()));
  // 遊玩分類：主線／秘境／寶庫／活動（之後的節慶、裝備副本放「活動」）
  const S = app.S, mode = app.mode || 'story';
  const modes = [['story', tx('主線')], ['mythic', tx('秘境')], ['vault', tx('寶庫')], ['event', tx('活動')]];
  h += `<div class="seg modes">${modes.map(([k, n]) => `<button data-act="mode" data-v="${k}" class="${mode === k ? 'sel' : ''}">${n}</button>`).join('')}</div>`;
  if (mode === 'mythic') return h + mythicSection() + boardCard();
  if (mode === 'vault') return h + vaultSection();
  if (mode === 'event') return h + `<div class="mythic locked"><b>${tx('活動')}</b><span class="sub" style="margin:0">${tx('即將推出：節慶副本、裝備副本等限時活動會放在這裡。')}</span></div>`;
  // 主線：章節分頁
  const chs = G.CHAPTERS, open = c => S.unlocked - 1 >= chs[c].floors[0];
  const ch = app.chapter != null && open(app.chapter) ? app.chapter : chs.reduce((a, c, i) => (open(i) ? i : a), 0);
  h += `<div class="seg chapters">${chs.map((c, i) => `<button data-act="chapter" data-v="${i}" class="${ch === i ? 'sel' : ''}" ${open(i) ? '' : 'disabled'}>${c.name}・${c.sub}${open(i) ? '' : ' 🔒'}</button>`).join('')}</div>`;
  h += `<div class="dlist">`;
  G.DUNGEONS.forEach((_, i) => {
    if (i < chs[ch].floors[0] || i > chs[ch].floors[1]) return;
    const d = G.dungeonInfo(i), locked = i >= app.S.unlocked, clears = app.S.clears[i] || 0;
    const idleHere = app.S.idle === i;
    h += tx('<div class="dg {0}"> <div class="tier">{1}<small>第 {2} 層</small></div> <h3>{3}<span class="boss">首領・{4}</span></h3> <div class="tip">{5}</div> <div class="meta"> <span>建議 <b class="num {6}">Lv{7}</b></span> <span>裝等 <b class="num {8}">{9}</b></span> <span>掉落 <b class="num">{10}</b></span> <span>通關 <b class="num">{11}</b> 次</span> </div> <div class="acts">{12} </div></div>', locked ? 'locked' : '', G.ROMAN[i], i + 1, d.name, d.boss, d.tip, lv >= d.recLevel ? 'ok' : 'low', d.recLevel, il >= d.recIlvl ? 'ok' : 'low', d.recIlvl, d.dropIlvl, clears, locked ? tx('<span class="sub" style="margin:0">先通關上一層</span>') :
        tx('<button class="btn main grow" data-act="fight" data-d="{0}">挑戰</button> <button class="btn {1}" data-act="idle" data-d="{2}" {3}>{4}</button> <button class="btn" data-act="prepare" data-d="{5}" aria-label="{6}">備戰</button>', i, idleHere ? 'on' : '', i, clears ? '' : tx('disabled title="通關一次後才能掛機"'), idleHere ? tx('掛機中・停止') : tx('掛機刷'), i, G.partyLocked(app.S) ? tx('一鍵備戰：掛機中只調天賦、裝備') : tx('一鍵備戰：陣容、天賦、裝備')));
  });
  h += `</div>` + tx('<div class="howto" style="margin-top:16px"><b>備戰</b>：依這層首領的弱點，自動排好陣容、天賦與裝備（掛機中陣容鎖定，只調天賦與裝備）。<br><b>掛機刷</b>：自動重複挑戰，關掉頁面也會累積（最多 {0} 小時），回來時一次結算。<br><b>存檔</b>：進度存在這支手機的瀏覽器。要換手機玩，到「團隊」最下方匯出存檔碼。</div>', G.ECONOMY.offlineCapHours);
  return h;
}
