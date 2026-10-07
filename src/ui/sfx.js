// ===== v0.20 音效：Web Audio 即時合成，不需要音檔 =====
// 瀏覽器規定要使用者點過畫面才能出聲：main.js 在第一次點擊時呼叫 unlock()
import { prefs } from './prefs.js';

let ctx = null, master = null, noiseBuf = null;
const last = {};
// 同一種音效的最短間隔（毫秒），避免 4× 加速時吵成一團
const GAP = { hit: 90, heal: 260, kill: 140, hurt: 200, dot: 300 };

function ac() {
  if (ctx) return ctx;
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return null;
  ctx = new C();
  master = ctx.createGain(); master.gain.value = 0.22; master.connect(ctx.destination);
  const n = Math.floor(ctx.sampleRate * 0.6);
  noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let x = 2463534242; // 固定的白噪音，不動用遊戲亂數
  for (let i = 0; i < n; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; d[i] = ((x >>> 0) / 4294967296) * 2 - 1; }
  return ctx;
}
export function unlock() {
  if (!prefs.sound) return;
  const c = ac(); if (c && c.state === 'suspended') c.resume().catch(() => {});
}
function env(g, t0, vol, att, dur) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + att);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
}
function tone(f0, f1, dur, type = 'square', vol = 0.4, at = 0) {
  const t0 = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  env(g, t0, vol, 0.006, dur); o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(dur, vol = 0.4, freq = 1200, type = 'bandpass', at = 0) {
  const t0 = ctx.currentTime + at, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = 0.9;
  env(g, t0, vol, 0.004, dur); s.connect(f); f.connect(g); g.connect(master); s.start(t0); s.stop(t0 + dur + 0.02);
}
const SOUNDS = {
  hit: () => noise(0.05, 0.18, 2600),
  dot: () => noise(0.04, 0.08, 3800),
  crit: () => { noise(0.09, 0.45, 1800); tone(520, 140, 0.14, 'sawtooth', 0.22); },
  hurt: () => noise(0.07, 0.16, 700, 'lowpass'),
  heal: () => { tone(520, 880, 0.16, 'sine', 0.22); tone(780, 1170, 0.16, 'sine', 0.12, 0.05); },
  kick: () => { tone(1400, 600, 0.07, 'triangle', 0.35); noise(0.05, 0.25, 4000); },
  cast: () => { tone(330, 330, 0.12, 'square', 0.16); tone(440, 440, 0.12, 'square', 0.16, 0.16); },
  blast: () => { noise(0.45, 0.6, 380, 'lowpass'); tone(160, 45, 0.4, 'sawtooth', 0.25); },
  pulse: () => { noise(0.3, 0.45, 500, 'lowpass'); tone(120, 60, 0.3, 'square', 0.18); },
  buster: () => { noise(0.18, 0.5, 900, 'lowpass'); tone(220, 70, 0.18, 'square', 0.22); },
  shield: () => { tone(300, 620, 0.25, 'sine', 0.25); tone(450, 930, 0.25, 'sine', 0.12, 0.04); },
  sbreak: () => { noise(0.2, 0.4, 5200, 'highpass'); tone(1200, 300, 0.2, 'triangle', 0.2); },
  curse: () => tone(300, 180, 0.3, 'triangle', 0.2),
  kill: () => tone(660, 990, 0.06, 'square', 0.14),
  bosskill: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.16, 'square', 0.2, i * 0.09)); noise(0.4, 0.3, 600, 'lowpass'); },
  die: () => tone(330, 70, 0.45, 'sawtooth', 0.22),
  boss: () => { tone(110, 110, 0.22, 'square', 0.25); tone(98, 98, 0.35, 'square', 0.25, 0.24); },
  horn: () => { tone(392, 392, 0.18, 'sawtooth', 0.2); tone(523, 523, 0.32, 'sawtooth', 0.22, 0.18); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.2, 'square', 0.2, i * 0.11)),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, f * 0.98, 0.24, 'triangle', 0.24, i * 0.14)),
};
export function play(name, at = 0) {
  if (!prefs.sound || !ctx || ctx.state !== 'running' || !SOUNDS[name]) return;
  if (document.hidden) return;
  const now = performance.now() + at * 1000;
  if (GAP[name] && last[name] && now - last[name] < GAP[name]) return;
  last[name] = now;
  try { if (at > 0) setTimeout(() => SOUNDS[name](), at * 1000); else SOUNDS[name](); } catch (e) { /* 音效失敗不影響遊戲 */ }
}
