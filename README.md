# Taiwan Trade Secrets Case Tracker

我國營業秘密法（Trade Secrets Act）相關刑事 / 民事判決追蹤儀表板，資料來源為司法院法學資料檢索系統（judgment.judicial.gov.tw）。

## 線上展示

本儀表板透過 GitHub Pages 部署：

> https://tyj2025.github.io/taiwan-trade-secret-dashboard/

## 內容

- `index.html` — 單一檔案儀表板（資料內嵌於 JS 變數）
- `trade_secret_cases_master.json` / `.csv` — 1,193 筆案件 metadata（判決 + 裁定）
- `trade_secret_judgments_fulltext.json` — 492 筆判決完整內文
- `trade_secret_judgments_structured.json` — 492 筆判決結構化欄位（主文、當事人、結論、法官、援引法條）
- `extraction_stats.json` — 結構化抽取統計

## 資料管線

| Step | 工具 | 說明 |
|------|------|------|
| 1 | Chrome 自動化 | 從 judgment.judicial.gov.tw 抓取 1,193 筆案件 metadata |
| 2 | `process_judgments.py` | 篩選出 492 筆「判決」，排除 699 筆「裁定」 |
| 3 | `download_fulltext.py` | 透過 `EXPORTFILE/reformat.aspx` 端點下載判決全文 |
| 4 | `extract_fields.py` | Regex 抽取主文、當事人、判決結論、法官、援引法條 |
| 5 | `build_dashboard.py` | 產生單一檔案 `index.html` |

### 重新建置

```bash
python3 build_dashboard.py
```

## 資料來源與授權

判決資料來源為**司法院法學資料檢索系統**（公開資料，依《政府資訊公開法》及司法院相關規定使用）。本專案僅進行整理、結構化與可視化，不對原始判決內容承擔任何法律意義。

程式碼授權：請見 LICENSE 檔（如有）。

## 免責聲明

- 本儀表板提供之資訊僅供學術研究與一般參考之用，不構成任何法律意見。
- 結構化欄位係透過自動化規則抽取，可能與原始判決有出入；引用前請以司法院公告之原始判決為準。
- 涉及個人資料部分，已依司法院判決公開原則處理；若仍有當事人認為內容應進一步去識別化，敬請來信告知。
