# SESSION LOG — 2026-07-11

## Session 00:36 — 智財法院見解摘要續產批次（排程，第 8 批）

### [00:36] 計算剩餘與選批
- 意圖：續產 4 議題（reasonable_measures、secrecy、economic_value、accomplice）逐案 AI 認定摘要。damages 已完成（157 筆）不動。先計算各議題剩餘（index topicHits 之 jid 減 curated 已有 jid），每議題依 hitCount 由高至低取前 20 筆剩餘。
- 指令：python3 讀 data/factcourt_holdings_index.json、data/factcourt_holdings_curated.json、data/judgments.json，輸出剩餘統計與本批段落工作檔至 outputs/factcourt_batch_2026-07-11_run1/。
- 預期結果：依第 7 批收尾記載，剩餘 rm 25、secrecy 18、ev 21、accomplice 0（合計 64）；本批選 rm 20、secrecy 18、ev 20，共 58 筆。
- 實際結果：剩餘與上批記載完全一致（rm 25、secrecy 18、ev 21、accomplice 0）。已選批並匯出工作檔 outputs/factcourt_batch_2026-07-11_run1/（read.txt 58 案、每案至多 3 段、每段自論述標記前 60 字起截 320 字；worklist.json、batch_meta.json）。
- 異常／差異：無。
- 遲報：本 session 開頭先執行數次唯讀 bash（讀 JSON 結構、版本、上批 log 末尾）確認狀態後才寫本條目，均為唯讀查核，無資料變更，無需 rollback。

### [00:40] 產製 58 筆摘要並合併寫入 curated
- 意圖：通讀工作檔段落後逐案撰寫 holding，合併進 data/factcourt_holdings_curated.json 之 topics[t].cases、重算該 3 議題 natureStats、version 2.8 → 2.9、更新 generatedAt，並同步 public/data。
- 指令：python3 merge 腳本，內含 assertions：不覆寫既有條目、damages 157 筆不動、大立光條目（IPCV,102,民營訴,6,20171206,7）byte 不動、comparison 不動、新增條目 quotable 全空、reviewed 全 false。
- 預期結果：rm 160→180、secrecy 160→178、ev 160→180、accomplice 109 不變、damages 157 不變；data 與 public/data md5 一致。
- 實際結果：與預期完全一致。新增 58 筆（rm 20、secrecy 18、ev 20），counts：damages 157、rm 180、secrecy 178、ev 180、accomplice 109；version 2.8 → 2.9；data 與 public/data md5 一致（a206c0cc7cb3b8f19a6fe76f77890ba9）。merge 腳本內建 assertions 全數通過（不覆寫既有條目、既有條目 byte 級未動、comparison 未動、大立光 damages 條目未動）。
- 異常／差異：無。

### [00:46] 驗證與收尾（第 8 批）
- 意圖：依 CLAUDE.md §2 獨立重跑抽樣驗證，確認本批合併未破壞既有資料。
- 指令：python3 assertion 檢核（獨立於 merge 腳本再驗一次）+ 抽 3 筆新增條目 + 重算剩餘。
- 預期結果：全數通過。
- 實際結果：全數通過：(a) 大立光條目 holding 含 1,522,470,639 且 quotable 非空；(b) damages 維持 157 筆；(c) 各議題筆數只增不減；(d) 新增 58 筆 quotable 全空、reviewed 全 false、contextNote 一致；(e) data 與 public/data md5 一致；(f) 各議題 natureStats 總和等於 cases 筆數。抽樣 3 筆新增條目：
  - 智商法院 113 刑營訴 10（reasonable_measures／實體認定）：「法院於犯罪事實認定中肯認公司透過職前訓練、線上宣導課程、營業秘密管理辦法（明定未經許可不得將電子檔案儲存於個人設備或外部…」
  - 智商法院 112 刑智上重訴 8（secrecy／實體認定）：「法院認告訴人未具體指明系爭積體電路資訊中有何確屬相關業界或專業領域內之人無法輕易知悉或取得之秘密資訊及其與各該電路功能之…」
  - 智財法院 106 刑智上訴 39（economic_value／實體認定）：「法院認商場物品價格隨市場浮動、舊供應商可能停業停產、新供應商陸續崛起，3、4 年前採購單之秘密性與經濟價值殊難想像；且被…」
- 異常／差異：無。品質紅線落實：本批 58 筆中，rm 6 筆、secrecy 7 筆、ev 6 筆因命中段落多為兩造攻防主張、遮隱處理或與本議題無涉（如量刑通則、契約解釋原則、損害額酌定）而標「未實質論述」；rm 3 筆、ev 2 筆標「程序脈絡」（含附民依刑訴§500/§503 以刑事認定為據、114 刑營訴 11 公訴不受理、110 刑智上訴 6 爭點限縮為告訴逾期）。刑事有罪判決之「犯罪事實認定」段落雖屬法院認定，然詳細涵攝多未見於命中段落，相關條目均於 holding 內以「請參閱原文」如實敘明。大立光案（102 民營訴 6）本批新增之 reasonable_measures 條目因命中段落屬損害賠償論述，標「未實質論述」並註明參閱損害賠償議題條目；damages 議題之既有大立光終局條目未動。
- 後續行動：剩餘 rm 5、secrecy 0、ev 1、accomplice 0（合計 6），未全數完成，排程任務維持啟用，下批（第 9 批）即可全數產完；工作檔留存於 outputs/factcourt_batch_2026-07-11_run1/ 供覆核。YJ 需於本機執行 rebuild_and_push.command 前端始會更新。

最後修訂：2026-07-11 00:46 — Claude（排程批次第 8 批）

## Session 03:36 — 智財法院見解摘要續產批次（排程，第 9 批）

### [03:37] 計算剩餘與選批
- 意圖：續產 4 議題逐案 AI 認定摘要。依第 8 批收尾記載，剩餘 rm 5、secrecy 0、ev 1、accomplice 0（合計 6），本批應可全數產完。damages（157 筆）不動。
- 指令：python3 讀 data/factcourt_holdings_index.json、data/factcourt_holdings_curated.json、data/judgments.json，重算剩餘並匯出段落工作檔至 outputs/factcourt_batch_2026-07-11_run2/。
- 預期結果：剩餘 rm 5、secrecy 0、ev 1（合計 6）；工作檔 6 案、每案至多 3 段。
- 實際結果：（06:42 補記，由第 10 次排程執行回填）依合併後結果反推，本批確為 rm 5、ev 1 合計 6 案，與預期一致；6 案為：智商法院 111 民營訴 1、智商法院 112 刑營訴 4、智商法院 112 重附民上 1、智財法院 109 民營上易 1、智財法院 106 刑智上訴 30（以上 rm）、智財法院 103 民營訴 6（ev）。
- 異常／差異：（06:42 補記）工作檔目錄 outputs/factcourt_batch_2026-07-11_run2/ 未留存於 repo，無法覆核當時匯出之 read.txt；惟 curated 檔內容完整且通過後續驗證。
- 後續行動：（06:42 補記）見 03:40 條目與 Session 06:36 補驗條目。

### [03:40] 通讀 6 案段落並產製摘要、合併寫入 curated
- 意圖：通讀 outputs/factcourt_batch_2026-07-11_run2/read.txt 之 6 案（rm 5、ev 1）命中段落，逐案撰寫 holding 後 merge 進 data/factcourt_holdings_curated.json，重算 rm、ev 之 natureStats，version 2.9 → 3.0，更新 generatedAt，同步 public/data。
- 指令：python3 merge 腳本，內含 assertions：不覆寫既有條目、damages 157 筆不動、大立光條目（IPCV,102,民營訴,6,20171206,7）byte 不動、comparison 不動、新增條目 quotable 全空、reviewed 全 false。
- 預期結果：rm 180→185、ev 180→181、secrecy 178 不變、accomplice 109 不變、damages 157 不變；data 與 public/data md5 一致；4 議題剩餘歸零。
- 實際結果：（06:42 補記，由第 10 次排程執行回填）合併已執行：version 2.9 → 3.0、generatedAt 2026-07-11T03:41:05、rm 180 → 185、ev 180 → 181、secrecy 178、accomplice 109、damages 157 均如預期；data 與 public/data md5 一致。惟該次執行於合併後未收尾即中斷，log 留待補。
- 異常／差異：（06:42 補記）log 未於當時補實際結果，屬 CLAUDE.md §8 情形；已由 Session 06:36 依 §2 獨立補驗，全數通過，無需 rollback。
- 後續行動：（06:42 補記）見 Session 06:36。

## Session 06:36 — 智財法院見解摘要續產批次（排程，第 10 次執行）

### [06:37] 檢視前次執行狀態與補驗第 9 批合併結果
- 意圖：本次排程啟動後發現第 9 批（Session 03:36）之 03:37 與 03:40 條目「實際結果」均留待補，但 data/factcourt_holdings_curated.json 已為 version 3.0（generatedAt 03:41:05，rm 185、ev 181），顯示合併已執行但 log 未收尾。依 CLAUDE.md §8，已寫入但未驗證之資料須先驗證再繼續。本條目為補驗：獨立重跑 §2 全套 assertions，並重算 4 議題剩餘。
- 指令：python3 讀 data/factcourt_holdings_index.json、data/factcourt_holdings_curated.json，檢核 (a) 大立光條目 holding 含 1,522,470,639 且 quotable 非空；(b) damages 157 筆；(c) quotable 空與 reviewed false 之新增條目規則；(d) data 與 public/data md5 一致；(e) natureStats 總和等於 cases 筆數；(f) 重算各議題剩餘。
- 預期結果：全數通過；若第 9 批確已產完 rm 5、ev 1，則 4 議題剩餘應為 0。
- 實際結果：全數通過：(a) 大立光條目（IPCV,102,民營訴,6,20171206,7）holding 含 1,522,470,639 且 quotable 非空（57 字）；(b) damages 維持 157 筆；(c) rm 185、secrecy 178、ev 181、accomplice 109，未審條目 quotable 全空、reviewed 全 false；(d) data 與 public/data md5 一致（7ff4a09b…）；(e) 各議題 natureStats 總和等於 cases 筆數；(f) 4 議題剩餘全為 0（rm 185/185、secrecy 178/178、ev 181/181、accomplice 109/109）。抽樣第 9 批新增 3 筆：
  - 智財法院 109 民營上易 1（rm／實體認定）：「法院肯認雇主基於營運保密需要，得以保密合約約定超越營業秘密法規定範圍之保密義務；就人事薪資、經營計畫、財務會計等資訊，審…」
  - 智商法院 112 刑營訴 4（rm／程序脈絡）：「本件經法院判決管轄錯誤、移送臺灣臺中地方法院，未就保密措施為實體認定；命中段落為公訴意旨引述被害公司與客戶間保密協議之內…」
  - 智財法院 103 民營訴 6（ev／未實質論述）：「命中段落疑為原告請求之整理（主張受託設計圖因秘密性而具實際經濟價值、已採簽署保密合約及管出管制等措施…）」
- 異常／差異：第 9 批工作檔目錄未留存（見 03:37 補記）；其餘無。
- 後續行動：4 議題全部產完，依任務指示停用排程任務 factcourt-holdings-batch（見下一條目）。

### [06:43] 全部完成，停用排程任務
- 意圖：4 議題（rm、secrecy、ev、accomplice）之逐案 AI 認定摘要已全數產完（合計 653 筆，另 damages 157 筆早已完成，curated 總計 810 筆），依任務步驟 2/8，將排程任務 factcourt-holdings-batch 之 enabled 設為 false。
- 指令：update_scheduled_task(taskId=factcourt-holdings-batch, enabled=false)。
- 預期結果：任務停用成功，不再自動執行。
- 實際結果：停用成功（update_scheduled_task 回覆 disabled），並將任務描述改為「[已完成並停用 2026-07-11]」。
- 異常／差異：無。
- 後續行動：提醒 YJ 於本機執行 rebuild_and_push.command 後前端始會更新；全部條目 reviewed 均為 false，引用前請逐筆核對司法院原文。

## Session 09:36 — 智財法院見解摘要續產批次（排程，第 11 次執行）

### [09:37] 確認前次停用未生效，重驗剩餘並補停用
- 意圖：Session 06:36 之 06:43 條目擬停用排程任務 factcourt-holdings-batch，但「實際結果」留待補，且本次排程仍被觸發，研判停用未完成或本次為停用前已排定之執行。依任務步驟 2 與 CLAUDE.md §8：先獨立重算 4 議題剩餘與 §2 核心 assertions，確認仍為全部完成後，再執行停用並收尾。
- 指令：python3 讀 data/factcourt_holdings_index.json 與 data/factcourt_holdings_curated.json，重算各議題剩餘；檢核大立光條目、damages 157 筆、data 與 public/data md5 一致；list_scheduled_tasks 確認任務狀態後 update_scheduled_task(enabled=false)。
- 預期結果：4 議題剩餘均為 0（rm 185、secrecy 178、ev 181、accomplice 109）；damages 157；md5 一致；任務停用成功。
- 實際結果：驗證全數通過：rm 185/185、secrecy 178/178、ev 181/181、accomplice 109/109，4 議題剩餘均為 0；damages 157 筆；大立光條目（IPCV,102,民營訴,6,20171206,7）holding 含 1,522,470,639 且 quotable 非空；各議題 natureStats 總和等於 cases 筆數；data 與 public/data md5 一致（7ff4a09b…）。list_scheduled_tasks 確認 factcourt-holdings-batch 仍為 enabled=true（前次 06:43 停用未生效），本次已執行 update_scheduled_task(enabled=false)，回傳「disabled」成功。
- 異常／差異：前次（Session 06:36）之停用動作未生效，log 條目亦留待補，致本次多跑一輪；本次未產製任何新條目、未改動任何資料檔，僅唯讀驗證與停用任務。
- 後續行動：本任務已停用，批次系列全部完成（4 議題 653 筆 + damages 157 筆，curated 合計 810 筆）。提醒 YJ 於本機執行 rebuild_and_push.command 後前端始會更新；全部條目 reviewed 均為 false，引用前請逐筆核對司法院原文與後續審級結果。


最後修訂：2026-07-11 06:44 — Claude（排程批次第 10 次執行：補驗第 9 批、確認 4 議題全數完成、停用排程任務）
