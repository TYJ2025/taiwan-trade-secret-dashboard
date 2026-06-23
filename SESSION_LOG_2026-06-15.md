# Session Log — 最高法院營業秘密裁判「每週一例行更新」
Date: 2026-06-15 (星期一)
Operator: Claude (Cowork，排程任務 sc-trade-secret-weekly-renewal 自動執行)
User: YJ

> 本 session 依 CLAUDE.md「Log-first」原則撰寫；同一日多 session 以 `## Session HH:MM` 區隔。
> 本次為排程自動執行，YJ 不在場；遇實作細節自行合理決定並於報告註記。

---

## 0. 本 session 目標（動手前填）

- 主要目標：執行每週一例行的最高法院營業秘密裁判更新——比對週基準、產 `reports/SC_WEEKLY_2026-06-15.md`、找出新案、若有新案補產 AI 草稿（reviewed=false）、抽樣驗證、提醒 YJ 本機 git。
- 本次以**本機現有資料為準**。若要納入每日 GitHub 機器人最新增補案件，需由 YJ 本機先 `git pull`（沙箱不做任何 git 寫入）。
- 成功條件（可驗證）：
  1. `node scripts/weekly_sc_renewal.mjs` 離線執行成功，產出本週報告並更新 baseline。
  2. 計算 fulltext vs summaries 差集，明確回報新案數。
  3. 若有新案：補產 AI 草稿，所有 quotable／outcomeVerbatim 以程式 assert 逐字存在於 fullText。
  4. SC 筆數只增不減；`npx vite build` 驗證輸出至 /tmp，不動 dist/。
- 不做事項：不執行任何 git 寫入；不改 `data/cases.json`／`data/stats.json`／`index.legacy.html`／`.github/workflows`；不自動改寫 holdings comparison 比對分析。

---

## 1. 環境與資料前置盤點

| 檢查項 | 指令 / 方法 | 結果 |
|---|---|---|
| 專案路徑 | `pwd` | Taiwan Trade Secrets Case Tracker（沙箱掛載）|
| 系統日期 | `date` | 2026-06-15（UTC；台灣時間週一早上）|
| 上週基準 | 讀 `data/sc_weekly_baseline.json` | 6/14 首建，74 筆 |
| 既有報告 | `reports/SC_WEEKLY_2026-06-14.md` | 已存在（首份，本週新增 0）|

---

## 2. 計畫步驟（動手前填）

1. [ ] 執行 `node scripts/weekly_sc_renewal.mjs`（no-fetch，沙箱無憑證）— 預期輸出：`reports/SC_WEEKLY_2026-06-15.md` + 更新 baseline + runs feed。
2. [ ] 計算 fulltext vs summaries 差集，判定新案。
3. [ ] 若有新案補產 AI 草稿並 assert 逐字；若無，回報「本週無新增」。
4. [ ] `npx vite build` 至 /tmp 驗證。
5. [ ] 回填 §3–§7，present 報告，提醒 YJ 本機 git。

---

## 3. 執行紀錄（逐步）

### [00:08] 執行週更新腳本
- 意圖：見 §0；比對週基準、產本週報告、更新 baseline 與 run feed、抽樣驗證。
- 指令：`node scripts/weekly_sc_renewal.mjs`
- 預期結果：no-fetch 模式（沙箱無 JUDICIAL 憑證），讀 74 筆，本週新增 0，產 `reports/SC_WEEKLY_2026-06-15.md`。
- 實際結果：env 無憑證跳過 API（沙箱常態）；現有 74 筆，本週新增 0、消失 0；3 筆抽樣全通過；缺摘要 0、未複核 74（依 YJ 指示維持 reviewed=false，非待辦）；報告已寫入、baseline 更新（74）、run feed 更新（保留 2 筆）。
- 異常／差異：無。
- 後續行動：獨立複算差集確認。

### [00:09] 獨立複算 fulltext vs summaries 差集
- 意圖：不依賴腳本，自行交叉驗證是否真有新案。
- 指令：`node -e` 讀兩檔比對 keys。
- 預期結果：差集為空（與腳本一致）。
- 實際結果：fulltext 74、summaries 74；新案（在 fulltext 不在 summaries）= 0；孤兒（在 summaries 不在 fulltext）= 0；baseline 74。三方一致。
- 異常／差異：無。
- 後續行動：因無新案，**不補產 AI 草稿**，亦不動 holdings curated／comparison。

### [00:09] Build 驗證（輸出至 /tmp，不動 dist/）
- 意圖：確認前端可正常 build（資料檔未破壞）。
- 指令：`npx vite build --outDir /tmp/vite_verify_0615 --emptyOutDir`
- 預期結果：build 成功；dist/ 不被更動。
- 實際結果：✓ built in 2.62s；index.js 760.33 kB（gzip 216.49 kB），CSS 31.91 kB；chunk >500kB 為既有警告非錯誤。dist/ 時間戳仍為 6/12，未受影響。
- 異常／差異：無。

---

## 4. 資料抽樣驗證

> 本週無資料寫入（無新案需補摘要），故無 before/after 比對；以 SC 案件欄位完整性與筆數不變性為守門。

| # | 案號 | 檢查欄位 | 期望 | 結果 |
|---|---|---|---|---|
| 1 | TPSM,114,台上,5831,20260211,1 | adDate/charCount/reason | 非空、charCount≥100 | ✅ 通過 |
| 2 | TPSV,114,台上,1492,20251029,1 | 同上 | 同上 | ✅ 通過 |
| 3 | TPSM,114,台抗,1432,20251002,1 | 同上 | 同上 | ✅ 通過 |

- 筆數只增不減：baseline 74 = current 74 ✅
- 差集獨立複算：新案 0、孤兒 0 ✅（與腳本一致）
- 本週未修改 `supreme_court_case_summaries.json`、`supreme_court_holdings_curated.json`，故金額／outcome 抽取結果不變。

---

## 6. 已知限制（誠實揭露）

1. **Cowork 沙箱無 API 憑證**：本週未重跑 JList API（憑證僅在 GitHub Actions／YJ 本機），以本機現有資料為準。若每日 bot 已增補新案，需 YJ 本機先 `git pull` 同步後，下週任務方能比對到。
2. **案件摘要為 AI 自動生成、未經律師覆核**：依 YJ 指示保留此註記，`reviewed` 維持 false，不視為待辦 backlog。
3. **篩選沿用 scrape_sc.mjs 雙路定義**：TPS AND（案由含「營業秘密」OR 全文含「營業秘密法」），可能有 false positive（全文偶然提及），本週無新案故無新增存疑者。

---

## 7. 檔案異動摘要

修改（由腳本產製）：
- `reports/SC_WEEKLY_2026-06-15.md` — 本週報告（新增）
- `data/sc_weekly_baseline.json` — 基準快照更新（仍 74 筆）
- `data/runs.json`（及 public 鏡像）— 追加一筆 run 紀錄

未修改：
- `data/supreme_court_case_summaries.json`、`data/supreme_court_holdings_curated.json`、`data/supreme_court_holdings_index.json`（本週無新案）
- `dist/`（build 輸出導向 /tmp，未動部署產物）
- 未執行任何 git 寫入（符合 CLAUDE.md §4 與 memory: no-sandbox-git-writes）

---

最後修訂：2026-06-15 — Claude (Cowork)
