// ===== 核心邏輯入口（不碰畫面，可在 Node 執行）=====
export * from './config.js';
export * from './items.js';
export * from './talents.js';
export * from './heroes.js';
export * from './dungeons.js';
export * from './battle.js';
export * from './game.js';
export * from './mythic.js';
export * from './vault.js';
export * from './leader.js';
export * from './advice.js';
export * from './tutorial.js';
export { setSeed } from './rng.js';
export { tx, LANGS, getLang, setLang } from './i18n.js';
export * from './daily.js';
export * from './achievements.js';
