#!/usr/bin/env python3
"""
Thin redirect — 正式的新聞抓取腳本已移至 repo root：../fetch_news.py
保留這個檔案是為了向後相容；內部直接呼叫 root 版本。
"""
from __future__ import annotations
import runpy
import sys
from pathlib import Path

ROOT_SCRIPT = Path(__file__).resolve().parent.parent / "fetch_news.py"
if not ROOT_SCRIPT.exists():
    sys.stderr.write(f"ERROR: expected {ROOT_SCRIPT} to exist.\n")
    sys.exit(1)

runpy.run_path(str(ROOT_SCRIPT), run_name="__main__")
