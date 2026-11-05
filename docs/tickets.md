# 工單

更新：2026-11-05　分支：`claude/website-optimization-content-jvengc`

| 等級 | 意義 |
|---|---|
| P0 | 不做，新功能上線後無法運作 |
| P1 | 上線前應處理，否則會誤導使用者 |
| P2 | 可排後續 |

---

## 本次已完成（供驗收）

| 項目 | 檔案 | 說明 |
|---|---|---|
| 每週挑戰賽公開頁 | `weekly.html` | 本週曲目、倒數、排行（同分並列）、歷週切換、登入後投稿（即時計算扣血） |
| 譜面創作工坊公開頁 | `workshop.html` | 作品卡片、搜尋、標籤篩選、排序、登入後投稿（曲目搜尋，曲庫按需載入） |
| 委員後台 | `admin-content.html` | 兩個分頁；週次與曲目設定、成績登記、作品收錄；可從 Discord 通知連結自動預填 |
| API | `api/content.js`、`api/_content.js` | 委員 GET/PUT（樂觀鎖），玩家 POST 投稿 → Webhook；資料驗證集中在 `_content.js` |
| 資料 | `data/weekly.json`、`data/workshop.json` | 空白初始檔 |
| 舊端點移除 | `api/auth/discord.js`、`api/auth/status.js` | 全站無引用；`status.js` 讀未簽章的 `user` cookie |
| 首頁接線 | `main.js`、`index.html` | 活動卡、Explore、頁尾連到新頁面 |

流程與段位挑戰相同：玩家投稿 → Discord 通知委員 → 委員點通知標題進後台（已預填）→ 核對證明 → 儲存（GitHub commit → 重新部署）。

---

## P0

### T-01　確認環境變數

新功能沿用現有變數，不需新增也能運作。

| 變數 | 必要 | 用途 |
|---|---|---|
| `DISCORD_RESERVE_WEBHOOK` | 是（已存在） | 未設定 `DISCORD_CONTENT_WEBHOOK` 時，投稿通知送到這裡 |
| `DISCORD_CONTENT_WEBHOOK` | 否 | 想讓投稿通知與段位預約分開頻道時設定 |
| `RESERVE_MENTION_ROLE_ID` | 否（已存在） | 投稿通知要 tag 的委員身分組 |
| `SITE_URL` | 否 | 通知裡後台連結的網域；未設定時用請求的 Host |
| `GITHUB_TOKEN`、`GITHUB_REPO`、`GITHUB_BRANCH` | 是（已存在） | 後台儲存寫入 GitHub |

**驗收**：Vercel Preview 部署上，用一般帳號投稿一次，委員頻道收到通知。

### T-02　確認 Serverless Function 數量

本次 +1（`content.js`）−2（兩支舊端點），目前共 11 支。

⚠️ 我目前無法確認 Hobby 方案的確切上限與是否仍有此限制，請直接查閱：https://vercel.com/docs/limits

**驗收**：Preview 部署成功，Functions 分頁列出 `api/content`。

### T-03　端對端驗收（Preview 環境）

1. 委員進 `/admin-content.html` → 新增週次 → 加 1–2 首曲目 → 儲存。
2. 等重新部署完成，`/weekly.html` 顯示該週為「進行中」。
3. 一般帳號投稿 → 委員頻道收到通知 → 點通知標題 → 後台已預填 → 新增 → 儲存。
4. 重新部署後，排行出現該玩家；同一玩家再投稿，後台顯示「此玩家已有成績，將更新」。
5. 工坊：投稿 → 通知 → 後台預填 → 補上說明與標籤 → 儲存 → 公開頁出現。

---

## P1

### T-04　每週挑戰賽規則由委員定案

目前頁面上的規則是依現有系統推出的預設，**需委員確認或修改**：

| 項目 | 目前做法 | 待決定 |
|---|---|---|
| 計分 | 每週可選「扣血合計」或「分數合計」 | 是否兩種都要 |
| 扣血權重 | 沿用段位挑戰預設（`data/rank-songs.json` 的 `defaults.damage`） | 是否另訂 |
| 同分 | 並列同名次，不決勝 | 是否要決勝規則（例：MISS 少者優先） |
| 週期 | 新增週次預設為下週一至週日 | 是否固定週期 |
| 獎勵 | 無 | 是否發 Discord 稱號或點數 |
| 證明 | 必填 https 連結 | 是否接受只傳 Discord 附件 |

**修改位置**：規則文字在 `weekly.html` 的 `renderRules()`；排名在 `ranked()`。

### T-05　大賽頁與 SEGA 2022 原文不一致

`2026springchampionshiprules.html` 仍是 SEGA 2022 規則的翻譯：

- 規則寫「3 人隊伍」，概要頁寫「個人參加」。
- 規則有「本戰（線下賽）」，概要頁寫全程線上。
- 「報名參賽／選手介紹／直播」及「比賽規約」PDF 仍連到 `pjsekai.sega.jp/championship2022spring`。
- 概要頁「舉辦平台」的 YouTube／Twitter 連到 SEGA 官方帳號。
- 聯絡方式下的受理時間沿用 SEGA 客服文字。

**需要**：主辦方提供實際規則後改寫；不確定的段落先移除，不保留 SEGA 原文。

### T-06　委員自我介紹

2025 年「雪白」「小藍」兩段讀起來像代寫，請本人重寫後更新 `main.js` 的 `STAFF2025`。2026 年 La.、afedrk、雪白三人的介紹是空的。

---

## P2

### T-07　首頁「特別活動」卡片

目前只寫「詳細內容將於 Discord 公告」。活動確定後補頁面；若短期內沒有，建議移除卡片，避免空預告。位置：`main.js` 的 `ACTIVITIES`。

### T-08　首頁 Top Events 輪播沒有圖片

三張都是漸層底。可放每週挑戰賽、段位挑戰、大賽主視覺。位置：`main.js` 的 `EVENTS` 加 `img`。

### T-09　投稿節流只在單一 instance 內有效

`api/content.js` 與 `reserve.js` 一樣用記憶體 Map 節流（每人 10 分鐘 1 次），換 instance 就會重置。目前投稿只會發通知、不寫資料，濫用成本低；若出現洗版，再改用 Vercel KV 或 Upstash 存時間戳。

### T-10　工坊作品無檢舉／下架流程

目前只能由委員在後台刪除。若作品量變多，可在卡片加「回報」連到 Discord 頻道。

### T-11　共用程式碼

`esc()`、`todayTPE()`、扣血計算在 `weekly.html`、`admin-content.html`、`api/_content.js` 各有一份。頁面數再增加時，可抽成 `public/js/common.js`（前端）。

### T-12　殘留檔案清理

repo 根目錄有一次性腳本與備份：`index.html.backup`、`view-source_https___pjsekai.sega.jp_championship2022spring_index.html`、`booking.html`（0 bytes）、`js/ScrollTrigger.min.js`（0 bytes）、各種 `*.mjs` 改寫腳本。確認不再需要後移除或移到 `_backup/`（已在 `.gitignore`）。
