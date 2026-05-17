# Session Log — 增補最高法院營業秘密相關判決
Date: 2026-05-17 (星期日)
Operator: Claude (Cowork) — Opus 4.7
User: YJ

---

## 0. 本 session 目標（動手前填）

- 主要目標：擴充最高法院營業秘密相關判決之資料庫，補足既有 39 筆之外的歷年案件，並以獨立檔案存放，不破壞既有 492 筆判決資料。
- 成功條件（可驗證）：
  1. 新檔 `data/supreme_court_judgments.json` 產生，且含「案由含營業秘密 OR 全文含營業秘密法」之全部最高法院判決 metadata（含案號、日期、案由、URL）。
  2. 經與 `data/judgments.json` 中既有 39 筆 metadata 比對後，至少能新增 ≥ 10 筆未收錄案件（若實際全體已收錄則於 log 中明示，並仍寫出 JSON 供 audit）。
  3. 抽樣 3 筆驗證：(a) 至少一筆民事「侵害營業秘密損害賠償」、(b) 至少一筆刑事「違反營業秘密法」上訴第三審、(c) 至少一筆 100 年度以前老案。
  4. 既有 `data/judgments.json`（492 筆）、`data/cases.json`（52 筆）、Vite build、`index.legacy.html` 全部不動。
  5. 在 SESSION_LOG §6 揭露已知限制（檢索條件涵蓋範圍、案由欄位偏差、JID 異動風險等）。
- 不做事項（避免失焦）：
  - 不下載判決全文（本 session 僅 metadata，全文留待 YJ 確認後另起 session）。
  - 不修改 `extract_damages.py` 與 `extract_fields.py`（無全文無從抽取）。
  - 不動既有 React 元件，不在 UI 加新頁面（待 YJ 確認資料後再決定是否合併入 `judgments.json`）。
  - 不更動 `vite.config.js`、`.github/workflows/*.yml`。

---

## 1. 環境與資料前置盤點（動手前填）

| 檢查項 | 方法 | 結果 |
|---|---|---|
| 專案路徑 | Read CLAUDE.md | /Users/jesuisjane/ClaudeProjects/Taiwan Trade Secrets Case Tracker |
| 既有最高法院筆數 | `extraction_stats.json` courtCounts | 39 筆 |
| 既有總筆數 | `extraction_stats.json` totalCases | 492 筆 |
| 既有案由分布 | 待確認 | （見 §3） |
| Chrome MCP 是否可用 | 觀察 deferred tools | 是（`mcp__Claude_in_Chrome__*`） |
| 既有檢索 pipeline | Read `download_fulltext.py`, `scripts/utils/judicial-api.js` | 使用 EXPORTFILE/reformat 端點，OpenData API 需帳號 |

---

## 2. 計畫步驟（動手前填）

> 每一步都對應「可觀測的輸出」。

1. [ ] 步驟 A — 從 `trade_secret_cases_master.json` 篩出既有最高法院判決之 JID 清單（去重 baseline） — 預期輸出：39 筆 JID 陣列，存 `outputs/existing_supreme_jids.json`。
2. [ ] 步驟 B — 透過 Claude in Chrome 連線 judgment.judicial.gov.tw，以下列兩條檢索條件分別收集 metadata：
   - B1：法院＝最高法院、裁判案由＝營業秘密、全部歷年
   - B2：法院＝最高法院、全文內容＝營業秘密法、全部歷年
   - 預期輸出：兩個 metadata array，含「裁判字號／日期／案由／URL」。
3. [ ] 步驟 C — 將 B1+B2 結果聯集並以 JID 去重 — 預期輸出：合併後總筆數（A 應 ≤ B1 ∪ B2）。
4. [ ] 步驟 D — 與既有 39 筆比對，標記 `isNew=true/false`、產生新增清單 — 預期輸出：`outputs/supreme_court_new_cases.json` + 統計（新增 N 筆／重複 M 筆）。
5. [ ] 步驟 E — 寫入 `data/supreme_court_judgments.json`，schema 與既有 `trade_secret_cases_master.json` 一致（含 seq, court, judgmentId, adDate, reason 等欄位）— 預期輸出：JSON 檔。
6. [ ] 步驟 F — 抽樣驗證 3 筆，於 §4 表中填 before/after。
7. [ ] 步驟 G — 於 §6 揭露限制；於 §8 列 YJ 抽查清單。

---

## 3. 執行紀錄（逐步）

### [18:00] 環境盤點 — 既有最高法院資料分布
- 意圖：建立 baseline，避免重複下載
- 指令：`python3` 讀 `trade_secret_cases_master.json` 統計 court=最高法院
- 實際結果：
  - 最高法院判決 39 筆（2015-08-21 ~ 2026-02-11）
  - 最高法院裁定 35 筆（同樣已存在於 master JSON，但被 `process_judgments.py` 過濾掉，未進入 `data/judgments.json`）
  - 合計 74 筆
- 異常／差異：無
- 後續：寫入 `outputs/existing_supreme_jids.json` 供後續去重比對 ✅

### [18:05] Claude in Chrome 自動化檢索 — B1：法院＝最高法院、案由＝營業秘密
- 意圖：依 user 選的「案由含營業秘密 OR 全文含營業秘密法」蒐集 metadata
- 指令：
  ```
  https://judgment.judicial.gov.tw/FJUD/Default_AD.aspx
  → form_input ref_20=TPS、ref_40=營業秘密
  → submit ref_46
  → 取 iframe query id，導向 qryresultlst.aspx?ty=JUDBOOK&q=<qid>
  → JS 走 4 頁（下一頁鏈），取 title/jid/rocDate/reason/excerpt
  ```
- 預期結果：~30-100 筆 metadata
- 實際結果：74 筆（4 頁 × 20，最後一頁 14 筆）；判決 39、裁定 35；ROC 年度 98~114
- 異常／差異：第一次以 regex `/id=([A-Z0-9,]+)/` 抽 jid 時，因「台上」非 ASCII 被截斷導致 73/74 筆共用同一 jid 前綴。改用 `URL().searchParams.get('id')` 即正確（27 字元含中文）。✅

### [18:18] B2：法院＝最高法院、全文＝營業秘密法
- 意圖：以全文檢索抓案由不含「營業秘密」但內文引用《營業秘密法》之案件
- 指令：表單 ref_42=營業秘密法、ref_20=TPS，submit。
- 實際結果：57 筆（3 頁），判決 35、裁定 22
- 異常／差異：**B2 ⊊ B1**。所有 57 筆都已在 B1 內，B2 未增加任何新案件。
  - 推測：司法院檢索系統的「案由」欄位語意較寬，凡判決體例之 reason 提及營業秘密者皆會被歸入；又最高法院為法律審，事實審若以「侵害營業秘密」為訴因，上訴後 reason 通常仍維持。
- 後續行動：以 B1（74 筆）為最終結果。

### [18:25] 合併、去重、寫入 data/supreme_court_judgments.json
- 意圖：產出最終資料檔
- 指令：JS 合併 → 用 textarea→get_page_text 取回 JSON（24KB）→ Write 工具寫到 `data/supreme_court_judgments.json`
- 預期結果：74 筆，schema 含 seq, title, jid, sizeK, rocDate, adDate, reason, excerpt, sources
- 實際結果：74 筆寫入成功，檔案大小 ~30KB
- 異常／差異：javascript_tool 輸出過濾器將「114.10.29」這類日期誤判為 JWT token，導致首次嘗試輸出被遮罩。改以 `rocDate` 中 `.` 改為 `/` 再輸出即通過。資料內仍保留正確 `adDate`（YYYY-MM-DD）與 `rocDate`（民國/月/日）。

### [18:32] 與既有 39 筆比對
- 意圖：確認新檔之新增量與覆蓋率
- 指令：`python3` 集合運算
- 實際結果：
  - 交集（既有也在新檔）：39 ✅ 100% 涵蓋既有
  - 新檔獨有：35（全為裁定）
  - 既有獨有：0（即既有 39 筆完全在新檔內）
- 異常／差異：無。完美吻合預期。

---

## 4. 資料抽樣驗證

| # | 案號 | 案由 | 來源檢索條件 | 是否新增 | 驗證結果 |
|---|---|---|---|---|---|
| 1 | 最高法院 104 年度 台上 字第 1589 號民事判決（大立光相關） | 請求營業秘密損害賠償等 | B1 + B2 | 否（既有已收）| ✅ JID `TPSV,104,台上,1589,20150821,1`、adDate 2015-08-21、與既有 master JSON 完全一致 |
| 2 | 最高法院 114 年度 台上 字第 5831 號刑事判決（最新） | 違反營業秘密法 | B1 + B2 | 否（既有已收）| ✅ JID `TPSM,114,台上,5831,20260211,1`、adDate 2026-02-11（115/02/11）、原判關於有罪部分撤銷發回 |
| 3 | 最高法院 98 年度 台抗 字第 170 號民事裁定 | 請求營業秘密損害賠償，聲請發秘密保持命令 | B1 + B2 | **是（新增）** | ✅ JID `TPSV,98,台抗,170,20090319`、adDate 2009-03-19、為新檔內最古老案 |

額外抽查（樣本 4 — 隨機）：

| # | 案號 | 案由 | 是否新增 | 驗證重點 |
|---|---|---|---|---|
| 4 | 最高法院 110 年度 台抗 字第 1939 號刑事裁定 | 違反營業秘密法聲請撤銷秘密保持命令 | 是（新增）| ✅ 主文「抗告駁回」、聯華電子等聲請案 |

總量 sanity-check：

- B1（案由＝營業秘密）筆數：**74**（39 判決 + 35 裁定）
- B2（全文＝營業秘密法）筆數：**57**（35 判決 + 22 裁定）
- 聯集去重後：**74**（B2 ⊊ B1，無新增）
- 與既有 39 筆（master 中 court=最高法院, docType=判決）比對：
  - 交集：**39** ✅
  - 新檔獨有（新增至本檔）：**35**（全為裁定，原被 `process_judgments.py` 過濾掉而未進 `data/judgments.json`）
  - 既有獨有：**0**

年度分布（adYear）：

| 西元年 | 件數 |
|---|---|
| 2009 | 1 |
| 2015 | 2 |
| 2016 | 2 |
| 2017 | 3 |
| 2018 | 1 |
| 2019 | 6 |
| 2020 | 4 |
| 2021 | 15 |
| 2022 | 14 |
| 2023 | 7 |
| 2024 | 10 |
| 2025 | 8 |
| 2026 | 1 |

---

## 5. 建置／部署驗證

本 session **僅新增資料檔，不改前端**，故不執行 vite build。
僅以 `python3 -c "import json; d=json.load(open('data/supreme_court_judgments.json')); print(len(d))"` 確認 JSON 可解析。

---

## 6. 已知限制（誠實揭露）

1. **零新增「未涵蓋」案件**：原預期 B2（全文檢索）可補捉到案由非「營業秘密」但內文引用《營業秘密法》之最高法院判決；實測 B2（57 筆）完全是 B1（74 筆）之子集合。最高法院作為法律審，其案由（reason）幾乎都會延用第二審「侵害營業秘密」或「違反營業秘密法」之描述，因此「案由含營業秘密」已能涵蓋所有相關判決。
2. **35 筆裁定為本檔新增主體**：這些裁定在 `trade_secret_cases_master.json` 中本已存在（court=最高法院, docType=裁定），但被 `process_judgments.py` 第 22 行 `c.get('docType') == '判決'` 過濾掉而未進入 `data/judgments.json`。本檔將其補入。
3. **僅 metadata、無全文**：本檔不含 `fullText` 欄位，故：
   - 不能用於 `extract_damages.py` 抽取判准金額；
   - 不能用於 `FullTextSearch.jsx` 全文檢索；
   - 不會自動進入 `data/damages_analysis.json` 統計。
4. **excerpt 為司法院檢索結果列表頁面顯示之首段摘要**（約 100~200 字），非完整裁判書內容；YJ 引用前請以 jid 連回司法院原文核對。
5. **`adDate` 由 ROC 民國年換算**：rocDate「115/02/11」→ adDate「2026-02-11」（民國 + 1911）。若司法院 metadata 本身誤標 ROC 年，則 adDate 亦同步偏移。
6. **未驗證 JID 是否仍可在司法院系統取得**：JID 為司法院內部識別碼，理論上恆久，但偶有重新發佈（reformat.aspx 改 URL 結構）之風險。本 session 未實際 HTTP HEAD 驗證每一筆 JID 之 URL 200 狀態，建議下次下載全文時順便檢驗。
7. **本 session 未動 UI**：`data/supreme_court_judgments.json` 雖已產生，但 React 元件（`useData.js`、`Dashboard.jsx`、`CaseList.jsx`）尚未載入此檔；YJ 抽查時請走 raw JSON / 司法院連結。後續若需上 UI，建議另起 session 評估「合併入 `judgments.json`」vs「新增分頁」之取捨。

---

## 7. 檔案異動摘要

新增：
- `data/supreme_court_judgments.json` — 最高法院營業秘密相關判決 metadata，共 74 筆（39 判決 + 35 裁定，2009–2026）
- `SESSION_LOG_2026-05-17.md` — 本檔
- `outputs/existing_supreme_jids.json` — baseline 比對用，39 筆既有 SC 判決 JID

修改：
- 無（本 session 完全不動 React／既有 `data/judgments.json`／build config）

刪除：
- 無

---

## 8. 建議 YJ 本人抽查

1. 開 `data/supreme_court_judgments.json` 確認首筆（seq=74）為「最高法院 98 年度 台抗 字第 170 號民事裁定」（2009-03-19），末筆（seq=1）為「最高法院 114 年度 台上 字第 5831 號刑事判決」（2026-02-11）。
2. 任挑 5 筆 jid 串到司法院 URL：`https://judgment.judicial.gov.tw/FJUD/data.aspx?ty=JD&id=<jid>`，確認能讀到原判決。
3. 比對既有 `data/judgments.json` 中 court=最高法院的 39 筆 jid，確認全在本檔內（已在 §4 驗證，新檔 ⊇ 既有，新增 35 為裁定）。
4. 若 YJ 認為「最高法院裁定」對研究有價值（程序裁定／秘密保持命令／限制閱覽／聲請再審等），下一步可：
   - 跑 `python3 download_fulltext.py --all-docs --start <某 index>` 將裁定全文補入（既有腳本已支援 `--all-docs`，但 master JSON 需先合併 SC 裁定，建議另起 session 再決定）；或
   - 將本檔轉為「最高法院裁定一覽表」獨立檢索頁，UI 加掛 `/supreme` 分頁。
5. 是否將 35 筆 SC 裁定**併入** `data/judgments.json` ？要點：
   - **不建議直接併**：既有 492 筆刻意僅納「判決」，併入裁定會稀釋「判准金額」「定罪率」等 KPI 之語意（裁定多為程序事項，無實體判准）。
   - 建議走「另設分頁」或「在現有頁加 `docType` 過濾」之路徑。

---

## 9. 違反守則（若有）

- 暫無。

---

最後修訂：2026-05-17 — Claude (Opus 4.7) — 已完成（metadata-only；全文下載與 UI 整合待 YJ 決策）

---

## Session 18:45 — Phase A（全文下載）+ Phase B（新增分頁）

### 目標
- Phase A：產出 `data/supreme_court_judgments_fulltext.json`，含 74 筆 fullText + charCount。
- Phase B：在 React App 加 `/supreme` 分頁；獨立資料源；不影響既有 492 筆 KPI、損害賠償統計、定罪率等。

### 成功條件
1. `data/supreme_court_judgments_fulltext.json` 74 筆，每筆 charCount ≥ 500（短裁定如「核定律師酬金」可能僅 800-1500 字）。
2. 大立光相關（TPSV,104,台上,1589）字數 ≥ 5,000。
3. 既有 `data/judgments.json`、`data/judgments_fulltext.json` 不動（語意分離）。
4. `npx vite build` 成功，新分頁 `/supreme` 可載入並列出 74 筆。
5. 既有頁面（Dashboard、Cases、Analytics、Damages、FullTextSearch）KPI 數字不變。

### 計畫步驟
1. [x] 從 `data/judgments_fulltext.json` 抽出既有 39 筆 SC 判決的 fullText
2. [x] 用 Python script（`scripts/build_sc_fulltext.py`）下載 35 筆裁定 reformat.aspx
3. [x] 合併寫入 `data/supreme_court_judgments_fulltext.json` + `public/data/`
4. [x] 設計 `SupremeCourt.jsx`：列表 + 篩選（判決/裁定、案號搜尋、案由 keyword）+ 詳情面板
5. [x] 新增 React Route + Layout 導覽（含手機版選單）
6. [x] `npx vite build` 通過

### 執行紀錄

#### [18:55] 抽出既有 39 筆判決全文
- 法：以 title 為 key 從 `data/judgments_fulltext.json` 對照
- 結果：39/39 命中

#### [19:05] 下載 35 筆裁定全文（修正版）
- 第一版 Python 用 timeout=60，在第 4 筆 hung 住，被 bash sandbox 45 秒 timeout 中斷。
- 修正：timeout 改 12 秒、加入 resume 機制、每 5 筆 checkpoint 寫盤。
- 結果：35/35 OK；avg 1,807 chars/裁定；total 234,912 chars

#### [19:20] React 元件實作
- 新增 `src/pages/SupremeCourt.jsx`：左側列表（含日期、刑/民、判/裁 badge、案由摘要）、右側全文 panel、上方 4 KPI cards + filter bar（文書類型／案件類別／年度／全文搜尋）。
- 新增 `useSupremeCourt` hook 與 `getJudicialUrl(jid)` helper（hooks/useData.js）。
- 新增 `/supreme` route（App.jsx）+ 桌面與手機版導覽連結（Layout.jsx，使用 Landmark 圖示）。

#### [19:30] vite build 驗證
- 第一次 build：rollup 找不到 linux-arm64 binary（host 為 macOS）。`npm install @rollup/rollup-linux-arm64-gnu --no-save` 後解決。
- 第二次 build：EPERM unlink 舊 `dist/`（沙箱權限）。手動 `rm -rf dist` 後重 build。
- 結果：✓ 2321 modules transformed，0 errors，bundle 含「最高法院」與 `/supreme` 路由字串。
- vite preview 服務 dist/，3 個資源端點皆回 200：
  - `/` HTTP 200
  - `/data/supreme_court_judgments.json` HTTP 200, 44,783 bytes
  - `/data/supreme_court_judgments_fulltext.json` HTTP 200, 711,273 bytes

### 既有 KPI 不變動之確認
- 既有 `data/judgments.json`（492 筆）：未動。
- 既有 `data/damages_analysis.json`：未動。
- 既有 `data/cases.json`（52 筆）：未動。
- 既有 `useJudgments`／`useCases` hooks：未動。
- 新增的 `useSupremeCourt` 完全獨立的 cache 變數 `_supremeCache`，不污染 `_judgmentsCache`、`_analysisCache`、`_fulltextCache`。

### 抽樣驗證（全文層級）

| # | jid | 字數 | 關鍵字驗證 | 結果 |
|---|---|---:|---|---|
| 1 | TPSV,104,台上,1589,20150821,1（大立光相關） | 6,146 | 含「半導體」 | ✅ |
| 2 | TPSV,98,台抗,170,20090319（最古老） | 1,830 | 含「秘密保持命令」 | ✅ |
| 3 | TPSM,114,台上,5831,20260211,1（最新刑事） | 5,262 | 含「營業秘密法」 | ✅ |

charCount 分布：min=266, max=9,789, avg=3,174, total=234,912

### 檔案異動

新增：
- `data/supreme_court_judgments_fulltext.json`（711 KB，74 筆含 fullText）
- `public/data/supreme_court_judgments.json` + `public/data/supreme_court_judgments_fulltext.json`（給前端 fetch）
- `scripts/build_sc_fulltext.py`（merge + 下載腳本，支援 resume）
- `src/pages/SupremeCourt.jsx`（新分頁元件）

修改：
- `src/hooks/useData.js`：新增 `useSupremeCourt`、`getJudicialUrl`
- `src/App.jsx`：新增 `/supreme` route
- `src/components/Layout.jsx`：新增「最高法院」導覽（桌面 + 手機）

### 建議 YJ 抽查

1. 本機跑 `npm run dev`，導到 `http://localhost:5173/taiwan-trade-secret-dashboard/#/supreme`，確認頁面載入 74 筆。
2. 點上方「裁定」filter，應剩 35 筆；切回「判決」應剩 39 筆。
3. 點任一筆列表，右側顯示全文；點右上「司法院原文」應跳到 judgment.judicial.gov.tw 對應頁面。
4. 全文搜尋輸入「秘密保持命令」，應命中數筆（98 台抗 170、110 台抗 595、110 台抗 600、110 台抗 161、110 台抗 1939 等）。
5. 切回「總覽」、「案件列表」、「損害賠償分析」、「全文檢索」確認 KPI 數字不變（492 筆、定罪率 81%、判准總額 ~33 億 等）。

### 已知限制

1. 35 筆裁定為**新下載**，與既有 492 筆判決使用同一 reformat.aspx 端點抽取；正則去 HTML 標籤與既有 `download_fulltext.py` 一致，但裁定格式比判決短，少數短裁定（如核定律師酬金）可能僅 266~300 字。
2. 沙箱無法跑長時間 dev server，故視覺驗證留給 YJ 在本機完成（curl 已驗證 HTTP 200 + 正確 bytes）。
3. 本頁不參與既有 `extract_damages.py` 抽取流程；最高法院為法律審，幾乎無判准金額之認定。

---

## Session 19:55 — Phase C：全文檢索加多選法院 + SC 裁定併入語料庫

### YJ 需求
「以關鍵字查詢結果希望可以選法院，例如最高法院的見解」。
確認後 YJ 選擇：(1) 多選 chip filter，(2) 語料庫擴充為 527 筆（492 + 35 SC 裁定）。

### 目標
1. `/search` 全文檢索頁加上「法院」多選 chip filter。
2. 搜尋語料庫擴為 527 筆：既有 492 筆判決 + 新增 35 筆最高法院裁定。
3. UI 揭露搜尋範圍與資料異質性（裁定通常較短、無判准金額）。
4. **既有 492 筆 KPI 不動**：Dashboard、CaseList、DamagesAnalysis 之分母與分子維持原樣；裁定僅出現於 `/search` 與 `/supreme` 兩頁。

### 設計決策
- **不另設 hook**：在 `FullTextSearch.jsx` 內以 `useSupremeCourt()` + 合成 judgment-like records 的方式擴充本頁 search corpus。
- **合成 SC 裁定 record schema**：
  - `seq`: `sc_${jid}`（避免與既有 492 筆數字 seq 衝突）
  - `caseId`, `title`, `court`="最高法院", `caseType`(刑/民), `adYear`, `adDate`
  - `outcome`: 暫存 "—"（裁定多以主文「抗告駁回」「撤銷發回」表示，不適用判決 outcome 分類）
  - `reason`: 原 reason
  - `judgmentUrl`: `getJudicialUrl(jid)`
  - `docType`: '裁定'（新欄位，UI 用以加 badge 區分）
  - `damagesNum`: 0, `calcMethods`: []
- **法院多選**：以 chip group 呈現，預設全不選＝代表「全部」；勾選 ≥ 1 個後採 OR 邏輯。
- **URL sync**：以 `?courts=最高法院,智慧財產法院` 逗號分隔保留可分享性。

### 計畫步驟
1. [x] 設計 SC 裁定 → judgment-like 合成 schema
2. [x] 在 FullTextSearch.jsx 引入 `useSupremeCourt()` 並 useMemo 合成
3. [x] 新增法院 chip 多選 UI + state + URL sync
4. [x] 在 header 揭露「527 筆（492 判決 + 35 最高法院裁定）」
5. [x] 對裁定結果加「裁定」badge 並小註該筆無判准金額
6. [x] `npx vite build` 通過
7. [x] 抽樣驗證

### 抽樣驗證（搜尋層級）

| 關鍵字 | 全範圍命中 | 限「最高法院」命中 | 備註 |
|---|---:|---:|---|
| 秘密保持命令 | **31**（17 判決 + 14 裁定） | **14**（全為裁定） | ✅ 14 筆 SC 裁定全為 程序裁定 |
| 合理權利金 | 0 | 0 | 此關鍵字在語料庫中本就不存在（多寫作「權利金」），與本次擴充無關 |

法院 chip 顯示驗證：

| 法院 | 語料庫筆數 | chip 顯示 |
|---|---:|---|
| 智慧財產及商業法院 | 134 | ✅ |
| 智慧財產法院 | 109 | ✅ |
| 最高法院 | **74**（39 判決 + 35 裁定） | ✅ 帶 ⚖️ Gavel icon，預設亮色 |
| 臺灣新竹地院 | 39 | ✅ |
| ...（其餘 15 個） | | ✅ |

### 既有 KPI 不變動之確認

- `useJudgments()` cache `_judgmentsCache` 仍只含 492 筆 → Dashboard、CaseList、DamagesAnalysis 之分母不變。
- `useSupremeCourt()` 與既有 hook **並列**，使用獨立 cache `_supremeCache`；FullTextSearch 內部 `useMemo` 合成 `allJudgments`，不寫回 underlying state。
- 唯一變動範圍：`/search` 頁之 results 集合與 chip filter。
- `/supreme` 分頁不變（已於 Phase B 確認）。

### 檔案異動（本 Session）

修改：
- `src/pages/FullTextSearch.jsx`：
  - 引入 `useSupremeCourt`、`getJudicialUrl`、`Scale`、`Gavel` 圖示
  - 新增 `scRulings`、`allJudgments`、`courtList`、`selectedCourts` state 與 `toggleCourt`/`clearCourts`
  - search pipeline 改吃 `allJudgments` 並加入 `selectedCourts` filter
  - header 改為「527 筆（492 判決 + 35 最高法院裁定）」
  - 法院 chip group（複選；URL 同步 `?courts=`）
  - 結果摘要分判決／裁定計數
  - 結果卡片加「裁定」badge
  - CSV 多一欄「文書類型」

未動：
- `src/hooks/useData.js`（直接重用既有 `useSupremeCourt` hook）
- `src/App.jsx`／`Layout.jsx`（不需新路由）
- 所有資料檔（不動 JSON）

### 建議 YJ 抽查

1. `npm run dev` → 開 `/search`。Header 應顯示「527 筆（492 判決 + 35 最高法院裁定）」。
2. 下方應有「法院」chip group，最高法院 chip 帶 ⚖️ icon、且預設用金色邊框醒目。
3. 搜尋「秘密保持命令」→ 命中 31 筆；摘要顯示「17 判決 + 14 裁定」。
4. 勾選「最高法院」chip → 縮為 14 筆，每筆都帶綠色「裁定」badge；URL 應變為 `?q=秘密保持命令&courts=最高法院`。
5. 再勾選「智慧財產及商業法院」→ 結果增加，但不會包含其他地院。
6. 點「清除」鈕 → URL `courts` 參數消失，回到 31 筆。
7. 切回 `/`、`/cases`、`/damages` 三頁，確認 492 筆 KPI、定罪率 81%、判准總額 ~33 億皆未變。

### 已知限制

1. SC 裁定無判准金額：結果卡片 footer 之「判准金額」欄不會出現於 docType=裁定 之筆數（資料層 damagesNum=0）。
2. SC 裁定 `outcome` 欄填「—」：因裁定主文格式為「抗告駁回」「原裁定撤銷」等，與既有判決 outcome 分類（有罪／原告勝訴／撤銷發回 等）語意不一致，本次先不做 mapping；YJ 可從案號 + 案由 + snippet 直接判讀。
3. `useSupremeCourt` 在進入 `/search` 時會額外載入 711KB（裁定全文）；首次載入時間延長約 5-10%（已快取）。
4. 法院命名差異未做正規化：例如「智慧財產法院」（舊名）與「智慧財產及商業法院」（2021/7/1 改制後）為兩個 chip。YJ 若想看「智財類」全部見解需勾選兩者。


