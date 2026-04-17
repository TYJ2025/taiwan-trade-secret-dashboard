#!/bin/bash
# Rebuild the Taiwan Trade Secrets Case Tracker dashboard.
# Re-runs the structured-field extractor (v2) and regenerates index.html.
# Double-click in Finder to run.

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "=========================================="
echo "1/2  Running extract_fields.py (v2)"
echo "=========================================="
python3 extract_fields.py

echo ""
echo "=========================================="
echo "2/2  Running build_dashboard.py"
echo "=========================================="
python3 build_dashboard.py

echo ""
echo "Done. Open index.html in your browser:"
echo "  open $DIR/index.html"
echo ""
read -n 1 -s -r -p "Press any key to close..."
