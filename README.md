# 副本團長 Raid Leader

放置型團本經理 RPG。招募坦、補、輸出組成 5 人小隊，靠配裝與換陣容推進 7 層副本。

## 專案結構

```
index.html              GitHub Pages 入口（直接載入 src/ 模組，不需建置）
dist/raid-leader.html   單檔版（JS、CSS 內嵌），用於預覽或分享
src/
  core/                 遊戲邏輯，不碰畫面，可在 Node 執行
    config.js           ★ 所有數值與內容（職業、副本、掉落、經濟）
    rng.js              亂數
    items.js            裝備生成、強化、分解
    heroes.js           英雄屬性與升級
    dungeons.js         副本難度與敵人
    battle.js           戰鬥模擬（職業行為、首領機制）
    game.js             存檔操作：獎勵、招募、配裝、掛機
  ui/                   畫面
    main.js             入口：分頁、點擊事件、離線結算
    state.js            畫面暫存狀態
    save.js             本機存檔、存檔碼
    battle-runner.js    即時戰鬥計時
    helpers.js          共用小工具
    views/              各分頁畫面（dungeon、battle、team、bag、tavern、sheets）
  styles.css  head.html  body.html
tools/
  build.js              產生 index.html 與 dist/
  sim.js                數值模擬：各層首通場次
  roles.js              陣容勝率比較
  e2e.js / e2e-actions.js  瀏覽器端對端測試
```

## 常用指令

| 指令 | 用途 |
|---|---|
| `npm install` | 安裝建置工具（只需一次） |
| `node tools/build.js` | 重新產生 `index.html` 與 `dist/raid-leader.html` |
| `node tools/sim.js 10` | 模擬 10 次完整遊玩 |
| `node tools/roles.js` | 各陣容在每層的勝率 |
| `node tools/e2e.js` | 瀏覽器測試主要流程 |

調整數值只改 `src/core/config.js`，改完跑 `sim.js` 確認節奏。

## 版本

- **v0.2.1** 遊玩回饋：分解精良、背包 50、戰利品箱、戰鬥控制列固定、鎖定縮放
- **v0.2.0** 模組化重構，遊戲內容與 v0.1.0 相同
- **v0.1.0** 灰盒原型：4 職業、7 層副本、掉寶配裝、掛機與離線收益
