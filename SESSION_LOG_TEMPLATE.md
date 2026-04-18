# Session Log — <主題>
Date: YYYY-MM-DD (星期X)
Operator: Claude (Cowork) / <其他 agent>
User: YJ

> 本範本供 Claude 或其他 agent 執行本 repo 任務時複製使用。
> 檔名請存為 `SESSION_LOG_<YYYY-MM-DD>.md`；同一日多 session 以 `## Session HH:MM` 區隔即可。
> 詳細規範見 `CLAUDE.md`。

---

## 0. 本 session 目標（動手前填）

- 主要目標：<一句話>
- 成功條件（可驗證）：
  1. <例：data/judgments.json 有 492 筆且 damagesNum 合計 ≈ 33 億>
  2. <例：npx vite build 成功，dist/index.html 包含 /src/main.jsx 入口>
  3. <…>
- 不做事項（避免失焦）：<例：不改 cases.json、不動 deploy.yml>

---

## 1. 環境與資料前置盤點

| 檢查項 | 指令 / 方法 | 結果 |
|---|---|---|
| 專案路徑 | `pwd` | … |
| 分支／最後 commit | `git log -1 --oneline` | … |
| node / npm | `node -v && npm -v` | … |
| python | `python3 -V` | … |
| 關鍵資料檔 | `wc -l data/judgments.json` | … |
| Vite 入口 | `grep main.jsx index.html` | … |

---

## 2. 計畫步驟（動手前填）

> 每一步都要對應一個「可觀測的輸出」，否則拆得更細。

1. [ ] 步驟 A — 預期輸出：…
2. [ ] 步驟 B — 預期輸出：…
3. [ ] 步驟 C — 預期輸出：…

---

## 3. 執行紀錄（逐步）

### [HH:MM] <動作標題>
- 意圖：<為什麼>
- 指令：
  ```bash
  <完整指令>
  ```
- 預期結果：<成功樣貌>
- 實際結果：<關鍵摘要；不要貼整段 stdout>
- 異常／差異：<與預期不符；無則寫「無」>
- 後續行動：<下一步連結>

### [HH:MM] <下一個動作>
…

---

## 4. 資料抽樣驗證

> 任何寫入 `data/*.json`、`trade_secret_judgments_*.json` 的變更，**必須**完成以下抽樣。

| # | 案號 | 案由 | 欄位 | Before | After | 驗證結果 |
|---|---|---|---|---:|---:|---|
| 1 | 102 民營訴 6（大立光） | 損害賠償 | damagesNum | … | 1,522,470,639 | ✅／❌ |
| 2 | <原告敗訴一筆> | 損害賠償 | damagesNum | … | 0 | ✅／❌ |
| 3 | <任挑一筆> | … | … | … | … | … |

總量 sanity-check：

- 判准金額總額：<數字>（與上版差異：<±%>，是否合理：<說明>）
- 件數：<數字>（與上版差異：<±n>）

---

## 5. 建置／部署驗證

| 步驟 | 指令 | 結果 |
|---|---|---|
| 安裝 | `npm install --prefer-offline` | … |
| Build | `npx vite build --emptyOutDir` | transformed <n> modules |
| Preview | `npx vite preview --port 4173` | HTTP 200 |
| 資源可取 | `curl -I .../data/judgments.json` | 200, <bytes> |

---

## 6. 已知限制（誠實揭露）

1. <正則／啟發式的覆蓋範圍與 false positive 評估>
2. <樣本偏差或資料缺漏>
3. <未來應再精細化之部分>

---

## 7. 檔案異動摘要

新增：
- `path/to/new_file.py`

修改：
- `path/to/modified.jsx` — <一句話說明差異>

刪除：
- `path/to/removed_file.md`

---

## 8. 建議 YJ 本人抽查

> 給 YJ 的人工複核清單，至少 3 項。

1. <例：進損害賠償頁確認大立光 15.22 億>
2. <例：全文檢索輸入「合理權利金」應命中 ≥ 10 筆>
3. <…>

---

## 9. 違反守則（若有）

- <例：未先寫 log 即執行 bash：說明遲報之行為與影響>
- Rollback 計畫：<有／無，理由>

---

最後修訂：<YYYY-MM-DD> — <作者>
