// ===== 下一步建議：依目前狀態只給一個最重要的建議（副本頁頂端卡片）=====
import { CLASSES, ECONOMY, DUNGEONS } from './config.js';
import { partyHeroes, hasUpgrade, hireCost, mythicUnlocked } from './game.js';
import { roleOf } from './classes/index.js';
import { vaultUnlocked, vaultLeft } from './vault.js';
import { pendingPicks } from './talents.js';

const ROLE_NAME = { tank: '坦克', heal: '治療', dps: '輸出' };
// 回傳 { text, sub, btn: { label, act?, tab?, d? } } 或 null
export function nextStep(s) {
  const party = partyHeroes(s), top = s.unlocked - 1;
  if (!s.stats.runs) return { text: '開始第一場戰鬥', sub: '按下「腐根洞窟」的挑戰，隊伍會自己打。', btn: { label: '挑戰', act: 'fight', d: 0 } };
  if (hasUpgrade(s)) return { text: '背包有更好的裝備', sub: '一鍵替出戰隊員換上分數更高的裝備。', btn: { label: '一鍵配裝', act: 'autoequip' } };
  if (s.idle == null && party.length < ECONOMY.partyMax && s.heroes.length < ECONOMY.rosterMax && s.tavern.some(h => s.gold >= hireCost(h))) {
    const have = new Set(party.map(roleOf));
    const need = ['tank', 'heal'].find(r => !have.has(r)) || 'dps';
    return { text: `隊伍還有 ${ECONOMY.partyMax - party.length} 個空位`, sub: `去酒館招募，建議補${ROLE_NAME[need]}。`, btn: { label: '前往酒館', tab: 'tavern' } };
  }
  if (party.some(h => pendingPicks(h))) return { text: '有天賦還沒選', sub: s.idle != null ? `掛機中陣容不變，一鍵依「${DUNGEONS[top].name}」配好天賦與裝備。` : `一鍵依「${DUNGEONS[top].name}」配好陣容、天賦與裝備。`, btn: { label: '一鍵備戰', act: 'prepare', d: top } };
  if ((s.failStreak || 0) >= 2 && top > 0) return { text: `「${DUNGEONS[top].name}」連輸 ${s.failStreak} 場`, sub: '回前一層掛機刷裝備與等級，或調整陣容。', btn: { label: `掛機刷「${DUNGEONS[top - 1].name}」`, act: 'idle', d: top - 1 } };
  if (s.stash && s.stash.length) return { text: `戰利品箱有 ${s.stash.length} 件裝備`, sub: '背包滿了以後掉的裝備放在這裡，記得取出。', btn: { label: '前往背包', tab: 'bag' } };
  if (vaultUnlocked(s) && vaultLeft(s) && s.stats.runs >= 5) return { text: `今天寶庫還有 ${vaultLeft(s)} 次`, sub: '60 秒打寶藏哥布林，大量金幣可以拿去招募英雄。', btn: { label: '進入寶庫', act: 'vault', d: Math.max(...Object.keys(s.clears).filter(k => s.clears[k]).map(Number)) } };
  if (mythicUnlocked(s) && !s.mythic.runs) return { text: '傳奇秘境已解鎖', sub: '就在下方：層數無上限，每天詞綴不同。', btn: null };
  return null;
}
