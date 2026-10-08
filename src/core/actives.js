// ===== v0.24 英雄主動技能：每個職業（德魯伊、薩滿依專精）一招，點戰鬥畫面的隊員卡片施放 =====
// 自動模式（掛機、直接結算、或設定「自動施放」）由 auto() 判斷時機；手動點了就立刻施放
// 名稱一律原創（不沿用 WoW 技能名）
import { tx } from './i18n.js';

export const ACTIVE = { cd: 60, first: 12 }; // 冷卻 60 秒；開場 12 秒後才能用（數值見 tools/sim-actives.js）
const bossUp = b => b.waveIdx === b.waves.length - 1 && !b.vault;
const casting = b => b.foes().some(e => e.casting);
const lowParty = (b, avg, one) => { const a = b.alive(); if (!a.length) return false; const r = a.reduce((t, u) => t + u.hp / u.max, 0) / a.length; return r < avg || a.some(u => u.hp < u.max * one); };
const mainTarget = b => { const f = b.foes(); return f.find(e => e.boss) || f.reduce((m, e) => (e.hp > m.hp ? e : m), f[0]); };

export const ACTIVES = {
  wall: { name: tx('不動壁壘'), icon: 'stone-wall', desc: tx('8 秒內自己受到傷害 −25%'),
    use(b, u) { u.buf.wall = b.tick + 8; },
    auto: (b, u) => bossUp(b) && (casting(b) || u.hp < u.max * 0.6) },
  dawn: { name: tx('晨曦禱言'), icon: 'sun', desc: tx('全隊立即回復 18% 生命'),
    use(b, u) { for (const x of b.alive()) b.heal(u, x, x.max * 0.18, true); },
    auto: b => lowParty(b, 0.55, 0.35) },
  shadow: { name: tx('影襲'), icon: 'backstab', desc: tx('對首領（沒有首領就打生命最多的敵人）必定暴擊，威力 ×3'),
    use(b, u) { const e = mainTarget(b); if (!e) return; u.nextCrit = true; b.hitEnemy(u, e, u.pow * 1.5, { skill: true }); },
    auto: b => bossUp(b) },
  nova: { name: tx('星爆'), icon: 'star-swirl', desc: tx('對全體敵人威力 ×2.5 傷害，並打斷讀條'),
    use(b, u) { for (const e of b.foes()) { if (e.casting) { e.casting = null; b.fx({ k: 'kick', s: u.id, t: e.id }); } b.hitEnemy(u, e, u.pow * 2.5, { skill: true, aoe: true }); } },
    auto: b => b.foes().length >= 3 || casting(b) || (bossUp(b) && b.foes().length >= 2) },
  roar: { name: tx('咆哮守護'), icon: 'bear-head', desc: tx('6 秒內全隊受到傷害 −15%'),
    use(b) { b.guard = { until: b.tick + 6, v: 0.15 }; },
    auto: b => (bossUp(b) && casting(b)) || lowParty(b, 0.5, 0.3) },
  grove: { name: tx('林語甘霖'), icon: 'falling-leaf', desc: tx('5 秒內全隊每秒回復 3% 生命'),
    use(b, u) { for (const x of b.alive()) x.hots.push({ src: u, until: b.tick + 5, amt: x.max * 0.03 }); },
    auto: b => lowParty(b, 0.65, 0.4) },
  rend: { name: tx('撕裂猛擊'), icon: 'claw-slashes', desc: tx('對首領（沒有首領就打生命最多的敵人）威力 ×3 傷害'),
    use(b, u) { const e = mainTarget(b); if (e) b.hitEnemy(u, e, u.pow * 3, { skill: true }); },
    auto: b => bossUp(b) },
  storm: { name: tx('雷暴'), icon: 'lightning-storm', desc: tx('對全體敵人威力 ×2 傷害'),
    use(b, u) { for (const e of b.foes()) b.hitEnemy(u, e, u.pow * 2, { skill: true, aoe: true }); },
    auto: b => b.foes().length >= 3 || (bossUp(b) && b.foes().length >= 2) || bossUp(b) },
  tide: { name: tx('潮湧圖騰'), icon: 'totem', desc: tx('全隊立即回復 14% 生命，之後 4 秒每秒再回 2%'),
    use(b, u) { for (const x of b.alive()) { b.heal(u, x, x.max * 0.14, true); x.hots.push({ src: u, until: b.tick + 4, amt: x.max * 0.02 }); } },
    auto: b => lowParty(b, 0.55, 0.35) },
};
// 職業（與職責）→ 主動技能
export function activeKey(cls, role) {
  if (cls === 'guardian') return 'wall';
  if (cls === 'cleric') return 'dawn';
  if (cls === 'rogue') return 'shadow';
  if (cls === 'mage') return 'nova';
  if (cls === 'druid') return role === 'tank' ? 'roar' : role === 'heal' ? 'grove' : 'rend';
  if (cls === 'shaman') return role === 'heal' ? 'tide' : 'storm';
  return null;
}
