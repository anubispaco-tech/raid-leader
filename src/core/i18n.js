// ===== 多語言：tx('中文原文', 參數…) =====
// 以中文原文當 key：中文版直接回傳原文；其他語言查字典，查不到就退回中文，所以漏翻不會壞掉。
// 參數用 {0} {1}… 代入。語言存在 localStorage，切換後重新載入頁面（資料表在載入時就翻好）。
import en from '../i18n/en.js';

const DICTS = { en };
export const LANGS = [{ id: 'zh-TW', name: '繁體中文' }, { id: 'en', name: 'English' }];
const KEY = 'raid-leader-lang';
let lang = 'zh-TW';
try { const v = globalThis.localStorage && globalThis.localStorage.getItem(KEY); if (v && (v === 'zh-TW' || DICTS[v])) lang = v; } catch (e) { /* 無痕模式等 */ }

export const getLang = () => lang;
export function setLang(l) { try { globalThis.localStorage.setItem(KEY, l); } catch (e) { /* ignore */ } }
// 存檔裡的英雄名、裝備名是在當時的語言產生的：切換語言時換成目前語言（中英雙向）
let REV = null;
export function localName(s) {
  if (!s) return s;
  const en = DICTS.en;
  if (s.includes('・') && lang === 'en') { const [a, b] = s.split('・'); if (en[a] && en[b]) return en[a] + ' ' + en[b]; } // 名字・稱號
  if (lang === 'en') {
    if (en[s]) return en[s];
    const i = s.indexOf('的'); // 裝備名 = 「xx的」前綴 + 名詞
    if (i > 0 && en[s.slice(0, i + 1)] && en[s.slice(i + 1)]) return en[s.slice(0, i + 1)] + en[s.slice(i + 1)];
    return s;
  }
  if (!REV) { REV = {}; for (const [k, v] of Object.entries(en)) if (v.length < 24 && !(v in REV)) REV[v] = k; }
  if (REV[s]) return REV[s];
  const sp = s.split(' '); if (sp.length === 2 && REV[sp[0]] && REV[sp[1]]) return REV[sp[0]] + '・' + REV[sp[1]]; // Name Title → 名字・稱號
  const j = s.indexOf(' ');
  if (j > 0 && REV[s.slice(0, j + 1)] && REV[s.slice(j + 1)]) return REV[s.slice(0, j + 1)] + REV[s.slice(j + 1)];
  return s;
}
export function tx(key, ...args) {
  const d = DICTS[lang], s = (d && d[key]) || key;
  return args.length ? s.replace(/\{(\d+)\}/g, (m, i) => (i < args.length ? args[i] : m)) : s;
}
