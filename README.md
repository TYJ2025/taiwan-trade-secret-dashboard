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

### 最高法院裁判持續搜集（2026-06-11 起）

- `scripts/scrape_sc.mjs` 由 `.github/workflows/scrape.yml` 每日 04:06（台灣時間）執行：自司法院開放資料 API 之異動清單篩出最高法院（TPSV/TPSM）且「案由含營業秘密 OR 全文含營業秘密法」之裁判，去重後增補 `data/supreme_court_judgments_fulltext.json`。
- push 後 `deploy.yml` 自動重跑 `build_holdings_index.py`，新案件即出現於 /supreme 與 /holdings 之關鍵字索引。
- **AI 摘要不自動產製**：新增補案件之重點摘要（/supreme）與五議題認定摘要（/holdings curated）須在 Cowork session 以既有流程補產並經 YJ 複核（見 SESSION_LOG_2026-06-11 Session 6-8）。

### 重新建置

```bash
python3 build_dashboard.py
```

## 最高法院見解索引（/holdings 頁）— 如何新增議題

議題定義集中於 **`config/holdings_topics.json`**（可擴充式），新增議題零程式碼改動：

1. 編輯 `config/holdings_topics.json`，複製一個 topic 物件修改（規則見檔內 `_howToExtend`：id 唯一、icon 限既定清單、每個 pattern 須附 `ref` 標明法條依據、寬鬆變體置末）。
2. 執行 `python3 scripts/build_holdings_index.py`（腳本會驗證 config，違規即報錯）。
3. 依 `CLAUDE.md` §2 抽樣驗證新議題 snippet 之相關性，並記入當日 SESSION_LOG。
4. 前端 `/holdings` 頁為 data-driven，會自動渲染新議題；本機 `npx vite build` 後部署。

## 資料來源與授權

判決資料來源為**司法院法學資料檢索系統**（公開資料，依《政府資訊公開法》及司法院相關規定使用）。本專案僅進行整理、結構化與可視化，不對原始判決內容承擔任何法律意義。

程式碼授權：請見 LICENSE 檔（如有）。

## 免責聲明

- 本儀表板提供之資訊僅供學術研究與一般參考之用，不構成任何法律意見。
- 結構化欄位係透過自動化規則抽取，可能與原始判決有出入；引用前請以司法院公告之原始判決為準。
- 涉及個人資料部分，已依司法院判決公開原則處理；若仍有當事人認為內容應進一步去識別化，敬請來信告知。
