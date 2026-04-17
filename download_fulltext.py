#!/usr/bin/env python3
"""
台灣營業秘密裁判書全文下載腳本
Download full judgment text from Judicial Yuan for trade secret cases.

Usage:
    python3 download_fulltext.py                    # Download all 492 judgments
    python3 download_fulltext.py --start 100        # Resume from index 100
    python3 download_fulltext.py --limit 50         # Download only 50 cases
    python3 download_fulltext.py --delay 3          # 3-second delay between requests
    python3 download_fulltext.py --all-docs         # Include rulings (裁定), not just judgments

This script reads trade_secret_cases_master.json, filters to judgments (判決) only,
and fetches each judgment's full text from judgment.judicial.gov.tw.
Results are saved incrementally to trade_secret_judgments_fulltext.json.

NOTE: The judicial website is slow (~10-20s per request). Downloading all
492 judgments takes approximately 2-3 hours. Use --start to resume interrupted runs.
"""

import json
import re
import time
import argparse
import os
import sys
from pathlib import Path
from urllib.parse import quote
from http.cookiejar import CookieJar

# Try to use requests if available, fall back to urllib
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    import urllib.request
    import urllib.parse
    HAS_REQUESTS = False

SCRIPT_DIR = Path(__file__).parent
INPUT_JSON = SCRIPT_DIR / "trade_secret_cases_master.json"
OUTPUT_JSON = SCRIPT_DIR / "trade_secret_judgments_fulltext.json"
PROGRESS_FILE = SCRIPT_DIR / ".download_progress.json"

def create_session():
    """Create HTTP session (no cookies needed for reformat endpoint)."""
    if HAS_REQUESTS:
        session = requests.Session()
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
        })
        return session
    else:
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))
        opener.addheaders = [('User-Agent', 'Mozilla/5.0')]
        urllib.request.install_opener(opener)
        return None

def fetch_judgment(session, judgment_id: str, retry=2) -> str:
    """Fetch full judgment text using the EXPORTFILE/reformat endpoint.

    This endpoint does NOT require session cookies (unlike data.aspx),
    making it reliable for batch downloading.
    """
    encoded_id = quote(judgment_id)
    # Use the "去格式引用" (plain text export) endpoint — no session needed!
    url = f"https://judgment.judicial.gov.tw/EXPORTFILE/reformat.aspx?type=JD&id={encoded_id}&lawpara=&ispdf=0"

    for attempt in range(retry + 1):
        try:
            if HAS_REQUESTS:
                resp = session.get(url, timeout=60)
                html = resp.text
            else:
                resp = urllib.request.urlopen(url, timeout=60)
                html = resp.read().decode('utf-8')

            # The reformat page has judgment text inside <div class="text-pre">
            # which is inside <span id="spanCon">
            # Structure: <span id="spanCon"><div class="row">metadata...</div>
            #            <div class="row"><div class="text-pre">JUDGMENT TEXT</div></div></span>

            # Strategy 1: Extract from <div class="text-pre">
            match = re.search(r'<div[^>]*class="text-pre"[^>]*>(.*?)</div>\s*</div>\s*</span>', html, re.DOTALL)
            if match:
                text = match.group(1)
                text = re.sub(r'<br\s*/?>', '\n', text)
                text = re.sub(r'<[^>]+>', '', text)
                text = re.sub(r'[ \t]+', ' ', text)
                text = re.sub(r'\n[ \t]+', '\n', text)
                text = re.sub(r'\n{3,}', '\n\n', text)
                text = text.strip()
                if len(text) > 50:
                    return text

            # Strategy 2: Extract from <span id="spanCon"> (broader fallback)
            match = re.search(r'<span[^>]*id="spanCon"[^>]*>(.*?)</span>', html, re.DOTALL)
            if match:
                text = match.group(1)
                text = re.sub(r'<br\s*/?>', '\n', text)
                text = re.sub(r'<[^>]+>', '', text)
                text = re.sub(r'[ \t]+', ' ', text)
                text = re.sub(r'\n[ \t]+', '\n', text)
                text = re.sub(r'\n{3,}', '\n\n', text)
                text = text.strip()
                if len(text) > 50:
                    return text

            return ''
        except Exception as e:
            if attempt < retry:
                print(f" (retry {attempt+1})", end='', flush=True)
                time.sleep(5)
            else:
                print(f" ERROR: {e}", end='', flush=True)
                return ''

def load_progress() -> dict:
    """Load download progress from checkpoint file."""
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_progress(progress: dict):
    """Save download progress checkpoint."""
    with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
        json.dump(progress, f, ensure_ascii=False)

def main():
    parser = argparse.ArgumentParser(description='Download judgment full texts')
    parser.add_argument('--start', type=int, default=0, help='Start index (0-based)')
    parser.add_argument('--limit', type=int, default=0, help='Max cases to download (0=all)')
    parser.add_argument('--delay', type=float, default=2.0, help='Delay between requests (seconds)')
    parser.add_argument('--all-docs', action='store_true', help='Include rulings (裁定), not just judgments (判決)')
    parser.add_argument('--force', action='store_true', help='Re-download all (ignore existing data)')
    args = parser.parse_args()

    # Load master data
    if not INPUT_JSON.exists():
        print(f"ERROR: {INPUT_JSON} not found.")
        print(f"Please ensure trade_secret_cases_master.json is in the same directory.")
        return

    with open(INPUT_JSON, 'r', encoding='utf-8') as f:
        all_cases = json.load(f)
    print(f"Loaded {len(all_cases)} cases from master JSON")

    # Filter to judgments only (unless --all-docs)
    if args.all_docs:
        cases = all_cases
        print(f"Processing ALL document types ({len(cases)} cases)")
    else:
        cases = [c for c in all_cases if c.get('docType') == '判決']
        print(f"Filtered to judgments (判決) only: {len(cases)} cases")

    # Re-sequence
    for i, c in enumerate(cases, 1):
        c['seq'] = i

    # Load existing full texts (resume support)
    existing_texts = {}
    if OUTPUT_JSON.exists() and not args.force:
        with open(OUTPUT_JSON, 'r', encoding='utf-8') as f:
            existing = json.load(f)
            for c in existing:
                jid = c.get('judgmentId', '')
                # Only keep existing texts that are substantial (>50 chars)
                # Skip bad data from previous failed extractions
                if jid and c.get('fullText') and len(c['fullText']) > 50:
                    existing_texts[jid] = c['fullText']
        print(f"Found {len(existing_texts)} existing full texts with >50 chars (will skip)")
    elif args.force:
        print("Force mode: re-downloading all cases")

    # Create session
    print("Initializing session with judicial website...")
    try:
        session = create_session()
        print("Session ready")
    except Exception as e:
        print(f"ERROR: Could not connect to judicial website: {e}")
        print("Please check your internet connection and try again.")
        return

    # Process cases
    start_idx = args.start
    end_idx = len(cases) if args.limit == 0 else min(start_idx + args.limit, len(cases))
    downloaded = 0
    skipped = 0
    errors = 0

    print(f"\nDownloading cases {start_idx+1} to {end_idx} of {len(cases)}...")
    print(f"Estimated time: {(end_idx - start_idx) * 15 / 60:.0f}-{(end_idx - start_idx) * 25 / 60:.0f} minutes")
    print(f"(Press Ctrl+C to stop — progress is saved every 10 cases)\n")

    try:
        for i in range(start_idx, end_idx):
            c = cases[i]
            jid = c.get('judgmentId', '')

            # Skip if already downloaded
            if jid in existing_texts:
                c['fullText'] = existing_texts[jid]
                c['charCount'] = len(c['fullText'])
                skipped += 1
                continue

            title_preview = c.get('title', '')[:50]
            print(f"[{i+1}/{end_idx}] {title_preview}...", end='', flush=True)
            text = fetch_judgment(session, jid)
            c['fullText'] = text
            c['charCount'] = len(text)

            if text:
                downloaded += 1
                print(f" OK ({len(text):,} chars)")
                existing_texts[jid] = text
            else:
                errors += 1
                print(f" EMPTY")

            # Save progress every 10 cases
            if (downloaded + errors) % 10 == 0 and (downloaded + errors) > 0:
                save_data = []
                for j in range(i + 1):
                    rec = dict(cases[j])
                    if rec.get('judgmentId') in existing_texts:
                        rec['fullText'] = existing_texts[rec['judgmentId']]
                        rec['charCount'] = len(rec['fullText'])
                    save_data.append(rec)
                with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
                    json.dump(save_data, f, ensure_ascii=False, indent=2)
                save_progress({'last_index': i, 'downloaded': downloaded, 'skipped': skipped, 'errors': errors})
                print(f"  [checkpoint: {downloaded} downloaded, {skipped} skipped, {errors} errors]")

            time.sleep(args.delay)

    except KeyboardInterrupt:
        print(f"\n\nInterrupted by user at index {i}.")
        print(f"To resume, run: python3 download_fulltext.py --start {i}")

    # Final save
    final_data = []
    for c in cases:
        rec = dict(c)
        jid = rec.get('judgmentId', '')
        if jid in existing_texts:
            rec['fullText'] = existing_texts[jid]
            rec['charCount'] = len(rec['fullText'])
        final_data.append(rec)

    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(final_data, f, ensure_ascii=False, indent=2)
    save_progress({
        'last_index': min(i if 'i' in dir() else end_idx - 1, len(cases) - 1),
        'downloaded': downloaded,
        'skipped': skipped,
        'errors': errors,
        'total_with_text': len(existing_texts),
        'completed': downloaded + skipped + errors >= end_idx - start_idx
    })

    file_size = os.path.getsize(OUTPUT_JSON) / (1024 * 1024)
    print(f"\n{'='*50}")
    print(f"Download Summary")
    print(f"{'='*50}")
    print(f"Downloaded:  {downloaded}")
    print(f"Skipped:     {skipped} (already had text)")
    print(f"Errors:      {errors}")
    print(f"Total w/text: {len(existing_texts)} / {len(cases)}")
    print(f"Output file: {OUTPUT_JSON} ({file_size:.1f} MB)")
    print(f"{'='*50}")

    if errors > 0:
        print(f"\nTip: Re-run the script to retry failed downloads.")
        print(f"Already-downloaded cases will be skipped automatically.")

if __name__ == '__main__':
    main()
