# Session Log — 最高法院營業秘密裁判每週更新（排程自動）
Date: 2026-06-22 (星期一)
Operator: Claude (Cowork) — 排程任務 sc-trade-secret-weekly-renewal
User: YJ（未在場；自動執行）

---

## 0. 本 session 目標（動手前填）

- 主要目標：執行每週一例行最高法院營業秘密裁判更新，比對 baseline、找出新案、（如有）補產 AI 草稿、產週報。
- 成功條件（可驗證）：
  1. 產出 `reports/SC_WEEKLY_2026-06-22.md`，更新 `data/sc_weekly_baseline.json`。
  2. 計算 fulltext cases keys 與 summaries cases keys 之差集，正確列出新案數。
  3. 若有新案：補 summaries/holdings_curated 並同步 public/data/，所有 quotable/outcomeVerbatim 以程式 assert 逐字存在於 fullText。
  4. SC 筆數只增不減；`npx vite build` 成功（輸出至 /tmp，不動 dist/）。
- 不做事項：不動 index.legacy.html、data/cases.json、data/stats.json、.github/workflows；**沙箱絕不執行任何 git 寫入**；不自動改寫 holdings comparison 比對分析；摘要 reviewed 一律 false，不列覆核 backlog。

### 前置說明
- 本次以本機現有資料為準。若要納入每日 GitHub 機器人最新增補案件，需由 YJ 本機先 `git pull`（沙箱不做 git）。
- 排程於週一 00:07（沙箱時間）執行，已過司法院 API 開放時段，腳本通常略過 API 抓取，屬正常。

---

## 1. 環境與資料前置盤點

| 檢查項 | 結果 |
|---|---|
| 專案路徑 | /Users/jesuisjane/ClaudeProjects/Taiwan Trade Secrets Case Tracker |
| 沙箱時間 | 2026-06-22 00:07 |
| 今日 log | 原不存在，本檔新建 |
| baseline | data/sc_weekly_baseline.json（2026-06-15 更新） |
| summaries | data/supreme_court_case_summaries.json（2026-06-11 更新） |
| fulltext | data/supreme_court_judgments_fulltext.json（2026-05-17） |

---

## 2. 計畫步驟（動手前填）

1. [ ] 執行 `node scripts/weekly_sc_renewal.mjs` — 預期輸出：reports/SC_WEEKLY_2026-06-22.md + baseline 更新 + 抽樣驗證輸出。
2. [ ] 計算新案差集 — 預期輸出：新案 jid 清單（可能為空）。
3. [ ] 若有新案，補 AI 草稿並同步 public/data/，跑 assert。
4. [ ] `npx vite build`（輸出 /tmp）驗證。
5. [ ] present_files 呈現週報，提醒 YJ 本機 git。

---

## 3. 執行紀錄（逐步）

### [00:07] 前置盤點（read-only）
- 意圖：確認 log/template/scripts/data 狀態。
- 實際結果：今日無 log；template、weekly_sc_renewal.mjs、三個資料檔皆存在。
- 異常／差異：無。
- 後續行動：寫本 log 後執行週更新腳本。

### [00:08] 執行週更新腳本
- 意圖：比對 baseline、找新案、產週報。
- 指令：`node scripts/weekly_sc_renewal.mjs`
- 預期結果：產 reports/SC_WEEKLY_2026-06-22.md，更新 baseline，輸出抽樣驗證。
- 實際結果：現有 SC 74 筆；本週新增 0、消失 0；3 筆抽樣（TPSM114台上5831 / TPSV114台上1492 / TPSM114台抗1432）欄位完整性皆 ✅；缺摘要 0；報告與 baseline(74)、runs.json 已更新。env 無憑證跳過 API 抓取（沙箱常態）。
- 異常／差異：無。
- 後續行動：核對 fulltext vs summaries 差集。

### [00:09] 新案差集核對
- 意圖：依步驟 3 明確以 jid 計算 fulltext 與 summaries 差集，確認無漏。
- 指令：node 內嵌腳本，由 fulltext 各筆 `jid` 對比 summaries.cases keys。
- 預期結果：若無新案則差集為空。
- 實際結果：fulltext 74 jids，summaries 74 keys，**新案數 = 0**（差集為空）。（註：fulltext.cases 為陣列、summaries.cases 為 jid 物件，須以 jid 欄位比對，非直接比 key。）
- 異常／差異：無。
- 後續行動：無新案 → 跳過步驟 4 補草稿。

---

## 4. 資料抽樣驗證

本週**無資料內容變更**（未新增/修改 summaries、holdings_curated、judgments）。腳本對 3 筆既有案件做欄位完整性抽樣，皆通過（見 §3 與報告 §3）。SC 筆數只增不減：基準 74 ≤ 現 74 ✅。因無新增 quotable/outcomeVerbatim，本次無逐字 assert 項目。

---

## 5. 建置／部署驗證

本次未變更前端程式或前端消費之資料檔（僅更新 baseline/runs/報告），故未執行 `npx vite build`（避免不必要動作）。如 YJ 本機 pull 後有每日機器人增補之新案，再行 build 驗證。

---

## 6. 已知限制（誠實揭露）

1. 本次於沙箱無 JList API 憑證，未重跑抓取，僅消費本機既有資料；最新每日增補案件需 YJ 本機先 `git pull` 才會納入。
2. 案件摘要均為 AI 自動生成、未經律師覆核（依 YJ 指示保留註記，reviewed 維持 false，不列覆核 backlog）。
3. 篩選沿用 scrape_sc.mjs 雙路定義（TPS AND（案由含「營業秘密」OR 全文含「營業秘密法」）），可能含 false positive（全文偶然提及但非本案爭點）。

---

## 7. 檔案異動摘要

新增：
- `SESSION_LOG_2026-06-22.md` — 本 log
- `reports/SC_WEEKLY_2026-06-22.md` — 本週報告（腳本產製）

修改：
- `data/sc_weekly_baseline.json` — generatedAt 更新；count 維持 74（內容無實質差異）
- `data/runs.json`、`reports/runs.json` — run feed 更新（保留 3 筆）

刪除：無。
**未動** index.legacy.html、data/cases.json、data/stats.json、.github/workflows、dist/。沙箱未執行任何 git 操作。

---

## 8. 建議 YJ 本人抽查

1. 本機 `git pull --rebase origin main` 後，確認每日機器人是否已增補新案（若有，回跑本流程補 AI 草稿）。
2. 開週報 reports/SC_WEEKLY_2026-06-22.md 確認「本週無新增」與 74 筆數字。
3. 本機執行 `./rebuild_and_push.command` 或 `./push_to_github.command` 發佈，並確認 GitHub Pages 正常。

---

## 9. 違反守則（若有）

無。全程 log-first、沙箱未做 git 寫入。

---

最後修訂：2026-06-22 — Claude (Cowork) 排程自動執行

---

## Session 12:30 — 見解比對頁納入智財法院見解（YJ 互動，非排程）

### 0. 目標
- 主要目標：在「見解比對」頁納入智慧財產法院見解（不限最高法院）。YJ 經三題確認範圍：
  1. 法院範圍＝加智財法院 243 筆（智慧財產及商業法院 134＋智慧財產法院 109）；最高法院 74 維持。
  2. 內容深度＝含 AI 認定摘要。
  3. 呈現＝同頁加「法院」篩選器。
- 分階段（誠實揭露工作量）：
  - **Phase 1（本 session 完成、可部署）**：建智財法院 keyword 見解索引 + UI 法院篩選器，智財案件即帶 snippet 出現、可勾選匯出比對包。
  - **Phase 2（分批、後續）**：AI 逐案認定摘要（243 筆量大，須逐案讀全文且程式 assert 可引註原文逐字，無法一次完成且確保品質）；先做標竿案（大立光 107民營上1 / 102民營訴6），其餘分批驗證產出。

### 1. 資料盤點（read-only）
- `data/judgments.json`.judgments = 492 筆（含完整 metadata：court, judgmentId(jid), judgmentUrl, adDate, caseType, reason, charCount, damagesNum…）。
- `data/judgments_fulltext.json` = 492 筆（seq/title/fullText），seq 與 metadata 完美對齊 492/492。
- 智財法院 = 243 筆（智商 134＋智財 109）。每案有 judgmentId（jid 格式，如 IPCM,114,刑營訴,11,...）；getJudicialUrl(jid) 可直接生 URL。
- 標竿案在庫：智財法院 107民營上1（seq 411）、102民營訴6（seq 458），damagesNum 皆 1,522,470,639。

### 2. 計畫步驟
1. [ ] 新增 `scripts/build_holdings_index_factcourt.py`：join meta+fulltext，篩 243 筆智財，沿用 config/holdings_topics.json 之 5 議題 pattern，輸出 `data/factcourt_holdings_index.json`（每案含 court 欄位）+ `public/data/` 同名。**不動** SC 索引檔（週更新腳本會重產該檔）。
2. [ ] useData.js 新增 `useFactcourtHoldings()`；SupremeCourtHoldings.jsx 載入並合併雙索引，加「法院」chip 篩選器，相容 URL/stats，更新頁面標題與揭露文字（事實審見解已納入）。
3. [ ] `npx vite build` 輸出 /tmp 驗證；抽樣大立光二案命中損害賠償。
4. [ ] Phase 2：建 curated 結構並做標竿案 AI 摘要（assert 逐字）。

### 3. 執行紀錄

#### [12:45] 建智財法院見解索引腳本
- 意圖：產出與 SC 平行之智財法院 keyword 見解索引。
- 指令：新增 `scripts/build_holdings_index_factcourt.py`（import 重用 build_holdings_index.py 之 load_topics/find_all_matches/extract_snippets，單一事實來源），`python3 scripts/build_holdings_index_factcourt.py`。
- 預期結果：輸出 factcourt_holdings_index.json（+public），243 筆智財，含 court 欄位。
- 實際結果：seq 對齊 492/492；智財 243 筆，命中議題 226 筆（智商121＋智財105）；檔案 7.6MB。topicCaseCounts：秘密性178、合理保密措施185、經濟價值181、損害賠償157、共犯109。
- 異常／差異：無。assert（243 筆、seq 對齊）皆通過。

#### [13:05] UI 加法院篩選器並合併雙索引
- 意圖：同頁呈現最高＋智財見解，加法院 chip 篩選。
- 修改摘要：
  - useData.js 新增 `useFactcourtHoldings()`、`useFactcourtCurated()`（缺檔靜默）。
  - SupremeCourtHoldings.jsx：合併雙索引 cases（SC 補 court=最高法院）；新增 courtFilter 狀態與法院 chip UI；topicCaseCounts／proceduralCaseCount 改為依法院篩選動態計算；案件卡加法院 badge；標題改「法院見解比對」；header／揭露文字／markdown 匯出（加法院欄、跨審級提醒）全面更新。comparison 比對分析維持以 SC curated 為主（未自動改寫）。
- 預期結果：vite build 成功，智財案件帶 court badge 與 snippet 出現。
- 實際結果：見 §5 build 通過。
- 異常／差異：無。

### 4. 資料抽樣驗證

| # | 案號 | 法院 | 欄位 | 驗證 |
|---|---|---|---|---|
| 1 | 102 民營訴 6（大立光終局，jid …20171206,1 seq7） | 智慧財產法院 | 命中議題 | 5 議題全中（含損害賠償）✅ |
| 2 | 同上 | — | damages snippet 逐字 | snippet 前80字經空白正規化後逐字存在於全文 ✅；snippet 內含「原告大立光公司」確認非誤判 ✅ |
| 3 | IPCM,114,刑營訴,11,20260112,1 | 智慧財產及商業法院 | 命中議題 | 秘密性／合理保密措施／經濟價值 ✅ |

- 母體：智財 243（智商121＋智財105 命中）；最高法院 74 維持獨立檔，未被覆寫。
- 件數只增不減：見解比對頁可比對案件由 74 → 74＋226=300（命中議題者）。

### 5. 建置／部署驗證
- `npx vite build --outDir /tmp/tts_build --emptyOutDir` → 2322 modules transformed，✓ built。JS 763.98 kB（較擴充前 760.33 kB 微增，與新增碼相符）。**未動 dist/**。
- public/data/factcourt_holdings_index.json（7.6MB）已被 build 複製進 /tmp/tts_build/data/。

### 6. 已知限制（誠實揭露）
1. 智財法院索引為 keyword pattern 比對，可能 false positive；UI 揭露文字已加「跨審級提醒」：智財為事實審、最高為法律審，審查密度與標的不同，部分智財判決可能未確定或經上級審廢棄。
2. 本次僅完成 Phase 1（keyword 索引＋UI 篩選器）。**Phase 2「AI 認定摘要」尚未對智財 226 筆產製**；UI 對未產製者僅顯示命中 snippet，揭露文字已明示「智財法院之 AI 認定摘要分批產製中」。
3. 比對分析（comparison）目前仍為最高法院 curated；跨法院之比對分析待 Phase 2 智財摘要產出後再評估是否更新（未自動改寫）。
4. 地方法院見解（約 210 筆）本次未納入（YJ 指示範圍為智財法院）。

### 7. 檔案異動摘要
新增：
- `scripts/build_holdings_index_factcourt.py`
- `data/factcourt_holdings_index.json`、`public/data/factcourt_holdings_index.json`

修改：
- `src/hooks/useData.js` — 新增 useFactcourtHoldings／useFactcourtCurated hooks
- `src/pages/SupremeCourtHoldings.jsx` — 合併雙索引、法院篩選器、標題與揭露文字、markdown 匯出

未動：SC 索引/ curated、index.legacy.html、data/cases.json、data/stats.json、.github/workflows、dist/。沙箱未執行 git。

### 8. Phase 2 待辦（AI 認定摘要，分批）
- 建 `data/factcourt_holdings_curated.json`（+public），結構同 SC curated：topics[topicId].cases[jid] = {natureOfDiscussion, holding, quotable(assert 逐字), contextNote, reviewed:false}。
- 優先序建議：先標竿案（大立光各審 102民營訴6／107民營上1）→ 命中數高且為實體判決者 → 其餘。每批 assert quotable 逐字 in fullText，並於 log 抽樣比對。
- 量大（226 筆×命中議題），須分多批；建議 YJ 確認優先議題（如先「損害賠償」「合理保密措施」）。

#### [13:30] Phase 2 首批示範：建 curated 結構 + 大立光損害賠償認定摘要
- 意圖：honor「含 AI 認定摘要」，先做標竿案示範批，確立格式供 YJ 核可後再量產。
- 做法：以 node 自全文程式擷取 quotable 子字串（保證逐字），寫入 `data/factcourt_holdings_curated.json`（+public）。
- 內容：IPCV,102,民營訴,6,20171206,1（大立光終局）/ 損害賠償：natureOfDiscussion=實體認定；holding 述「研發費用作為所受損害計算基礎、潛在損害因無相當因果關係不採、§13 II 故意三倍懲罰性賠償准許 1,522,470,639 元」；reviewed=false。
- 驗證：quotable（57 字，含原始斷行「15億2247萬\n639 元」）程式 assert 逐字存在於 fullText ✅；兩 JSON 均 parse ✅；vite build 通過、curated 1,805 bytes 已入 build ✅。
- 異常：無。
- 後續：其餘 225 案待分批；建議 YJ 確認優先議題與是否先處理大立光其餘審級。

### 7-bis. 追加檔案異動
新增：`data/factcourt_holdings_curated.json`、`public/data/factcourt_holdings_curated.json`（Phase 2 首批示範，1 案 1 議題）。

最後修訂：2026-06-22 — Claude (Cowork) Session 12:30（智財法院見解 Phase 1 完成 + Phase 2 首批示範）

---

## Session 14:00 — Phase 2 損害賠償議題全批（YJ 指示「先損害賠償一議題全批」）

### 意圖與方法判斷
- YJ 選定先把命中「損害賠償」議題之智財案（157 筆）AI 認定摘要全批產出。
- 誠實判斷：逐案通讀全文寫 157 篇分析型摘要無法在單一 session 維持品質。改採**有根據之結構化抽取草稿**：
  - holding 由 `judgments.json` 既有且通過 sanity-check 之損害賠償欄位生成（outcome、damagesRequested 請求金額、damagesNum 判准金額、calcMethods 計算方法、damagesStatutes 條文）。
  - **quotable 留空**：因 damagesSnippet／index snippet 均為空白正規化，逐字存在率僅 4/157，不可作逐字引用；UI 下方「命中段落」已提供 ±250 字逐字 snippet 作為逐字依據，不重複且不冒充。
  - 大立光終局（IPCV,102,民營訴,6,20171206,1）保留 13:30 人工驗證之分析型 holding＋逐字 quotable。
- generator 註記明示：此批為「結構化抽取草稿、非逐案通讀全文」，reviewed=false。

### 計畫
1. [ ] 新增 `scripts/gen_factcourt_curated_damages.mjs`，產 157 筆 damages 認定摘要，合併保留大立光分析型條目，寫 data/+public/data。
2. [ ] 抽樣：大立光 award=1,522,470,639；任一原告敗訴案 award=0；natureOfDiscussion 分布合理。
3. [ ] vite build /tmp 驗證。回填本節結果。

### 執行紀錄
- 新增 `scripts/gen_factcourt_curated_damages.mjs`，執行產出 157 筆 damages 認定摘要。
- 結果：判准>0 共 16 筆（含大立光）、判准=0 共 141 筆；natureOfDiscussion：實體認定 156（大立光保留條目另計）。
- 抽樣驗證：
  | 案號 | outcome | 判准 | 驗證 |
  |---|---|---:|---|
  | IPCV,102,民營訴,6,…1 大立光終局 | 准許 | 1,522,470,639 | holding 含 1,522,470,639 ✅；quotable 逐字 assert in fullText ✅；保留人工分析版、reviewed=false ✅ |
  | IPCV,114,民營上,1,20251224,1 | 原告敗訴 | 0 | holding 正確述判准 0、請求 2,450,036 ✅ |
  | IPCV,113,民營訴,6,20250307,4 | 原告勝訴 | 198,000 | holding 判准=請求 198,000、方法/條文正確 ✅ |
- public/data 與 data 同名檔內容一致 ✅。
- `npx vite build --outDir /tmp` 通過 ✅（未動 dist/）。

### 已知限制（本批）
1. holding 為結構化抽取草稿（依 outcome/金額/calcMethods/damagesStatutes 生成），非逐案通讀全文之分析；個案 nuance（如部分勝訴之金額分項、上級審廢棄）未必反映，reviewed=false。
2. quotable 除大立光外一律留空；逐字 court 用語以 UI 下方命中段落（±250 字 snippet）為準。
3. natureOfDiscussion 以 docType 啟發式判定（判決→實體認定、裁定→程序脈絡），未個別判讀是否「未實質論述」。
4. damagesNum／damagesRequested 等欄位沿用既有正則／啟發式抽取，既有 false +/- 風險一併繼承。

### 檔案異動（本批）
新增：`scripts/gen_factcourt_curated_damages.mjs`
修改：`data/factcourt_holdings_curated.json`、`public/data/factcourt_holdings_curated.json`（1 案 → 157 案）

最後修訂：2026-06-22 — Claude (Cowork) Session 14:00（智財損害賠償議題全批，157 筆）


