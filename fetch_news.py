#!/usr/bin/env python3
"""
抓取台灣營業秘密案件相關新聞，輸出 news.json 供儀表板使用。

資料來源：Google News RSS
  https://news.google.com/rss/search?q=<關鍵字>&hl=zh-TW&gl=TW&ceid=TW:zh-Hant&when=7d

Google News 的 pubDate 對舊文重新索引時可能不可靠（例如：2014 年的文章被
Yahoo/Line Today 重新 promote 後，Google News 會報告最近的時間戳，造成
「舊新聞混進今日快訊」）。

為了確保只輸出真正近期的新聞，本腳本做了三層把關：
  1. Google News RSS 加上 when=7d，限制「最近 7 天」
  2. 解析每則新聞的 Google News 重定向 → 實際文章 URL
  3. 從實際 URL 路徑（如 /2014/06/11/）或文章 HTML meta tag（article:published_time
     等）抓出「真實發布日期」，丟掉超過 MAX_AGE_DAYS 的舊文

輸出：news.json（list of dicts，欄位 title/source/published/url/realUrl/realDate/snippet）

Usage:
    python3 fetch_news.py
"""

from __future__ import annotations

import concurrent.futures
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
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
REQUEST_TIMEOUT = 12
MAX_AGE_DAYS = 90         # 真實發布日期超過這天數 → 丟棄
MAX_WORKERS = 8           # 並行解析 URL 的 thread 數
RECENT_WHEN = "7d"        # Google News 時間過濾器
STRICT_MODE = True        # True：解不到真實日期就丟棄（避免 RSS pubDate 造假造成誤留）

# 標題/內容出現以下關鍵字（且年份 <= 2020）就直接丟 —
# 用來擋掉 Google News 重新 promote 的 10+ 年老新聞（如袁帝文 2014 案）
# 格式：(必須同時出現的所有關鍵字,) → 丟棄
TITLE_BLOCKLIST = [
    ("袁帝文",),               # 2014 聯發科挖角案
    ("聯發科", "挖角", "2014"),  # 同案另一種下標
]


def build_rss_url(query):
    q = urllib.parse.quote(query)
    return (
        "https://news.google.com/rss/search"
        f"?q={q}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant&when={RECENT_WHEN}"
    )


def fetch(url, timeout=REQUEST_TIMEOUT):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


def strip_html(s):
    s = re.sub(r"<[^>]+>", " ", s or "")
    s = re.sub(r"&nbsp;", " ", s)
    s = re.sub(r"&amp;", "&", s)
    s = re.sub(r"&lt;", "<", s)
    s = re.sub(r"&gt;", ">", s)
    s = re.sub(r"&quot;", '"', s)
    s = re.sub(r"&#39;", "'", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def parse_rss(xml_text):
    items = []
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


def dedupe(items):
    seen = set()
    out = []
    for it in items:
        key = (it.get("title") or "").strip()
        if not key:
            continue
        norm = re.sub(r"\s+-\s+[^-]+$", "", key)
        if norm in seen:
            continue
        seen.add(norm)
        out.append(it)
    return out


# ─────────────────────────────────────────────────────────
# URL 解析 & 真實發布日期
# ─────────────────────────────────────────────────────────

DATE_URL_PATTERNS = [
    # /yyyy/mm/dd/
    re.compile(r"/(\d{4})/(\d{1,2})/(\d{1,2})(?:/|[-_.])"),
    # /yyyymmdd（不接著更多數字）
    re.compile(r"/(\d{4})(\d{2})(\d{2})(?:[/\-._]|$|\?)"),
]


def extract_date_from_url(url):
    """從 URL path 找日期（yyyymmdd 或 yyyy/mm/dd 格式）"""
    for pattern in DATE_URL_PATTERNS:
        m = pattern.search(url)
        if m:
            try:
                y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
                if 2000 <= y <= 2030 and 1 <= mo <= 12 and 1 <= d <= 31:
                    return datetime(y, mo, d, tzinfo=timezone.utc)
            except ValueError:
                pass
    return None


# 從 Google News HTML 中抓實際文章 URL 的 regex（多種備案）
RESOLVE_PATTERNS = [
    re.compile(r'data-n-au="(https?://[^"]+)"'),
    re.compile(r'jsname="tljFtd"[^>]+href="(https?://[^"]+)"'),
    re.compile(r'<a[^>]+class="[^"]*"[^>]+href="(https?://(?!news\.google\.com)[^"]+)"'),
    re.compile(r"URL=([^\"'>]+)"),  # meta refresh
]

EXTERNAL_URL_RE = re.compile(
    r'"(https?://(?!(?:news|www|translate|accounts|policies|support|mail|lens|gstatic)\.google\.com)[^"\']+)"'
)


def resolve_google_news_url(google_url, timeout=REQUEST_TIMEOUT):
    """解析 Google News 重定向，取得實際文章 URL。失敗回傳 None。"""
    try:
        req = urllib.request.Request(google_url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            final = resp.geturl()
            if "news.google.com" not in final:
                return final
            html = resp.read(500_000).decode("utf-8", errors="replace")
    except Exception:
        return None

    for pattern in RESOLVE_PATTERNS:
        m = pattern.search(html)
        if m:
            url = m.group(1).strip()
            if "google.com" not in url:
                return url

    m = EXTERNAL_URL_RE.search(html)
    if m:
        return m.group(1).strip()
    return None


META_DATE_PATTERNS = [
    re.compile(r'<meta[^>]+property=["\']article:published_time["\'][^>]+content=["\']([^"\']+)["\']', re.I),
    re.compile(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']article:published_time["\']', re.I),
    re.compile(r'<meta[^>]+name=["\']pubdate["\'][^>]+content=["\']([^"\']+)["\']', re.I),
    re.compile(r'<meta[^>]+itemprop=["\']datePublished["\'][^>]+content=["\']([^"\']+)["\']', re.I),
    re.compile(r'<meta[^>]+name=["\']article:published_time["\'][^>]+content=["\']([^"\']+)["\']', re.I),
    re.compile(r'<time[^>]+datetime=["\']([^"\']+)["\']', re.I),
]


def parse_iso_date(s):
    """寬鬆解析 ISO 8601 / RFC 日期字串"""
    if not s:
        return None
    s = s.strip()
    # 常見變體
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        pass
    # 像 "2014-06-11 14:30:00" 或 "2014/06/11"
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y/%m/%d", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(s[:len(fmt) + 0], fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    # RFC 2822
    try:
        dt = parsedate_to_datetime(s)
        if dt and dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        pass
    return None


def fetch_article_date(article_url, timeout=REQUEST_TIMEOUT):
    """抓實際文章頁，從 <meta> / <time> 取得發布時間"""
    try:
        req = urllib.request.Request(article_url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            html = resp.read(300_000).decode("utf-8", errors="replace")
    except Exception:
        return None

    for p in META_DATE_PATTERNS:
        m = p.search(html)
        if m:
            dt = parse_iso_date(m.group(1))
            if dt is not None:
                return dt
    return None


def determine_item_date(item):
    """回傳 (real_datetime_or_None, real_url_or_None)"""
    url = item.get("url") or ""
    if not url:
        return None, None

    real_url = resolve_google_news_url(url)
    if not real_url:
        return None, None

    # 1. URL path 上的日期（/2014/06/11/ 或 /20140611）
    d = extract_date_from_url(real_url)
    if d is not None:
        return d, real_url

    # 2. 文章 HTML meta tag
    d = fetch_article_date(real_url)
    return d, real_url


def matches_blocklist(title):
    """標題命中 TITLE_BLOCKLIST 任一組合（全部關鍵字都出現）就回 True"""
    if not title:
        return False
    t = title
    for combo in TITLE_BLOCKLIST:
        if all(kw in t for kw in combo):
            return ", ".join(combo)
    return False


def filter_and_enrich(items):
    """並行解析每個項目的真實發布時間，過濾掉超過 MAX_AGE_DAYS 的舊文"""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=MAX_AGE_DAYS)

    def worker(item):
        # 1. 標題黑名單（最便宜，先檢查）
        hit = matches_blocklist(item.get("title", ""))
        if hit:
            return item, {"keep": False, "reason": f"blocklist ({hit})"}

        # 2. 解析真實 URL + 真實日期
        try:
            real_date, real_url = determine_item_date(item)
        except Exception as e:
            real_date, real_url = None, None

        if real_url:
            item["realUrl"] = real_url

        if real_date is not None:
            item["realDate"] = real_date.isoformat()
            if real_date >= cutoff:
                return item, {"keep": True, "reason": f"real-date-ok ({real_date.date()})"}
            else:
                return item, {"keep": False, "reason": f"real-date-old ({real_date.date()})"}

        # 3. 解不到真實日期
        if STRICT_MODE:
            # 嚴格模式：直接丟，不信 RSS pubDate（因為 Google News 會造假）
            reason = "no-real-date (strict)"
            if not real_url:
                reason = "no-real-url"
            return item, {"keep": False, "reason": reason}

        # Fallback（STRICT_MODE=False）：用 RSS pubDate
        pub = item.get("published", "")
        dt = parse_iso_date(pub) if pub else None
        if dt is not None:
            if dt >= cutoff:
                return item, {"keep": True, "reason": f"rss-date-ok ({dt.date()})"}
            else:
                return item, {"keep": False, "reason": f"rss-date-old ({dt.date()})"}
        return item, {"keep": False, "reason": "no-date-info"}

    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        for item, decision in ex.map(worker, items):
            results.append((item, decision))

    kept = [it for it, dec in results if dec["keep"]]
    dropped = [(it, dec) for it, dec in results if not dec["keep"]]

    print(f"  kept {len(kept)}, dropped {len(dropped)}  (strict={STRICT_MODE})")

    if dropped:
        print(f"  --- dropped items ---")
        for it, dec in dropped:
            t = (it.get("title") or "")[:70]
            print(f"    [x {dec['reason']}] {t}")

    if kept:
        print(f"  --- kept items ---")
        for it in kept[:15]:
            t = (it.get("title") or "")[:70]
            rd = it.get("realDate", "")[:10] if it.get("realDate") else "(no-real-date)"
            print(f"    [✓ {rd}] {t}")

    return kept


def sort_by_real_date(items):
    def keyfn(it):
        return it.get("realDate") or it.get("published") or ""
    return sorted(items, key=keyfn, reverse=True)


def main():
    all_items = []
    for q in QUERIES:
        url = build_rss_url(q)
        print(f"fetch: {q}  (when={RECENT_WHEN})")
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

    print(f"resolving real URLs + filtering (max age {MAX_AGE_DAYS} days, workers={MAX_WORKERS})...")
    all_items = filter_and_enrich(all_items)
    print(f"after filter: {len(all_items)}")

    all_items = sort_by_real_date(all_items)[:MAX_ITEMS]

    output = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "count": len(all_items),
        "maxAgeDays": MAX_AGE_DAYS,
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
