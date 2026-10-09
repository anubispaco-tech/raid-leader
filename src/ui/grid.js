// ===== v0.20 格子戰場：用格子的顏色、範圍、方向、閃爍頻率與堆疊高度表現戰鬥 =====
// 格子 DOM 常駐（不跟著每秒的 innerHTML 重畫），render 時搬回 #gridSlot；
// 戰鬥核心每 tick 留下演出事件（Battle.fxq），這裡把它們分散在下一秒內播放。
// 站位用「粗格」7×9 規劃，畫面是 K 倍的細格（14×18）：隊員與小怪佔 2×2、首領 6×6，特效在細格上跑，軌跡比較順。
// 注意：這裡只能用 Math.random，不能用 core 的 R()，否則會改變戰鬥結果。
import { tx } from '../core/i18n.js';
import { prefs, setPref } from './prefs.js';
import { play } from './sfx.js';
import { svg, CLASS_GLYPH, enemyGlyph } from './icons.js';
import { ACTIVES } from '../core/actives.js';

const K = 2, CR = 9, CC = 7, MID = 4;          // 粗格列數、欄數、中線（粗格列）
const ROWS = CR * K, COLS = CC * K;
const COL = {
  phys: '#f4ead0', enemy: '#ff4d5e', heal: '#57e09a', shield: '#7fe3ff', cast: '#ff8a3d',
  curse: '#b072ff', bolt: '#ffe14d', gold: '#e8c06a', white: '#ffffff', tide: '#3f8fe0', charm: '#e05fd0',
};
const CLASS_COL = { guardian: '#5d8ff0', cleric: '#4fc17f', rogue: '#e3664f', mage: '#f08a4b', druid: '#8bc34a', shaman: '#5fb8e8' };
const BOSS_COL = '#b13e53', BOSS_PHASE = '#d8344a', FOE_COL = '#7a3a46', GOBLIN_COL = '#b8902e', DEAD_COL = '#3a4150';
export const ZOOM = { min: 0.6, max: 2, step: 1.2 }; // 立體視角的縮放範圍（倍率，乘在預設大小上）

// 站位（粗格）：隊伍依職責；敵人依「有沒有首領、幾隻首領」
const HERO_SLOTS = {
  tank: [[5, 3], [5, 2], [5, 4]],
  heal: [[7, 3], [7, 2], [7, 4]],
  dps: [[6, 2], [6, 4], [6, 1], [6, 5], [7, 1], [7, 5], [8, 3]],
};
const ANY_HERO = []; for (let r = MID + 1; r < CR; r++) for (let c = 0; c < CC; c++) ANY_HERO.push([r, c]);
const FOE_SLOTS = [[3, 3], [3, 2], [3, 4], [3, 1], [3, 5], [1, 0], [1, 6], [3, 0], [3, 6], [2, 0], [2, 6], [0, 0], [0, 6], [2, 1], [2, 5], [1, 1], [1, 5], [0, 3], [1, 3], [2, 3]];
const TRASH_SLOTS = [[2, 3], [2, 2], [2, 4], [1, 3], [1, 1], [1, 5], [2, 1], [2, 5], [3, 3], [0, 3], [1, 2], [1, 4], [3, 2], [3, 4], [2, 0], [2, 6], [0, 1], [0, 5], [3, 1], [3, 5]];

let root = null, board = null, cells = [], cur = null, waveSeen = -1;
let owners = new Map();      // 單位 id → { kind, unit, cells, core, center, lab, cr, cc, size }
const occ = new Map();       // 粗格 'r,c' → 單位 id
const ghosts = new Map();    // 這一 tick 剛移除的單位（被擊殺、換波）：讓事件還找得到位置
const longAnims = new Map(); // 讀條警示、詛咒等持續動畫：key → [Animation]
let shakeAt = 0;

const at = p => cells[p[0]][p[1]];
const dist = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
// 粗格列範圍 → 細格清單（整列寬）
function area(r0, r1) { const o = []; for (let r = r0 * K; r < (r1 + 1) * K; r++) for (let c = 0; c < COLS; c++) o.push([r, c]); return o; }

function build() {
  root = document.createElement('div'); root.className = 'gstage';
  board = document.createElement('div'); board.className = 'gboard'; board.setAttribute('aria-hidden', 'true');
  board.style.setProperty('--cols', COLS);
  root.appendChild(board);
  // 立體視角的縮放鍵（只縮放、不旋轉）；按鈕事件由 main.js 的 data-act 統一處理
  const z = document.createElement('div'); z.className = 'gzoom';
  z.innerHTML = `<button type="button" data-act="gzoom" data-v="-1" aria-label="${tx('縮小')}">−</button><button type="button" data-act="gzoom" data-v="1" aria-label="${tx('放大')}">＋</button>`;
  root.appendChild(z);
  cells = [];
  for (let r = 0; r < ROWS; r++) {
    cells.push([]);
    for (let c = 0; c < COLS; c++) {
      const el = document.createElement('div'); el.className = 'gcell' + (Math.floor(r / K) === MID ? ' gmid' : '');
      el.style.gridArea = `${r + 1} / ${c + 1}`;
      const floor = document.createElement('div'); floor.className = 'gfloor';
      const stack = document.createElement('div'); stack.className = 'gstack';
      const fx = document.createElement('div'); fx.className = 'gfx';
      el.append(floor, stack, fx); board.appendChild(el);
      cells[r].push({ el, stack, fx, base: 0, bonus: 0, color: null, shield: false, owner: null, sig: '', gen: 0 });
    }
  }
  pinchZoom();
}
function clearCell(c) { c.gen++; Object.assign(c, { base: 0, bonus: 0, color: null, shield: false, owner: null }); }

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16), ch = s => Math.round(((n >> s) & 255) * f);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
const topOf = c => Math.max(0, c.base + c.bonus) + (c.shield ? 1 : 0);
function paint(c) {
  const n = Math.max(0, c.base + c.bonus), sig = `${n}|${c.color}|${c.shield}`;
  if (sig === c.sig) return;
  c.sig = sig; c.stack.textContent = '';
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div'); s.className = 'gslab';
    s.style.setProperty('--i', i); s.style.background = shade(c.color || DEAD_COL, 0.42 + 0.58 * (i + 1) / n);
    c.stack.appendChild(s);
  }
  if (c.shield) { const s = document.createElement('div'); s.className = 'gslab gshield'; s.style.setProperty('--i', n); c.stack.appendChild(s); }
  c.fx.style.setProperty('--top', topOf(c));
}

// ---------- 站位 ----------
function place(id, kind, unit, cr, cc, size = 1) {
  const list = [];
  for (let y = 0; y < size * K; y++) for (let x = 0; x < size * K; x++) list.push([cr * K + y, cc * K + x]);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) occ.set(`${cr + y},${cc + x}`, id);
  for (const p of list) at(p).owner = id;
  const half = Math.floor(size * K / 2), center = [cr * K + half, cc * K + half];
  const core = size === 1 ? list : list.filter(p => dist(p, center) <= 1);
  // 單位標籤（圖示＋血條）：跨整個方塊，浮在最高那層上面
  const lab = document.createElement('div'); lab.className = 'glab' + (kind === 'boss' ? ' gboss' : '');
  lab.style.gridArea = `${cr * K + 1} / ${cc * K + 1} / span ${size * K} / span ${size * K}`;
  lab.innerHTML = `${svg(kind === 'hero' ? CLASS_GLYPH[unit.cls] : enemyGlyph(unit))}<span class="ghp"><i></i></span>`;
  board.appendChild(lab);
  owners.set(id, { kind, unit, cells: list, core, center, lab, cr, cc, size });
}
const freeOf = list => list.find(([r, c]) => !occ.has(`${r},${c}`));
function placeHeroes(b) {
  for (const u of b.units) {
    const p = freeOf(HERO_SLOTS[u.role] || []) || freeOf(ANY_HERO); if (!p) continue;
    place(u.id, 'hero', u, p[0], p[1]);
  }
}
function placeFoe(e, hasBoss) {
  const p = freeOf(hasBoss ? FOE_SLOTS : TRASH_SLOTS); if (!p) return false;
  place(e.id, 'foe', e, p[0], p[1]); return true;
}
function drop(id) {
  const o = owners.get(id); if (!o) return;
  for (const p of o.cells) { const c = at(p); if (c.owner === id) clearCell(c); }
  for (const [k, v] of occ) if (v === id) occ.delete(k);
  o.lab.remove(); ghosts.set(id, o); owners.delete(id);
}
function placeWave(b) {
  for (const [id, o] of [...owners]) if (o.kind !== 'hero') drop(id);
  const bosses = b.enemies.filter(e => e.boss);
  const blocks = bosses.length > 1 ? [[0, 0], [0, 4]] : [[0, 2]];
  bosses.slice(0, 2).forEach((e, i) => place(e.id, 'boss', e, blocks[i][0], blocks[i][1], 3));
  for (const e of b.enemies) if (!e.boss && e.hp > 0) placeFoe(e, bosses.length > 0);
  waveSeen = b.waveIdx;
}
function reset(b) {
  for (const id of [...owners.keys()]) drop(id);
  ghosts.clear(); occ.clear();
  for (const t of tags) t.el.remove(); tags = [];
  for (const k of [...longAnims.keys()]) stopLong(k);
  for (const row of cells) for (const c of row) { clearCell(c); c.sig = ''; }
  placeHeroes(b); placeWave(b); cur = b;
}

// 每次 render：位置、血量、死亡、護盾、轉階段這些「狀態」都從戰鬥資料讀
export function syncGrid(b) {
  if (!root) build();
  if (b !== cur) reset(b);
  else if (b.waveIdx !== waveSeen) placeWave(b);
  const hasBoss = b.enemies.some(e => e.boss);
  for (const e of b.enemies) if (!owners.has(e.id) && e.hp > 0 && placeFoe(e, hasBoss)) flashCells(owners.get(e.id).cells, COL.curse, { dur: 500, peak: 0.8 });
  for (const [id, o] of [...owners]) {
    const u = o.unit, dead = u.hp <= 0;
    if (o.kind === 'foe' && dead) { drop(id); continue; }
    if (o.kind === 'boss') {
      const up = u.phased || u.bonded ? 2 : 0, mid = (o.size * K - 1) / 2;
      for (const p of o.cells) {
        const c = at(p), dn = Math.hypot(p[0] - o.cr * K - mid, p[1] - o.cc * K - mid) / K; // 離中心多遠（以粗格為單位）
        Object.assign(c, dead ? { base: dn < 0.8 ? 1 : 0, color: DEAD_COL } : { base: Math.max(2, Math.round(6 - 2 * dn)) + up, color: up ? BOSS_PHASE : BOSS_COL });
        c.shield = !dead && u.bshield > 0;
      }
    } else {
      const base = dead ? 1 : o.kind === 'hero' ? (u.role === 'tank' ? 3 : 2) : 2;
      const color = dead ? DEAD_COL : o.kind === 'hero' ? (CLASS_COL[u.cls] || '#8e97a6') : u.goblin ? GOBLIN_COL : FOE_COL;
      for (const p of o.cells) { const c = at(p); c.base = base; c.color = color; c.shield = !dead && o.kind === 'hero' && u.shield > 0; }
    }
    o.lab.classList.toggle('dead', dead);
  }
  for (const row of cells) for (const c of row) paint(c);
  for (const o of owners.values()) labelSync(o);
}
function labelSync(o) {
  const u = o.unit, f = u.hp <= 0 ? 0 : u.hp / u.max, bar = o.lab.lastChild;
  o.lab.style.setProperty('--top', Math.max(...o.core.map(p => topOf(at(p)))));
  bar.firstChild.style.width = Math.max(0, Math.min(100, f * 100)) + '%';
  bar.classList.toggle('low', f > 0 && f < 0.35);
}

// ---------- 立體視角縮放 ----------
function applyZoom() { if (root) root.style.setProperty('--zm', prefs.zoom.toFixed(3)); }
export function zoomBy(dir) {
  const z = dir === 0 ? 1 : prefs.zoom * (dir > 0 ? ZOOM.step : 1 / ZOOM.step);
  setPref('zoom', Math.min(ZOOM.max, Math.max(ZOOM.min, z))); applyZoom();
}
// 雙指捏合（手機）與觸控板捏合（ctrl+滾輪）；單指照常捲動頁面
function pinchZoom() {
  const pts = new Map(); let start = null;
  const d2 = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  root.addEventListener('pointerdown', e => { if (e.pointerType !== 'touch' || !prefs.iso) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) start = { d: d2(), z: prefs.zoom }; });
  root.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2 && start) { setPref('zoom', Math.min(ZOOM.max, Math.max(ZOOM.min, start.z * d2() / Math.max(1, start.d)))); applyZoom(); }
  });
  const end = e => { pts.delete(e.pointerId); if (pts.size < 2) start = null; };
  root.addEventListener('pointerup', end); root.addEventListener('pointercancel', end);
  root.addEventListener('wheel', e => { if (!prefs.iso || !e.ctrlKey) return; e.preventDefault(); setPref('zoom', Math.min(ZOOM.max, Math.max(ZOOM.min, prefs.zoom * Math.exp(-e.deltaY * 0.01)))); applyZoom(); }, { passive: false });
}

export function mountGrid(slot, b) {
  if (!slot || !b) return;
  syncGrid(b);
  root.classList.toggle('iso', prefs.iso);
  root.classList.toggle('lite', prefs.fx === 'lite');
  applyZoom();
  slot.appendChild(root);
}

// ---------- 動畫小工具 ----------
function flash(p, o) {
  const c = at(p), col = o.color;
  const frames = o.outline
    ? [{ opacity: 0, background: 'transparent', boxShadow: `inset 0 0 0 2px ${col}` }, { opacity: 1, offset: 0.4 }, { opacity: 0 }]
    : [{ opacity: 0, background: col, boxShadow: 'none' }, { opacity: o.peak ?? 0.9, offset: 0.3 }, { opacity: 0 }];
  return c.fx.animate(frames, { duration: o.dur ?? 300, delay: o.delay ?? 0, iterations: o.times ?? 1, easing: 'ease-out' });
}
function flashCells(list, color, o = {}) { return list.map(p => flash(p, { color, ...o })); }
// 暫時升高／壓低；格子被清空（換波、擊殺）後舊的計時器作廢
function lift(list, k, ms, delay = 0) {
  setTimeout(() => {
    const done = [];
    for (const p of list) { const c = at(p); c.bonus += k; paint(c); done.push([c, c.gen]); }
    syncLabels();
    setTimeout(() => { for (const [c, g] of done) if (c.gen === g) { c.bonus -= k; paint(c); } syncLabels(); }, ms);
  }, delay);
}
function syncLabels() { for (const o of owners.values()) labelSync(o); }
function line(a, b) {
  const pts = []; let [y0, x0] = a; const [y1, x1] = b;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    pts.push([y0, x0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return pts;
}
// 從 a 走到 b（細格），回傳抵達所需毫秒；step 是「每粗格」的毫秒，細格自動切成 K 段，總時間不變
function projectile(a, b, color, step, delay) {
  const path = line(a, b).slice(1, -1), s = step / K;
  path.forEach((p, i) => flash(p, { color, delay: delay + i * s, dur: Math.max(140, s * 7), peak: 0.75 }));
  return delay + path.length * s;
}
function ring(src, list, color, step, o = {}) { for (const p of list) flash(p, { color, delay: (o.delay || 0) + dist(p, src) * step / K, dur: o.dur || 380, peak: o.peak ?? 0.5 }); }
function shake(px) {
  if (!root || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const now = performance.now(); if (now - shakeAt < 400) return; shakeAt = now;
  root.animate([{ translate: '0 0' }, { translate: `${px}px ${-px / 2}px` }, { translate: `${-px}px ${px / 2}px` }, { translate: '0 0' }], { duration: 240 });
}
function stopLong(key) { const l = longAnims.get(key); if (l) { l.forEach(a => a.cancel()); longAnims.delete(key); } }

// ---------- v0.24.1 主動技能標籤 ----------
const ACT_KIND = { wall: 'guard', roar: 'guard', dawn: 'heal', grove: 'heal', tide: 'heal', nova: 'aoe', storm: 'aoe', shadow: 'one', rend: 'one' };
const TAG_MS = 1500; // 固定真實時間，不跟著戰鬥速度縮短
let tags = [];
function castTag(o, A, col) {
  if (!root || !root.isConnected || !o.lab.isConnected) return;
  const now = performance.now(); tags = tags.filter(t => t.end > now && t.el.isConnected);
  const rr = root.getBoundingClientRect(), lr = o.lab.getBoundingClientRect();
  const el = document.createElement('div'); el.className = 'gcast'; el.style.setProperty('--cc', col);
  el.innerHTML = `${svg(A.icon)}<span>${A.name}</span>`;
  root.appendChild(el);
  const w = el.offsetWidth, h = el.offsetHeight;
  let x = lr.left - rr.left + lr.width / 2 - w / 2, y = lr.top - rr.top - h - 4;
  x = Math.max(4, Math.min(rr.width - w - 4, x));
  for (const t of tags) if (Math.abs(t.y - y) < h && Math.abs(t.x - x) < w) y = t.y - h - 2; // 同時施放：往上疊，不互相蓋住
  y = Math.max(2, y);
  el.style.left = x + 'px'; el.style.top = y + 'px';
  tags.push({ el, x, y, end: now + TAG_MS });
  const a = el.animate([{ opacity: 0, transform: 'translateY(6px) scale(.85)' }, { opacity: 1, transform: 'none', offset: 0.12 }, { opacity: 1, offset: 0.75 }, { opacity: 0, transform: 'translateY(-8px)' }], { duration: TAG_MS, easing: 'ease-out' });
  a.onfinish = () => el.remove();
}

// ---------- 播放一個 tick 的事件 ----------
const NOISY = new Set(['hit', 'hurt', 'heal']);
export function playFx(b, evs, tickMs) {
  if (!evs.length || !root || !root.isConnected || b !== cur || prefs.fx === 'off') { ghosts.clear(); return; }
  if (evs.length > 200) evs = evs.filter(e => e.k === 'end' || (e.k === 'kill' && e.boss)); // 直接結算：只演結尾
  const lite = prefs.fx === 'lite';
  const span = tickMs * 0.75, step = Math.max(14, Math.min(45, tickMs / 22));
  const own = id => owners.get(id) || ghosts.get(id);
  const ctr = id => { const o = own(id); return o && o.center; };
  const core = id => { const o = own(id); return o ? o.core : null; };
  const partyCells = () => [...owners.values()].filter(o => o.kind === 'hero').flatMap(o => o.cells);
  const foeCells = () => [...owners.values()].filter(o => o.kind !== 'hero').flatMap(o => o.cells);
  const heroCore = () => [...owners.values()].filter(o => o.kind === 'hero').flatMap(o => o.core);
  const ME = [6 * K + 1, 3 * K + 1];
  let shots = 0; const maxShots = lite ? 0 : 10;
  const seen = new Set();
  const big = evs.filter(e => !NOISY.has(e.k)).length, nNoisy = evs.length - big;
  let ni = 0;
  evs.forEach((e, idx) => {
    const d = NOISY.has(e.k) ? Math.round(span * (ni++ / Math.max(1, nNoisy))) : Math.round(span * (idx / evs.length) * 0.5);
    const s = ctr(e.s), t = ctr(e.t), tc = core(e.t), sc = core(e.s);
    switch (e.k) {
      case 'hit': {
        if (!t) break;
        const o = own(e.s), col = e.charm ? COL.charm : e.proc ? COL.bolt : o ? (CLASS_COL[o.unit.cls] || COL.phys) : COL.phys;
        if (e.dot) { const key = 'dot' + e.t; if (lite || seen.has(key)) break; seen.add(key); flash(t, { color: col, delay: d, dur: 220, peak: 0.35 }); play('dot'); break; }
        if (e.aoe) { // 範圍：同一位施放者這一秒只畫一次「一片」
          const key = 'aoe' + e.s; if (seen.has(key)) break; seen.add(key);
          ring(s || t, foeCells(), col, lite ? 0 : step * 1.5, { delay: d, dur: 360, peak: 0.55 }); play('hit', d / 1000); break;
        }
        let hitAt = d;
        if (s && shots < maxShots) { shots++; hitAt = projectile(s, t, col, step, d); }
        if (e.crit) { flashCells(tc, col, { delay: hitAt, dur: 480, peak: 1 }); lift(tc, 2, Math.max(300, tickMs * 0.6), hitAt); play('crit', hitAt / 1000); }
        else { flashCells(tc, col, { delay: hitAt, dur: 160, peak: 0.85 }); play('hit', hitAt / 1000); }
        break;
      }
      case 'hurt': {
        if (!t) break;
        const so = own(e.s);
        if (e.kind === 'magic') { const key = 'mg' + e.t; if (seen.has(key)) break; seen.add(key); flashCells(tc, COL.curse, { delay: d, dur: 260, peak: 0.35 }); break; }
        let hitAt = d;
        if (so && so.kind === 'boss' && !seen.has('bossatk' + e.s) && !lite) { seen.add('bossatk' + e.s); hitAt = projectile(so.center, t, COL.enemy, step, d); }
        const key = 'hurt' + e.t; if (seen.has(key)) break; seen.add(key);
        flashCells(tc, COL.enemy, { delay: hitAt, dur: 200, peak: 0.55 }); play('hurt', hitAt / 1000);
        break;
      }
      case 'heal': {
        if (!t) break;
        if (e.big) { flashCells(tc, COL.heal, { delay: d, dur: 900, peak: 1 }); lift(tc, 2, 900, d); play('heal', d / 1000); break; }
        const key = 'heal' + e.t; if (seen.has(key)) break; seen.add(key);
        let hitAt = d;
        if (s && e.s !== e.t && !lite && !seen.has('healer' + e.s)) { seen.add('healer' + e.s); hitAt = projectile(s, t, COL.heal, step * 1.8, d); }
        flashCells(tc, COL.heal, { delay: hitAt, dur: 600, peak: 0.55 }); lift(tc, 1, 500, hitAt); play('heal', hitAt / 1000);
        break;
      }
      case 'kick': {
        stopLong('cast' + e.t);
        const hitAt = s && t && !lite ? projectile(s, t, COL.white, step * 0.7, d) : d;
        if (tc) flashCells(tc, COL.white, { delay: hitAt, dur: 140, times: 3, peak: 1 });
        play('kick', hitAt / 1000);
        break;
      }
      // v0.25 潮汐：漲潮＝藍色從我方最下排往上漫，持續到退潮；退潮＝金色由上往下退
      case 'tide': {
        stopLong('tide');
        const rows = area(MID + 1, CR - 1);
        if (e.high) {
          const total = e.dur * tickMs, anims = [];
          for (const p of rows) anims.push(flash(p, { color: COL.tide, delay: d + (ROWS - 1 - p[0]) * step / 2, dur: Math.max(500, total / 2), times: 2, peak: 0.42 }));
          longAnims.set('tide', anims); play('tide', d / 1000);
        } else {
          for (const p of rows) flash(p, { color: COL.gold, delay: d + (p[0] - (MID + 1) * K) * step / 2, dur: 420, peak: 0.35 });
          play('ebb', d / 1000);
        }
        break;
      }
      // v0.25 魅惑：被點名的隊員持續閃紫紅色，直到被淨化或時間到
      case 'charm': {
        stopLong('charm' + e.t);
        if (!tc) break;
        const total = e.dur * tickMs, anims = [];
        if (s && !lite) projectile(s, t, COL.charm, step, d);
        for (const p of tc) anims.push(flash(p, { color: COL.charm, delay: d, dur: 450, times: Math.max(2, Math.floor(total / 450)), peak: 0.8 }));
        longAnims.set('charm' + e.t, anims); play('charm', d / 1000);
        break;
      }
      // v0.25 登船：敵方區域左右兩側先閃一下，增援的海盜由 syncGrid 放上格子
      case 'board': {
        for (const p of area(0, MID - 1)) if (p[1] < K || p[1] >= COLS - K) flash(p, { color: COL.enemy, delay: d + p[0] * step / 3, dur: 420, peak: 0.7 });
        play('board', d / 1000);
        break;
      }
      case 'dispel': stopLong('curse' + e.t); stopLong('charm' + e.t); if (tc) flashCells(tc, COL.heal, { delay: d, dur: 500, peak: 0.9 }); play('heal', d / 1000); break;
      case 'cast': { // 讀條：我方區域的警示框由慢閃變快閃
        if (!sc) break;
        stopLong('cast' + e.s);
        const total = e.time * tickMs, anims = [], cc = e.charm ? COL.charm : COL.cast; // 魅惑之歌用紫紅色
        const slowN = Math.max(1, Math.floor((total * 0.6) / 700)), fastStart = slowN * 700, fastN = Math.max(2, Math.floor((total - fastStart) / 180));
        for (const p of partyCells()) {
          anims.push(flash(p, { color: cc, outline: true, dur: 700, times: slowN, delay: d }));
          anims.push(flash(p, { color: cc, outline: true, dur: 180, times: fastN, delay: d + fastStart }));
        }
        for (const p of sc) anims.push(flash(p, { color: cc, dur: 400, times: Math.max(2, Math.floor(total / 400)), peak: 0.6, delay: d }));
        longAnims.set('cast' + e.s, anims); play('cast', d / 1000);
        break;
      }
      case 'blast': {
        stopLong('cast' + e.s);
        for (const p of area(MID, CR - 1)) flash(p, { color: COL.cast, delay: d + (p[0] - MID * K) * step, dur: 420, peak: 0.9 });
        setTimeout(() => shake(5), d + 120); play('blast', d / 1000);
        break;
      }
      case 'pulse': if (s) { ring(s, area(0, CR - 1), COL.enemy, lite ? 0 : step * 2, { delay: d, dur: 380, peak: 0.45 }); setTimeout(() => shake(4), d + 150); play('pulse', d / 1000); } break;
      case 'buster': {
        const hitAt = s && t && !lite ? projectile(s, t, COL.enemy, step * 0.8, d) : d;
        if (tc) { flashCells(tc, COL.enemy, { delay: hitAt, dur: 420, peak: 1 }); lift(tc, -1, 500, hitAt); }
        setTimeout(() => shake(3), hitAt); play('buster', hitAt / 1000);
        break;
      }
      case 'curse': {
        if (!tc) break;
        stopLong('curse' + e.t);
        longAnims.set('curse' + e.t, flashCells(tc, COL.curse, { outline: true, dur: 900, times: Math.max(1, Math.round(e.dur * tickMs / 900)), delay: d }));
        play('curse', d / 1000);
        break;
      }
      case 'shield': { const o = own(e.s); if (o) flashCells(o.cells, COL.shield, { delay: d, dur: 420, peak: 0.8 }); play('shield', d / 1000); break; }
      case 'sbreak': { const o = own(e.t); if (o) flashCells(o.cells, COL.shield, { delay: d, dur: 140, times: 3, peak: 1 }); play('sbreak', d / 1000); break; }
      case 'sfail': { const o = own(e.t); if (o) flashCells(o.cells, COL.heal, { delay: d, dur: 700, peak: 0.7 }); play('heal', d / 1000); break; }
      case 'phase': { const o = own(e.s); if (o) flashCells(o.cells, COL.enemy, { delay: d, dur: 600, peak: 0.95 }); setTimeout(() => shake(6), d); play('boss', d / 1000); break; }
      case 'summon': { const o = own(e.s); if (o) flashCells(o.cells, COL.curse, { delay: d, dur: 500, peak: 0.6 }); break; }
      case 'kill': {
        const o = own(e.t), list = o ? o.cells : [];
        flashCells(list, COL.white, { delay: d, dur: 380, peak: 1 });
        if (e.boss) { if (o) ring(o.center, area(0, CR - 1), COL.gold, step * 2, { delay: d + 150, dur: 500, peak: 0.5 }); play('bosskill', d / 1000); }
        else play('kill', d / 1000);
        break;
      }
      case 'die': if (tc) flashCells(tc, COL.enemy, { delay: d, dur: 600, peak: 1 }); play('die', d / 1000); break;
      case 'immune': if (tc) flashCells(tc, COL.shield, { delay: d, dur: 600, peak: 0.9 }); break;
      case 'volc': if (tc) flashCells(tc, COL.cast, { delay: d, dur: 500, peak: 0.85 }); break;
      case 'horn': { ring(ME, area(MID + 1, CR - 1), COL.gold, step * 2, { delay: d, dur: 500, peak: 0.5 }); lift(heroCore(), 1, 700, d); play('horn', d / 1000); break; }
      case 'act': { // v0.24.1 英雄主動技能：施放者發光升高＋頭上技能名標籤（標籤用真實時間，4 倍速也看得到）
        const o = own(e.s), A = ACTIVES[e.key]; if (!o || !A) break;
        const col = CLASS_COL[o.unit.cls] || COL.gold;
        flashCells(o.cells, COL.gold, { delay: d, dur: 600, peak: 0.95 }); lift(o.core, 2, 800, d);
        const kind = ACT_KIND[e.key];
        if (kind === 'heal') ring(s, area(MID + 1, CR - 1), COL.heal, step * 2, { delay: d + 80, dur: 520, peak: 0.55 });
        else if (kind === 'guard') ring(s, e.key === 'wall' ? o.cells : area(MID + 1, CR - 1), COL.shield, step * 2, { delay: d + 80, dur: 520, peak: 0.6 });
        else if (kind === 'aoe') flashCells(foeCells(), col, { delay: d + 120, dur: 480, peak: 0.7 });
        setTimeout(() => castTag(o, A, col), d);
        play('horn', d / 1000);
        break;
      }
      case 'lust': { ring(s || ME, area(MID + 1, CR - 1), COL.bolt, step * 2, { delay: d, dur: 450, peak: 0.45 }); play('horn', d / 1000); break; }
      case 'wave': if (e.boss) { const o = [...owners.values()].find(x => x.kind === 'boss'); if (o) { flashCells(o.cells, COL.enemy, { delay: d, dur: 700, peak: 0.8 }); lift(o.cells, 2, 600, d); } play('boss', d / 1000); } break;
      case 'end': {
        for (const p of area(0, CR - 1)) flash(p, { color: e.win ? COL.gold : COL.enemy, delay: d + (e.win ? (ROWS - 1 - p[0]) : p[0]) * step, dur: 520, peak: e.win ? 0.45 : 0.3 });
        play(e.win ? 'win' : 'lose', d / 1000);
        break;
      }
    }
  });
  ghosts.clear();
}
