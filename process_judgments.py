#!/usr/bin/env python3
"""
台灣營業秘密裁判書資料處理腳本
Process trade secret case metadata from Judicial Yuan search results.

Usage:
    python3 process_judgments.py

Reads batch1 + batch2 JSON from ~/Downloads/, merges, deduplicates,
parses structured fields, and outputs final JSON + CSV to this directory.
"""

import json
import csv
import re
import os
from pathlib import Path
from urllib.parse import unquote

# === Configuration ===
DOWNLOADS_DIR = Path.home() / "Downloads"
OUTPUT_DIR = Path(__file__).parent
BATCH_FILES = [
    DOWNLOADS_DIR / "trade_secret_cases_batch1.json",
    DOWNLOADS_DIR / "trade_secret_cases_batch2_ipc_older.json",
]
OUTPUT_JSON = OUTPUT_DIR / "trade_secret_cases_master.json"
OUTPUT_CSV = OUTPUT_DIR / "trade_secret_cases_master.csv"

# === Helper Functions ===

def extract_judgment_id(href: str) -> str:
    """Extract judgment ID from href like data.aspx?ty=JD&id=TPSM%2c114%2c...&ot=in"""
    match = re.search(r'id=([^&]+)', href)
    if match:
        return unquote(match.group(1))
    return ''

def parse_title(title: str) -> dict:
    """Parse structured fields from case title."""
    result = {
        'court': '',
        'rocYear': 0,
        'adYear': 0,
        'caseWord': '',
        'caseNum': 0,
        'caseType': '其他',
        'docType': '其他',
    }

    # Court name (everything before the year number)
    court_match = re.match(r'^(.+?)\s*\d{2,3}\s*年', title)
    if court_match:
        result['court'] = court_match.group(1).strip()

    # ROC year
    year_match = re.search(r'(\d{2,3})\s*年度?\s', title)
    if year_match:
        result['rocYear'] = int(year_match.group(1))
        result['adYear'] = result['rocYear'] + 1911

    # Case word (字別)
    word_match = re.search(r'年度?\s+(.+?)\s*字第?\s', title)
    if word_match:
        result['caseWord'] = word_match.group(1).strip()

    # Case number
    num_match = re.search(r'字第?\s*(\d+)\s*號', title)
    if num_match:
        result['caseNum'] = int(num_match.group(1))

    # Case type
    if '刑事' in title or '刑營' in title or '刑智' in title or '刑' in result['caseWord']:
        result['caseType'] = '刑事'
    elif '民事' in title or '民營' in title or '民' in result['caseWord']:
        result['caseType'] = '民事'
    elif '行政' in title:
        result['caseType'] = '行政'

    # Document type
    if '判決' in title:
        result['docType'] = '判決'
    elif '裁定' in title:
        result['docType'] = '裁定'

    return result

def roc_to_ad_date(roc_date: str) -> str:
    """Convert ROC date (e.g., '109.12.30') to AD date ('2020-12-30')."""
    parts = roc_date.split('.')
    if len(parts) == 3:
        try:
            roc_y = int(parts[0])
            return f"{roc_y + 1911}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"
        except ValueError:
            pass
    return ''

def build_judgment_url(judgment_id: str) -> str:
    """Build a direct URL to the judgment on the Judicial Yuan website."""
    if judgment_id:
        from urllib.parse import quote
        encoded_id = quote(judgment_id)
        return f"https://judgment.judicial.gov.tw/FJUD/data.aspx?ty=JD&id={encoded_id}"
    return ''

# === Main Processing ===

def main():
    # 1. Load all batch files
    all_cases = []
    for batch_file in BATCH_FILES:
        if batch_file.exists():
            with open(batch_file, 'r', encoding='utf-8') as f:
                cases = json.load(f)
                print(f"Loaded {len(cases)} cases from {batch_file.name}")
                all_cases.extend(cases)
        else:
            print(f"WARNING: {batch_file.name} not found, skipping")

    print(f"Total loaded: {len(all_cases)}")

    # 2. Deduplicate by href
    seen_hrefs = set()
    unique_cases = []
    for c in all_cases:
        href = c.get('href', '')
        if href and href not in seen_hrefs:
            seen_hrefs.add(href)
            unique_cases.append(c)
        elif not href:
            unique_cases.append(c)

    print(f"After deduplication: {len(unique_cases)} unique cases")

    # 3. Parse structured fields
    final_data = []
    for idx, c in enumerate(unique_cases, 1):
        parsed = parse_title(c.get('title', ''))
        judgment_id = extract_judgment_id(c.get('href', ''))
        roc_date = c.get('date', '')
        ad_date = roc_to_ad_date(roc_date)

        record = {
            'seq': idx,
            'court': parsed['court'],
            'courtCode': c.get('courtCode', ''),
            'title': c.get('title', ''),
            'caseId': f"{parsed['court']} {parsed['rocYear']} 年度 {parsed['caseWord']} 字第 {parsed['caseNum']} 號",
            'rocYear': parsed['rocYear'],
            'adYear': parsed['adYear'],
            'caseWord': parsed['caseWord'],
            'caseNum': parsed['caseNum'],
            'caseType': parsed['caseType'],
            'docType': parsed['docType'],
            'rocDate': roc_date,
            'adDate': ad_date,
            'reason': c.get('reason', ''),
            'size': c.get('size', ''),
            'judgmentId': judgment_id,
            'judgmentUrl': build_judgment_url(judgment_id),
        }
        final_data.append(record)

    # 4. Sort by date (newest first)
    final_data.sort(key=lambda x: x['adDate'], reverse=True)
    for idx, r in enumerate(final_data, 1):
        r['seq'] = idx

    # 5. Print statistics
    print(f"\n=== Statistics ===")
    print(f"Total cases: {len(final_data)}")

    type_counts = {}
    for r in final_data:
        t = r['caseType']
        type_counts[t] = type_counts.get(t, 0) + 1
    print(f"Case types: {type_counts}")

    doc_counts = {}
    for r in final_data:
        d = r['docType']
        doc_counts[d] = doc_counts.get(d, 0) + 1
    print(f"Document types: {doc_counts}")

    court_counts = {}
    for r in final_data:
        c = r['courtCode']
        court_counts[c] = court_counts.get(c, 0) + 1
    top_courts = sorted(court_counts.items(), key=lambda x: -x[1])[:10]
    print(f"Top courts: {top_courts}")

    year_counts = {}
    for r in final_data:
        y = r['adYear']
        if y:
            year_counts[y] = year_counts.get(y, 0) + 1
    year_range = sorted(year_counts.keys())
    print(f"Year range: {year_range[0]} - {year_range[-1]}")
    print(f"Cases per year: {dict(sorted(year_counts.items()))}")

    # 6. Save JSON
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(final_data, f, ensure_ascii=False, indent=2)
    print(f"\nSaved JSON: {OUTPUT_JSON} ({os.path.getsize(OUTPUT_JSON) / 1024:.0f} KB)")

    # 7. Save CSV (with BOM for Excel)
    csv_fields = [
        'seq', 'court', 'courtCode', 'title', 'caseId',
        'rocYear', 'adYear', 'caseWord', 'caseNum',
        'caseType', 'docType', 'rocDate', 'adDate',
        'reason', 'size', 'judgmentId', 'judgmentUrl'
    ]
    with open(OUTPUT_CSV, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=csv_fields)
        writer.writeheader()
        for r in final_data:
            writer.writerow({k: r.get(k, '') for k in csv_fields})
    print(f"Saved CSV: {OUTPUT_CSV} ({os.path.getsize(OUTPUT_CSV) / 1024:.0f} KB)")

if __name__ == '__main__':
    main()
