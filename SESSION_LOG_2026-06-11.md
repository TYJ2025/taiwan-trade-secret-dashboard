# Session Log — 擴充最高法院見解索引：新增「損害賠償」「共犯」議題
Date: 2026-06-11 (星期四)
Operator: Claude (Cowork)
User: YJ

---

## Session（架構檢視後之改善第 1 項）

## 0. 本 session 目標（動手前填）

- 主要目標：`build_holdings_index.py` 之 TOPICS 由 §2 三要件擴充為五議題（＋損害賠償、＋共犯），重建 `data/supreme_court_holdings_index.json`，並同步更新前端 `/holdings` 頁。
- 成功條件（可驗證）：
  1. 重跑腳本後，索引含 5 個 topics；既有三要件之 topicCaseCounts 與前版完全一致（不受新增議題影響）。
  2. 「損害賠償」「共犯」各命中 ≥ 1 筆，且抽樣 3 筆 snippet 肉眼確認與議題相關。
  3. `src/pages/SupremeCourtHoldings.jsx` 顯示 5 個議題 chip，「三要件」字樣更新為涵蓋五議題之描述，限制揭露段同步更新。
- 不做事項（避免失焦）：不動 492 筆判決資料、不動 `data/cases.json`／`stats.json`、不改 DamagesAnalysis、不碰 workflows、不執行 git push。

---

## 1. 環境與資料前置盤點

| 檢查項 | 指令 / 方法 | 結果 |
|---|---|---|
| 專案路徑 | 已連結資料夾 | Taiwan Trade Secrets Case Tracker |
| 關鍵資料檔 | data/supreme_court_judgments_fulltext.json | 存在（74 筆，待指令確認） |
| 既有索引 | data/supreme_court_holdings_index.json | 存在（3 topics，待記錄前版 counts） |
| python | python3 -V | 待確認 |

---

## 2. 計畫步驟（動手前填）

1. [ ] 記錄前版索引之 stats（topicCaseCounts／casesWithAnyHit）— 預期輸出：3 個 topic 之基準數字
2. [ ] 修改 `scripts/build_holdings_index.py`：TOPICS 新增 damages、accomplice 兩議題（patterns 附法條 inline comment）— 預期輸出：diff 僅及 TOPICS 與 docstring
3. [ ] 重跑 `python3 scripts/build_holdings_index.py` — 預期輸出：5 topics；既有三要件 counts 不變；data/ 與 public/data/ 兩份同步產出
4. [ ] 抽樣驗證 ≥ 3 筆（含損害賠償、共犯各至少 1 筆）snippet 與議題相關性 — 預期輸出：§4 表格
5. [ ] 更新 `src/pages/SupremeCourtHoldings.jsx`：ICON_MAP、頁首文案、限制揭露段 — 預期輸出：5 chips 正常渲染所需之程式碼
6. [ ] 補記實際結果與已知限制

---

## 3. 執行紀錄（逐步）

> 時間為 sandbox 時鐘（UTC），台灣時間 +8。

### [01:01] 記錄前版索引基準
- 意圖：擴充議題前先固定基準，確保既有三要件 counts 不被影響。
- 指令：python3 讀取 data/supreme_court_holdings_index.json 之 stats
- 預期結果：3 topics 之 counts
- 實際結果：generatedAt 2026-05-17；totalSC=74；casesWithAnyHit=37；topicCaseCounts：secrecy 31／reasonable_measures 30／economic_value 32；topicHitCounts：159／164／141
- 異常／差異：無
- 後續行動：以此為 after 比對基準

### [01:03] 修改 build_holdings_index.py TOPICS
- 意圖：新增 damages（營業秘密法§13；民§216；民訴§222 II）與 accomplice（刑§28-31；民§185）兩議題，每個 pattern 附法條 inline comment（守則§5）。
- 指令：Edit scripts/build_holdings_index.py（docstring、TOPICS 區塊）
- 預期結果：diff 僅及 docstring 與 TOPICS；既有三要件 patterns 未動
- 實際結果：完成；damages 12 patterns、accomplice 9 patterns，各以寬鬆變體（「損害賠償」「共犯」）置末
- 異常／差異：無
- 後續行動：重跑索引

### [01:04] 重跑 build_holdings_index.py
- 意圖：產出 5 議題索引，data/ 與 public/data/ 同步。
- 指令：
  ```bash
  python3 scripts/build_holdings_index.py
  ```
- 預期結果：5 topics；secrecy=31、reasonable_measures=30、economic_value=32 與前版一致；damages／accomplice 各 ≥1 案
- 實際結果：5 topics 產出；三要件 counts（31/30/32 案、159/164/141 hits）與前版完全一致；damages 33 案 79 hits、accomplice 14 案 35 hits；casesWithAnyHit 37→58；索引檔 480,105 bytes；md5 確認 data/ 與 public/data/ 一致
- 異常／差異：無
- 後續行動：抽樣驗證

### [01:08] 抽樣驗證（見 §4）
- 意圖：守則§2 — 資料變更須抽樣 ≥3 筆。
- 指令：python3 列印 damages／accomplice 命中數最高各 2 筆之 snippet ＋ 既有議題回歸樣本
- 預期結果：snippet 與議題相關；既有議題 per-case hitCount 無異常
- 實際結果：見 §4 表；accomplice 精準（命中「共同正犯／犯意聯絡／行為分擔」實體論述）；damages 寬鬆 pattern 在程序裁定（114台抗459 限制閱覽）屬 false positive，已列入限制揭露
- 異常／差異：damages 之 79 hits 偏低係因 74 筆中多為刑事／程序案件，合理
- 後續行動：更新前端

### [01:10] 更新 SupremeCourtHoldings.jsx
- 意圖：5 議題 chip 渲染（ICON_MAP 加 calculator/users）、頁首與限制揭露文案同步（守則§3）。
- 指令：Edit src/pages/SupremeCourtHoldings.jsx（5 處）
- 預期結果：import 新 icon、ICON_MAP 5 鍵、文案無「僅三要件」誤導
- 實際結果：完成；匯出資料包之「已知限制」亦同步加 2 行
- 異常／差異：無
- 後續行動：build 驗證

### [01:12] Vite build 驗證
- 意圖：確認 JSX 與資料變更可正常建置。
- 指令：
  ```bash
  npx vite build --outDir /tmp/dist_verify --emptyOutDir
  ```
- 預期結果：build 成功，產物含 5-topic 索引
- 實際結果：✓ 2322 modules transformed, built in 2.48s；產物索引 topics = 5
- 異常／差異：直接 build 至 repo 內 dist/ 時 emptyOutDir 因 sandbox 掛載權限 EPERM 失敗（無法 unlink 既有 dist 檔案），故改輸出 /tmp 驗證；**repo 之 dist/ 未更新**，正式部署仍需 YJ 在本機跑 rebuild_and_push.command
- 後續行動：無（session 完成）

---

## 4. 資料抽樣驗證

> 本次變更檔：data/supreme_court_holdings_index.json（不涉 492 筆判決資料，大立光基準不適用；改以議題相關性抽樣）

| # | 案號 | 議題 | Before | After | 驗證結果 |
|---|---|---|---|---|---|
| 1 | 109 台上 180（刑事判決） | accomplice | （議題不存在） | hits=7，命中「共同正犯／犯意聯絡／行為分擔」，為發回更審之實體論述 | ✅ 相關 |
| 2 | 108 台上 2125（民事判決） | damages | （議題不存在） | hits=9，營業秘密損害賠償事件本案 | ✅ 相關 |
| 3 | 114 台抗 459（民事裁定） | damages | （議題不存在） | hits=8，限制閱覽程序裁定，僅案件名稱提及損害賠償 | ⚠️ false positive，已揭露 |
| 4 | 112 台上 13（刑事判決） | accomplice | （議題不存在） | hits=4，命中「共犯」論述 | ✅ 相關 |
| 5 | 104 台上 1589（民事判決，回歸樣本） | 三要件 | secrecy/measures/value 各有命中 | hitCount 3/3/5，aggregate counts 與前版一致 | ✅ 未受影響 |

總量 sanity-check：

- 三要件 topicCaseCounts／topicHitCounts 與前版（2026-05-17 產）逐項一致 → 既有資料零變動 ✅
- damages 33 案／accomplice 14 案，皆 < totalSC 74，數量級合理（74 筆中多為刑事與程序案件）

---

## 6. 已知限制（誠實揭露）

1. 「損害賠償」「共犯」寬鬆 pattern 會命中案由、判決首部與程序性段落；僅命中寬鬆詞且次數低（1-2）者多屬 false positive。估計 damages 33 案中約 1/4 為程序裁定脈絡（已在頁面與匯出包揭露，可用文書類型 filter 過濾）。
2. 最高法院為法律審，damages 議題之 snippet 價值在計算方法論（民§216、民訴§222 II、合理權利金、懲罰性賠償）之見解，非金額酌定本身。
3. 共犯議題 patterns 未涵蓋「間接正犯」「相續共同正犯」等較罕見態樣；如有需求再擴充。
4. repo 內 dist/ 因 sandbox 權限未重建；GitHub Pages 部署需 YJ 本機執行 rebuild_and_push.command。

---

## 7. 檔案異動摘要

新增：
- `SESSION_LOG_2026-06-11.md`

修改：
- `scripts/build_holdings_index.py` — TOPICS 新增 damages（12 patterns）、accomplice（9 patterns），docstring 同步
- `data/supreme_court_holdings_index.json`、`public/data/supreme_court_holdings_index.json` — 重建為 5 議題（既有三要件內容不變）
- `src/pages/SupremeCourtHoldings.jsx` — ICON_MAP 加 calculator/users、頁首文案改五大爭點、限制揭露（頁面＋匯出包）各加 2 點

刪除：無

---

## 8. 建議 YJ 本人抽查

1. 開 /holdings 頁應見 5 個議題 chip；「損害賠償」33 件、「共犯」14 件。
2. 切到「共犯」、文書類型「判決」，點開 109 台上 180，snippet 應為共同正犯犯意聯絡之實體論述。
3. 切到「損害賠償」，確認 114 台抗 459（限制閱覽裁定）這類程序案件的 snippet 確屬 false positive，評估是否接受目前的揭露方式、或要求加「排除僅命中寬鬆詞」之 filter。
4. 勾選數筆後下載 .md 比對資料包，確認「已知限制」新增 2 行存在。

---

---

## Session 2（01:20 UTC）— 見解索引改為可擴充式（config-driven）

### 0. 目標（動手前填）

- 主要目標：議題定義自 `build_holdings_index.py` 抽離至 `config/holdings_topics.json`；腳本改為載入＋驗證 config；前端去除 hardcode（icon fallback、預設議題改取第一個）。日後新增議題＝編輯 JSON ＋重跑腳本，零程式碼改動。
- 成功條件（可驗證）：
  1. 以 config 重跑後，索引內容與 Session 1 產出**逐項一致**（除 generatedAt／新增之 metadata 欄位外）——5 議題 counts 不變。
  2. 腳本對 config 做驗證：id 唯一、term 唯一、必填欄位齊全，違反即報錯退出。
  3. 前端在議題增減時無需改碼即可渲染（icon 未知時 fallback FileText；預設議題不再寫死）。
  4. README 增「如何新增議題」說明。
- 不做事項：不改其他資料集、不改匯出包格式、不 push。

### 計畫步驟

1. [ ] 建 `config/holdings_topics.json`（5 議題，pattern 改 {term, ref} 結構，ref 標法條依據以替代 inline comment，符合守則§5 精神）
2. [ ] 重構 `build_holdings_index.py`：載入 config、驗證、輸出格式維持不變（patterns 仍為字串陣列，向下相容前端）
3. [ ] 前端：ICON_MAP 擴充常用 icon ＋ 預設議題改 data-driven
4. [ ] 重跑索引，與 Session 1 產出做逐項 diff（counts 必須一致）
5. [ ] vite build 驗證、README 補說明

### 執行紀錄

#### [01:22] 建 config/holdings_topics.json
- 意圖：議題定義（5 議題、52 patterns）抽離至 config；pattern 改 {term, ref} 結構，ref 標法條依據（取代 Python inline comment，守則§5）。
- 預期結果：JSON 含 _howToExtend 使用說明 + 5 topics
- 實際結果：完成
- 異常／差異：無

#### [01:25] 重構 build_holdings_index.py
- 意圖：TOPICS literal（104 行）改為 load_topics()：載入 config、驗證（id 唯一／term 唯一／必填齊全／icon 白名單警告）、輸出加 configVersion 與 patternRefs，version 1.0→1.1。
- 實際結果：完成；輸出之 topics[].patterns 維持字串陣列，向下相容
- 異常／差異：無

#### [01:28] 前端 SupremeCourtHoldings.jsx 去 hardcode
- 意圖：(a) ICON_MAP 擴充至 9 個（scale/key/gavel/file），未知值 fallback FileText；(b) 預設議題改 data-driven（偏好 reasonable_measures，不存在則取第一個）；(c) 頁首文案改由 topics 資料渲染，議題增減不需改字。
- 實際結果：完成
- 異常／差異：無

#### [01:30] 回歸驗證
- 意圖：config-driven 重跑之索引內容必須與 Session 1 產出實質一致。
- 指令：cp 前版至 /tmp → 重跑 → python 逐項比對 cases/stats/topics
- 預期結果：完全一致
- 實際結果：**第一次比對失敗**——查明原因為 matchedTerms 以 list(set()) 產生、跨 run 順序隨機（PYTHONHASHSEED），非內容差異；normalize 排序後 cases/stats/topics 逐項一致。已順手修正腳本改 sorted()，此後重跑產出 deterministic。5 議題 counts：31/30/32/33/14 案，與 Session 1 一致 ✅
- 異常／差異：發現既有腳本之 set 順序不確定性（pre-existing），已修正
- 後續行動：防呆測試

#### [01:32] config 防呆測試＋同步＋build
- 意圖：驗證壞 config 會被攔截。
- 實際結果：注入重複 topic id 之 config → AssertionError「topic id 重複：secrecy」✅；data/ 與 public/data/ md5 一致 ✅；vite build ✓ 2322 modules ✅
- 異常／差異：無

#### [01:34] README 補「如何新增議題」
- 實際結果：完成（4 步驟，含守則§2 抽樣與 SESSION_LOG 要求）

### 檔案異動摘要（Session 2）

新增：
- `config/holdings_topics.json` — 議題定義（5 議題、52 patterns，各附法條 ref）

修改：
- `scripts/build_holdings_index.py` — TOPICS 改 config 載入＋驗證；matchedTerms 改 sorted()（deterministic）；輸出 version 1.1
- `data/supreme_court_holdings_index.json`、`public/data/supreme_court_holdings_index.json` — 重建（內容與 Session 1 實質一致，新增 configVersion／patternRefs 欄位）
- `src/pages/SupremeCourtHoldings.jsx` — ICON_MAP 擴充＋fallback、預設議題與頁首文案 data-driven
- `README.md` — 增「如何新增議題」一節

### 已知限制（Session 2）

1. 議題「新增」零改碼；若新議題需要新 icon 圖示，仍須在 ICON_MAP 加一行（未加亦可用，fallback 為 FileText）。
2. config 驗證不含「patterns 嚴格→寬鬆排序」之自動檢查（語意性規則，無法機械驗證），靠 _howToExtend 說明＋人工抽樣把關。
3. repo 內 dist/ 仍因 sandbox 權限未重建，部署需 YJ 本機執行 rebuild_and_push.command。

### 建議 YJ 本人抽查（Session 2）

1. 開 config/holdings_topics.json，確認 _howToExtend 規則描述符合你的維護習慣。
2. /holdings 頁外觀與行為應與 Session 1 後完全相同（5 chips、counts 31/30/32/33/14）。
3. 試新增一個測試議題（如「還原工程」）跑一次流程，確認零改碼成立後再刪除。

---

## Session 3（01:45 UTC）— 清理過時 .command 部署腳本

### 0. 目標（動手前填）

- 主要目標：兩個過時腳本（指向舊路徑 /Users/jesuisjane/Documents/Claude/Projects/...、且為舊版單檔儀表板流程）**均改寫**（YJ 於 01:47 指示「改寫」，不刪除）：
  1. `rebuild_and_push.command` → 本機 vite build 驗證 → commit → push（實際部署由 .github/workflows/deploy.yml 自動執行）
  2. `push_to_github.command` → 輕量版：僅 status 預覽 → commit → push（不 build；日常資料/文件異動用）
- 成功條件：新腳本路徑正確、不含寫死 commit message、push 前須使用者確認、bash -n 語法檢查通過、可執行權限。
- 不做事項：不動 copy_data.command／cleanup_nested_dirs.command／remove_temp_from_history.command（另案評估）；不動 workflows。

### 執行紀錄

#### [01:48] 改寫 rebuild_and_push.command
- 意圖：修正 REPO_DIR 至現行路徑（ClaudeProjects）；流程改為「異動預覽 → 本機 vite build 驗證 → 自填 commit message → 確認後 push」；移除過時的 fetch_news/build_dashboard 步驟與寫死 commit 訊息；標明正式部署由 deploy.yml 自動執行。
- 實際結果：完成；bash -n 通過；chmod +x 完成
- 異常／差異：無

#### [01:50] 改寫 push_to_github.command
- 意圖：由「首次 import」腳本改為輕量日常版（不 build；status 預覽 → commit → push），移除有風險之 `-X ours` merge 與寫死 initial commit 訊息；若偵測 src/ 異動會提示改用 rebuild 版。保留 temp/ 誤 track 保險與 >95MB 檔案檢查。
- 實際結果：完成；bash -n 通過；chmod +x 完成
- 異常／差異：盤點時發現另有 `rebuild_dashboard.command`（未在本次範圍），路徑可能同樣過時，待 YJ 指示

### 檔案異動摘要（Session 3）

修改：
- `rebuild_and_push.command` — 改寫（本機 build 驗證 + commit + push）
- `push_to_github.command` — 改寫（輕量 commit + push）

### 建議 YJ 本人抽查（Session 3）

1. 雙擊 `push_to_github.command`，確認異動預覽正確後，以它完成本次五大爭點＋config 化之 push（src/ 有異動會提示改用 rebuild 版——本次建議用 `rebuild_and_push.command`）。
2. 確認 push 後 Actions「Deploy to GitHub Pages」綠燈、/holdings 頁出現 5 個議題。
3. 裁示 `rebuild_dashboard.command`、`copy_data.command`、`cleanup_nested_dirs.command`、`remove_temp_from_history.command` 是否一併清理。

---

## Session 4（02:00 UTC）— 見解價值標記＋統計 bug 修正＋漏案揭露

### 0. 目標（動手前填）

- 主要目標（架構檢視清單第 2、9、5 項）：
  1. **見解價值標記**：config 增 proceduralMarkers（上訴不合法等形式駁回用語），索引對每案標 proceduralHits；前端 /holdings 加「排除疑似程序駁回」filter＋案件列 badge。
  2. **useAnalytics 勝訴統計 bug**：一部勝訴／部分有罪目前被計入敗訴；先盤點 result 實際值域再修。
  3. **漏案揭露**：/supreme 頁資料說明補充檢索式已知漏案類型（刑§317-318 妨害工商秘密、國安法§8 核心關鍵技術等）。
- 成功條件：
  1. 重跑索引後五議題 counts 不變（標記為新增欄位，不影響命中）；抽樣 ≥3 筆驗證標記正確性（程序駁回裁判被標、實體判決不被標）。
  2. useAnalytics 修正後，「部分」類結果計入勝訴方並於 log 記 before/after 件數。
  3. vite build 通過。
- 不做事項：不動歷審串連／裁定資料集／canonical registry（大型項目另案）；不改 492 筆資料。

### 執行紀錄

#### [02:02] Marker 設計試驗（重要發現）
- 意圖：先在 74 筆全文上試跑候選 marker，再定案。
- 實際結果：初版含「違背法律上之程式」「不合法律上之程式」時命中 31/74，**但實體判決（112台上13、112台上229）被誤標**——刑事判決開頭例稿引用刑訴§395 標準時必出現該語。改用 8 個結論性語句（「上訴自非合法」「其上訴為不合法」「未合法表明上訴理由」等）後命中 17/74（判決 5、裁定 12），誤標消除。
- 異常／差異：無（試驗即為了發現此問題）
- 後續行動：marker 定案寫入 config，並於 config _proceduralMarkersNote 記錄此設計理由

#### [02:05] config＋腳本＋重跑
- 意圖：proceduralMarkers 進 config（可擴充、每個附 ref）；腳本對每案輸出 proceduralHits（sorted、中性標記）；stats 加 proceduralCaseCount；version 1.1→1.2。
- 實際結果：重跑後**五議題 counts 與 topicHits 逐案零變動**（回歸 assert 通過）；58 筆索引案件中 11 筆含程序駁回語句（9 裁定＋2 判決）；public/ md5 同步一致
- 異常／差異：無

#### [02:08] 抽樣驗證（標記正確性）
| # | 案號 | 類型 | proceduralHits | 驗證 |
|---|---|---|---|---|
| 1 | 110 台上 13（民事裁定） | 形式駁回裁定 | 上訴自非合法／其上訴為不合法 | ✅ 應標而標 |
| 2 | 108 台上 2125（民事判決） | 實體損害賠償判決 | （空） | ✅ 不應標而未標 |
| 3 | 112 台上 13（刑事判決） | 實體判決（共犯論述） | （空） | ✅ 初版誤標、收斂後正確 |
| 4 | 109 台抗 483（民事裁定） | 抗告形式駁回 | 抗告自非合法 | ✅ 應標而標 |

#### [02:10] 前端 /holdings：filter＋badge＋揭露
- 意圖：「排除含程序駁回語句」checkbox、案件列金色 badge（hover 顯示命中語句）、頁尾與匯出包揭露各加 1 段（強調非案件定性）。
- 實際結果：完成
- 異常／差異：無

#### [02:12] useAnalytics 一部勝訴 bug 修正
- 意圖：convictionByIndustry 原僅認「有罪」「原告勝訴」，致「部分勝訴」計入敗訴。
- Before/after（52 筆 cases.json 值域：有罪 26、原告勝訴 8、無罪 6、部分勝訴 4、審理中 3、駁回 3、調解中 1、偵查中 1）：勝訴方計數 34 → 38（+4 筆部分勝訴）。「部分有罪」現值域無、為防禦性納入。
- 實際結果：完成（附 inline comment 記錄修正緣由）
- 異常／差異：無

#### [02:14] /supreme 漏案揭露＋build
- 意圖：資料說明補「檢索式已知漏案類型」（刑§317-318、競業禁止／不正競爭包裝、國安法§8）。
- 實際結果：完成；vite build ✓ 2322 modules
- 異常／差異：無

### 檔案異動摘要（Session 4）

修改：
- `config/holdings_topics.json` — 增 proceduralMarkers（8 個結論性語句）＋設計理由註記
- `scripts/build_holdings_index.py` — 載入／驗證 markers、每案輸出 proceduralHits、stats.proceduralCaseCount、version 1.2
- `data/`＋`public/data/supreme_court_holdings_index.json` — 重建（議題命中零變動，新增標記欄位）
- `src/pages/SupremeCourtHoldings.jsx` — 排除 filter、badge、揭露（頁面＋匯出包）
- `src/hooks/useData.js` — useAnalytics 一部勝訴修正
- `src/pages/SupremeCourt.jsx` — 檢索式漏案揭露

### 已知限制（Session 4）

1. 程序駁回標記為「含語句」之中性標記，無法區分「全案形式駁回」與「一部不合法一部實體」；已在 UI 與匯出包明示，引註前仍須律師複核。
2. 結論性語句清單僅 8 個，可能漏標用語特殊之形式駁回（false negative）；config 可隨時擴充。
3. useAnalytics 母體仍為 52 筆審理中資料集（檢視清單第 8 項「統計母體改 492 筆」屬大型重構，未在本 session 處理）。

### 建議 YJ 本人抽查（Session 4）

1. /holdings 勾「排除含程序駁回語句」後，「共犯」議題應看不到 110 台上 13 等形式駁回裁定。
2. 點開任一帶金色「程序駁回語句」badge 之案件，hover badge 應顯示命中語句。
3. /supreme 頁尾應有「檢索式已知漏案類型」段落。

---

## Session 5（02:40 UTC）— push 失敗排查＋腳本補 pull --rebase

### 執行紀錄

#### [02:38] 排查 YJ push 失敗
- 意圖：YJ 執行 rebuild_and_push.command 後回報完成，但需驗證遠端。
- 指令：git ls-remote ＋ 唯讀 fetch ＋ merge-base --is-ancestor
- 實際結果：遠端 main＝73be634（今日機器人 news commit），**本機兩個 commit（eac9cba、70fe37c）不在遠端**——本機自 5/17 未同步，遠端已累積每日機器人 commit，push 遭 non-fast-forward 拒絕。已指示 YJ 執行 `git pull --rebase && git push`。
- 異常／差異：rebuild_and_push.command 改寫時未預見機器人 commit 造成的常態性落後，係設計疏漏，本 session 修正
- 後續行動：兩支 .command push 前加 `git pull --rebase origin main`

#### [02:42] 兩支 .command 補自動同步
- 意圖：push 前先 rebase 遠端機器人 commit，失敗（衝突）時給出明確指示後中止。
- 預期結果：bash -n 通過
- 實際結果：兩支均完成，bash -n 通過。注意：本次腳本修改尚未 commit，會隨 YJ 下次 push 一併上去
- 異常／差異：無

---

最後修訂：2026-06-11 — Claude (Cowork)
