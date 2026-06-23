# Session Log — 最高法院營業秘密案件「每週自動更新」流程建置
Date: 2026-06-14 (星期日)
Operator: Claude (Cowork)
User: YJ

> 本 session 依 CLAUDE.md「Log-first」原則撰寫；同一日多 session 以 `## Session HH:MM` 區隔。

---

## 0. 本 session 目標（動手前填）

- 主要目標：建立**每週一早上自動執行**的最高法院營業秘密裁判「更新＋差異報告」流程；抓取與報告自動化，**git commit/push 由 YJ 本機執行**（沙箱不做 git 寫入）。
- 範圍（依 YJ 6/14 確認）：全部營業秘密判決；自動化程度＝抓取＋產差異報告；執行時點＝每週一早上。
- 成功條件（可驗證）：
  1. `scripts/weekly_sc_renewal.mjs` 可離線執行：讀現有 SC 資料集（74 筆）→ 與週基準比對 → 產 `reports/SC_WEEKLY_<date>.md`。
  2. 報告須含：本週新增案件清單、待補 AI 摘要 backlog（新案 bot 不自動產 curated 摘要）、抽樣驗證、已知限制、push 提醒。
  3. 建立 Cowork 排程（每週一 08:00 台灣時間），prompt 內含 log-first 與報告產製。
  4. 全程不執行 git commit/push（符合 memory: no-sandbox-git-writes）。
- 不做事項：不改 `data/cases.json` / `data/stats.json`（52 筆審理中資料集）；不動 `index.legacy.html`；不改 `deploy.yml` 的既有部署；不重跑既有 492/74 筆抽取。

---

## 1. 環境與資料前置盤點

| 檢查項 | 指令 / 方法 | 結果 |
|---|---|---|
| 專案路徑 | `pwd` | Taiwan Trade Secrets Case Tracker（沙箱掛載）|
| node / python | `node -v && python3 -V` | node v22.22.3 / Python 3.10.12 |
| SC 資料集 | 讀 `data/supreme_court_judgments_fulltext.json` | 74 筆；keys: seq,title,jid,sizeK,rocDate,adDate,reason,excerpt,sources,fullText,charCount |
| SC 摘要 | 讀 `data/supreme_court_case_summaries.json` | `cases` 為 jid→{caseNo,outcome,outcomeVerbatim,gist,mainIssues,reviewed} 之 map，74 筆 |
| 既有每日爬蟲 | 讀 `scripts/scrape_sc.mjs` + `.github/workflows/scrape.yml` | 每日 04:06(台)透過 JList API 抓 TPS 營業秘密案，寫 SC 檔並 push；**curated 摘要不在 bot 產製範圍**（scrape_sc.mjs L191）|
| API 憑證 | `env \| grep JUDICIAL`；`ls .env*` | 沙箱內**無** JUDICIAL_USER/PASS、無 .env（憑證僅存於 GitHub Actions secrets）；API 僅 00:00–06:00(台)開放 |

### 設計結論（憑證現實 → 分工）
- API 抓取需憑證＋僅清晨開放，**Cowork 沙箱無法可靠重跑 API**。每日 GitHub Action 已負責「抓原始全文 + push」。
- 因此**每週 Cowork 任務的定位**：在每日 bot 已抓進來的資料上，做**週度差異彙整 + 為新案補 curated AI 摘要（填補 bot 缺口）+ 抽樣驗證 + 產報告**，交 YJ 複核後本機 push。
- `weekly_sc_renewal.mjs` 仍保留：**若** env 有 JUDICIAL 憑證則先呼叫 `scrape_sc.mjs` 抓新（GitHub Actions 或 YJ 本機有憑證時可一鍵抓＋報告）；無憑證則僅消費既有資料，不報錯。

---

## 2. 計畫步驟（動手前填）

1. [ ] 寫 `scripts/weekly_sc_renewal.mjs` — 輸出：可 `--dry-run` 印出新增/缺摘要/驗證結果。
2. [ ] 正式跑一次 — 輸出：`reports/SC_WEEKLY_2026-06-14.md` + `data/sc_weekly_baseline.json`（首次建立基準）。
3. [ ] 抽 3 筆 SC 案件比對欄位完整性。
4. [ ] 建立每週一 08:00 排程任務。
5. [ ] 回填本 log §3–§8，交付 YJ。

---

## 3. 執行紀錄（逐步）

### [遲報條目] 唯讀勘查 bash（log 撰寫前已執行）
- 意圖：了解 repo 結構、SC 資料 schema、既有爬蟲與憑證可用性，方能正確設計週流程。
- 已執行（皆唯讀，未改任何檔）：`ls -la`、`cat scrape.yml / sc_meta.json`、`node -e` 讀取各 JSON 之筆數與 keys、`git log` 查 SC 檔歷史、`env | grep` 查憑證。
- 違反原因：依 CLAUDE.md §1，「執行 bash」應先寫 log；我在盤點階段先跑了唯讀指令才補寫本 log。
- 影響評估：全為唯讀、未寫檔、未對外抓取、未 git，**無資料汙染風險**，無需 rollback。後續所有寫檔行為均在本 log 之後。

### [建立並測試] weekly_sc_renewal.mjs
- 意圖：見 §0。
- 預期結果：見 §2 步驟 1–2。
- 實際結果：
  - `--dry-run`：讀 74 筆、抽樣 3 筆（114台上5831、114台上1492、114台抗1432）全通過，不寫檔。
  - 正式 `--no-fetch`：寫 `reports/SC_WEEKLY_2026-06-14.md`（7,205 bytes）、建立 `data/sc_weekly_baseline.json`（74 筆）。
  - 第二次執行：本週新增 0、消失 0（idempotent 正確）。
  - 純函式單元測試：diffAgainstBaseline → added=[NEW]/removed=[GONE]；summaryStatus → missing/reviewed/unreviewed 三態正確；fieldCheck good/bad 正確。
  - 加 `import.meta.url` 守門：直接執行才跑 main()，被 import（測試）不寫檔——已驗證。
- 異常／差異：summaries 之 `reviewed` 全為 false（74/74），故 backlog「未複核 74」為實情（有草稿、未經 YJ 複核），非錯誤。
- 後續行動：建排程。

### [建立排程] sc-trade-secret-weekly-renewal
- 意圖：每週一早上自動跑更新＋報告。
- 實際結果：已建 Cowork 排程，cron `0 8 * * 1`（本地時間，排程器調整為 08:07），下次約 16 小時後（週一早上）。prompt 內含 log-first、跑腳本、為新案補 curated 摘要（reviewed 維持 false 待 YJ 複核）、present 報告、提醒 YJ 本機 push。
- 異常／差異：無。

---

## 4. 資料抽樣驗證

> 本週流程**不修改**金額抽取結果，故沿用主資料集既有基準作為「抽取邏輯未壞」之守門；SC 週流程另就 SC 案件做欄位完整性抽查。

| # | 案號 | 檢查欄位 | 期望 | 結果 |
|---|---|---|---|---|
| 1 | TPSM,114,台上,5831,20260211,1 | adDate / charCount / reason | 非空、charCount≥100 | ✅ 通過 |
| 2 | TPSV,114,台上,1492,20251029,1 | 同上 | 同上 | ✅ 通過 |
| 3 | TPSM,114,台抗,1432,20251002,1 | 同上 | 同上 | ✅ 通過 |

資料集 sanity：SC 筆數只增不減（baseline 74 = current 74，首跑建立基準）✅。
備註：資料集最新一筆裁判日為 2026-02-11，顯示每日 GitHub Action 確有持續增補。

---

## 6. 已知限制（誠實揭露）

1. **Cowork 沙箱無 API 憑證**：每週任務預設不重跑 JList API（憑證僅在 GitHub Actions / YJ 本機）；原始抓取仍倚賴每日 GitHub Action。週任務負責差異彙整、補 curated 摘要、驗證與報告。
2. **案件摘要為 AI 自動生成、未經律師覆核**：依 YJ 6/14 指示，保留此註記即可，不逐筆人工覆核、`reviewed` 維持 false；報告以揭露呈現，不視為待辦 backlog，亦不逕標「已認定」。
3. **週基準首次建立**：首跑以當下 74 筆為基準，故「本週新增」自下週起才有比對基礎；首份報告改列資料集現況與待補摘要 backlog。

---

## 7. 檔案異動摘要

新增：
- `scripts/weekly_sc_renewal.mjs` — 週度差異/報告/驗證 orchestrator
- `reports/SC_WEEKLY_2026-06-14.md` — 首份週報告
- `data/sc_weekly_baseline.json` — 週比對基準（JID 快照）
- `SESSION_LOG_2026-06-14.md` — 本 log

修改：
- `data/supreme_court_case_summaries.json` — **本次未修改**（無新案需補摘要；現 74 筆皆 reviewed=false 待 YJ 複核）

排程（非 repo 檔）：
- `/Users/jesuisjane/Claude/Scheduled/sc-trade-secret-weekly-renewal/SKILL.md` — 每週一 08:07 本地時間

---

## 8. 建議 YJ 本人抽查

1. 開 `reports/SC_WEEKLY_2026-06-14.md`，確認「待補 AI 摘要」backlog 件數與 `reviewed=false` 一致。
2. 確認排程任務「每週一 08:00」已建立。
3. 本機執行 push（`push_to_github.command` 或 git add/commit/push）後，確認 GitHub Pages 正常。

---

## 9. 違反守則（若有）

- 見 §3「遲報條目」：log 撰寫前先跑唯讀勘查 bash；已補揭露，無資料風險，無 rollback。

---

---

## Session (續) — 為儀表板新增 run feed

### [意圖] 讓每週執行結果可顯示在 YJ 的 main-board.vercel.app
- 背景：YJ 從未收到通知（app 內通知需 app 前景、且任務尚未首跑）。YJ 選擇「儀表板面板」管道。
- 設計：`weekly_sc_renewal.mjs` 每次正式執行時，除報告外另**追加一筆 run 紀錄**到 `reports/runs.json` 並鏡像 `public/data/runs.json`（後者經 deploy 部署為 GitHub Pages 之 `/data/runs.json`，CORS `*` 可供 vercel 儀表板跨域 fetch）。
- feed 結構：`{ updatedAt, latest, runs:[{date,ranAt,status,newCount,totalCount,missingSummaries,reportFile,reportUrl}] }`，保留最近 26 筆。
- 預期：dry-run 不寫；正式跑後兩檔皆有 1 筆且 latest 一致。
- 待 YJ：提供 main-board 原始碼位置／資料來源，才能在儀表板加通知區塊。
- 實際結果：<待回填>

最後修訂：2026-06-14 — Claude (Cowork)
