// ===== 圖示（v0.11）：game-icons.net 的 SVG 取代 emoji =====
// 對照表改了以後執行 node tools/icons-build.js 重新產生 icon-data.js
import * as G from '../core/index.js';
import DATA from './icon-data.js';

// 職業（顏色見 styles.css 的 .gi-<職業>）
export const CLASS_GLYPH = { guardian: 'templar-shield', cleric: 'holy-symbol', rogue: 'plain-dagger', mage: 'wizard-staff', druid: 'oak-leaf', shaman: 'totem' };
// 裝備部位
export const SLOT_GLYPH = { weapon: 'broadsword', head: 'visored-helm', chest: 'breastplate', hands: 'gauntlet', legs: 'leg-armor', trinket: 'gem-pendant' };
// 各層首領（雙首領各自一個）
const BOSS_GLYPH = ['mushroom-gills', 'golem-head', 'trident', 'fire-shield', 'crowned-skull', 'tentacles-skull', 'dragon-head',
  'rock-golem', 'anvil-impact', 'cultist', ['sun', 'moon'], 'crystal-growth', 'portal', 'horned-skull'];
const TRASH = 'imp-laugh', GOBLIN = 'goblin-head', COIN = 'two-coins';
export const HORN = 'hunting-horn'; // 英勇號角按鈕
export const TROPHY = 'trophy-cup';  // 成就

export const svg = (name, cls = '') => DATA[name]
  ? `<svg class="gi ${cls}" viewBox="0 0 512 512" aria-hidden="true"><path d="${DATA[name]}"/></svg>` : '';
export const classIcon = cls => svg(CLASS_GLYPH[cls], 'gi-' + cls);
export const slotIcon = (slot, rarity = 0) => svg(SLOT_GLYPH[slot], 'c' + rarity);
export const dungeonIcon = i => { const g = BOSS_GLYPH[i]; return svg(Array.isArray(g) ? g[0] : g, 'gi-boss'); };
// 戰鬥中的敵人：依名字找首領圖示，其餘是小怪／寶藏哥布林
const byName = {};
G.DUNGEONS.forEach((d, i) => {
  const g = BOSS_GLYPH[i];
  if (d.twin) d.twin.forEach((t, k) => { byName[t.name] = Array.isArray(g) ? g[k] : g; });
  byName[d.boss] = Array.isArray(g) ? g[0] : g;
});
export const enemyIcon = e => svg(e.goblin ? GOBLIN : e.boss ? (byName[e.name] || 'crowned-skull') : TRASH, e.boss ? 'gi-boss' : 'gi-foe');

// 啟動時呼叫：職業包的 icon（戰鬥紀錄、名冊等處用的）換成 SVG；金幣圖示改成遮罩
export function installIcons() {
  for (const [k, p] of Object.entries(G.CLASSES)) if (CLASS_GLYPH[k]) p.icon = classIcon(k);
  const coin = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="${DATA[COIN]}"/></svg>`)}`;
  const st = document.createElement('style');
  st.textContent = `.coin{background:var(--brass)!important;border-radius:0!important;width:16px!important;height:16px!important;-webkit-mask:url("${coin}") center/contain no-repeat;mask:url("${coin}") center/contain no-repeat}`;
  document.head.appendChild(st);
}
