// ===== 職業包登記處 =====
// 新增職業：在這個資料夾放一個職業包檔案，然後在下面登記一行。介面與存檔不用改。
// 職業包欄位：見 guardian.js（meta、ai、base、specs、talents、recommend、legend、act、hooks）
// 戰鬥核心的掛勾點（hooks）：outMult、critBonus、afterHit、busterGuard、lifeSaver、tick
// 傳說的掛勾點（legend.hooks）：partyTaken、lifeSaver、onHeal、onCrit、onKill、cdMult
import guardian from './guardian.js';
import cleric from './cleric.js';
import rogue from './rogue.js';
import mage from './mage.js';

export const PACKS = { guardian, cleric, rogue, mage };
// 職責：一般職業固定；之後德魯伊這類職業可在職業包裡定義 roleOf(h) 依專精切換
export const roleOf = h => { const p = PACKS[h.cls]; return p.roleOf ? p.roleOf(h) : p.role; };
