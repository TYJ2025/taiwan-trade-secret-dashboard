#!/usr/bin/env bash
# -------------------------------------------------------------------
#  從 GitHub 歷史中徹底移除 temp/ 資料夾
#  repo: https://github.com/TYJ2025/taiwan-trade-secret-dashboard
#
#  做法：git filter-repo 改寫所有 commit，再 force push
#  注意：這會重寫 git 歷史；若已有他人 clone，他們需重新 clone
# -------------------------------------------------------------------
set -e

REPO_DIR="/Users/jesuisjane/Documents/Claude/Projects/Taiwan Trade Secrets Case Tracker"
REMOTE_URL_FROM_GIT=""

cd "$REPO_DIR"

echo ""
echo "=================================================="
echo "  從 git 歷史移除 temp/"
echo "=================================================="
echo ""
echo "目錄: $REPO_DIR"
echo ""

# -----------------------------------------------------------
# 0. 基本檢查
# -----------------------------------------------------------
if [ ! -d .git ]; then
  echo "✗ 這裡不是 git repo。請先確認位置。"
  exit 1
fi

REMOTE_URL_FROM_GIT=$(git remote get-url origin 2>/dev/null || true)
if [ -z "$REMOTE_URL_FROM_GIT" ]; then
  echo "✗ 找不到 origin remote。請先設定。"
  exit 1
fi
echo "remote origin = $REMOTE_URL_FROM_GIT"

# -----------------------------------------------------------
# 1. 安裝 git-filter-repo（若尚未安裝）
# -----------------------------------------------------------
if ! command -v git-filter-repo >/dev/null 2>&1; then
  echo ""
  echo "--- 安裝 git-filter-repo ---"
  if command -v brew >/dev/null 2>&1; then
    brew install git-filter-repo
  elif command -v pip3 >/dev/null 2>&1; then
    pip3 install --user git-filter-repo
    # 確保 ~/Library/Python/*/bin 或 ~/.local/bin 在 PATH
    export PATH="$HOME/.local/bin:$HOME/Library/Python/3.11/bin:$HOME/Library/Python/3.12/bin:$HOME/Library/Python/3.13/bin:$PATH"
  else
    echo "✗ 需要 brew 或 pip3 其中之一來安裝 git-filter-repo"
    echo "  brew install git-filter-repo"
    echo "  或 pip3 install --user git-filter-repo"
    exit 1
  fi
fi

if ! command -v git-filter-repo >/dev/null 2>&1; then
  echo "✗ git-filter-repo 安裝後仍找不到，請手動 which git-filter-repo 檢查 PATH"
  exit 1
fi
echo "✓ git-filter-repo 可用"

# -----------------------------------------------------------
# 2. 建立本機備份（clone 鏡像）
# -----------------------------------------------------------
BACKUP_DIR="${REPO_DIR}.backup.$(date +%Y%m%d_%H%M%S)"
echo ""
echo "--- 建立本機備份 ---"
echo "位置: $BACKUP_DIR"
cp -R ".git" "/tmp/git_backup_$(date +%s)" 2>/dev/null || true
mkdir -p "$BACKUP_DIR"
cp -R .git "$BACKUP_DIR/.git"
echo "✓ 備份完成（僅 .git 目錄）"

# -----------------------------------------------------------
# 3. 用 git-filter-repo 刪除 temp/ 全部歷史
# -----------------------------------------------------------
echo ""
echo "--- 改寫歷史：移除 temp/ ---"
# --force 是必要的，因為這不是 fresh clone
git filter-repo --path temp --invert-paths --force

# -----------------------------------------------------------
# 4. filter-repo 會移除 remote，重新加回
# -----------------------------------------------------------
echo ""
echo "--- 重新加回 origin ---"
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REMOTE_URL_FROM_GIT"
else
  git remote add origin "$REMOTE_URL_FROM_GIT"
fi
echo "✓ origin = $REMOTE_URL_FROM_GIT"

# -----------------------------------------------------------
# 5. 清理 refs 與 gc
# -----------------------------------------------------------
echo ""
echo "--- 本機 GC ---"
git reflog expire --expire=now --all
git gc --prune=now --aggressive
echo "✓ 本機歷史已清理"

# -----------------------------------------------------------
# 6. Force push 覆蓋遠端歷史
# -----------------------------------------------------------
echo ""
echo "--- Force push 覆蓋遠端 ---"
echo "⚠️  這將改寫 GitHub 上的 main 分支歷史"
read -p "確認執行 force push？(y/N) " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "已取消。本機已改寫，若要放棄改寫請從備份恢復："
  echo "  rm -rf .git && cp -R '$BACKUP_DIR/.git' .git"
  exit 0
fi

git push origin --force --all
git push origin --force --tags 2>/dev/null || true

echo ""
echo "=================================================="
echo "  ✅ 歷史清理完成"
echo "=================================================="
echo ""
echo "下一步（重要）："
echo ""
echo "1. 前往 repo 確認 temp/ 已消失："
echo "   https://github.com/TYJ2025/taiwan-trade-secret-dashboard"
echo ""
echo "2. 若檔案敏感，email support@github.com 請求清除 blob cache："
echo "   - 主旨：Request to purge cached blobs after force push"
echo "   - 內容：repo 名 + 說明已 force-push 移除敏感內容，請清除殘留 blob"
echo ""
echo "3. 本機備份位置（確認沒問題後可手動刪除）："
echo "   $BACKUP_DIR"
echo ""
echo "按 Enter 關閉..."
read
