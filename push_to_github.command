#!/usr/bin/env bash
# -------------------------------------------------------------------
#  Taiwan Trade Secrets Case Tracker — push to GitHub
#  repo: https://github.com/TYJ2025/taiwan-trade-secret-dashboard
# -------------------------------------------------------------------
set -e

REPO_URL_HTTPS="https://github.com/TYJ2025/taiwan-trade-secret-dashboard.git"
REPO_URL_SSH="git@github.com:TYJ2025/taiwan-trade-secret-dashboard.git"
REPO_DIR="/Users/jesuisjane/Documents/Claude/Projects/Taiwan Trade Secrets Case Tracker"

cd "$REPO_DIR"

echo ""
echo "=================================================="
echo "  推送 Taiwan Trade Secrets Tracker 到 GitHub"
echo "=================================================="
echo ""
echo "目錄: $REPO_DIR"
echo ""

# -----------------------------------------------------------
# 0. 檢查 git 是否存在
# -----------------------------------------------------------
if ! command -v git >/dev/null 2>&1; then
  echo "✗ 找不到 git。請先安裝 Xcode Command Line Tools:"
  echo "  xcode-select --install"
  exit 1
fi

# -----------------------------------------------------------
# 1. 警告：檢查 temp/ 與大檔案
# -----------------------------------------------------------
echo "--- 敏感 / 大檔案檢查 ---"
if [ -d "temp" ]; then
  temp_count=$(find temp -type f | wc -l | tr -d ' ')
  temp_size=$(du -sh temp 2>/dev/null | cut -f1)
  echo "⚠️  temp/ 包含 ${temp_count} 個檔案（${temp_size}）；您已確認要一併 push。"
fi

echo ""
echo "超過 95 MB 的檔案（GitHub 限制 100 MB，需改用 Git LFS）："
big_files=$(find . -type f -size +95M ! -path './.git/*' 2>/dev/null || true)
if [ -z "$big_files" ]; then
  echo "  （無）"
else
  echo "$big_files" | while read f; do
    ls -lh "$f" | awk '{print "  " $5 "\t" $9}'
  done
  echo ""
  echo "✗ 偵測到 >95MB 檔案，GitHub 會拒絕。請先處理再重跑本腳本。"
  echo "  建議：安裝 git-lfs 後執行  git lfs install && git lfs track \"*.json\""
  exit 1
fi
echo ""

# -----------------------------------------------------------
# 2. 選擇 HTTPS / SSH
# -----------------------------------------------------------
echo "選擇遠端協定："
echo "  1) HTTPS  ($REPO_URL_HTTPS)   — 需 GitHub PAT"
echo "  2) SSH    ($REPO_URL_SSH)     — 需設定 SSH key"
read -p "請輸入 1 或 2 [預設 1]: " proto
proto=${proto:-1}
if [ "$proto" = "2" ]; then
  REPO_URL="$REPO_URL_SSH"
else
  REPO_URL="$REPO_URL_HTTPS"
fi
echo "使用: $REPO_URL"
echo ""

# -----------------------------------------------------------
# 3. 初始化 git
# -----------------------------------------------------------
if [ ! -d .git ]; then
  git init -b main
  echo "✓ git repo 已初始化 (branch: main)"
else
  echo "✓ 已是 git repo"
fi

# -----------------------------------------------------------
# 4. 設定 user.name / user.email（若尚未）
# -----------------------------------------------------------
if [ -z "$(git config user.email || true)" ]; then
  git config user.email "yujen.tsai@gmail.com"
fi
if [ -z "$(git config user.name || true)" ]; then
  git config user.name "TYJ"
fi

# -----------------------------------------------------------
# 5. 設定 remote
# -----------------------------------------------------------
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi
echo "✓ remote origin = $REPO_URL"

# -----------------------------------------------------------
# 6. 切到 main
# -----------------------------------------------------------
git checkout -B main >/dev/null 2>&1

# -----------------------------------------------------------
# 7. 本地 add + commit
# -----------------------------------------------------------
echo ""
echo "--- 建立本地 commit ---"
git add -A
if git diff --cached --quiet; then
  echo "（無變更可 commit）"
else
  git commit -m "Taiwan Trade Secrets Case Tracker: initial import

- index.html dashboard (單一檔案，內嵌資料)
- 1,193 筆案件 metadata (判決 + 裁定)
- 492 筆判決全文 + 結構化欄位
- 資料管線 scripts (download_fulltext / extract_fields / build_dashboard)"
  echo "✓ commit 完成"
fi

# -----------------------------------------------------------
# 8. 抓取並合併遠端（若已有內容）
# -----------------------------------------------------------
echo ""
echo "--- 抓取遠端 main ---"
set +e
git fetch origin main
fetch_rc=$?
set -e

if [ $fetch_rc -eq 0 ] && git rev-parse --verify origin/main >/dev/null 2>&1; then
  echo "遠端已有 main，執行 merge（保留本地衝突版本 -X ours）"
  if ! git merge origin/main --allow-unrelated-histories -X ours --no-edit; then
    echo ""
    echo "✗ Merge 失敗。請手動 cd 到目錄解決後再 push："
    echo "  cd \"$REPO_DIR\""
    echo "  git status"
    exit 1
  fi
else
  echo "（遠端 main 尚無或 fetch 失敗，視為首次 push）"
fi

# -----------------------------------------------------------
# 9. Push
# -----------------------------------------------------------
echo ""
echo "--- Push 到 GitHub ---"
git push -u origin main

echo ""
echo "=================================================="
echo "  ✅ 推送完成"
echo "=================================================="
echo ""
echo "下一步：啟用 GitHub Pages"
echo "  1. 打開 https://github.com/TYJ2025/taiwan-trade-secret-dashboard/settings/pages"
echo "  2. Source:  Deploy from a branch"
echo "  3. Branch:  main   /  (root)"
echo "  4. 儲存，約 1 分鐘後網址會是："
echo "     https://tyj2025.github.io/taiwan-trade-secret-dashboard/"
echo ""
echo "按 Enter 關閉視窗..."
read
