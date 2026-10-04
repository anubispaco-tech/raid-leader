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
 * v0.13.2：雲端存檔改成自動同步（衝突偵測）→ 貼上新版後直接部署新版本即可（不用再跑 setup）
 * v0.13：雲端存檔（Google 登入）→ 在下面 CLIENT_ID 填入 OAuth 用戶端 ID，執行一次 setup（會要求 Drive 授權），再部署新版本
 *        存檔放在你 Google Drive 的「raid-leader-saves」資料夾，一位玩家一個檔；工作表「雲端」只記 Google 帳號編號（sub），不存 Email
 */

const SHEETS = {
  players: { name: '玩家', headers: ['玩家ID', '暱稱', '第一次遊玩', '最後上線', '回訪天數', '遊玩分鐘', '隊伍等級', '最高層', '秘境鑰石', '秘境最高', '版本', '遊玩日期', '深淵最高', '深淵鑰石', '封鎖（填任何字就不上天梯）'] },
  events: { name: '事件', headers: ['時間', '玩家ID', '暱稱', '類型', '內容'] },
  feedback: { name: '回饋', headers: ['時間', '玩家ID', '暱稱', '意見', '當時進度', '版本'] },
};
const COL = { pid: 1, name: 2, first: 3, last: 4, days: 5, minutes: 6, level: 7, top: 8, key: 9, best: 10, ver: 11, dates: 12, best2: 13, key2: 14, ban: 15 };
// 成績合理性（v0.10.1）：傳奇秘境要通關第 7 層、深淵秘境要通關第 14 層才可能有成績；每次回報最多進步 JUMP 級
const SANE = { mythicTop: 7, abyssTop: 14, jump: 15 };
const TZ = 'Asia/Taipei';
// ---------- 雲端存檔（v0.13）----------
const CLIENT_ID = '927029065806-rcr8ur1pnnp7pnsm7g1vnjloq4h6gnpo.apps.googleusercontent.com'; // ← 貼上 Google Cloud 的 OAuth 用戶端 ID（xxxx.apps.googleusercontent.com）
const CLOUD = { sheet: '雲端', folder: 'raid-leader-saves', sessionDays: 30, maxBytes: 2 * 1024 * 1024 };
const CLOUD_HEAD = ['Google 帳號編號', '登入憑證', '憑證到期', '存檔檔案 ID', '最後上傳', '進度摘要', '版本'];
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
  sum.setColumnWidth(1, 300);
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
    sh.appendRow([pid, name, now(), now(), 1, num(d.playMin, 1e6), num(d.level, 100), num(d.top, 99), num(d.key, 99), Math.min(num(d.best, 99), SANE.jump), clean(d.ver, 10), "'" + today, Math.min(num(d.best2, 99), SANE.jump), num(d.key2, 99), '']);
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
  row[COL.dates - 1] = dates.join(',');
  sh.getRange(r, COL.dates).setNumberFormat('@');
  sh.getRange(r, 1, 1, row.length).setValues([row]);
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
    sh.appendRow([sub, token, exp, '', '', '', '']);
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
    if (id) DriveApp.getFileById(id).setContent(text);
    else id = cloudFolder().createFile(row.v[0] + '.json', text, 'application/json').getId();
    const at = Date.now();
    sh.getRange(row.r, 4, 1, 4).setValues([[id, at, clean(d.summary, 100), clean(d.ver, 10)]]);
    return { ok: true, updated: at };
  } finally { lock.releaseLock(); }
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

