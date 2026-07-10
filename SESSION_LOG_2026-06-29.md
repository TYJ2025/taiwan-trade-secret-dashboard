# Session Log — 最高法院營業秘密裁判每週更新
Date: 2026-06-29 (星期一)
Operator: Claude (Cowork) — 排程任務 sc-trade-secret-weekly-renewal
User: YJ

> 每週一例行：在每日 GitHub bot 已抓進的資料上做差異彙整、抽樣驗證、產週報告。
> 規範見 `CLAUDE.md`。本次於沙箱執行，**絕不做任何 git 寫入**。

---

## 0. 本 session 目標（動手前填）

- 主要目標：執行 `scripts/weekly_sc_renewal.mjs`，比對週基準、產 `reports/SC_WEEKLY_2026-06-29.md`，找出並（如有）補產新案 AI 草稿。
- 成功條件（可驗證）：
  1. 產出 `reports/SC_WEEKLY_2026-06-29.md`，並更新 `data/sc_weekly_baseline.json`。
  2. 算出 fulltext 與 summaries 之差集（新案 keys）；若有新案，補產 summaries / holdings curated 草稿（reviewed=false），且 quotable/outcomeVerbatim 經程式 assert 確實 in fullText。
  3. SC 筆數只增不減；`npx vite build` 驗證成功（輸出至 /tmp，不動 dist/）。
- 不做事項：不改 index.legacy.html、data/cases.json、data/stats.json、.github/workflows；不自動改寫 holdings comparison 比對分析；不做任何 git 操作。

---

## 1. 環境與資料前置盤點

| 檢查項 | 結果 |
|---|---|
| 專案路徑 | /sessions/elegant-jolly-franklin/mnt/Taiwan Trade Secrets Case Tracker |
| 最後 commit | 351c572 chore: 更新資料與頁面 2026-06-23 |
| node | v22.22.3 |
| 週基準 baseline | 上次 2026-06-22 快照，count=74 |
| 上週報告 | SC_WEEKLY_2026-06-22.md：本週無新增，74 筆全有 AI 摘要 |

備註：本次以本機現有資料為準。若要納入每日 GitHub 機器人最新增補案件，需由 YJ 本機先 `git pull`（沙箱不做 git）。沙箱無司法院 API 憑證，週一此時段通常略過 API 抓取，屬正常。

---

## 2. 計畫步驟（動手前填）

1. [ ] 執行 `node scripts/weekly_sc_renewal.mjs` — 預期輸出：reports/SC_WEEKLY_2026-06-29.md + 更新 baseline。
2. [ ] 計算 fulltext vs summaries 差集 — 預期輸出：新案 keys 清單（可能為空）。
3. [ ] 若有新案：補 summaries / holdings curated 草稿並 assert verbatim。
4. [ ] 驗證：筆數只增不減、vite build 至 /tmp。
5. [ ] present_files 呈現週報告。

---

## 3. 執行紀錄（逐步）

### [00:08] 執行週更新腳本
- 意圖：在每日 bot 既有資料上做差異彙整、抽樣、產週報告。
- 指令：`node scripts/weekly_sc_renewal.mjs`
- 預期結果：產 reports/SC_WEEKLY_2026-06-29.md + 更新 baseline；無憑證時略過 API。
- 實際結果：現有 SC 74 筆；本週新增 0、消失 0；3 筆抽樣全通過；缺摘要 0、未複核 74、抽樣異常 0。已寫 report、baseline（74）、runs.json。未做 git。
- 異常／差異：無。沙箱無 JUDICIAL_USER/PASS，跳過 API 抓取屬常態。
- 後續行動：獨立核對差集。

### [00:09] 獨立核對 fulltext vs summaries 差集
- 意圖：不完全依賴腳本，自行驗證有無新案。
- 指令：node 內嵌比對 cases keys。
- 預期結果：差集若為空即無新案。
- 實際結果：fulltext 74、summaries 74、新案差集 []、孤兒 0。確認本週無新增。
- 異常／差異：無。
- 後續行動：因無新案，免補 AI 草稿；進行 build 驗證。

### [00:09] Build 驗證（輸出至 /tmp，不動 dist/）
- 意圖：確認前端可正常 build。
- 指令：`npx vite build --outDir /tmp/vite_build_check --emptyOutDir`
- 預期結果：built 成功；dist/ 不被更動。
- 實際結果：✓ built in 2.74s（index.js 763.98 kB / gzip 217.60 kB，chunk >500kB 警告為既有狀況）。dist/ 仍為 6/23，未更動。
- 異常／差異：無。

---

## 4. 資料抽樣驗證

本次**無**新增或修改給前端讀的判決資料（summaries/holdings/fulltext 皆未變動），故無 before/after 金額比對需求。
腳本層級欄位完整性抽樣（3 筆，皆通過）：

| # | 案號(JID) | adDate | charCount | reason | 結果 |
|---|---|---|---:|---|---|
| 1 | TPSM,114,台上,5831,20260211,1 | 2026-02-11 | 5,262 | ✅ | ✅ 通過 |
| 2 | TPSV,114,台上,1492,20251029,1 | 2025-10-29 | 3,990 | ✅ | ✅ 通過 |
| 3 | TPSM,114,台抗,1432,20251002,1 | 2025-10-02 | 2,735 | ✅ | ✅ 通過 |

- 筆數只增不減檢查：基準 74 ≤ 現 74 ✅
- summaries / fulltext keys 對稱：兩側皆 74，孤兒 0 ✅

---

## 5. 建置／部署驗證

| 步驟 | 指令 | 結果 |
|---|---|---|
| Build | `npx vite build --outDir /tmp/vite_build_check` | ✓ built in 2.74s |
| dist/ 保護 | `ls -la dist/` | 仍為 2026-06-23，未更動 ✅ |

---

## 6. 已知限制（誠實揭露）

1. 原始抓取以司法院 JList 開放資料 API 為準（每日 GitHub Action 執行）；本次於沙箱無憑證，僅做差異彙整與報告，未重跑 API。本機現有資料截至 6/23 commit；若每日 bot 已有 6/23 之後增補，需 YJ 本機先 `git pull` 後再跑本流程才會反映。
2. 案件摘要為 AI 自動生成、未經律師覆核（依 YJ 指示保留註記，reviewed 維持 false，不逐筆人工覆核）。
3. 篩選沿用 scrape_sc.mjs 雙路定義：TPS AND（案由含「營業秘密」 OR 全文含「營業秘密法」）；可能有 false positive（全文偶然提及），需人工複核。本週無新案，無新增存疑項。

---

## 7. 檔案異動摘要

本 session 產生／修改（皆非 git 操作）：
- 新增 `SESSION_LOG_2026-06-29.md` — 本日 log。
- 新增 `reports/SC_WEEKLY_2026-06-29.md` — 本週報告（無新增案件）。
- 修改 `data/sc_weekly_baseline.json` — baseline 快照更新（74 筆）。
- 修改 `data/runs.json` — run feed（保留 4 筆）。

注意（非本 session 造成，為 YJ 本機既有未提交變更，謹此提醒）：
git status 另顯示 `src/hooks/useData.js`、`src/pages/SupremeCourtHoldings.jsx`、`SESSION_LOG_2026-06-22.md` 已修改，及 `data/factcourt_holdings_*.json`、`scripts/build_holdings_index_factcourt.py`、`scripts/gen_factcourt_curated_damages.mjs` 為未追蹤檔。這些非本次排程所動，請 YJ 本機自行確認是否一併提交。

---

最後修訂：2026-06-29 — Claude (Cowork) 排程
