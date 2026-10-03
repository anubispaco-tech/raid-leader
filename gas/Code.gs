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
 */

const SHEETS = {
  players: { name: '玩家', headers: ['玩家ID', '暱稱', '第一次遊玩', '最後上線', '回訪天數', '遊玩分鐘', '隊伍等級', '最高層', '秘境鑰石', '秘境最高', '版本', '遊玩日期'] },
  events: { name: '事件', headers: ['時間', '玩家ID', '暱稱', '類型', '內容'] },
  feedback: { name: '回饋', headers: ['時間', '玩家ID', '暱稱', '意見', '當時進度', '版本'] },
};
const COL = { pid: 1, name: 2, first: 3, last: 4, days: 5, minutes: 6, level: 7, top: 8, key: 9, best: 10, ver: 11, dates: 12 };
const TZ = 'Asia/Taipei';
const LIMIT_SEC = { snapshot: 20, event: 2, feedback: 60 }; // 同一位玩家的送出間隔下限

// ---------- 初始化：建立工作表與「摘要」 ----------
function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.values(SHEETS).forEach(def => {
    const sh = ss.getSheetByName(def.name) || ss.insertSheet(def.name);
    sh.getRange(1, 1, 1, def.headers.length).setValues([def.headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
  ss.getSheetByName(SHEETS.players.name).hideColumns(COL.dates); // 遊玩日期清單只給程式用

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
  const rows = rowsOf(SHEETS.players).filter(r => r[COL.pid - 1]);
  const list = rows.map(r => ({
    name: r[COL.name - 1], best: Number(r[COL.best - 1]) || 0, top: Number(r[COL.top - 1]) || 0,
    level: Number(r[COL.level - 1]) || 0, last: r[COL.last - 1],
  }))
    .sort((a, b) => b.best - a.best || b.top - a.top || b.level - a.level)
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
  if (idx === -1) {
    sh.appendRow([pid, name, now(), now(), 1, num(d.playMin, 1e6), num(d.level, 40), num(d.top, 7), num(d.key, 99), num(d.best, 99), clean(d.ver, 10), today]);
    return;
  }
  const r = idx + 2, row = sh.getRange(r, 1, 1, SHEETS.players.headers.length).getValues()[0];
  const dates = String(row[COL.dates - 1] || '').split(',').filter(Boolean);
  if (!dates.includes(today)) dates.push(today);
  row[COL.name - 1] = name;
  row[COL.last - 1] = now();
  row[COL.days - 1] = dates.length;
  row[COL.minutes - 1] = Math.max(Number(row[COL.minutes - 1]) || 0, num(d.playMin, 1e6));
  row[COL.level - 1] = num(d.level, 40);
  row[COL.top - 1] = Math.max(Number(row[COL.top - 1]) || 0, num(d.top, 7));
  row[COL.key - 1] = num(d.key, 99);
  row[COL.best - 1] = Math.max(Number(row[COL.best - 1]) || 0, num(d.best, 99));
  row[COL.ver - 1] = clean(d.ver, 10);
  row[COL.dates - 1] = dates.join(',');
  sh.getRange(r, 1, 1, row.length).setValues([row]);
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
