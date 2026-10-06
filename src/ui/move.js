// ===== v0.17.2 搬家：舊網址（GitHub Pages）自動帶著本機存檔跳到新網址（Cloudflare） =====
// 存檔放在網址 # 後面（不會送到伺服器），先用 deflate 壓縮；新網址只在「這台還沒有存檔」時才匯入，避免被別人的連結覆蓋進度
import { KEY } from './state.js';
import { tx } from '../core/i18n.js';
import * as G from '../core/index.js';

export const NEW_ORIGIN = 'https://raid-leader.anubispaco.workers.dev';
const OLD_HOSTS = ['anubispaco-tech.github.io'];
const b64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = str => { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; };
const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
export async function pack(text) {
  const raw = new TextEncoder().encode(text);
  if (typeof CompressionStream === 'function') return 'z' + b64(await pipe(raw, new CompressionStream('deflate-raw')));
  return 'b' + b64(raw);
}
export async function unpack(code) {
  const bytes = unb64(code.slice(1));
  return new TextDecoder().decode(code[0] === 'z' ? await pipe(bytes, new DecompressionStream('deflate-raw')) : bytes);
}
// 舊網址：顯示「搬家中」然後跳轉；回傳 true 代表不要再啟動遊戲
export function moveAway() {
  if (!OLD_HOSTS.includes(location.hostname)) return false;
  document.body.insertAdjacentHTML('beforeend', `<div id="boot"><div class="blogo">${tx('副本團長')}</div><div class="bbar"><i></i></div><div class="bmsg">${tx('遊戲搬家了，正在帶著你的進度前往新網址…')}</div></div>`);
  let raw = null; try { raw = localStorage.getItem(KEY); } catch (e) { /* ignore */ }
  const go = hash => location.replace(NEW_ORIGIN + '/' + hash);
  if (!raw) { go(''); return true; }
  pack(raw).then(c => go('#move=' + c)).catch(() => go(''));
  return true;
}
// 新網址：網址帶著存檔 → 這台沒存檔才寫入；回傳 'moved' | 'kept' | 'bad' | null
export async function takeMoved() {
  const m = /^#move=([A-Za-z0-9_-]+)$/.exec(location.hash);
  if (!m) return null;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
  try { if (localStorage.getItem(KEY)) return 'kept'; } catch (e) { return 'bad'; }
  try {
    const s = G.sanitizeSave(JSON.parse(await unpack(m[1])));
    if (!s || typeof s !== 'object' || !Array.isArray(s.heroes) || !s.items) return 'bad';
    localStorage.setItem(KEY, JSON.stringify(s));
    return 'moved';
  } catch (e) { return 'bad'; }
}
