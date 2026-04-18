#!/bin/bash
# Rebuild the Taiwan Trade Secrets Case Tracker dashboard.
# 1. Re-run structured field extractor (v2).
# 2. Re-run damages deep-extraction (produces data/judgments*.json + damages_analysis.json).
# 3. Run vite build.
# Double-click in Finder to run.

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "=========================================="
echo "1/3  Running extract_fields.py (v2)"
echo "=========================================="
python3 extract_fields.py

echo ""
echo "=========================================="
echo "2/3  Running extract_damages.py"
echo "=========================================="
python3 extract_damages.py

echo ""
echo "=========================================="
echo "3/3  vite build"
echo "=========================================="
npm install
npm run build

echo ""
echo "Done.  Preview locally:"
echo "  npm run preview"
echo ""
read -n 1 -s -r -p "Press any key to close..."
