// ===== 畫面層的共用狀態（存檔 app.S 以外都是暫時的，重新整理就清空）=====
import * as G from '../core/index.js';
export const KEY = 'raid-leader-save-v1';
export const TICK_MS = 1000;
export const app = {
  S: null,            // 存檔
  tab: 'dungeon',     // 目前分頁
  battle: null,       // 進行中的戰鬥
  bTimer: null, speed: 1, lastResult: null, pendingRepeat: null,
  invFilter: 'all',   // 背包篩選
  modal: null,        // 目前開啟的抽屜
  render: () => {},   // 由 main.js 指定
};

// v0.14 首次挑戰不能直接結算；自動化測試（sessionStorage rl-e2e）例外
export const e2eMode = () => { try { return sessionStorage.getItem('rl-e2e') === '1'; } catch (e) { return false; } };
export const canSkip = b => { try { if (sessionStorage.getItem('rl-e2e') === '1') return true; } catch (e) { /* ignore */ } return G.skipAllowed(app.S, b); };
