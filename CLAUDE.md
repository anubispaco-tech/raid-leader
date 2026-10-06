# 副本團長 Raid Leader — 給 Claude 的接手說明

新對話開始時先讀這份，再讀 README.md（版本紀錄、專案結構、工具清單）。

> 這個 repo 是公開的：這份檔案只放技術流程，不放個人資訊、私人文件連結或試算表 ID。

## 專案
- 放置型團本經理 RPG，純前端（Vanilla JS ES modules），手機瀏覽器優先，繁中／英文雙語。溝通用繁體中文。

## 重要位置
| 項目 | 位置 |
|---|---|
| 遊戲網址 | https://anubispaco-tech.github.io/raid-leader/（main 分支 push 即自動部署） |
| 單檔預覽、企劃書、美術畫布 | 開發者的 Claude artifact（用 Artifact 工具 list 找「副本團長」） |
| 遊玩數據 | GAS（`gas/Code.gs`）寫入開發者的試算表；改了 GAS 要請開發者貼上 → 視情況執行 setup → 部署「新版本」 |
| OAuth 用戶端 ID | `src/core/config.js` 的 `CLOUD.clientId` 與 `gas/Code.gs` 的 `CLIENT_ID`（用戶端 ID 本來就是公開值） |

## 每次改版的固定流程
1. 改 `src/`；新文字一律用 `tx('中文原文', 參數…)`。
2. `python3 tools/i18n-build.py` → 列出 MISSING 的片段，寫進新的 `src/i18n/en-frags-N.json`，直到 0 missing。
3. `package.json` 版本號 +1 → `node tools/build.js`（會同時產生 index.html、dist/app.js、dist/raid-leader.html、version.js）。
4. `node tools/regress.js` 要一致；只有主線流程改變（例如酒館多了職業）時才 `--save` 重設基準，矩陣部分必須一致（`--matrix`）。
5. 跑相關 e2e：`node tools/e2e-*.js`（Playwright 在 /opt/npm-tools）。全部測試清單見 tools/。
6. README.md 版本紀錄加一行 → commit（附 Co-Authored-By）→ push main。
7. 用 Artifact 工具把 `dist/raid-leader.html` 發布到開發者既有的單檔預覽 artifact（同一個網址更新）。
8. 用瀏覽器確認線上 `app.js?v=` 已是新版。

## 設計慣例
- `src/core` 只放邏輯，不碰畫面，可在 Node 跑模擬；UI 在 `src/ui`。
- 職業 = `src/core/classes/` 一個檔案 + `classes/index.js` 登記一行（像 DLC）。
- 數值調整一定先寫或跑模擬工具（sim.js、sim-ch2.js、sim-abyss.js、probe.js、shaman-sim.js、druid-sim.js），用數據說話。
- 物品定義在 `config.js` 的 `ITEM_BASES`（基底代號不可改名，只能新增）、`GEAR_AFFIX`、`ITEM_TIERS`；名稱一律用 `itemLabel()` 組，不要寫死到存檔。
- 存檔格式只加不改，舊檔升級寫在 `game.js` 的 `migrate()`；載入一律經過 `sanitizeSave` + `normalizeTypes`（安全）。
- CSP 在 `tools/build.js`：新增外部來源要同步更新。
- 圖示來自 game-icons.net（CC BY 3.0）：改 `src/ui/icons.js` 對照表後跑 `node tools/icons-build.js`。

## 目前狀態（v0.17.0，GAS 對應 v0.14 版）
- 內容：6 職業（含德魯伊、薩滿）、2 章 14 層、傳奇秘境＋深淵秘境（共用體力）、寶庫、每日任務／首勝／簽到、45 個成就、T0 職業套裝、雲端存檔（Google 登入、自動同步、衝突偵測）。
- 已決定：秘境體力制、套裝依職業分、樓層用羅馬數字、日文上線前再做、帳密登入不做（只用 Google）。
- 待辦／候選：戰鬥紀錄 emoji 換圖示、技能名稱改成原創（商業化前）、日文、活動副本、T1 套裝、刷寶模式、10 人團本、主動技能。
