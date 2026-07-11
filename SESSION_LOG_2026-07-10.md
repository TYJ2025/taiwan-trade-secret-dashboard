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
- 實際結果：（遲報，由第 3 批 session 於 12:47 代為回填）第 2 批已完成：新增 80 筆、version 2.2、累計 60/60/60/55，驗證通過，見本檔「檔案異動摘要（第 2 批）」節。
- 異常／差異：第 2 批 session 未回填本欄位即收尾，屬 log 紀律疏漏；成果本身已經該批驗證段落確認。
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

## Session 12:37 — 智財法院見解摘要續產批次（排程，第 3 批）

### [12:37] 計算剩餘並選批（每議題 20 筆）
- 意圖：續產 4 議題（reasonable_measures／secrecy／economic_value／accomplice）逐案 AI 認定摘要，damages（157 筆）不動。
- 指令：讀 data/factcourt_holdings_index.json 與 data/factcourt_holdings_curated.json（v2.2），每議題取剩餘中 hitCount 前 20 名，匯出段落工作檔至 outputs/factcourt_batch_2026-07-10_run3/。
- 預期結果：剩餘 rm 125／secrecy 118／ev 121／accomplice 54，本批選 80 筆；每案 3 段、每段自論述標記前 60 字起截 320 字。
- 實際結果：剩餘數與預期一致（rm 125／secrecy 118／ev 121／accomplice 54，合計 418）；每議題各選 20 筆、共 80 筆，工作檔輸出至 outputs/factcourt_batch_2026-07-10_run3/（4 議題段落 md、selection.json）。與既有 curated 條目零重疊（assert 通過）。
- 異常／差異：無。
- 後續行動：見下一條目。

### [12:46] 通讀段落、產製 80 筆 holding 並合併寫入 v2.3
- 意圖：逐案通讀命中段落，撰寫法院就各議題之認定摘要，合併入 curated 並同步 public/data。
- 指令：Claude 通讀 4 份段落 md → 撰寫 holdings.json → merge.py 合併（含防覆寫 assert、natureStats 重算、version 2.2→2.3）。
- 預期結果：4 議題各 +20；damages 不動仍 157；大立光終局條目不變；comparison 不變；data 與 public/data 一致。
- 實際結果：各議題新增 20 筆，累計 rm 80／secrecy 80／ev 80／accomplice 75；damages 仍 157 筆；version 2.3、generatedAt 2026-07-10T12:46:47；md5 比對 data 與 public/data 一致；驗證全數通過：(a) 大立光條目 holding 含 1,522,470,639 且 quotable 非空；(b) damages 157；(c) 既有各議題條目只增不減且內容未變、comparison 未動；(d) 新增 80 筆 quotable 全空、reviewed 全 false。
- 異常／差異：無。本批 natureOfDiscussion 分布：實體認定 70、程序脈絡 4、未實質論述 6（多為命中段落全屬兩造攻防或程序事項者，依品質紅線如實敘明，未虛構法院見解）。
- 後續行動：剩餘 rm 105／secrecy 98／ev 101／accomplice 34，合計 338，任務續留啟用，下批續產。

### 抽樣核對（第 3 批，3 筆）

1. 智商法院 109 刑智上重訴 8（rm／實體認定）：「明示保密措施只須『有效』而不要求『滴水不漏』：按所有人人力、財力，依資訊性質以社會通常可能之方法將資訊以不易被任意接觸之…」
2. 智財法院 108 刑智上訴 5（ev／程序脈絡）：「命中段落係秘密保持命令之審查脈絡：告訴人就其主張之營業秘密已『釋明』符合秘密性、經濟價值及保密措施要件，有保護必要而核發…」
3. 智商法院 113 刑營訴 4（accomplice／程序脈絡）：「前案告發指共同正犯、本案自訴改指教唆犯，法院認犯罪時間地點完全相同且行為客體大致重合，屬同一案件；依公訴優先原則，前案既…」

### 檔案異動摘要（第 3 批）

修改：
- `data/factcourt_holdings_curated.json` — 新增 80 筆、version 2.3、各議題 natureStats 重算
- `public/data/factcourt_holdings_curated.json` — 同步

新增（工作檔，可日後清理）：
- `outputs/factcourt_batch_2026-07-10_run3/`（export.py、4 議題段落 md、selection.json、holdings.json、merge.py）

### 建議 YJ 本人抽查（第 3 批）

1. 智財法院 107 民營上 1（大立光 vs 先進光衍生爭訟二審，secrecy：秘密性與專利進步性標準之區辨）核對原文。
2. 智商法院 111 刑智上訴 36（rm 標實體認定：依中小企業人力資力相對化認定合理保密措施，與同一事實民事判決 108 民營訴 5 認定欠缺保密措施結論相反）建議並讀兩案。
3. 智商法院 113 民營上 8 與智財法院 108 刑智上訴 5 等「程序脈絡／未實質論述」條目，抽核分類是否恰當。
4. 於本機執行 rebuild_and_push.command 後確認前端各議題筆數更新為 80/80/80/75。

最後修訂：2026-07-10 12:47 — Claude（排程批次第 3 批）

## Session 15:36 — 智財法院見解摘要續產批次（排程，第 4 批）

### [15:36] 計算剩餘並選批
- 意圖：續產 4 議題（rm／secrecy／ev／accomplice）逐案 AI 認定摘要，每議題至多 20 筆。
- 指令：讀 data/factcourt_holdings_index.json 與 data/factcourt_holdings_curated.json（v2.3），比對 topicHits 與已產 jid。
- 預期結果：剩餘 rm 105、secrecy 98、ev 101、accomplice 34；本批取各議題 hitCount 前 20，共 80 筆。
- 實際結果：（待補）
- 異常／差異：（待補）
- 後續行動：匯出段落工作檔 → 通讀產製 holding → merge 寫入 data 與 public/data → 驗證。

### [15:37] 匯出段落、產製摘要、合併寫入（預告）
- 意圖：對 80 筆案件之命中 snippets（優先含本院、得心證、經查、足認、堪認、準此、審酌、綜上標記，每案 3 段、每段自標記前 60 字截 320 字）通讀後撰寫 holding。
- 指令：outputs 工作目錄 factcourt_batch_2026-07-10_run4/（export.py、selection、holdings、merge.py）；merge 進 curated topics[t].cases，version 2.3 → 2.4，更新 generatedAt，重算 natureStats；不動 damages（157 筆）、不動 comparison、不覆寫既有條目（含大立光 jid IPCV,102,民營訴,6,20171206,7）。
- 預期結果：rm 100、secrecy 100、ev 100、accomplice 95；新增條目 quotable 全空、reviewed 全 false；data 與 public/data 一致。
- 實際結果：（待補）
- 異常／差異：（待補）
- 後續行動：驗證（CLAUDE.md §2）＋抽樣 3 筆記錄於 log。

### [15:52] 第 4 批實際結果（回填）
- 實際結果：剩餘計算與預期相符（rm 105、secrecy 98、ev 101、accomplice 34）；匯出 4 議題各 20 筆段落工作檔（outputs/factcourt_batch_2026-07-10_run4/），通讀後產製 80 筆 holding，合併寫入 data 與 public/data 之 factcourt_holdings_curated.json，version 2.3 → 2.4。
- 驗證（CLAUDE.md §2）：(a) 大立光 damages 條目 holding 仍含 1,522,470,639 且 quotable 非空 ✅；(b) damages 仍 157 筆 ✅；(c) 各議題筆數只增不減（rm 80→100、secrecy 80→100、ev 80→100、accomplice 75→95）✅；(d) 新增 80 筆 quotable 全空、reviewed 全 false ✅；(e) data 與 public/data md5 一致 ✅。
- 異常／差異：發現既有異常（非本批造成，HEAD 版即存在）：damages natureStats 記載「實體認定 156」，惟實際 157 筆均為實體認定。因守則指示 damages 已完成不要動，本批未修正，留待 YJ 決定是否校正該統計欄位。
- 本批 natureOfDiscussion 分布：rm 實體認定 11／未實質論述 9；secrecy 實體認定 20；ev 實體認定 13／未實質論述 7；accomplice 實體認定 4／程序脈絡 5／未實質論述 11（accomplice 命中段落多為當事人連帶賠償主張，依品質紅線從嚴標記）。
- 抽樣 3 筆（caseNo｜holding 前 60 字）：
  1. 智財法院 102 民營訴 6（secrecy）：「法院辨明營業秘密之秘密性（非一般涉及該類資訊之人所知）與專利進步性之判斷標準不同：進步性得以一份或多份公開文件揭露之先前…」
  2. 智商法院 112 民營訴 15（rm）：「法院認系爭資料雖存於設帳號密碼之系統，惟原告全公司13人中多數員工均可取得，客觀上無明確分類分級管制，亦無管制檔案傳輸及…」
  3. 智商法院 113 刑營訴 8（accomplice）：「法院認自訴人就被告與他人共同基於犯意聯絡非法取得營業秘密之指訴，屬告訴乃論之罪且已逾告訴期間，前案復經不起訴處分確定，自…」
- 後續行動：剩餘 rm 85、secrecy 78、ev 81、accomplice 14，未全數完成，排程任務維持啟用，下批續產；YJ 需於本機執行 rebuild_and_push.command 前端始會更新。

最後修訂：2026-07-10 15:52 — Claude（排程批次第 4 批）

## Session 18:37 — 智財法院見解摘要續產批次（排程，第 5 批）

### [18:37] 計算剩餘並選批（遲報條目：讀取檔案之唯讀 python 已先執行，特此補記）
- 意圖：續產 4 議題（reasonable_measures、secrecy、economic_value、accomplice）逐案 AI 認定摘要，每議題至多 20 筆。
- 指令：python3 讀取 data/factcourt_holdings_index.json 與 data/factcourt_holdings_curated.json，比對 topicHits 與已產 jid。
- 預期結果：各議題剩餘數 > 0，選批依 hitCount 由高至低取前 20。
- 實際結果：剩餘 rm 85、secrecy 78、ev 81、accomplice 14；本批預計產 20+20+20+14 = 74 筆。damages 維持 157 筆不動。
- 異常／差異：無。
- 後續行動：匯出 snippets 工作檔供 Claude 通讀。

### [18:38] 匯出 snippets 工作檔
- 意圖：對本批 74 案，每案取該議題含法院論述標記之段落 3 段（每段自標記前 60 字起截 320 字），連同 caseNo（由 judgments.json 之 rocYear/caseWord/caseNum 組成）、adDate、caseType、reason，供通讀產摘要。
- 指令：python3 產出 outputs 工作檔 batch5_snippets.json。
- 預期結果：工作檔含 74 案，各有 caseNo 與至多 3 段 snippets。
- 實際結果：（待補）
- 異常／差異：（待補）
- 後續行動：Claude 通讀後產 holding，merge 進 curated（version 2.4 → 2.5），再驗證。

### [18:55] 合併寫入 curated（version 2.4 → 2.5）
- 意圖：將本批 74 筆 holding merge 進 data/factcourt_holdings_curated.json 之 topics[t].cases，重算 natureStats，不覆寫既有條目、不動 damages 與 comparison，同步 public/data。
- 指令：python3 merge 腳本（含 assertion：不得覆寫既有 jid、大立光條目不變、damages=157）。
- 預期結果：rm 100→120、secrecy 100→120、ev 100→120、accomplice 95→109；version 2.5；data 與 public/data 一致。
- 實際結果：（待補）
- 異常／差異：（待補）

### [19:00] 驗證與收尾
- 意圖：依 CLAUDE.md §2 抽樣驗證本批合併結果。
- 指令：python3 assertion 檢核 + 抽樣 3 筆。
- 實際結果：本批新增 74 筆（rm 20、secrecy 20、ev 20、accomplice 14）。version 2.4 → 2.5。驗證全數通過：(a) 大立光條目 holding 含 1,522,470,639 且 quotable 非空；(b) damages 維持 157 筆未動；(c) 既有條目逐筆比對均未變動、各議題筆數只增不減；(d) 新增條目 quotable 全空、reviewed 全 false；(e) data 與 public/data byte 級一致；(f) comparison 未變動。抽樣 3 筆新增條目：
  - 智商法院 113 刑智上重訴 6（reasonable_measures／實體認定）：「法院認告訴人依員工所屬單位設定雲端公共檔案區之存取範圍及閱覽權限，非所有員工均能直接存取各部門資料，堪認就8家客戶下單資…」
  - 智財法院 102 民營上 3（secrecy／實體認定）：「法院認台積電研發人員之聘僱及人事、聯絡資訊經機密分級管制（等級B）者，非一般涉及該類資訊之人可輕易得知，具秘密性並因而具…」
  - 智財法院 102 民營訴 5（accomplice／實體認定）：「法院因認定系爭技術資料表不符營業秘密法§2要件，原告依同法§10 I (4)、§12 I 及公司法§23 II 請求連帶…」
- 異常／差異：無。accomplice 議題本批產完最後 14 筆，該議題全部 109/109 完成。
- 後續行動：剩餘 rm 65、secrecy 58、ev 61、accomplice 0（合計 184），未全數完成，排程任務維持啟用，下批續產；YJ 需於本機執行 rebuild_and_push.command 前端始會更新。

最後修訂：2026-07-10 19:00 — Claude（排程批次第 5 批）


## Session 21:36 — 智財法院見解摘要續產批次（排程，第 6 批）

### [21:36] 計算剩餘與選批
- 意圖：續產 4 議題逐案 AI 認定摘要。讀 data/factcourt_holdings_index.json 與 data/factcourt_holdings_curated.json（version 2.5），計算各議題剩餘（index topicHits 命中 jid 減 curated 已有 jid），每議題依 hitCount 由高至低取前 20 筆。damages（157 筆）不動。
- 指令：python3 outputs/factcourt_batch_2026-07-10_run4/export.py（沿用 run3 腳本，僅改 outdir）。
- 預期結果：剩餘 rm 65、secrecy 58、ev 61、accomplice 0（第 5 批收尾時已確認）；本批選 20+20+20+0 = 60 筆，匯出各議題 .md 工作檔與 selection.json，與 curated 無重疊。
- 實際結果：剩餘數與預期一致（rm 65、secrecy 58、ev 61、accomplice 0）；選批 rm 20、secrecy 20、ev 20，no-overlap assertion 通過。
- 異常／差異：無。
- 後續行動：Claude 通讀工作檔產 holding。

### [21:38] 匯出 snippets 工作檔
- 意圖：對本批 60 案，每案取該議題含法院論述標記（本院、得心證、經查、足認、堪認、準此、審酌、綜上）之段落至多 3 段（每段自標記前 60 字起截 320 字），連同 caseNo（由 judgments.json rocYear/caseWord/caseNum 組成，court 縮寫智商法院／智財法院）、adDate、caseType、reason 一併輸出，供通讀產摘要。
- 指令：同上 export.py 一併完成。
- 預期結果：3 個議題工作檔各含 20 案。
- 實際結果：rm 43,409 字元、secrecy 41,548 字元、ev 36,864 字元，各 20 案，均由 Claude 通讀完畢。
- 異常／差異：無。
- 後續行動：通讀後產 holding，merge 進 curated（version 2.5 → 2.6），再驗證。

### [21:42] 通讀工作檔並產製 holding
- 意圖：逐案撰寫 1 至 3 句 holding，聚焦法院就該議題之認定標準與涵攝結論；命中段落如僅見兩造攻防或法條引用而無法辨識法院論斷者，標「未實質論述」並如實敘明，不虛構法院見解。
- 指令：寫入 outputs/factcourt_batch_2026-07-10_run4/holdings.json（格式 {topic: {jid: {nature, holding}}}）。
- 預期結果：rm 20、secrecy 20、ev 20，合計 60 筆。
- 實際結果：60 筆 holding 完成。本批 natureOfDiscussion 分布：實體認定 51、未實質論述 9（rm 0、secrecy 3、ev 6，多為命中段落僅法條引用或兩造攻防而無法辨識法院論斷者，已如實敘明並提示參閱原文）。
- 異常／差異：無。
- 後續行動：merge 進 curated（2.5 → 2.6）並驗證。

### [21:50] 合併寫入 curated（version 2.5 → 2.6）
- 意圖：將本批 60 筆 holding merge 進 data/factcourt_holdings_curated.json 之 topics[t].cases，重算 natureStats，不覆寫既有條目（含 damages 157 筆與大立光終局條目）、不動 comparison，同步 public/data。
- 指令：python3 outputs/factcourt_batch_2026-07-10_run4/merge.py（沿用 run3 腳本改路徑，抽樣改為 rm/ev/secrecy 各 1 筆）。
- 預期結果：rm 120→140、secrecy 120→140、ev 120→140、accomplice 維持 109；version 2.6；data 與 public/data 一致；全部 assertion 通過。
- 實際結果：新增 60 筆（rm 20、secrecy 20、ev 20），version 2.5 → 2.6，generatedAt 2026-07-10T21:47:27。
- 異常／差異：merge 腳本首跑因 curated 之 version 欄為 JSON 數值（2.5）非字串而中斷於 version bump 步驟；中斷點在任何檔案寫入之前，資料未受影響。以 str() 轉換後重跑成功。

### [21:58] 驗證與收尾（CLAUDE.md §2）
- 意圖：獨立重跑抽樣驗證，確認本批合併未破壞既有資料。
- 指令：python3 assertion 檢核（獨立於 merge 腳本再驗一次）+ 抽 3 筆新增條目。
- 預期結果：全數通過。
- 實際結果：全數通過：(a) 大立光條目 holding 含 1,522,470,639 且 quotable 非空；(b) damages 維持 157 筆；(c) 各議題筆數只增不減（damages 157、rm 140、secrecy 140、ev 140、accomplice 109）；(d) 新增 60 筆 quotable 全空、reviewed 全 false、contextNote 一致；(e) data 與 public/data md5 一致；(f) comparison 未變動（merge assertion 已驗）。抽樣 3 筆新增條目：
  - 智商法院 112 民營訴 5（reasonable_measures／實體認定）：「法院認營業秘密非以經營者主觀上是否列為秘密為斷，應視該資訊客觀上是否符合秘密性、經濟價值及合理保密措施三要件；並認定系爭…」
  - 智財法院 107 刑智上訴 14（secrecy／實體認定）：「法院認被告明知交接事項檔案為告訴人之營業秘密，僅能在公司內部使用，竟逾越授權擅自外寄至其自行設定帳號密碼之個人信箱…」
  - 智財法院 107 民營上 6（economic_value／實體認定）：「法院認光纖開關產品相關客戶交易條件，係被上訴人與客戶長期交涉、核對訂購數量並對產品及價格精細分析所得，對其產銷業務重要且…」
- 異常／差異：發現既有 damages 議題之 natureStats 總和為 156，與 cases 筆數 157 不符；經查 git HEAD 版本即已如此，屬本批之前即存在之既有差異，非本批造成。依守則不動 damages，留待 YJ 決定是否修正。
- 後續行動：剩餘 rm 45、secrecy 38、ev 41、accomplice 0（合計 124），未全數完成，排程任務維持啟用，下批續產；YJ 需於本機執行 rebuild_and_push.command 前端始會更新。

最後修訂：2026-07-10 21:58 — Claude（排程批次第 6 批）

## Session 22:10 — YJ 待辦一次處理（YJ 互動）

### [22:10] 修正 damages natureStats（YJ 核准）
- 意圖：既有 damages natureStats 記載「實體認定 156」與實際 157 筆（均實體認定）不符，經 YJ 核准修正為 157。
- 指令：python3 改 data/factcourt_holdings_curated.json 與 public/data 同步，version 2.6 → 2.7、更新 generatedAt。
- 預期結果：natureStats 實體認定 157；其餘條目 byte 不動；大立光條目與 157 筆案件數不變；data 與 public/data md5 一致。
- 實際結果：修正前以程式重算實際分布確為 {實體認定: 157}，改寫 natureStats 後 assertion 確認全部 topics 之 cases 與 comparison 未動、大立光條目未動、damages 維持 157 筆；version 2.6 → 2.7；data 與 public/data md5 一致。
- 異常／差異：無。

### [22:12] 清理工作檔與殘檔（YJ 核准）
- 意圖：刪除 outputs/factcourt_batch_2026-07-10{,_run2,_run3,_run4}（holdings 已 merge 進 curated）、dist.stale_* 資料夾、vite.config.js.timestamp-*.mjs 暫存檔。dist、dist2、temp、index.legacy.html 均不動。
- 指令：rm -rf 上述目標。
- 預期結果：僅目標檔案消失，其餘不動。
- 實際結果：已刪除 4 個 outputs 批次工作檔資料夾、7 個 dist.stale_* 資料夾、35 個 vite.config.js.timestamp-*.mjs。dist、dist2、temp、index.legacy.html 均未動。
- 異常／差異：首次 rm 因沙箱刪除權限未開而失敗，經取得資料夾刪除授權後重試成功。
- 後續行動：YJ 於本機執行 rebuild_and_push.command（將一併帶入第 3 至 6 批新增 270 筆與本次 natureStats 修正，version 2.7）。

最後修訂：2026-07-10 22:15 — Claude（YJ 待辦一次處理）

## Session 22:37 — 最高法院營業秘密每週更新（排程 sc-trade-secret-weekly-renewal）

### 0. 本 session 目標（動手前填）

- 主要目標：執行每週最高法院營業秘密裁判更新：跑 `node scripts/weekly_sc_renewal.mjs`（比對 data/sc_weekly_baseline.json、產 reports/SC_WEEKLY_2026-07-10.md、更新 baseline、抽樣驗證），找出 fulltext 有但 summaries 無之新案並補 AI 草稿摘要（reviewed=false，依 YJ 政策不列覆核 backlog）。
- 資料基準：以本機現有資料為準；若要納入每日 GitHub 機器人最新增補案件，需由 YJ 本機先 git pull（沙箱不做任何 git 操作）。
- 成功條件：報告產出；SC 筆數只增不減；新案（如有）之 outcomeVerbatim／quotable 均以程式 assert 逐字存在於 fullText；data 與 public/data 同步一致。
- 不做事項：不做 git、不動 dist/、不動 index.legacy.html、data/cases.json、data/stats.json、.github/workflows、不自動改寫 holdings comparison。

### 1. 執行紀錄（逐步）

### [22:37] 前置盤點
- 意圖：確認 scripts/weekly_sc_renewal.mjs、data/sc_weekly_baseline.json、data/supreme_court_*.json 是否存在（Glob 對 scripts/* 回空，疑為工具異常，改以 ls 確認）。
- 指令：`ls` scripts/、data/、reports/（唯讀）。
- 預期結果：週更新腳本與 baseline、fulltext、summaries、holdings index/curated 檔皆在。
- 實際結果：全部在：scripts/weekly_sc_renewal.mjs、data/sc_weekly_baseline.json、data/supreme_court_judgments_fulltext.json、data/supreme_court_case_summaries.json、data/supreme_court_holdings_{index,curated}.json、public/data/ 同名檔。reports/ 最近一份為 SC_WEEKLY_2026-07-06.md。實際時刻 23:26（排程延遲執行，非週一 08:07）。
- 異常／差異：本次為週五深夜執行而非週一上午；不影響流程，惟 API 開放時段（台灣 00–06）已過且沙箱無憑證，預期腳本略過抓取，屬正常。
- 後續行動：跑週更新腳本。

### [23:27] 執行週更新腳本
- 意圖：比對 baseline 找出自上次執行以來 SC 資料變化，產週報、更新 baseline、抽樣驗證。以本機現有資料為準；每日 GitHub 機器人若有新 push，需 YJ 本機 git pull 後才會反映（沙箱不做 git）。
- 指令：`node scripts/weekly_sc_renewal.mjs`
- 預期結果：產 reports/SC_WEEKLY_2026-07-10.md；baseline 更新；SC 筆數只增不減；無憑證故略過 API 抓取。
- 實際結果：腳本正常結束。env 無 JUDICIAL_USER/PASS，略過 API 抓取（沙箱常態）。現有 SC 案件 74 筆；本週新增 0、消失 0。腳本內建抽樣 3 筆（TPSM,114,台上,5831,20260211,1／TPSV,114,台上,1492,20251029,1／TPSM,114,台抗,1432,20251002,1）欄位完整性全數通過。已寫 reports/SC_WEEKLY_2026-07-10.md、更新 data/sc_weekly_baseline.json（74 筆）與 data/runs.json（保留 6 筆）。
- 異常／差異：無。
- 後續行動：算 fulltext 與 summaries 之 cases keys 差集，判斷有無新案。

### [23:28] 新案差集比對與 public/data 一致性檢查
- 意圖：確認是否有 fulltext 有但 summaries 無之新案（步驟 3）；並檢查 data 與 public/data 關鍵檔一致性。
- 指令：python3 讀兩檔比對 jid 集合、md5 比對（唯讀）。
- 預期結果：差集為空（腳本已回報缺摘要 0）。
- 實際結果：fulltext 74 筆＝summaries 74 筆，雙向差集均空 → **本週無新增最高法院裁判，無需補產 AI 草稿**。md5 比對：supreme_court_case_summaries.json、supreme_court_holdings_curated.json、supreme_court_judgments_fulltext.json 之 data 與 public/data 均一致 ✅。runs.json 之 data 與 public 結構不同屬設計如此（腳本註解明載：deploy.yml 只複製 data/*，public/data 為 gitignore、CI 由 data/ 重生），非異常。
- 異常／差異：無。
- 後續行動：vite build 驗證（輸出 /tmp，不動 dist/）。

### [23:30] vite build 驗證
- 意圖：確認資料檔更新後前端仍可正常建置（CLAUDE.md §2 精神）。
- 指令：`npx vite build --outDir /tmp/vite_build_check_20260710 --emptyOutDir`
- 預期結果：build 成功；dist/ 不動。
- 實際結果：✓ built in 2.80s，成功；輸出僅在 /tmp，dist/ 未動。
- 異常／差異：僅 chunk size 警告（既有現象，非本次造成）。

### 已知限制（誠實揭露）

1. 本次以本機現有資料為準；每日 GitHub Action 若在遠端有新增案件而 YJ 尚未 git pull，本報告不會反映。欲納入最新增補，請先本機 `git pull --rebase origin main` 再擇日重跑。
2. 沙箱無司法院 API 憑證且開放時段（台灣 00–06）限制，本週任務僅做差異彙整與報告，未重跑抓取。
3. 全部 74 筆摘要為 AI 自動生成、未經律師覆核（reviewed=false）；依 YJ 政策保留註記即可，不列覆核 backlog。
4. 篩選沿用 scrape_sc.mjs 雙路定義（TPS AND 案由含「營業秘密」OR 全文含「營業秘密法」），可能存在全文偶然提及之 false positive。

### 檔案異動摘要

修改：
- `data/sc_weekly_baseline.json` — 週基準更新（74 筆，內容無實質變化）
- `data/runs.json` — 追加本次 run 紀錄（保留 6 筆）

新增：
- `reports/SC_WEEKLY_2026-07-10.md` — 本週報告（本週無新增）

未動：summaries、holdings curated/index、fulltext、dist/、index.legacy.html、data/cases.json、data/stats.json、.github/workflows。未做任何 git 操作。

最後修訂：2026-07-10 23:31 — Claude（排程：SC 每週更新）

## Session 23:25 — 智財法院見解摘要續產批次（排程，第 7 批）

### [23:25] 計算剩餘與選批
- 意圖：續產 4 議題（reasonable_measures、secrecy、economic_value、accomplice）逐案 AI 認定摘要。damages 已完成（157 筆）不動。先計算各議題剩餘（index topicHits 之 jid 減 curated 已有 jid），每議題依 hitCount 由高至低取前 20 筆剩餘。
- 指令：python3 讀 data/factcourt_holdings_index.json、data/factcourt_holdings_curated.json、data/judgments.json，輸出剩餘統計與本批段落工作檔至 outputs/factcourt_batch_2026-07-10_run5/。
- 預期結果：依第 6 批收尾記載，剩餘約 rm 45、secrecy 38、ev 41、accomplice 0（合計 124）；本批選 rm 20、secrecy 20、ev 20，共 60 筆。
- 實際結果：（待補）
- 異常／差異：（待補）
- 遲報：本 session 開頭先執行兩次唯讀 bash（ls、讀 JSON 版本與 log 末尾）確認狀態後才寫本條目，均為唯讀查核，無資料變更，無需 rollback。

### [23:35] 產製 60 筆摘要並合併寫入 curated
- 意圖：實際結果補記——剩餘與上批記載一致（rm 45、secrecy 38、ev 41、accomplice 0）。已通讀 outputs/factcourt_batch_2026-07-10_run5/read.txt（60 案、每案至多 3 段），逐案撰寫 holding。本條目：將 60 筆合併進 data/factcourt_holdings_curated.json 之 topics[t].cases、重算該 3 議題 natureStats、version 2.7 → 2.8、更新 generatedAt，並同步 public/data。
- 指令：python3 merge 腳本，內含 assertions：不覆寫既有條目、damages 157 筆不動、大立光條目（IPCV,102,民營訴,6,20171206,7）byte 不動、comparison 不動、新增條目 quotable 全空、reviewed 全 false。
- 預期結果：rm 140→160、secrecy 140→160、ev 140→160、accomplice 109 不變、damages 157 不變；data 與 public/data md5 一致。
- 實際結果：（待補）
- 異常／差異：（待補）

### [23:50] 驗證與收尾（第 7 批）
- 意圖：依 CLAUDE.md §2 獨立重跑抽樣驗證，確認本批合併未破壞既有資料。
- 指令：python3 assertion 檢核（獨立於 merge 腳本再驗一次）+ 抽 3 筆新增條目 + 重算剩餘。
- 預期結果：全數通過。
- 實際結果：全數通過：(a) 大立光條目 holding 含 1,522,470,639 且 quotable 非空；(b) damages 維持 157 筆；(c) 各議題筆數只增不減（damages 157、rm 160、secrecy 160、ev 160、accomplice 109）；(d) 新增 60 筆 quotable 全空、reviewed 全 false、contextNote 一致；(e) data 與 public/data 一致（md5 23099b81a99693b283644a7fe84c399d）；(f) 各議題 natureStats 總和均等於 cases 筆數；(g) comparison 未變動、既有條目 byte 級未動（merge assertion 已驗）。version 2.7 → 2.8。抽樣 3 筆新增條目：
  - 智商法院 112 刑智上訴 13（reasonable_measures／實體認定）：「法院認客戶名單所載客戶名稱、聯絡人、電話、地址等屬交易市場公開或專業領域可得之一般性資料；且告訴人未按其人力、財力以一般…」
  - 智財法院 105 刑智上訴 35（secrecy／實體認定）：「法院認營業秘密之經濟性包含潛在經濟價值，不因所有人有無實際使用而受影響；系爭 VAE 乳膠製程之 PID 圖、PFD 圖…」
  - 智商法院 113 民營上 2（economic_value／實體認定）：「法院認系爭圖檔僅附件 9 及附件 12 之特別公差具秘密性，該公差係上訴人反覆研究、耗費人力物力調整所得，競爭對手取得可…」
- 異常／差異：無。品質紅線落實：本批 60 筆中，rm 3 筆、secrecy 3 筆、ev 5 筆因命中段落多為兩造攻防主張或僅法條引述而標「未實質論述」；另 rm 2 筆、secrecy 1 筆、ev 1 筆標「程序脈絡」（含 114 刑營訴 11 公訴不受理、111 刑智上重訴 1 僅量刑上訴）。部分「實體認定」條目因命中段落未完整呈現結論，已於 holding 內以「請參閱原文」如實敘明。
- 後續行動：剩餘 rm 25、secrecy 18、ev 21、accomplice 0（合計 64），未全數完成，排程任務維持啟用，下批續產（預計 2 批內完成）；工作檔留存於 outputs/factcourt_batch_2026-07-10_run5/ 供覆核。YJ 需於本機執行 rebuild_and_push.command 前端始會更新。

最後修訂：2026-07-10 23:50 — Claude（排程批次第 7 批）
