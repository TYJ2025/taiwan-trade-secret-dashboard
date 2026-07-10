# Session Log — 智財法院見解摘要續產批次（排程）
Date: 2026-07-10 (星期五)
Operator: Claude (Cowork，排程任務 factcourt-holdings-batch)
User: YJ（排程執行，YJ 不在場）

---

## Session 09:07 — 智財法院見解摘要續產批次（排程）

### 0. 本 session 目標（動手前填）

- 主要目標：續產智財法院 4 議題（reasonable_measures、secrecy、economic_value、accomplice）逐案 AI 認定摘要，本批每議題至多 20 筆（合計約 80 筆），merge 進 data/factcourt_holdings_curated.json 並同步 public/data。
- 成功條件（可驗證）：
  1. 大立光條目（jid IPCV,102,民營訴,6,20171206,7）holding 仍含 1,522,470,639 且 quotable 非空。
  2. damages 議題維持 157 筆，不增不減。
  3. 4 議題既有筆數只增不減；新增條目 quotable 全空、reviewed 全 false。
  4. data/ 與 public/data/ 之 factcourt_holdings_curated.json 內容一致。
  5. version 小數位遞增、generatedAt 更新。
- 不做事項：不動 damages 議題、不改任何議題 comparison、不做 git 操作、不改前端程式。

### 1. 執行紀錄（逐步）

### [09:07] 前置盤點（遲報條目）
- 意圖：確認當日 log 是否存在、data 目錄結構與現在時刻。
- 指令：`ls` 專案根目錄與 data/、`date`（唯讀）。
- 實際結果：無當日 log（本檔為新建）；data/factcourt_holdings_index.json 與 curated.json 均存在；時刻 09:07。
- 異常／差異：依 CLAUDE.md §1 應先寫 log 再執行 bash；本條為遲報，僅涉唯讀盤點，無資料異動，無需 rollback。
- 後續行動：計算各議題剩餘案件數。

### [09:08] 計算剩餘案件
- 意圖：讀 index 之 topicHits 與 curated 之 topics[t].cases，算出 4 議題剩餘 jid 數，決定本批選案。
- 指令：python3 讀兩檔比對 jid 集合（唯讀）。
- 預期結果：得各議題剩餘數；若總數為 0 則停用排程任務並結束。
- 實際結果：curated 現況（version 2.0，generatedAt 2026-07-10T00:34:45）：damages 157、reasonable_measures 20、secrecy 20、economic_value 20、accomplice 15。剩餘：reasonable_measures 165／185、secrecy 158／178、economic_value 161／181、accomplice 94／109，合計剩餘 578。
- 異常／差異：無。curated 各議題已有 jid 均在 index 命中集合內。
- 後續行動：每議題依 hitCount 由高至低取前 20 筆剩餘案件，匯出段落工作檔。

### [09:12] 選批並匯出段落工作檔
- 意圖：對 4 議題各選 20 筆剩餘案件（依該議題 hitCount 降冪），每案自 snippets 優先挑含法院論述標記（本院、得心證、經查、足認、堪認、準此、審酌、綜上）之段落 3 段、每段自標記前 60 字起截 320 字，連同 caseNo（由 data/judgments.json 之 rocYear、caseWord、caseNum 組成；智慧財產及商業法院＝智商法院、智慧財產法院＝智財法院）、adDate、caseType、reason 輸出至 outputs/factcourt_batch_2026-07-10/ 下 4 個議題工作檔，供 Claude 通讀產製 holding。
- 指令：python3 匯出腳本（唯讀來源，僅寫工作檔）。
- 預期結果：4 個 md 工作檔，各 20 案；每案含 caseNo 與至多 3 段擷取文字。
- 實際結果：4 檔各 20 案產出（reasonable_measures 52KB、secrecy 56KB、economic_value 53KB、accomplice 51KB）；80 個 jid 全數可在 judgments.json 對應到 caseNo。
- 異常／差異：無。
- 後續行動：Claude 逐案通讀撰寫 holding，再 merge 寫入 curated。

### [09:35] 通讀產製 holdings 並合併寫入 curated
- 意圖：Claude 已通讀 4 檔共 80 案之命中段落，逐案撰寫 holding（存於 outputs/factcourt_batch_2026-07-10/holdings_*.json），現將其 merge 進 data/factcourt_holdings_curated.json 之 topics[t].cases，重算各議題 natureStats，version 2.0 → 2.1，更新 generatedAt，並同步 public/data/。
- 指令：python3 merge 腳本；不覆寫既有條目、不動 damages 與任何 comparison。
- 預期結果：各議題筆數 20→40、20→40、20→40、15→35；damages 維持 157；大立光條目不變；新增條目 quotable 全空、reviewed 全 false、contextNote 固定語；data 與 public/data 一致。
- 實際結果：新增 80 筆（4 議題各 20）；筆數 reasonable_measures 40、secrecy 40、economic_value 40、accomplice 35；damages 維持 157；version 2.1，generatedAt 2026-07-10T09:20:20；natureStats 重算完成（新增 80 筆中實體認定 66、程序脈絡 3、未實質論述 11）。
- 異常／差異：無。merge 前以 assert 確認大立光 damages 條目位元組級不變。
- 後續行動：CLAUDE.md §2 驗證（見下）。

### [09:40] 驗證（CLAUDE.md §2）
- 意圖：確認資料寫入未破壞既有內容。
- 指令：python3 驗證腳本（唯讀）。
- 預期結果：五項檢核全過。
- 實際結果：
  - (a) 大立光條目 holding 仍含 1,522,470,639，quotable 非空 ✅
  - (b) damages 仍 157 筆 ✅
  - (c) 各議題筆數只增不減（157/40/40/40/35）✅
  - (d) 新增 80 筆 quotable 全空、reviewed 全 false、docType 均為判決 ✅
  - (e) data 與 public/data md5 一致 ✅；各議題 comparison 均未變動 ✅
- 抽樣 3 筆新增條目（caseNo｜holding 前 60 字）：
  1. [economic_value] 智財法院 104 民營訴 3｜法院認系爭產品已於市場公開銷售流通，可經還原工程解析出電路圖、BOM清單等資訊而不具秘密性…
  2. [accomplice] 智財法院 105 民營上更(一) 1｜命中段落多為被上訴人抗辯（縱有侵害亦屬個人行為…上訴人無法舉證…共同侵權事實）…（依品質紅線標「未實質論述」）
  3. [economic_value] 智商法院 112 民營上 1｜法院認系爭客戶名單載有客戶採購人員聯絡資料、信用等級分類及交易注意事項，經同業於另案函覆確認非業界可輕易取得…
- 異常／差異：無。

### 已知限制（誠實揭露）

1. holding 係 Claude 通讀「keyword ±250 字命中段落」所產製，非通讀判決全文；段落可能混雜兩造主張，已依品質紅線將無法辨識法院論斷者標為「未實質論述」（本批 11 筆），惟仍可能有將脈絡誤判之殘餘風險，引用前務必核對司法院原文。
2. 每案僅取至多 3 段、每段 320 字之標記優先段落，法院就該議題之完整論述（尤其結論在段落截斷外者）可能未被涵蓋；此類條目已在 holding 內以「未見於命中段落，請參閱原文」明示。
3. 全部新增條目 reviewed=false、quotable 空字串，尚待 YJ 人工複核後始得引用。

### 檔案異動摘要

修改：
- `data/factcourt_holdings_curated.json` — 新增 80 筆、version 2.1、natureStats 重算
- `public/data/factcourt_holdings_curated.json` — 同步

新增（工作檔，可日後清理）：
- `outputs/factcourt_batch_2026-07-10/`（4 議題段落 md、holdings_*.json、selection.json）

### 批次進度（排程任務 factcourt-holdings-batch）

| 議題 | 本批新增 | 累計 | 總命中 | 剩餘 |
|---|---:|---:|---:|---:|
| reasonable_measures | 20 | 40 | 185 | 145 |
| secrecy | 20 | 40 | 178 | 138 |
| economic_value | 20 | 40 | 181 | 141 |
| accomplice | 20 | 35 | 109 | 74 |
| 合計 | 80 | 155 | 653 | 498 |

剩餘 498 筆 > 0，排程任務維持啟用，下次執行續產。

### 建議 YJ 本人抽查

1. 智財法院 107 刑智上訴 19（合理保密措施標準：有效但不要求滴水不漏）之 holding 與原文核對。
2. 智商法院 113 民營上 2 同時出現於 reasonable_measures 與 secrecy 兩議題，確認兩則 holding 分工是否恰當。
3. 智財法院 103 民營訴 1（economic_value 標「未實質論述」：命中段落實為原告主張）抽核判斷是否正確。
4. 於本機執行 rebuild_and_push.command 後確認前端「事實審見解」頁各議題筆數更新為 40/40/40/35。

最後修訂：2026-07-10 — Claude（排程批次）

## Session 09:36 — 智財法院見解摘要續產批次（排程，第 2 批）

### [09:36] 計算剩餘並選批
- 意圖：續產 4 議題（reasonable_measures、secrecy、economic_value、accomplice）逐案 AI 認定摘要；damages（157 筆）已完成不動。
- 指令：讀 data/factcourt_holdings_index.json 與 data/factcourt_holdings_curated.json（v2.1），計算各議題剩餘＝topicHits 命中 jid 減 curated 已有 jid。
- 預期結果：剩餘約 reasonable_measures 145、secrecy 138、economic_value 141、accomplice 74（承上批 log 收尾數字）。
- 實際結果：reasonable_measures 145、secrecy 138、economic_value 141、accomplice 74，合計 498，與上批收尾一致。
- 異常／差異：無。
- 後續行動：每議題依 hitCount 由高至低取前 20 筆剩餘案件，匯出段落工作檔。

### [09:37] 匯出命中段落工作檔並由 Claude 通讀產製摘要
- 意圖：對本批 80 筆（每議題 20 筆）匯出每案 3 段、每段 320 字之命中段落（優先含法院論述標記：本院、得心證、經查、足認、堪認、準此、審酌、綜上），由 Claude 通讀後逐案撰寫 holding。
- 指令：python 匯出至 outputs/factcourt_batch_2026-07-10_run2/；Claude 通讀後產 holdings_<topic>.json；再 merge 進 data/factcourt_holdings_curated.json 與 public/data 同步，version 2.1 → 2.2。
- 預期結果：新增 80 筆條目；quotable 全空、reviewed 全 false、contextNote 固定揭露語；不覆寫既有條目（含 damages 157 筆與大立光 jid IPCV,102,民營訴,6,20171206,7）；不動 comparison。
- 實際結果：（待補）
- 異常／差異：（待補）
- 後續行動：驗證（CLAUDE.md §2）後收尾。

### [09:52] 合併寫入與驗證結果（第 2 批）
- 實際結果：新增 80 筆（每議題 20 筆），version 2.1 → 2.2，data 與 public/data 同步寫入。驗證全數通過：(a) 大立光 damages 條目 holding 仍含 1,522,470,639 且 quotable 非空、條目位元組級未變；(b) damages 仍 157 筆；(c) 既有各議題條目逐筆比對未變、comparison 未動；(d) 新增條目 quotable 全空、reviewed 全 false；(e) data 與 public/data 檔案內容一致。
- 異常／差異：無。品質紅線落實：命中段落僅見兩造攻防或條文引用、無法辨識法院論斷者，natureOfDiscussion 標「未實質論述」並於 holding 如實敘明（本批計 rm 5、secrecy 5、economic_value 5、accomplice 4 筆，另程序脈絡 rm 2、secrecy 1）。
- 抽樣 3 筆（caseNo／holding 前 60 字）：
  1. 智財法院 106 刑智上訴 16（reasonable_measures／實體認定）：法院區分刑法工商秘密與營業秘密法之保密強度：客戶資料設專人保管、領取歸還均須簽名，可認屬工商秘密；惟員工個人成交取得之客…
  2. 智商法院 114 民營上 1（economic_value／實體認定）：太陽光電模組排佈與建置規格隨個案設置面積、遮陰、方位等條件而異，且系爭標案於報導刊登時業已截標，法院認同業縱知悉亦無從節…
  3. 智商法院 110 刑智上訴 27（accomplice／實體認定）：四被告就擅自重製取得並洩漏營業秘密有犯意聯絡及行為分擔，論以共同正犯；已離職而不具為他人處理事務身分者，因與具身分之在職…
- 後續行動：剩餘 418 筆 > 0，排程任務 factcourt-holdings-batch 維持啟用，下次執行續產。

### 批次進度（排程任務 factcourt-holdings-batch，第 2 批後）

| 議題 | 本批新增 | 累計 | 總命中 | 剩餘 |
|---|---:|---:|---:|---:|
| reasonable_measures | 20 | 60 | 185 | 125 |
| secrecy | 20 | 60 | 178 | 118 |
| economic_value | 20 | 60 | 181 | 121 |
| accomplice | 20 | 55 | 109 | 54 |
| 合計 | 80 | 235 | 653 | 418 |

### 檔案異動摘要（第 2 批）

修改：
- `data/factcourt_holdings_curated.json` — 新增 80 筆、version 2.2、各議題 natureStats 重算
- `public/data/factcourt_holdings_curated.json` — 同步

新增（工作檔，可日後清理）：
- `outputs/factcourt_batch_2026-07-10_run2/`（4 議題段落 md、holdings.json、selection.json、merge.py）

### 建議 YJ 本人抽查（第 2 批）

1. 智財法院 106 刑智上訴 16（工商秘密 vs 營業秘密法合理保密措施之強度區分）核對原文。
2. 智商法院 112 民營訴 11 與其二審智商法院 114 民營上 1 同時入列（rm／economic_value），確認兩審級 holding 敘述一致性。
3. 智財法院 107 民營上 2（rm 標「程序脈絡」：命中段落多為訴訟資料限閱裁量）抽核分類是否恰當。
4. 大立光案（智財法院 102 民營訴 6）本批於 accomplice 議題新增條目（damages 終局條目未動），請確認兩議題並列無誤。
5. 於本機執行 rebuild_and_push.command 後確認前端各議題筆數更新為 60/60/60/55。

最後修訂：2026-07-10 09:52 — Claude（排程批次第 2 批）
