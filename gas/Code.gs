/**
 * 副本團長 Raid Leader — 遊玩數據、排行榜、意見回饋
 * 綁定在試算表「raid-leader」的 Apps Script。
 *
 * 部署步驟（只需一次）：
 *   1. 貼上本檔，存檔
 *   2. 上方函式選單選 setup → 執行（第一次會要求授權）
 *   3. 部署 → 新增部署作業 → 類型「網頁應用程式」
 *      執行身分：我　／　誰可以存取：所有人
 *   4. 複製結尾是 /exec 的網址，交給遊戲
 *
 * 之後改了程式：部署 → 管理部署作業 → 編輯 → 版本選「新版本」→ 部署（網址不變）
 * v0.9.3：新增「深淵最高／深淵鑰石」兩欄 → 貼上後先執行一次 setup（補表頭），再部署新版本
 * v0.10.1：新增「封鎖」欄與成績合理性檢查 → 同樣先執行 setup，再部署新版本
 * v0.21.1：玩家表新增「來源／推薦人／主畫面」三欄，摘要加各來源回訪率 → 貼上後先執行一次 setup（補表頭、舊玩家來源填 old），再部署新版本
 * v0.14：雲端存檔覆蓋前自動備份上一份（玩家看不到，只有管理員能還原）→ 貼上後執行一次 setup（補「雲端」表頭），再部署新版本
 *        還原方式：打開試算表 → 上方選單「副本團長」→ 在「雲端」分頁選取該玩家那一列 → 「還原選取列的備份存檔」
 * v0.13.2：雲端存檔改成自動同步（衝突偵測）→ 貼上新版後直接部署新版本即可（不用再跑 setup）
 * v0.13：雲端存檔（Google 登入）→ 在下面 CLIENT_ID 填入 OAuth 用戶端 ID，執行一次 setup（會要求 Drive 授權），再部署新版本
 *        存檔放在你 Google Drive 的「raid-leader-saves」資料夾，一位玩家一個檔；工作表「雲端」只記 Google 帳號編號（sub），不存 Email
 */

const SHEETS = {
  players: { name: '玩家', headers: ['玩家ID', '暱稱', '第一次遊玩', '最後上線', '回訪天數', '遊玩分鐘', '隊伍等級', '最高層', '秘境鑰石', '秘境最高', '版本', '遊玩日期', '深淵最高', '深淵鑰石', '封鎖（填任何字就不上天梯）', '來源', '推薦人（玩家ID）', '主畫面'] },
  events: { name: '事件', headers: ['時間', '玩家ID', '暱稱', '類型', '內容'] },
  feedback: { name: '回饋', headers: ['時間', '玩家ID', '暱稱', '意見', '當時進度', '版本'] },
  news: { name: '公告', headers: ['ID（不可重複，例如 n001）', '類型', '標題', '內容（可換行，網址會自動變連結）', '標題EN', '內容EN', '開始時間（空白＝立即）', '結束時間（空白＝不下架）', '置頂', '開啟時彈出', '最低版本（例如 0.18.0）', '狀態'] },
};
// v0.18 公告：狀態「上架」且在開始～結束時間內才會出現在遊戲；遊戲端快取 10 分鐘、GAS 端快取 1 分鐘
const NEWS = { types: ['公告', '活動', '更新', '維修'], status: ['上架', '草稿'], max: 20 };
const COL = { pid: 1, name: 2, first: 3, last: 4, days: 5, minutes: 6, level: 7, top: 8, key: 9, best: 10, ver: 11, dates: 12, best2: 13, key2: 14, ban: 15, src: 16, ref: 17, pwa: 18 };
// 成績合理性（v0.10.1）：傳奇秘境要通關第 7 層、深淵秘境要通關第 14 層才可能有成績；每次回報最多進步 JUMP 級
const SANE = { mythicTop: 7, abyssTop: 14, jump: 15 };
const TZ = 'Asia/Taipei';
// ---------- 雲端存檔（v0.13）----------
const CLIENT_ID = '927029065806-rcr8ur1pnnp7pnsm7g1vnjloq4h6gnpo.apps.googleusercontent.com'; // ← 貼上 Google Cloud 的 OAuth 用戶端 ID（xxxx.apps.googleusercontent.com）
const CLOUD = { sheet: '雲端', folder: 'raid-leader-saves', sessionDays: 30, maxBytes: 2 * 1024 * 1024 };
const CLOUD_HEAD = ['Google 帳號編號', '登入憑證', '憑證到期', '存檔檔案 ID', '最後上傳', '進度摘要', '版本', '玩家ID', '暱稱', '備份檔案 ID', '備份時間', '備份摘要', '備份挑戰數'];
const CC = { file: 4, at: 5, summary: 6, ver: 7, pid: 8, name: 9, bfile: 10, bat: 11, bsummary: 12, bruns: 13 }; // 「雲端」欄位（1 起算）
const BACKUP_HOURS = 6; // 一般上傳：備份超過 6 小時才換新，且只在進度沒有倒退時換（避免被誤蓋的存檔覆蓋掉好的備份）
const LIMIT_SEC = { snapshot: 20, event: 2, feedback: 60, login: 3, cloudsave: 15, cloudload: 3, cloudinfo: 2 }; // 同一位玩家的送出間隔下限

// ---------- 初始化：建立工作表與「摘要」 ----------
function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.values(SHEETS).forEach(def => {
    const sh = ss.getSheetByName(def.name) || ss.insertSheet(def.name);
    sh.getRange(1, 1, 1, def.headers.length).setValues([def.headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
  const ps = ss.getSheetByName(SHEETS.players.name);
  ps.hideColumns(COL.dates); // 遊玩日期清單只給程式用
  ps.getRange(1, COL.dates, ps.getMaxRows(), 1).setNumberFormat('@'); // 純文字，避免單一日期被自動轉成日期值
  fixDates();
  fillOldSource(); // v0.21.1 之前的玩家沒有來源 → 填 old
  const ns = ss.getSheetByName(SHEETS.news.name), nr = ns.getMaxRows() - 1;
  ns.getRange(2, 2, nr, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(NEWS.types, true).build());
  ns.getRange(2, 9, nr, 2).insertCheckboxes();
  ns.getRange(2, 11, nr, 1).setNumberFormat('@'); // 版本號維持文字（避免 0.18.0 被當成日期或數字）
  ns.getRange(2, 12, nr, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(NEWS.status, true).build());
  ns.getRange(2, 7, nr, 2).setNumberFormat('yyyy/mm/dd hh:mm');
  ns.setColumnWidth(3, 200); ns.setColumnWidth(4, 360);
  const cs = ss.getSheetByName(CLOUD.sheet) || ss.insertSheet(CLOUD.sheet);
  cs.getRange(1, 1, 1, CLOUD_HEAD.length).setValues([CLOUD_HEAD]).setFontWeight('bold'); cs.setFrozenRows(1);
  cloudFolder(); // 第一次執行會要求 Google Drive 授權

  const sum = ss.getSheetByName('摘要') || ss.insertSheet('摘要', 0);
  sum.clear();
  const P = `'${SHEETS.players.name}'`;
  sum.getRange('A1:B7').setValues([
    ['項目', '數值'],
    ['玩家人數', `=COUNTA(${P}!A2:A)`],
    ['回訪 ≥ 4 天的人數（第一次＋另外 3 天）', `=COUNTIF(${P}!E2:E,">=4")`],
    ['回訪比例', '=IFERROR(B3/B2,0)'],
    ['內測過關（> 50%）', '=IF(B4>0.5,"✅ 過關","尚未")'],
    ['平均遊玩分鐘', `=IFERROR(AVERAGE(${P}!F2:F),0)`],
    ['最近 24 小時上線人數', `=COUNTIF(${P}!D2:D,">="&TEXT(NOW()-1,"yyyy-mm-dd hh:mm:ss"))`],
  ]);
  sum.getRange('A1:B1').setFontWeight('bold');
  sum.getRange('B4').setNumberFormat('0%');
  // v0.21.1 各來源回訪率：來源代號見遊戲連結 ?src=（ig_story、ig_bio、threads、fb、line、share…；direct＝直接開網址、old＝v0.21.1 以前的玩家）
  const L = c => `${P}!${c}2:${c}`;
  sum.getRange('A9:D9').setValues([['來源', '玩家', '回訪 ≥ 4 天', '比例']]).setFontWeight('bold');
  sum.getRange('A10').setFormula(`=IFERROR(SORT(UNIQUE(FILTER(${L('P')},${L('P')}<>""))),"")`);
  sum.getRange('B10').setFormula(`=ARRAYFORMULA(IF(A10:A29="","",COUNTIF(${L('P')},A10:A29)))`);
  sum.getRange('C10').setFormula(`=ARRAYFORMULA(IF(A10:A29="","",COUNTIFS(${L('P')},A10:A29,${L('E')},">=4")))`);
  sum.getRange('D10').setFormula(`=ARRAYFORMULA(IF(A10:A29="","",IFERROR(C10:C29/B10:B29,0)))`);
  sum.getRange('D10:D29').setNumberFormat('0%');
  sum.getRange('F9:G9').setValues([['推廣', '數值']]).setFontWeight('bold');
  sum.getRange('F10:G12').setValues([
    ['朋友分享加入（有推薦人）', `=COUNTIF(${L('Q')},"?*")`],
    ['從主畫面開過的玩家', `=COUNTIF(${L('R')},"是")`],
    ['登入雲端存檔的玩家', `=MAX(0,COUNTA('${CLOUD.sheet}'!A2:A))`],
  ]);
  sum.setColumnWidth(6, 220);
}

// ---------- 遊戲送資料（POST，body 為 JSON 字串） ----------
function doPost(e) {
  try {
    const d = JSON.parse((e.postData && e.postData.contents) || '{}');
    const pid = String(d.pid || '');
    if (!/^[a-z0-9]{8,24}$/.test(pid)) return json({ ok: false, error: 'bad pid' });
    if (!LIMIT_SEC[d.type]) return json({ ok: false, error: 'bad type' });
    const cache = CacheService.getScriptCache(), ck = `${d.type}:${pid}`;
    if (cache.get(ck)) return json({ ok: false, error: 'too fast' });
    cache.put(ck, '1', LIMIT_SEC[d.type]);

    if (d.type === 'login') return json(cloudLogin(d));
    if (d.type === 'cloudsave' || d.type === 'cloudload' || d.type === 'cloudinfo') return json(cloudOp(d));

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const name = clean(d.name, 16) || '匿名';
      if (d.type === 'snapshot') upsertPlayer(pid, name, d);
      if (d.type === 'event') append(SHEETS.events, [now(), pid, name, clean(d.kind, 20), clean(d.detail, 200)]);
      if (d.type === 'feedback') {
        const text = clean(d.text, 1000);
        if (!text) return json({ ok: false, error: 'empty' });
        append(SHEETS.feedback, [now(), pid, name, text, clean(d.progress, 100), clean(d.ver, 10)]);
      }
    } finally { lock.releaseLock(); }
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

// ---------- 遊戲讀排行榜（GET ?action=leaderboard） ----------
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'news') return newsOut();
  if (action !== 'leaderboard') return json({ ok: true, service: 'raid-leader' });
  const cache = CacheService.getScriptCache(), hit = cache.get('leaderboard');
  if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);
  const rows = rowsOf(SHEETS.players).filter(r => r[COL.pid - 1] && !String(r[COL.ban - 1] || '').trim());
  const list = rows.map(r => ({
    name: r[COL.name - 1], best: Number(r[COL.best - 1]) || 0, best2: Number(r[COL.best2 - 1]) || 0, top: Number(r[COL.top - 1]) || 0,
    level: Number(r[COL.level - 1]) || 0, last: r[COL.last - 1],
  }))
    .sort((a, b) => b.best2 - a.best2 || b.best - a.best || b.top - a.top || b.level - a.level)
    .slice(0, 10);
  const out = JSON.stringify({ ok: true, updated: now(), list });
  cache.put('leaderboard', out, 60); // 1 分鐘快取，避免大家同時讀
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}

// ---------- v0.18 公告 ----------
function newsOut() {
  const cache = CacheService.getScriptCache(), hit = cache.get('news');
  if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.news.name), t = Date.now();
  const rows = sh && sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 12).getValues() : [];
  const ms = v => { if (v instanceof Date) return v.getTime(); if (!v) return 0;
    let x = String(v).trim().replace(/\//g, '-').replace(' ', 'T'); if (x.indexOf('T') < 0) x += 'T00:00';
    return new Date(x + '+08:00').getTime() || 0; };
  const txt = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').trim().slice(0, max);
  const list = rows
    .filter(r => r[0] && String(r[11]).trim() === '上架')
    .map(r => ({ id: txt(r[0], 20), type: NEWS.types.indexOf(String(r[1]).trim()) >= 0 ? String(r[1]).trim() : '公告',
      title: txt(r[2], 60), body: txt(r[3], 2000), titleEn: txt(r[4], 80), bodyEn: txt(r[5], 2000),
      start: ms(r[6]), end: ms(r[7]), pin: r[8] === true, pop: r[9] === true, minVer: txt(r[10], 12) }))
    .filter(n => n.title && (!n.start || n.start <= t) && (!n.end || n.end > t))
    .sort((a, b) => (b.pin - a.pin) || ((b.start || 0) - (a.start || 0)))
    .slice(0, NEWS.max);
  const out = JSON.stringify({ ok: true, at: t, list });
  cache.put('news', out, 60);
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}

// ---------- 玩家表：同一位玩家只有一列 ----------
function upsertPlayer(pid, name, d) {
  const sh = sheet(SHEETS.players), today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const ids = sh.getLastRow() > 1 ? sh.getRange(2, COL.pid, sh.getLastRow() - 1, 1).getValues().flat() : [];
  const idx = ids.indexOf(pid);
  const num = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
  // 不合理的成績直接歸零（例如還沒通關第 7 層卻有秘境成績）
  const top = num(d.top, 99);
  if (top < SANE.mythicTop) { d.best = 0; d.key = 0; }
  if (top < SANE.abyssTop) { d.best2 = 0; d.key2 = 0; }
  if (idx === -1) {
    sh.appendRow([pid, name, now(), now(), 1, num(d.playMin, 1e6), num(d.level, 100), num(d.top, 99), num(d.key, 99), Math.min(num(d.best, 99), SANE.jump), clean(d.ver, 10), "'" + today, Math.min(num(d.best2, 99), SANE.jump), num(d.key2, 99), '', srcOf(d.src), refOf(d.ref, pid), d.pwa ? '是' : '']);
    return;
  }
  const r = idx + 2, row = sh.getRange(r, 1, 1, SHEETS.players.headers.length).getValues()[0];
  const dates = normDates(row[COL.dates - 1]);
  if (!dates.includes(today)) dates.push(today);
  row[COL.name - 1] = name;
  row[COL.last - 1] = now();
  row[COL.days - 1] = dates.length;
  row[COL.minutes - 1] = Math.max(Number(row[COL.minutes - 1]) || 0, num(d.playMin, 1e6));
  row[COL.level - 1] = num(d.level, 100);
  row[COL.top - 1] = Math.max(Number(row[COL.top - 1]) || 0, num(d.top, 99));
  row[COL.key - 1] = num(d.key, 99);
  const capJump = (old, v) => Math.min(num(v, 99), old + SANE.jump); // 一次最多進步 jump 級
  const oldBest = Number(row[COL.best - 1]) || 0, oldBest2 = Number(row[COL.best2 - 1]) || 0;
  row[COL.best - 1] = Math.max(oldBest, capJump(oldBest, d.best));
  row[COL.best2 - 1] = Math.max(oldBest2, capJump(oldBest2, d.best2));
  row[COL.key2 - 1] = num(d.key2, 99);
  row[COL.ver - 1] = clean(d.ver, 10);
  // v0.21.1 來源與推薦人只記第一次；主畫面開過一次就標「是」
  while (row.length < SHEETS.players.headers.length) row.push('');
  if (!row[COL.src - 1] && d.src) row[COL.src - 1] = srcOf(d.src);
  if (!row[COL.ref - 1] && d.ref) row[COL.ref - 1] = refOf(d.ref, pid);
  if (d.pwa) row[COL.pwa - 1] = '是';
  row[COL.dates - 1] = dates.join(',');
  sh.getRange(r, COL.dates).setNumberFormat('@');
  sh.getRange(r, 1, 1, row.length).setValues([row]);
}

// v0.21.1 來源代號只收小寫英數與底線；推薦人必須是合法玩家 ID 且不是自己
function srcOf(v) { const s = String(v || '').toLowerCase(); return /^[a-z0-9_]{1,24}$/.test(s) ? s : ''; }
function refOf(v, pid) { const s = String(v || '').toLowerCase(); return /^[a-z0-9]{8,24}$/.test(s) && s !== pid ? s : ''; }
function fillOldSource() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.players.name), n = sh.getLastRow() - 1;
  if (n < 1) return;
  const rng = sh.getRange(2, COL.src, n, 1), vals = rng.getValues();
  const ids = sh.getRange(2, COL.pid, n, 1).getValues();
  vals.forEach((r, i) => { if (!r[0] && ids[i][0]) r[0] = 'old'; });
  rng.setValues(vals);
}

// 遊玩日期清單 → 去重的 yyyy-MM-dd 陣列（相容被試算表轉成日期值的舊資料）
function normDates(v) {
  const tz = Session.getScriptTimeZone();
  const list = v instanceof Date ? [v] : String(v || '').split(',');
  const out = [];
  list.forEach(x => {
    if (!x) return;
    let d = x;
    if (!(x instanceof Date)) {
      const t = String(x).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(t)) d = t;
      else { const p = new Date(t); if (isNaN(p)) return; d = p; }
    }
    if (d instanceof Date) d = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
    if (!out.includes(d)) out.push(d);
  });
  return out.sort();
}

// 一次性修正：重算所有玩家的遊玩日期與回訪天數（setup 會自動執行）
function fixDates() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.players.name);
  const n = sh.getLastRow() - 1;
  if (n < 1) return;
  const rng = sh.getRange(2, COL.days, n, COL.dates - COL.days + 1);
  const vals = rng.getValues();
  vals.forEach(row => { const d = normDates(row[COL.dates - COL.days]); row[0] = d.length; row[COL.dates - COL.days] = d.join(','); });
  sh.getRange(2, COL.dates, n, 1).setNumberFormat('@');
  rng.setValues(vals);
}

// ---------- 小工具 ----------
function sheet(def) {
  const sh = SpreadsheetApp.getActive().getSheetByName(def.name);
  if (!sh) throw new Error(`找不到工作表「${def.name}」，請先執行 setup`);
  return sh;
}
function rowsOf(def) {
  const sh = sheet(def);
  return sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, def.headers.length).getValues() : [];
}
function append(def, row) { sheet(def).appendRow(row); }
function now() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }
// 去掉換行以外的控制字元、避免被當成公式、限制長度
function clean(v, max) {
  let s = String(v == null ? '' : v).replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ---------- 雲端存檔 ----------
// 登入：遊戲送來 Google 的 ID token → 向 Google 驗證 → 發一組 30 天的登入憑證（之後上傳／下載都用它）
function cloudLogin(d) {
  if (!CLIENT_ID) return { ok: false, error: 'cloud off' };
  const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(String(d.idToken || '')), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return { ok: false, error: 'bad token' };
  const t = JSON.parse(r.getContentText());
  if (t.aud !== CLIENT_ID || !/^(https:\/\/)?accounts\.google\.com$/.test(t.iss) || Number(t.exp) * 1000 < Date.now()) return { ok: false, error: 'bad token' };
  const sub = String(t.sub), token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const exp = Date.now() + CLOUD.sessionDays * 864e5;
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sh = cloudSheet(), row = cloudRowBy(sh, 1, sub);
    if (row) { sh.getRange(row.r, 2, 1, 2).setValues([[token, exp]]); return { ok: true, token, updated: row.v[3] ? cloudMs(row.v[4]) : 0, summary: row.v[5] || '' }; }
    sh.appendRow([sub, token, exp, '', '', '', '', '', '', '', '', '', '']);
    return { ok: true, token, updated: 0, summary: '' };
  } finally { lock.releaseLock(); }
}
function cloudOp(d) {
  const sh = cloudSheet(), row = cloudRowBy(sh, 2, String(d.token || ''));
  if (!row || !row.v[1] || Number(row.v[2]) < Date.now()) return { ok: false, error: 'login' };
  const cur = row.v[3] ? cloudMs(row.v[4]) : 0;
  if (d.type === 'cloudinfo') return { ok: true, updated: cur, summary: row.v[5] || '' };
  if (d.type === 'cloudload') {
    if (!row.v[3]) return { ok: true, save: null, updated: 0 };
    return { ok: true, save: DriveApp.getFileById(row.v[3]).getBlob().getDataAsString(), updated: cur, summary: row.v[5] };
  }
  // cloudsave：存檔內容只做大小與 JSON 檢查，遊戲讀回來時會再過濾
  const text = String(d.save || '');
  if (!text || text.length > CLOUD.maxBytes) return { ok: false, error: 'size' };
  try { JSON.parse(text); } catch (e) { return { ok: false, error: 'json' }; }
  // 衝突偵測：雲端在這台裝置上次同步之後被別台更新過 → 不覆蓋，交給玩家選（force = 玩家確認要覆蓋）
  if (!d.force && d.base != null && cur && Number(d.base) !== cur) return { ok: false, error: 'conflict', updated: cur, summary: row.v[5] || '' };
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    let id = row.v[3];
    if (id) {
      const file = DriveApp.getFileById(id);
      cloudBackup(sh, row, file.getBlob().getDataAsString(), runsOf(text), !!d.force);
      file.setContent(text);
    }
    else id = cloudFolder().createFile(row.v[0] + '.json', text, 'application/json').getId();
    const at = Date.now();
    sh.getRange(row.r, CC.file, 1, 6).setValues([[id, at, clean(d.summary, 100), clean(d.ver, 10), String(d.pid || ''), clean(d.name, 16)]]);
    return { ok: true, updated: at };
  } finally { lock.releaseLock(); }
}
// v0.14 備份：把即將被覆蓋的舊存檔複製到「<sub>.prev.json」
//   一定備份：玩家選擇覆蓋雲端（force）、或新存檔的挑戰次數比舊的少（疑似舊進度蓋掉新進度）
//   定期換新：沒有備份或備份超過 BACKUP_HOURS 小時，且舊存檔進度不低於目前備份
function cloudBackup(sh, row, oldText, newRuns, force) {
  const oldRuns = runsOf(oldText), bRuns = Number(row.v[CC.bruns - 1]) || 0, bAt = Number(row.v[CC.bat - 1]) || 0;
  const due = !row.v[CC.bfile - 1] || Date.now() - bAt > BACKUP_HOURS * 3600e3;
  if (!(force || newRuns < oldRuns || (due && oldRuns >= bRuns))) return;
  let bid = row.v[CC.bfile - 1];
  if (bid) DriveApp.getFileById(bid).setContent(oldText);
  else bid = cloudFolder().createFile(row.v[0] + '.prev.json', oldText, 'application/json').getId();
  sh.getRange(row.r, CC.bfile, 1, 4).setValues([[bid, Date.now(), row.v[CC.summary - 1] || '', oldRuns]]);
}
function runsOf(text) { try { return Number(JSON.parse(text).stats.runs) || 0; } catch (e) { return 0; } }

// ---------- 管理員：還原備份（試算表上方選單「副本團長」）----------
function onOpen() {
  SpreadsheetApp.getUi().createMenu('副本團長').addItem('還原選取列的備份存檔', 'restoreSelectedBackup').addToUi();
}
// 在「雲端」分頁選取玩家那一列後執行：主存檔與備份「互換」（還原後原本的存檔變成備份，可以再換回來）
// 玩家下次開遊戲或切回遊戲時會偵測到雲端較新，自動載入（若那台有新進度會先問玩家）
function restoreSelectedBackup() {
  const ui = SpreadsheetApp.getUi(), sh = SpreadsheetApp.getActiveSheet();
  if (sh.getName() !== CLOUD.sheet) { ui.alert('請先切到「' + CLOUD.sheet + '」分頁，選取要還原的玩家那一列。'); return; }
  const r = sh.getActiveRange().getRow();
  if (r < 2) { ui.alert('請選取玩家那一列（不是表頭）。'); return; }
  const v = sh.getRange(r, 1, 1, CLOUD_HEAD.length).getValues()[0];
  if (!v[CC.file - 1] || !v[CC.bfile - 1]) { ui.alert('這位玩家還沒有備份存檔。'); return; }
  const who = (v[CC.name - 1] || '（未記錄暱稱）') + '／' + (v[CC.pid - 1] || v[0]);
  const ok = ui.alert('還原備份', who + '\n\n目前：' + v[CC.summary - 1] + '\n備份：' + v[CC.bsummary - 1] + '（' + Utilities.formatDate(new Date(Number(v[CC.bat - 1])), TZ, 'MM/dd HH:mm') + '）\n\n要把備份換成目前存檔嗎？（原本的存檔會變成備份，可再換回來）', ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) return;
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const main = DriveApp.getFileById(v[CC.file - 1]), back = DriveApp.getFileById(v[CC.bfile - 1]);
    const a = main.getBlob().getDataAsString(), b = back.getBlob().getDataAsString();
    main.setContent(b); back.setContent(a);
    const at = Date.now();
    sh.getRange(r, CC.at, 1, 2).setValues([[at, v[CC.bsummary - 1]]]);
    sh.getRange(r, CC.bat, 1, 3).setValues([[at, v[CC.summary - 1], runsOf(a)]]);
  } finally { lock.releaseLock(); }
  ui.alert('已還原。請玩家重新開啟遊戲（或切回遊戲），會自動載入還原後的進度。');
}
// 「最後上傳」一律回傳毫秒數（舊資料可能被試算表轉成日期）
function cloudMs(v) { return v instanceof Date ? v.getTime() : (Number(v) || (v ? new Date(String(v).replace(' ', 'T') + '+08:00').getTime() : 0) || 0); }
function cloudSheet() {
  const ss = SpreadsheetApp.getActive();
  return ss.getSheetByName(CLOUD.sheet) || (setup(), ss.getSheetByName(CLOUD.sheet));
}
function cloudRowBy(sh, col, value) {
  if (!value || sh.getLastRow() < 2) return null;
  const vals = sh.getRange(2, 1, sh.getLastRow() - 1, CLOUD_HEAD.length).getValues();
  const i = vals.findIndex(v => String(v[col - 1]) === value);
  return i < 0 ? null : { r: i + 2, v: vals[i] };
}
function cloudFolder() {
  const it = DriveApp.getFoldersByName(CLOUD.folder);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CLOUD.folder);
}

