# 台灣營業秘密案件儀表板

Taiwan Trade Secrets Case Dashboard

即時追蹤台灣營業秘密法相關案件，每日凌晨 4:06 自動更新。

---

## 功能特色

- **多源資料整合**：整合司法院裁判書系統、智慧財產及商業法院、智財局營業秘密專區、調查局等多個來源
- **結構化欄位擷取**：自動解析法院別、案件類型、判決結果、涉及條文、主要爭點、損害賠償金額、涉案技術
- **每日自動更新**：GitHub Actions 排程於每日 04:06 AM (台灣時間) 自動抓取
- **全文搜尋與篩選**：支援中文模糊搜尋、多維度篩選與排序
- **統計圖表**：歷年趨勢、產業分布、判決結果分析、條文引用頻率、賠償金額排行

## 快速開始

### 1. Clone 專案

```bash
git clone https://github.com/YOUR_USERNAME/taiwan-trade-secret-dashboard.git
cd taiwan-trade-secret-dashboard
npm install
```

### 2. 本機開發

```bash
# 複製資料到 public 目錄供開發伺服器使用
cp -r data/ public/data/

# 啟動開發伺服器
npm run dev
```

### 3. 設定自動抓取

1. 至 [司法院資料開放平臺](https://opendata.judicial.gov.tw) 註冊帳號
2. 在 GitHub Repo 的 Settings > Secrets and variables > Actions 中新增：
   - `JUDICIAL_USER`：司法院開放資料帳號
   - `JUDICIAL_PASS`：司法院開放資料密碼
3. 在 Settings > Actions > General 中啟用 "Read and write permissions"
4. 在 Settings > Pages 中設定 Source 為 "GitHub Actions"

### 4. 手動觸發抓取

前往 Actions 頁面 > "Daily Scrape" > "Run workflow"

## 技術架構

```
資料抓取 (GitHub Actions cron)
  │
  ├─ 司法院裁判書開放 API (00:00~06:00)
  │   ├─ JList：取得異動 JID
  │   └─ JDoc：下載裁判書全文
  │
  ├─ NLP 文本解析
  │   ├─ 法院/案件類型辨識
  │   ├─ 判決結果擷取
  │   ├─ 條文引用偵測
  │   ├─ 損害賠償金額擷取
  │   ├─ 關鍵爭點分類
  │   └─ 涉案技術/產業分類
  │
  └─ 輸出 JSON → commit → 觸發部署
       │
       └─ React SPA (GitHub Pages)
           ├─ 總覽儀表板 (Recharts)
           ├─ 案件列表 (Fuse.js 搜尋)
           └─ 案件詳情
```

## 資料來源

| 來源 | 類型 | 更新頻率 |
|------|------|----------|
| 司法院裁判書開放 API | 裁判書全文 | 每日 |
| 智慧財產及商業法院 | 判決書 | 每日 |
| 智慧財產局營業秘密專區 | 精選判決彙編 | 每年 |
| 法務部調查局 | 偵辦統計 | 不定期 |
| 政府資料開放平臺 | 統計資料 | 每月 |
| 新聞媒體 | 尚未訴訟案件 | 即時 |

## 常見引用條文

- **§2**：營業秘密定義（秘密性、經濟價值性、合理保密措施）
- **§10**：侵害行為態樣
- **§11**：防止侵害請求權
- **§12-13**：損害賠償及計算（含3倍懲罰性賠償）
- **§13-1**：國內刑事責任（告訴乃論）
- **§13-2**：域外/中國刑事責任（公訴罪，1-10年）

## 授權

MIT License
