#!/usr/bin/env bash
# -------------------------------------------------------------------
#  清理 repo 裡多餘的巢狀目錄與暫存檔
#  - .github/.github/          (重複，保留 .github/workflows/)
#  - scripts/scripts/          (重複，保留 scripts/)
#  - vite.config.js.timestamp-*.mjs  (vite build 暫存)
#
#  不需 force push — 只是新增一個 cleanup commit
# -------------------------------------------------------------------
set -e

REPO_DIR="/Users/jesuisjane/Documents/Claude/Projects/Taiwan Trade Secrets Case Tracker"

cd "$REPO_DIR"

echo ""
echo "=================================================="
echo "  Cleanup：移除巢狀目錄與暫存檔"
echo "=================================================="
echo ""

# -----------------------------------------------------------
# 0. 檢查
# -----------------------------------------------------------
if [ ! -d .git ]; then
  echo "✗ 不是 git repo"
  exit 1
fi

# -----------------------------------------------------------
# 1. 列出將要刪除的項目
# -----------------------------------------------------------
echo "--- 將移除的路徑（僅從 git index；本機檔案保留） ---"
TARGETS=()
[ -d ".github/.github" ] && TARGETS+=(".github/.github")
[ -d "scripts/scripts" ] && TARGETS+=("scripts/scripts")
for f in vite.config.js.timestamp-*.mjs; do
  [ -e "$f" ] && TARGETS+=("$f")
done

if [ ${#TARGETS[@]} -eq 0 ]; then
  echo "（本機沒有這些路徑，可能已清過或結構不同）"
  echo ""
  echo "嘗試直接從 git index 移除遠端存在的路徑："
  git ls-files '.github/.github/*' 'scripts/scripts/*' 'vite.config.js.timestamp-*.mjs' 2>/dev/null | while read f; do
    echo "  $f"
  done
fi

for t in "${TARGETS[@]}"; do
  echo "  $t"
done
echo ""

read -p "確認移除？(y/N) " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "已取消"
  exit 0
fi

# -----------------------------------------------------------
# 2. 從 git index 與 working tree 移除
# -----------------------------------------------------------
echo ""
echo "--- 執行 git rm ---"

# 針對本機存在的目錄 / 檔案
for t in "${TARGETS[@]}"; do
  git rm -rf "$t" 2>/dev/null && echo "✓ 移除 $t" || echo "（略過 $t）"
done

# 保險：即使本機沒有，也從 index 移除遠端存在的
git rm -rf --cached --ignore-unmatch '.github/.github' 2>/dev/null || true
git rm -rf --cached --ignore-unmatch 'scripts/scripts' 2>/dev/null || true
git ls-files 'vite.config.js.timestamp-*.mjs' 2>/dev/null | while read f; do
  git rm --cached --ignore-unmatch "$f" 2>/dev/null || true
  echo "✓ 從 index 移除 $f"
done

# -----------------------------------------------------------
# 3. 加入 .gitignore 防止再跑進來
# -----------------------------------------------------------
if ! grep -q "vite.config.js.timestamp" .gitignore 2>/dev/null; then
  cat >> .gitignore <<'EOF'

# Vite build 暫存檔
vite.config.js.timestamp-*.mjs
EOF
  git add .gitignore
  echo "✓ 已將 vite timestamp 加入 .gitignore"
fi

# -----------------------------------------------------------
# 4. Commit
# -----------------------------------------------------------
echo ""
echo "--- 建立 commit ---"
if git diff --cached --quiet; then
  echo "（無變更可 commit）"
  exit 0
fi

git commit -m "chore: remove nested dirs and vite timestamp artifact

- drop duplicated .github/.github/
- drop duplicated scripts/scripts/
- drop vite.config.js.timestamp-*.mjs (ignore via .gitignore)"

# -----------------------------------------------------------
# 5. Push（不需 force）
# -----------------------------------------------------------
echo ""
echo "--- Push 到 origin main ---"
git push origin main

echo ""
echo "=================================================="
echo "  ✅ 清理完成"
echo "=================================================="
echo "https://github.com/TYJ2025/taiwan-trade-secret-dashboard"
echo ""
echo "按 Enter 關閉..."
read
