#!/usr/bin/env bash
# -------------------------------------------------------------------
#  Taiwan Trade Secrets Case Tracker — 輕量 commit + push
#
#  現行架構（2026-06-11 改寫）：
#    - 適用：日常資料／文件異動（data/、config/、SESSION_LOG、README…），
#      不在本機跑 build，push 後由 GitHub Actions 自動 build + 部署
#    - 若改動了 src/ 前端程式碼，建議改用 rebuild_and_push.command
#      （多一步本機 build 驗證，避免把 build 失敗的 code 推上去）
#    - 舊版「首次 import／設定 remote」流程已移除；remote 已設定完成
#      （git@github.com:TYJ2025/taiwan-trade-secret-dashboard.git）
# -------------------------------------------------------------------
set -e

REPO_DIR="/Users/jesuisjane/ClaudeProjects/Taiwan Trade Secrets Case Tracker"
cd "$REPO_DIR"

echo ""
echo "=================================================="
echo "  輕量 Commit + Push（不做本機 build）"
echo "=================================================="
echo "目錄: $REPO_DIR"
echo ""

# ---------------------------------------------------------
# 0. 基本檢查
# ---------------------------------------------------------
[ -d .git ] || { echo "✗ 這不是 git repo"; exit 1; }

# temp/ 保險：若曾被 track，從 index 移除（不刪本機檔案）
if git ls-files --error-unmatch temp >/dev/null 2>&1; then
  git rm -r --cached temp >/dev/null
  echo "✓ 已將誤 track 的 temp/ 從 index 移除"
fi

# 超過 95MB 的檔案（GitHub 限制 100MB）
big_files=$(find . -type f -size +95M ! -path './.git/*' ! -path './node_modules/*' 2>/dev/null || true)
if [ -n "$big_files" ]; then
  echo "✗ 偵測到 >95MB 檔案，GitHub 會拒絕："
  echo "$big_files"
  exit 1
fi

# ---------------------------------------------------------
# 1. 異動預覽 + 確認
# ---------------------------------------------------------
echo "--- 異動預覽 ---"
git status --short
if [ -z "$(git status --porcelain)" ]; then
  echo "（無任何異動，結束）"
  exit 0
fi
echo ""
if git status --porcelain | grep -q "^.. src/"; then
  echo "⚠️  偵測到 src/ 有異動 — 建議改用 rebuild_and_push.command 先做本機 build 驗證。"
  echo ""
fi

DEFAULT_MSG="chore: 更新資料與文件 $(date +%Y-%m-%d)"
read -p "Commit 訊息 [預設: ${DEFAULT_MSG}]: " msg
msg=${msg:-$DEFAULT_MSG}

read -p "確認 commit + push 到 origin/main？(y/N) " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "已取消。"
  exit 0
fi

# ---------------------------------------------------------
# 2. Commit + Push
# ---------------------------------------------------------
git add -A
if git diff --cached --quiet; then
  echo "（無變更可 commit）"
else
  git commit -m "$msg"
  echo "✓ commit 完成"
fi

# GitHub 上的機器人每天自動 commit（data/news 更新），push 前先 rebase
echo "--- 同步遠端（每日機器人 commit）---"
if ! git pull --rebase origin main; then
  echo ""
  echo "✗ Rebase 發生衝突。請執行 git status 查看衝突檔案，"
  echo "  解決後 git rebase --continue，再重跑本腳本；"
  echo "  或將衝突內容貼給 Claude 處理。"
  exit 1
fi
git push origin main
echo ""
echo "=================================================="
echo "  ✅ 已 push。GitHub Actions 正在自動 build + 部署"
echo "=================================================="
echo ""
echo "進度： https://github.com/TYJ2025/taiwan-trade-secret-dashboard/actions"
echo "站台： https://tyj2025.github.io/taiwan-trade-secret-dashboard/"
echo ""
echo "按 Enter 關閉..."
read
