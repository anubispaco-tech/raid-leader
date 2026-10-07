// ===== v0.20 格子戰場：用格子的顏色、範圍、方向、閃爍頻率與堆疊高度表現戰鬥 =====
// 格子 DOM 常駐（不跟著每秒的 innerHTML 重畫），render 時搬回 #gridSlot；
// 戰鬥核心每 tick 留下演出事件（Battle.fxq），這裡把它們分散在下一秒內播放。
// 注意：這裡只能用 Math.random，不能用 core 的 R()，否則會改變戰鬥結果。
import { prefs } from './prefs.js';
import { play } from './sfx.js';
import { svg, CLASS_GLYPH, enemyGlyph } from './icons.js';

const ROWS = 9, COLS = 7, MID = 4;
const COL = {
  phys: '#f4ead0', enemy: '#ff4d5e', heal: '#57e09a', shield: '#7fe3ff', cast: '#ff8a3d',
  curse: '#b072ff', bolt: '#ffe14d', gold: '#e8c06a', white: '#ffffff',
};
const CLASS_COL = { guardian: '#5d8ff0', cleric: '#4fc17f', rogue: '#e3664f', mage: '#f08a4b', druid: '#8bc34a', shaman: '#5fb8e8' };
const BOSS_COL = '#b13e53', BOSS_PHASE = '#d8344a', FOE_COL = '#7a3a46', GOBLIN_COL = '#b8902e', DEAD_COL = '#3a4150';

// 站位：隊伍依職責；敵人依「有沒有首領、幾隻首領」
const HERO_SLOTS = {
  tank: [[5, 3], [5, 2], [5, 4]],
  heal: [[7, 3], [7, 2], [7, 4]],
  dps: [[6, 2], [6, 4], [6, 1], [6, 5], [7, 1], [7, 5], [8, 3]],
};
const ANY_HERO = []; for (let r = 5; r < ROWS; r++) for (let c = 0; c < COLS; c++) ANY_HERO.push([r, c]);
const FOE_SLOTS = [[3, 3], [3, 2], [3, 4], [3, 1], [3, 5], [1, 0], [1, 6], [3, 0], [3, 6], [2, 0], [2, 6], [0, 0], [0, 6], [2, 1], [2, 5], [1, 1], [1, 5], [0, 3], [1, 3], [2, 3]];
const TRASH_SLOTS = [[2, 3], [2, 2], [2, 4], [1, 3], [1, 1], [1, 5], [2, 1], [2, 5], [3, 3], [0, 3], [1, 2], [1, 4], [3, 2], [3, 4], [2, 0], [2, 6], [0, 1], [0, 5], [3, 1], [3, 5]];

let root = null, board = null, cells = [], cur = null, waveSeen = -1;
let owners = new Map();     // 單位 id → { kind, unit, cells:[[r,c]], center:[r,c] }
const ghosts = new Map();   // 這一 tick 剛移除的單位（被擊殺、換波）：讓事件還找得到位置
const longAnims = new Map(); // 讀條警示、詛咒等持續動畫：key → [Animation]
let shakeAt = 0;

const at = p => cells[p[0]][p[1]];
const dist = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));

function build() {
  root = document.createElement('div'); root.className = 'gstage';
  board = document.createElement('div'); board.className = 'gboard'; board.setAttribute('aria-hidden', 'true');
  root.appendChild(board);
  cells = [];
  for (let r = 0; r < ROWS; r++) {
    cells.push([]);
    for (let c = 0; c < COLS; c++) {
      const el = document.createElement('div'); el.className = 'gcell' + (r === MID ? ' gmid' : '');
      const floor = document.createElement('div'); floor.className = 'gfloor';
      const stack = document.createElement('div'); stack.className = 'gstack';
      const hp = document.createElement('div'); hp.className = 'ghp'; hp.hidden = true; hp.appendChild(document.createElement('i'));
      const fx = document.createElement('div'); fx.className = 'gfx';
      el.append(floor, stack, hp, fx); board.appendChild(el);
      cells[r].push({ el, stack, hp, fx, base: 0, bonus: 0, color: null, glyph: '', shield: false, owner: null, sig: '' });
    }
  }
}
function clearCell(c) { c.gen = (c.gen || 0) + 1; Object.assign(c, { base: 0, bonus: 0, color: null, glyph: '', shield: false, owner: null }); c.hp.hidden = true; }

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16), ch = s => Math.round(((n >> s) & 255) * f);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
function paint(c) {
  const n = Math.max(0, c.base + c.bonus), sig = `${n}|${c.color}|${c.glyph}|${c.shield}`;
  if (sig === c.sig) return;
  c.sig = sig; c.stack.textContent = '';
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div'); s.className = 'gslab';
    s.style.setProperty('--i', i); s.style.background = shade(c.color || DEAD_COL, 0.42 + 0.58 * (i + 1) / n);
    if (i === n - 1 && c.glyph) s.innerHTML = c.glyph;
    c.stack.appendChild(s);
  }
  if (c.shield) { const s = document.createElement('div'); s.className = 'gslab gshield'; s.style.setProperty('--i', n); c.stack.appendChild(s); }
  const top = n + (c.shield ? 1 : 0);
  c.fx.style.setProperty('--top', top); c.hp.style.setProperty('--top', top);
}

// ---------- 站位 ----------
function place(id, kind, unit, list, center) {
  for (const p of list) at(p).owner = id;
  owners.set(id, { kind, unit, cells: list, center: center || list[0] });
}
function freeOf(list) { return list.find(p => !at(p).owner); }
function placeHeroes(b) {
  for (const u of b.units) {
    const p = freeOf(HERO_SLOTS[u.role] || []) || freeOf(ANY_HERO); if (!p) continue;
    place(u.id, 'hero', u, [p]);
  }
}
function bossBlocks(n) {
  if (n <= 1) return [{ r: 0, c: 2 }];
  return [{ r: 0, c: 0 }, { r: 0, c: 4 }];
}
function placeFoe(e, hasBoss) {
  const p = freeOf(hasBoss ? FOE_SLOTS : TRASH_SLOTS); if (!p) return false;
  place(e.id, 'foe', e, [p]); return true;
}
function placeWave(b) {
  for (let r = 0; r <= MID; r++) for (let c = 0; c < COLS; c++) {
    const cl = at([r, c]); if (cl.owner) drop(cl.owner); clearCell(cl);
  }
  const bosses = b.enemies.filter(e => e.boss), blocks = bossBlocks(bosses.length);
  bosses.slice(0, 2).forEach((e, i) => {
    const { r, c } = blocks[i], list = [];
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) list.push([r + y, c + x]);
    place(e.id, 'boss', e, list, [r + 1, c + 1]);
  });
  for (const e of b.enemies) if (!e.boss && e.hp > 0) placeFoe(e, bosses.length > 0);
  waveSeen = b.waveIdx;
}
function drop(id) { const o = owners.get(id); if (o) { ghosts.set(id, o); owners.delete(id); } }
function reset(b) {
  owners = new Map(); for (const k of [...longAnims.keys()]) stopLong(k);
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
  for (const [id, o] of owners) {
    const u = o.unit, dead = u.hp <= 0;
    if (o.kind === 'hero') {
      const c = at(o.center);
      Object.assign(c, dead ? { base: 1, color: DEAD_COL, glyph: svg(CLASS_GLYPH[u.cls]) } : { base: u.role === 'tank' ? 3 : 2, color: CLASS_COL[u.cls] || '#8e97a6', glyph: svg(CLASS_GLYPH[u.cls]) });
      c.shield = !dead && u.shield > 0;
      setHp(c, dead ? 0 : u.hp / u.max);
    } else if (o.kind === 'boss') {
      for (const p of o.cells) {
        const c = at(p), d = dist(p, o.center);
        Object.assign(c, dead ? { base: d ? 0 : 1, color: DEAD_COL, glyph: '' }
          : { base: (d ? (p[0] !== o.center[0] && p[1] !== o.center[1] ? 3 : 4) : 6) + (u.phased || u.bonded ? 2 : 0), color: u.phased || u.bonded ? BOSS_PHASE : BOSS_COL, glyph: d ? '' : svg(enemyGlyph(u)) });
        c.shield = !dead && u.bshield > 0;
      }
      setHp(at(o.center), dead ? 0 : u.hp / u.max);
    } else {
      const c = at(o.center);
      if (dead) { clearCell(c); drop(id); continue; }
      Object.assign(c, { base: 2, color: u.goblin ? GOBLIN_COL : FOE_COL, glyph: svg(enemyGlyph(u)) });
      setHp(c, u.hp / u.max);
    }
  }
  for (const row of cells) for (const c of row) paint(c);
}
function setHp(c, f) { c.hp.hidden = false; c.hp.firstChild.style.width = Math.max(0, Math.min(100, f * 100)) + '%'; c.hp.classList.toggle('low', f < 0.35); }

export function mountGrid(slot, b) {
  if (!slot || !b) return;
  syncGrid(b);
  root.classList.toggle('iso', prefs.iso);
  root.classList.toggle('lite', prefs.fx === 'lite');
  slot.appendChild(root);
}

// ---------- 動畫小工具 ----------
function flash(p, o) {
  const c = at(p), col = o.color;
  const frames = o.outline
    ? [{ opacity: 0, background: 'transparent', boxShadow: `inset 0 0 0 3px ${col}` }, { opacity: 1, offset: 0.4 }, { opacity: 0 }]
    : [{ opacity: 0, background: col, boxShadow: 'none' }, { opacity: o.peak ?? 0.9, offset: 0.3 }, { opacity: 0 }];
  return c.fx.animate(frames, { duration: o.dur ?? 300, delay: o.delay ?? 0, iterations: o.times ?? 1, easing: 'ease-out' });
}
function flashCells(list, color, o = {}) { return list.map(p => flash(p, { color, ...o })); }
// 暫時升高／壓低；格子被清空（換波、擊殺）後舊的計時器作廢
function lift(p, k, ms, delay = 0) {
  const c = at(p), g = c.gen;
  setTimeout(() => {
    if (c.gen !== g) return;
    c.bonus += k; paint(c);
    setTimeout(() => { if (c.gen !== g) return; c.bonus -= k; paint(c); }, ms);
  }, delay);
}
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
// 從 a 走到 b，回傳抵達所需毫秒
function projectile(a, b, color, step, delay) {
  const path = line(a, b).slice(1, -1);
  path.forEach((p, i) => flash(p, { color, delay: delay + i * step, dur: Math.max(120, step * 4), peak: 0.75 }));
  return delay + path.length * step;
}
function ring(src, list, color, step, o = {}) { for (const p of list) flash(p, { color, delay: (o.delay || 0) + dist(p, src) * step, dur: o.dur || 380, peak: o.peak ?? 0.5 }); }
function area(r0, r1) { const o = []; for (let r = r0; r <= r1; r++) for (let c = 0; c < COLS; c++) o.push([r, c]); return o; }
function shake(px) {
  if (!root || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const now = performance.now(); if (now - shakeAt < 400) return; shakeAt = now;
  root.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${px}px,${-px / 2}px)` }, { transform: `translate(${-px}px,${px / 2}px)` }, { transform: 'translate(0,0)' }], { duration: 240 });
}
function stopLong(key) { const l = longAnims.get(key); if (l) { l.forEach(a => a.cancel()); longAnims.delete(key); } }

// ---------- 播放一個 tick 的事件 ----------
const NOISY = new Set(['hit', 'hurt', 'heal']);
export function playFx(b, evs, tickMs) {
  if (!evs.length || !root || !root.isConnected || b !== cur || prefs.fx === 'off') { ghosts.clear(); return; }
  if (evs.length > 200) evs = evs.filter(e => e.k === 'end' || (e.k === 'kill' && e.boss)); // 直接結算：只演結尾
  const lite = prefs.fx === 'lite';
  const span = tickMs * 0.75, step = Math.max(14, Math.min(45, tickMs / 22));
  const own = id => owners.get(id) || ghosts.get(id);
  const ctr = id => { const o = own(id); return o && o.center; };
  const partyCells = () => [...owners.values()].filter(o => o.kind === 'hero').map(o => o.center);
  const foeCells = () => [...owners.values()].filter(o => o.kind !== 'hero').flatMap(o => o.cells);
  let shots = 0; const maxShots = lite ? 0 : 10;
  const seen = new Set();
  const big = evs.filter(e => !NOISY.has(e.k)).length, nNoisy = evs.length - big;
  let ni = 0;
  evs.forEach((e, idx) => {
    const d = NOISY.has(e.k) ? Math.round(span * (ni++ / Math.max(1, nNoisy))) : Math.round(span * (idx / evs.length) * 0.5);
    const s = ctr(e.s), t = ctr(e.t);
    switch (e.k) {
      case 'hit': {
        if (!t) break;
        const o = own(e.s), col = e.proc ? COL.bolt : o ? (CLASS_COL[o.unit.cls] || COL.phys) : COL.phys;
        if (e.dot) { const key = 'dot' + e.t; if (lite || seen.has(key)) break; seen.add(key); flash(t, { color: col, delay: d, dur: 220, peak: 0.3 }); play('dot'); break; }
        if (e.aoe) { // 範圍：同一位施放者這一秒只畫一次「一片」
          const key = 'aoe' + e.s; if (seen.has(key)) break; seen.add(key);
          const list = foeCells(); ring(s || t, list, col, lite ? 0 : step * 1.5, { delay: d, dur: 360, peak: 0.55 }); play('hit', d / 1000); break;
        }
        let hitAt = d;
        if (s && shots < maxShots) { shots++; hitAt = projectile(s, t, col, step, d); }
        if (e.crit) { flash(t, { color: col, delay: hitAt, dur: 480, peak: 1 }); lift(t, 2, Math.max(300, tickMs * 0.6), hitAt); play('crit', hitAt / 1000); }
        else { flash(t, { color: col, delay: hitAt, dur: 160, peak: 0.85 }); play('hit', hitAt / 1000); }
        break;
      }
      case 'hurt': {
        if (!t) break;
        const so = own(e.s);
        if (e.kind === 'magic') { const key = 'mg' + e.t; if (seen.has(key)) break; seen.add(key); flash(t, { color: COL.curse, delay: d, dur: 260, peak: 0.35 }); break; }
        let hitAt = d;
        if (so && so.kind === 'boss' && !seen.has('bossatk' + e.s) && !lite) { seen.add('bossatk' + e.s); hitAt = projectile(so.center, t, COL.enemy, step, d); }
        const key = 'hurt' + e.t; if (seen.has(key)) break; seen.add(key);
        flash(t, { color: COL.enemy, delay: hitAt, dur: 200, peak: 0.55 }); play('hurt', hitAt / 1000);
        break;
      }
      case 'heal': {
        if (!t) break;
        if (e.big) { flash(t, { color: COL.heal, delay: d, dur: 900, peak: 1 }); lift(t, 2, 900, d); play('heal', d / 1000); break; }
        const key = 'heal' + e.t; if (seen.has(key)) break; seen.add(key);
        let hitAt = d;
        if (s && e.s !== e.t && !lite && !seen.has('healer' + e.s)) { seen.add('healer' + e.s); hitAt = projectile(s, t, COL.heal, step * 1.8, d); }
        flash(t, { color: COL.heal, delay: hitAt, dur: 600, peak: 0.55 }); lift(t, 1, 500, hitAt); play('heal', hitAt / 1000);
        break;
      }
      case 'kick': {
        stopLong('cast' + e.t);
        const hitAt = s && t && !lite ? projectile(s, t, COL.white, step * 0.7, d) : d;
        if (t) flash(t, { color: COL.white, delay: hitAt, dur: 140, times: 3, peak: 1 });
        play('kick', hitAt / 1000);
        break;
      }
      case 'dispel': stopLong('curse' + e.t); if (t) flash(t, { color: COL.heal, delay: d, dur: 500, peak: 0.9 }); play('heal', d / 1000); break;
      case 'cast': { // 讀條：我方區域的警示框由慢閃變快閃
        if (!s) break;
        stopLong('cast' + e.s);
        const total = e.time * tickMs, list = partyCells(), anims = [];
        const slowN = Math.max(1, Math.floor((total * 0.6) / 700)), fastStart = slowN * 700, fastN = Math.max(2, Math.floor((total - fastStart) / 180));
        for (const p of list) {
          anims.push(flash(p, { color: COL.cast, outline: true, dur: 700, times: slowN, delay: d }));
          anims.push(flash(p, { color: COL.cast, outline: true, dur: 180, times: fastN, delay: d + fastStart }));
        }
        anims.push(flash(s, { color: COL.cast, dur: 400, times: Math.max(2, Math.floor(total / 400)), peak: 0.6, delay: d }));
        longAnims.set('cast' + e.s, anims); play('cast', d / 1000);
        break;
      }
      case 'blast': {
        stopLong('cast' + e.s);
        for (const p of area(MID, ROWS - 1)) flash(p, { color: COL.cast, delay: d + (p[0] - MID) * step * 2, dur: 420, peak: 0.9 });
        setTimeout(() => shake(5), d + 120); play('blast', d / 1000);
        break;
      }
      case 'pulse': if (s) { ring(s, area(0, ROWS - 1), COL.enemy, lite ? 0 : step * 2, { delay: d, dur: 380, peak: 0.45 }); setTimeout(() => shake(4), d + 150); play('pulse', d / 1000); } break;
      case 'buster': {
        const hitAt = s && t && !lite ? projectile(s, t, COL.enemy, step * 0.8, d) : d;
        if (t) { flash(t, { color: COL.enemy, delay: hitAt, dur: 420, peak: 1 }); lift(t, -1, 500, hitAt); }
        setTimeout(() => shake(3), hitAt); play('buster', hitAt / 1000);
        break;
      }
      case 'curse': {
        if (!t) break;
        stopLong('curse' + e.t);
        longAnims.set('curse' + e.t, [flash(t, { color: COL.curse, outline: true, dur: 900, times: Math.max(1, Math.round(e.dur * tickMs / 900)), delay: d })]);
        play('curse', d / 1000);
        break;
      }
      case 'shield': { const o = owners.get(e.s); if (o) flashCells(o.cells, COL.shield, { delay: d, dur: 420, peak: 0.8 }); play('shield', d / 1000); break; }
      case 'sbreak': { const o = owners.get(e.t); if (o) flashCells(o.cells, COL.shield, { delay: d, dur: 140, times: 3, peak: 1 }); play('sbreak', d / 1000); break; }
      case 'sfail': { const o = owners.get(e.t); if (o) flashCells(o.cells, COL.heal, { delay: d, dur: 700, peak: 0.7 }); play('heal', d / 1000); break; }
      case 'phase': { const o = owners.get(e.s); if (o) flashCells(o.cells, COL.enemy, { delay: d, dur: 600, peak: 0.95 }); setTimeout(() => shake(6), d); play('boss', d / 1000); break; }
      case 'summon': { const o = owners.get(e.s); if (o) flashCells(o.cells, COL.curse, { delay: d, dur: 500, peak: 0.6 }); break; }
      case 'kill': {
        const o = own(e.t), list = o ? o.cells : t ? [t] : [];
        flashCells(list, COL.white, { delay: d, dur: 380, peak: 1 });
        if (e.boss) { const c = (o && o.center) || t; if (c) ring(c, area(0, ROWS - 1), COL.gold, step * 2, { delay: d + 150, dur: 500, peak: 0.5 }); play('bosskill', d / 1000); }
        else play('kill', d / 1000);
        break;
      }
      case 'die': if (t) flash(t, { color: COL.enemy, delay: d, dur: 600, peak: 1 }); play('die', d / 1000); break;
      case 'immune': if (t) flash(t, { color: COL.shield, delay: d, dur: 600, peak: 0.9 }); break;
      case 'volc': if (t) flash(t, { color: COL.cast, delay: d, dur: 500, peak: 0.85 }); break;
      case 'horn': { const pc = partyCells(); ring([6, 3], area(MID + 1, ROWS - 1), COL.gold, step * 2, { delay: d, dur: 500, peak: 0.5 }); pc.forEach(p => lift(p, 1, 700, d)); play('horn', d / 1000); break; }
      case 'lust': { ring(s || [6, 3], area(MID + 1, ROWS - 1), COL.bolt, step * 2, { delay: d, dur: 450, peak: 0.45 }); play('horn', d / 1000); break; }
      case 'wave': if (e.boss) { const o = [...owners.values()].find(x => x.kind === 'boss'); if (o) { flashCells(o.cells, COL.enemy, { delay: d, dur: 700, peak: 0.8 }); o.cells.forEach(p => lift(p, 2, 600, d)); } play('boss', d / 1000); } break;
      case 'end': {
        const list = area(0, ROWS - 1);
        for (const p of list) flash(p, { color: e.win ? COL.gold : COL.enemy, delay: d + (e.win ? (ROWS - 1 - p[0]) : p[0]) * step * 2, dur: 520, peak: e.win ? 0.45 : 0.3 });
        play(e.win ? 'win' : 'lose', d / 1000);
        break;
      }
    }
  });
  ghosts.clear();
}
