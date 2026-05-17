#!/usr/bin/env python3
"""
Build data/supreme_court_judgments_fulltext.json by:
1. Matching 39 SC 判決 against existing data/judgments_fulltext.json (already downloaded)
2. Downloading 35 SC 裁定 fullText via EXPORTFILE/reformat.aspx (same endpoint download_fulltext.py uses)

Per SESSION_LOG_2026-05-17.md §Session 18:45, this is a metadata→fulltext join step.
The 35 rulings have already been verified to be fetchable via the reformat endpoint
(tested via browser-side fetch: 35/35 success, avg 1807 chars).

Usage:
    python3 scripts/build_sc_fulltext.py
"""
import json
import re
import time
import sys
from pathlib import Path
from urllib.parse import quote
from urllib.request import urlopen, Request

ROOT = Path(__file__).parent.parent
META_FILE = ROOT / "data" / "supreme_court_judgments.json"
JUDG_FULL = ROOT / "data" / "judgments_fulltext.json"
OUT_FILE = ROOT / "data" / "supreme_court_judgments_fulltext.json"
PUBLIC_OUT = ROOT / "public" / "data" / "supreme_court_judgments_fulltext.json"
PUBLIC_META = ROOT / "public" / "data" / "supreme_court_judgments.json"

REFORMAT_BASE = "https://judgment.judicial.gov.tw/EXPORTFILE/reformat.aspx"


def fetch_reformat(jid: str, retries: int = 2) -> str:
    url = f"{REFORMAT_BASE}?type=JD&id={quote(jid)}&lawpara=&ispdf=0"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
    }
    for attempt in range(retries + 1):
        try:
            req = Request(url, headers=headers)
            with urlopen(req, timeout=12) as r:
                html = r.read().decode("utf-8", errors="replace")
            m = re.search(
                r'<div[^>]*class="text-pre"[^>]*>(.*?)</div>\s*</div>\s*</span>',
                html, re.DOTALL,
            )
            if not m:
                m = re.search(
                    r'<span[^>]*id="spanCon"[^>]*>(.*?)</span>',
                    html, re.DOTALL,
                )
            if not m:
                return ""
            text = m.group(1)
            text = re.sub(r"<br\s*/?>", "\n", text)
            text = re.sub(r"<[^>]+>", "", text)
            text = re.sub(r"[ \t]+", " ", text)
            text = re.sub(r"\n[ \t]+", "\n", text)
            text = re.sub(r"\n{3,}", "\n\n", text)
            return text.strip()
        except Exception as e:
            if attempt < retries:
                print(f" retry {attempt + 1} ({e})", end="", flush=True)
                time.sleep(3)
            else:
                print(f" ERROR: {e}", end="", flush=True)
                return ""


def main():
    meta = json.loads(META_FILE.read_text(encoding="utf-8"))
    print(f"Loaded {len(meta)} SC entries (metadata)")

    judg_full = json.loads(JUDG_FULL.read_text(encoding="utf-8"))
    title_to_full = {x["title"]: x.get("fullText", "") for x in judg_full}
    print(f"Loaded {len(judg_full)} judgments_fulltext entries")

    # Resume support: load existing output if present
    result = []
    existing_by_jid = {}
    if OUT_FILE.exists():
        result = json.loads(OUT_FILE.read_text(encoding="utf-8"))
        existing_by_jid = {x["jid"]: x for x in result if x.get("fullText")}
        print(f"Resume: {len(existing_by_jid)} entries already have fullText")

    matched_judgments = 0
    downloaded_rulings = 0
    failed = 0
    save_every = 5
    new_result = []

    for i, m in enumerate(meta, 1):
        title = m["title"]
        jid = m["jid"]
        is_ruling = title.endswith("裁定")

        if jid in existing_by_jid:
            rec = existing_by_jid[jid]
            new_result.append(rec)
            continue

        full_text = ""
        if not is_ruling and title in title_to_full:
            full_text = title_to_full[title]
            matched_judgments += 1
            print(f"[{i}/{len(meta)}] (matched 判決) {title[:40]}... {len(full_text):,} chars")
        else:
            print(f"[{i}/{len(meta)}] (downloading 裁定) {title[:40]}...", end="", flush=True)
            full_text = fetch_reformat(jid)
            if full_text:
                downloaded_rulings += 1
                print(f" OK ({len(full_text):,} chars)")
            else:
                failed += 1
                print(" EMPTY")
            time.sleep(1.0)

        rec = dict(m)
        rec["fullText"] = full_text
        rec["charCount"] = len(full_text)
        new_result.append(rec)

        # Periodic save
        if (downloaded_rulings + matched_judgments) > 0 and (downloaded_rulings + matched_judgments) % save_every == 0:
            OUT_FILE.write_text(
                json.dumps(new_result + [r for r in result if r["jid"] not in {x["jid"] for x in new_result}], ensure_ascii=False, indent=1),
                encoding="utf-8",
            )
            print(f"  [checkpoint: {downloaded_rulings + matched_judgments} done]")

    result = new_result

    OUT_FILE.write_text(
        json.dumps(result, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    PUBLIC_OUT.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_OUT.write_text(
        json.dumps(result, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    # also mirror metadata to public/
    PUBLIC_META.write_text(
        json.dumps(meta, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )

    print("=" * 56)
    print(f"Total entries: {len(result)}")
    print(f"  Matched 判決 from existing fulltext: {matched_judgments}")
    print(f"  Downloaded 裁定 from server:        {downloaded_rulings}")
    print(f"  Failed:                              {failed}")
    print(f"Output: {OUT_FILE}")
    print(f"Public mirror: {PUBLIC_OUT}")
    print("=" * 56)

    # Quick sanity check
    if failed > 0:
        print(f"\nWARNING: {failed} rulings failed to download. Re-run script to retry.")
        sys.exit(1)


if __name__ == "__main__":
    main()
