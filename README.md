# 副本團長 Raid Leader

放置型團本經理 RPG。招募坦、補、輸出組成 5 人小隊，靠配裝與換陣容推進 7 層副本。

## 專案結構

```
index.html              GitHub Pages 入口（載入 dist/app.js，網址帶版本號避免快取）
dist/app.js             打包後的遊戲程式（由 tools/build.js 產生）
dist/raid-leader.html   單檔版（JS、CSS 內嵌），用於預覽或分享
src/
  core/                 遊戲邏輯，不碰畫面，可在 Node 執行
    config.js           ★ 數值與內容（副本、掉落、經濟、秘境）
    classes/            ★ 職業包：一個職業一個檔案（屬性、出手、技能、專精、天賦、傳說）
      index.js          登記處：新增職業 = 放一個檔案＋在這裡登記一行
      shared.js         職業包共用工具
    rng.js              亂數（setSeed 可固定種子）
    i18n.js             多語言：tx('中文原文', 參數…)；中文版回傳原文，英文查 src/i18n/en.js
    items.js            裝備生成、強化、分解
    talents.js          天賦狀態、推薦配置（資料來自職業包）
    heroes.js           英雄屬性與升級
    dungeons.js         副本難度與敵人
    battle.js           戰鬥核心（掛勾點、首領機制、詞綴、英勇號角）
    mythic.js           傳奇秘境：鑰石、每日詞綴、敵人成長、結算
    vault.js            寶庫：每日次數、哥布林、金幣結算
    advice.js           下一步建議
    version.js          版本號（由 build.js 產生）
    game.js             存檔操作：獎勵、招募、配裝、掛機
  ui/                   畫面
    main.js             入口：分頁、點擊事件、離線結算
    state.js            畫面暫存狀態
    save.js             本機存檔、存檔碼
    battle-runner.js    即時戰鬥計時
    helpers.js          共用小工具
    telemetry.js        遊玩數據、排行榜、意見回饋（送到 GAS）
    views/              各分頁畫面（dungeon、battle、team、bag、tavern、sheets）
    story.js            劇情對話（序章）
  i18n/
    en-frags-*.json     ★ 英文翻譯（以「文字片段」為單位，HTML 標籤自動保留）
    en.js               由 tools/i18n-build.py 產生，勿手改
  styles.css  head.html  body.html
gas/
  Code.gs               綁定試算表 raid-leader 的 Apps Script（部署步驟寫在檔案開頭）
tools/
  build.js              產生 index.html 與 dist/
  sim-lib.js / sim.js   數值模擬：各層首通場次（套用推薦天賦、不吹號角）
  specs.js              選對 / 選錯專精 / 無天賦 的勝率比較
  sim-mythic.js         秘境節奏：達到各鑰石等級所需場數
  i18n-build.py         掃描所有 tx() 產生 en.js，列出缺翻譯的片段
  i18n-convert.py       一次性工具：把中文字串轉成 tx()（v0.8.1 已轉完）
  regress.js            回歸測試：固定種子跑 290 場戰鬥，重構前後結果要一模一樣
  e2e*.js               瀏覽器端對端測試（主流程、背包操作、天賦與號角）
```

## 常用指令

| 指令 | 用途 |
|---|---|
| `npm install` | 安裝建置工具（只需一次） |
| `node tools/build.js` | 重新產生 `index.html` 與 `dist/raid-leader.html` |
| `node tools/sim.js 10` | 模擬 10 次完整遊玩 |
| `node tools/specs.js` | 選對 / 選錯專精的勝率差 |
| `node tools/sim-mythic.js 4 300` | 秘境節奏 |
| `node tools/regress.js` | 回歸測試（改戰鬥程式後必跑；刻意改平衡時用 `--save` 更新基準） |
| `node tools/e2e.js`、`e2e-actions.js`、`e2e-talents.js`、`e2e-mythic.js`、`e2e-telemetry.js`、`e2e-v07.js`、`e2e-idlelock.js`、`e2e-fire.js`、`e2e-v074.js` | 瀏覽器測試 |

調整數值改 `src/core/config.js`（副本、經濟）與 `src/core/classes/`（職業），改完跑 `sim.js` 與 `specs.js` 確認節奏。

### 新增或修改文字

1. 程式裡寫 `tx('中文', 參數…)`，參數用 `{0}`、`{1}`。
2. 跑 `python3 tools/i18n-build.py`，把列出的缺翻譯片段補進 `src/i18n/en-frags-*.json`，再跑一次。
3. 漏翻不會壞：英文版會直接顯示中文。

### 新增職業

1. 複製 `src/core/classes/guardian.js` 改成新職業（屬性、`act` 出手邏輯、技能、專精、天賦、`recommend`、傳說）。
2. 在 `src/core/classes/index.js` 登記一行。
3. 需要依專精切換職責時，在職業包加 `roleOf(h)`。
4. 職業專屬效果用 `hooks`（outMult、critBonus、afterHit、busterGuard、lifeSaver、tick），傳說用 `legend.hooks`（partyTaken、lifeSaver、onHeal、onCrit、onKill、cdMult）。戰鬥核心不用改。

## 版本

- **v0.8.2** 設定選單（點左上角標題：帳號、存檔、語言、意見回饋、版本、重看序章）
- **v0.8.1** 多語言（繁中／英文）、開始畫面與語言切換、序章對話
- **v0.8.0** 職業包重構（一職業一檔案、戰鬥掛勾點、固定種子回歸測試；玩家端行為不變）
- **v0.7.1~0.7.5** 掛機鎖陣容、單人一鍵配裝、一鍵解雇、名冊 30、秘境掛機、巔峰等級、裝備精煉、羅馬數字樓層
- **v0.7.0** 英雄稀有度（普通~傳說）、4 位傳奇英雄、招募令與保底、寶庫
- **v0.6.0** 分解下拉、背包擴充里程碑、一鍵強化 / 卸下、一鍵備戰（推薦陣容＋天賦＋配裝）、文字口吻調整
- **v0.5.0** 天梯（排行榜）、遊玩數據、意見回饋（GAS + 試算表）、暱稱
- **v0.4.0** 傳奇秘境（鑰石、限時、每日詞綴、個人紀錄）、傳說裝備、下一步建議卡
- **v0.3.0** 技能、專精、天賦列、英勇號角、推薦天賦；副本難度同步調高
- **v0.2.1** 遊玩回饋：分解精良、背包 50、戰利品箱、戰鬥控制列固定、鎖定縮放
- **v0.2.0** 模組化重構，遊戲內容與 v0.1.0 相同
- **v0.1.0** 灰盒原型：4 職業、7 層副本、掉寶配裝、掛機與離線收益
