#!/usr/bin/env bash
# -------------------------------------------------------------------
#  Taiwan Trade Secrets Case Tracker — 本機 build 驗證 + commit + push
#
#  現行架構（2026-06-11 改寫）：
#    - 前端為 Vite + React（src/），非舊版單檔 index.html
#    - 正式部署由 GitHub Actions 自動執行（.github/workflows/deploy.yml：
#      push 到 main → npm run build → 部署 GitHub Pages）
#    - 本腳本只做「push 前的本機驗證 + commit + push」，
#      不需要、也不會把 dist/ 推上 GitHub
#
#  使用：雙擊執行，或 terminal 執行 ./rebuild_and_push.command
#  若只是日常小異動、不想等本機 build，可改用 push_to_github.command
# -------------------------------------------------------------------
set -e

REPO_DIR="/Users/jesuisjane/ClaudeProjects/Taiwan Trade Secrets Case Tracker"
cd "$REPO_DIR"

echo ""
echo "=================================================="
echo "  Build 驗證 + Push（部署由 GitHub Actions 接手）"
echo "=================================================="
echo "目錄: $REPO_DIR"
echo ""

# ---------------------------------------------------------
# 0. 基本檢查
# ---------------------------------------------------------
[ -d .git ] || { echo "✗ 這不是 git repo"; exit 1; }
command -v git >/dev/null || { echo "✗ 找不到 git"; exit 1; }
command -v npx >/dev/null || { echo "✗ 找不到 npx（請安裝 Node.js）"; exit 1; }

# 超過 95MB 的檔案（GitHub 限制 100MB）
big_files=$(find . -type f -size +95M ! -path './.git/*' ! -path './node_modules/*' 2>/dev/null || true)
if [ -n "$big_files" ]; then
  echo "✗ 偵測到 >95MB 檔案，GitHub 會拒絕："
  echo "$big_files"
  exit 1
fi

# ---------------------------------------------------------
# 1. 異動預覽
# ---------------------------------------------------------
echo "--- Step 1: 異動預覽 ---"
git status --short
if git diff --quiet && git diff --cached --quiet && [ -z "$(git status --porcelain)" ]; then
  echo "（無任何異動，結束）"
  exit 0
fi
echo ""

# ---------------------------------------------------------
# 2. 本機 build 驗證（與 Actions 相同指令）
# ---------------------------------------------------------
echo "--- Step 2: 本機 build 驗證 ---"
npx vite build
echo "✓ build 通過（dist/ 僅供本機檢查，不會 push；Actions 會自己重新 build）"
echo ""
echo "  本機預覽（可選）： npx vite preview"
echo ""

# ---------------------------------------------------------
# 3. Commit（訊息由你輸入，不寫死）
# ---------------------------------------------------------
DEFAULT_MSG="chore: 更新資料與頁面 $(date +%Y-%m-%d)"
read -p "Commit 訊息 [預設: ${DEFAULT_MSG}]: " msg
msg=${msg:-$DEFAULT_MSG}

read -p "確認 commit + push 到 origin/main？(y/N) " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "已取消。"
  exit 0
fi

git add -A
if git diff --cached --quiet; then
  echo "（無變更可 commit）"
else
  git commit -m "$msg"
  echo "✓ commit 完成"
fi

# ---------------------------------------------------------
# 4. Push（部署自動觸發）
# ---------------------------------------------------------
git push origin main
echo ""
echo "=================================================="
echo "  ✅ 已 push。GitHub Actions 正在自動 build + 部署"
echo "=================================================="
echo ""
echo "進度： https://github.com/TYJ2025/taiwan-trade-secret-dashboard/actions"
echo "站台： https://tyj2025.github.io/taiwan-trade-secret-dashboard/  （約 1-2 分鐘後更新）"
echo ""
echo "按 Enter 關閉..."
read
