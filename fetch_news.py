#!/usr/bin/env python3
"""
抓取台灣營業秘密案件相關新聞，輸出 news.json 供儀表板使用。

資料來源：
  - Google News RSS（優先，免 API key）
    https://news.google.com/rss/search?q=<關鍵字>&hl=zh-TW&gl=TW&ceid=TW:zh-Hant

多組關鍵字依序抓取後合併去重，按發布時間由新到舊排序，保留最近 50 則。

輸出：news.json（list of dicts，欄位 title/source/published/url/snippet）

Usage:
    python3 fetch_news.py
"""

from __future__ import annotations

import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from xml.etree import ElementTree as ET

SCRIPT_DIR = Path(__file__).resolve().parent
OUTPUT_JSON = SCRIPT_DIR / "news.json"

# 多組關鍵字：聚焦營業秘密 + 相關語境
QUERIES = [
    "營業秘密",
    "營業秘密法",
    "營業秘密 起訴",
    "營業秘密 判決",
    "營業秘密 台積電",
    "營業秘密 離職",
    "還原工程 營業秘密",
    "trade secret Taiwan",
]

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

MAX_ITEMS = 50
REQUEST_TIMEOUT = 20


def build_rss_url(query: str) -> str:
    q = urllib.parse.quote(query)
    return f"https://news.google.com/rss/search?q={q}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant"


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
        return resp.read().decode("utf-8", errors="replace")


def strip_html(s: str) -> str:
    s = re.sub(r"<[^>]+>", " ", s or "")
    s = re.sub(r"&nbsp;", " ", s)
    s = re.sub(r"&amp;", "&", s)
    s = re.sub(r"&lt;", "<", s)
    s = re.sub(r"&gt;", ">", s)
    s = re.sub(r"&quot;", '"', s)
    s = re.sub(r"&#39;", "'", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def parse_rss(xml_text: str) -> list[dict]:
    items: list[dict] = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        print(f"  parse error: {e}", file=sys.stderr)
        return items

    for item in root.iter("item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub_date = (item.findtext("pubDate") or "").strip()
        source_el = item.find("source")
        source = (source_el.text if source_el is not None else "") or ""
        description = (item.findtext("description") or "").strip()

        try:
            dt = parsedate_to_datetime(pub_date) if pub_date else None
            if dt and dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            iso = dt.isoformat() if dt else ""
        except Exception:
            iso = ""

        items.append({
            "title": title,
            "source": source.strip(),
            "published": iso,
            "pubDateRaw": pub_date,
            "url": link,
            "snippet": strip_html(description)[:220],
        })
    return items


def dedupe(items: list[dict]) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for it in items:
        key = (it.get("title") or "").strip()
        if not key:
            continue
        # normalize title — 去除來源尾綴 " - 聯合報"
        norm = re.sub(r"\s+-\s+[^-]+$", "", key)
        if norm in seen:
            continue
        seen.add(norm)
        out.append(it)
    return out


def sort_by_published(items: list[dict]) -> list[dict]:
    def keyfn(it: dict):
        p = it.get("published") or ""
        return p
    return sorted(items, key=keyfn, reverse=True)


def main() -> int:
    all_items: list[dict] = []
    for q in QUERIES:
        url = build_rss_url(q)
        print(f"fetch: {q}")
        try:
            xml = fetch(url)
            items = parse_rss(xml)
            print(f"  got {len(items)} items")
            all_items.extend(items)
        except Exception as e:
            print(f"  failed: {e}", file=sys.stderr)
        time.sleep(0.5)

    before = len(all_items)
    all_items = dedupe(all_items)
    print(f"dedup: {before} -> {len(all_items)}")

    all_items = sort_by_published(all_items)[:MAX_ITEMS]

    output = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "count": len(all_items),
        "items": all_items,
    }

    OUTPUT_JSON.write_text(
        json.dumps(output, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"wrote {OUTPUT_JSON} ({len(all_items)} items)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
