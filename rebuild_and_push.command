#!/usr/bin/env bash
# -------------------------------------------------------------------
#  Rebuild dashboard (with news) and push to GitHub
#
#  會做的事：
#    1. python3 fetch_news.py         → 產生 news.json
#    2. python3 build_dashboard.py    → 重新生成 index.html（含快訊）
#    3. git add / commit / push
#
#  修正內容：
#    (a) 民刑事判決結果分開為兩張圓餅圖
#    (b) 賠償金額 KPI 改為「民事勝訴賠償（中位數）」
#    (c) 新增每日快訊區塊（Google News RSS）
# -------------------------------------------------------------------
set -e

REPO_DIR="/Users/jesuisjane/Documents/Claude/Projects/Taiwan Trade Secrets Case Tracker"
cd "$REPO_DIR"

echo ""
echo "=================================================="
echo "  Rebuild Dashboard + Push News Feature"
echo "=================================================="
echo ""
echo "目錄: $REPO_DIR"
echo ""

# -----------------------------------------------------------
# 0. 基本檢查
# -----------------------------------------------------------
if [ ! -d .git ]; then
  echo "✗ 這不是 git repo"; exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "✗ 找不到 python3"; exit 1
fi

# -----------------------------------------------------------
# 1. Fetch news
# -----------------------------------------------------------
echo "--- Step 1: 抓取新聞 ---"
if python3 fetch_news.py; then
  echo "✓ news.json 產生完成"
else
  echo "⚠️  fetch_news.py 執行失敗 — 仍繼續 rebuild（儀表板會顯示「暫無快訊」）"
fi
echo ""

# -----------------------------------------------------------
# 2. Rebuild dashboard
# -----------------------------------------------------------
echo "--- Step 2: 重建 index.html ---"
python3 build_dashboard.py
echo "✓ index.html 已重建"
echo ""

# -----------------------------------------------------------
# 3. 本地預覽提示
# -----------------------------------------------------------
echo "--- Step 3: 本地預覽（可選） ---"
echo "  open index.html  (直接瀏覽器開啟)"
echo "  或  python3 -m http.server 8000"
echo ""

read -p "確認內容正確，是否 commit + push？(y/N) " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "已取消。你仍可手動執行 git add / commit / push。"
  exit 0
fi

# -----------------------------------------------------------
# 4. Commit & Push
# -----------------------------------------------------------
echo ""
echo "--- Step 4: Commit & Push ---"

git add -A
if git diff --cached --quiet; then
  echo "（無變更可 commit）"
else
  git commit -m "feat: 分離民刑事圓餅圖、修正賠償統計、新增每日快訊

- 判決結果圓餅圖分離為「刑事」與「民事」兩張 doughnut chart
- 賠償金額 KPI 改為「民事勝訴賠償（中位數）」，僅計入民事原告勝訴案件
- 新增每日快訊區塊（Google News RSS + GitHub Actions 每日自動更新）
- 新增 fetch_news.py 與 .github/workflows/update_news.yml"
  echo "✓ commit 完成"
fi

git push origin main
echo ""

# -----------------------------------------------------------
# 5. 提醒 GitHub Actions 權限
# -----------------------------------------------------------
echo "=================================================="
echo "  ✅ 完成"
echo "=================================================="
echo ""
echo "下一步："
echo ""
echo "1. 確認 GitHub Actions 有寫入權限（首次設定需要）："
echo "   https://github.com/TYJ2025/taiwan-trade-secret-dashboard/settings/actions"
echo "   Workflow permissions → Read and write permissions → Save"
echo ""
echo "2. 手動觸發第一次新聞更新（可選）："
echo "   https://github.com/TYJ2025/taiwan-trade-secret-dashboard/actions/workflows/update_news.yml"
echo "   → Run workflow"
echo ""
echo "3. 儀表板："
echo "   https://tyj2025.github.io/taiwan-trade-secret-dashboard/"
echo ""
echo "按 Enter 關閉..."
read
