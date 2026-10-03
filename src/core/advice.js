// ===== 下一步建議：依目前狀態只給一個最重要的建議（副本頁頂端卡片）=====
import { CLASSES, ECONOMY, DUNGEONS } from './config.js';
import { partyHeroes, hasUpgrade, hireCost, mythicUnlocked } from './game.js';
import { pendingPicks } from './talents.js';

const ROLE_NAME = { tank: '坦克', heal: '治療', dps: '輸出' };
// 回傳 { text, sub, btn: { label, act?, tab?, d? } } 或 null
export function nextStep(s) {
  const party = partyHeroes(s), top = s.unlocked - 1;
  if (!s.stats.runs) return { text: '開始第一場戰鬥', sub: '按下「腐根洞窟」的挑戰，隊伍會自動作戰。', btn: { label: '挑戰', act: 'fight', d: 0 } };
  if (hasUpgrade(s)) return { text: '背包有更好的裝備', sub: '一鍵替出戰隊員換上分數更高的裝備。', btn: { label: '一鍵配裝', act: 'autoequip' } };
  if (party.length < ECONOMY.partyMax && s.heroes.length < ECONOMY.rosterMax && s.tavern.some(h => s.gold >= hireCost(h))) {
    const have = new Set(party.map(h => CLASSES[h.cls].role));
    const need = ['tank', 'heal'].find(r => !have.has(r)) || 'dps';
    return { text: `隊伍還有 ${ECONOMY.partyMax - party.length} 個空位`, sub: `去酒館招募，建議補${ROLE_NAME[need]}。`, btn: { label: '前往酒館', tab: 'tavern' } };
  }
  if (party.some(h => pendingPicks(h))) return { text: '有天賦可以選', sub: `依「${DUNGEONS[top].name}」的首領機制一鍵配好全隊。`, btn: { label: '推薦天賦', act: 'recommend-party', d: top } };
  if ((s.failStreak || 0) >= 2 && top > 0) return { text: `「${DUNGEONS[top].name}」連輸 ${s.failStreak} 場`, sub: '回前一層掛機刷裝備與等級，或調整陣容。', btn: { label: `掛機刷「${DUNGEONS[top - 1].name}」`, act: 'idle', d: top - 1 } };
  if (s.stash && s.stash.length) return { text: `戰利品箱有 ${s.stash.length} 件裝備`, sub: '背包滿時掉落的裝備暫存在這裡。', btn: { label: '前往背包', tab: 'bag' } };
  if (mythicUnlocked(s) && !s.mythic.runs) return { text: '傳奇秘境已解鎖', sub: '無限層數、限時挑戰、每日詞綴，就在下方。', btn: null };
  return null;
}
