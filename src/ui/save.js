// ===== 存檔：本機儲存與存檔碼 =====
import { tx } from '../core/i18n.js';
import { app, KEY } from './state.js';

export function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch (e) {}
  return null;
}
export function save() {
  if (app.fresh) return; // 新玩家還在開始畫面：先不存
  app.S.lastSeen = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(app.S)); } catch (e) {}
}
export function exportCode() { return btoa(unescape(encodeURIComponent(JSON.stringify(app.S)))); }
export function importCode(code) {
  const s = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
  if (!s || !Array.isArray(s.heroes) || !s.items) throw new Error(tx('格式不符'));
  return s;
}
