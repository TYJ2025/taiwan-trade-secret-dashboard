#!/usr/bin/env python3
"""
最高法院見解預索引腳本

針對 data/supreme_court_judgments_fulltext.json 之 74 筆裁判，
以營業秘密法 §2 三要件為議題，用 keyword pattern 抓出命中段落並抽 ±250 字
context snippet，輸出 data/supreme_court_holdings_index.json
供前端 /holdings 頁面使用。

Usage:
    python3 scripts/build_holdings_index.py

Design notes:
- 每個議題定義 6-10 個 keyword pattern（含正式法律用語 + 實務常見變體）。
- snippet 為 ±SNIPPET_RADIUS（預設 250 字）；overlap 之命中段落合併避免重複。
- 索引不做「是否真正屬於該要件之論述」之判斷；可能 false positive（例：
  「保密措施」可能命中秘密保持命令之程序段落）。前端 UI 應提示使用者複核。
"""
import json
import re
import sys
import os
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).parent.parent
FULLTEXT_FILE = ROOT / "data" / "supreme_court_judgments_fulltext.json"
OUT_FILE = ROOT / "data" / "supreme_court_holdings_index.json"
PUBLIC_OUT = ROOT / "public" / "data" / "supreme_court_holdings_index.json"

SNIPPET_RADIUS = 250  # 命中位置前後各 250 字
MERGE_OVERLAP = 100   # 兩段 snippet 距離 < 100 字則合併

# ─────────────────────────────────────────────────────────────────
# 議題定義（先做營業秘密法§2 三要件）
# ─────────────────────────────────────────────────────────────────
TOPICS = [
    {
        "id": "secrecy",
        "name": "秘密性",
        "icon": "lock",
        "lawArticle": "營業秘密法 §2(1)",
        "description": "非一般涉及該類資訊之人所知者",
        "patterns": [
            "非一般涉及該類資訊之人所知",
            "並非一般涉及該類資訊之人所知",
            "為一般涉及該類資訊之人所知",
            "一般涉及該類資訊之人所知",
            "不為公眾所知悉",
            "公眾所知悉",
            "一般大眾所知悉",
            "可由公開資訊取得",
            "由公開資料取得",
            "秘密性要件",
            # 較寬鬆變體（最後加）
            "秘密性",
        ],
    },
    {
        "id": "reasonable_measures",
        "name": "合理保密措施",
        "icon": "shield",
        "lawArticle": "營業秘密法 §2(3)",
        "description": "所有人已採取合理之保密措施者",
        "patterns": [
            "合理之保密措施",
            "合理保密措施",
            "相當之保密措施",
            "相當保密措施",
            "採取合理保密",
            "已採取保密措施",
            "未採取保密措施",
            "未盡合理保密措施",
            "採取保密措施",
            "保密措施之要件",
            # 較寬鬆變體
            "保密措施",
            "保密義務之約定",
            "保密協議",
        ],
    },
    {
        "id": "economic_value",
        "name": "經濟價值性",
        "icon": "coin",
        "lawArticle": "營業秘密法 §2(2)",
        "description": "因其秘密性而具有實際或潛在之經濟價值者",
        "patterns": [
            "實際或潛在之經濟價值",
            "因其秘密性而具有實際或潛在之經濟價值",
            "實際或潛在價值",
            "潛在之經濟價值",
            "經濟價值要件",
            "商業價值",
            # 較寬鬆變體
            "經濟價值",
        ],
    },
]


def find_all_matches(text, patterns):
    """對 text 跑所有 pattern，回傳 [(position, matched_str), ...] sorted by position。"""
    hits = []
    seen_positions = set()
    for p in patterns:
        start = 0
        while True:
            pos = text.find(p, start)
            if pos == -1:
                break
            # 避免同一位置被不同 pattern 重複計算
            if pos not in seen_positions:
                hits.append((pos, p))
                seen_positions.add(pos)
            start = pos + 1
    hits.sort(key=lambda x: x[0])
    return hits


def extract_snippets(text, hits, radius=SNIPPET_RADIUS, merge_overlap=MERGE_OVERLAP):
    """從命中位置抽 ±radius 字 snippet，距離 < merge_overlap 的合併。"""
    if not hits:
        return []
    # 先計算每個 hit 的 [start, end] 範圍
    ranges = []
    for pos, matched in hits:
        s = max(0, pos - radius)
        e = min(len(text), pos + len(matched) + radius)
        ranges.append({"start": s, "end": e, "hits": [(pos, matched)]})
    # 合併距離 < merge_overlap 的範圍
    merged = [ranges[0]]
    for r in ranges[1:]:
        last = merged[-1]
        if r["start"] - last["end"] < merge_overlap:
            last["end"] = max(last["end"], r["end"])
            last["hits"].extend(r["hits"])
        else:
            merged.append(r)
    # 產出 snippet
    snippets = []
    for r in merged:
        snippet_text = text[r["start"]:r["end"]]
        # 清掉多餘 whitespace
        snippet_text = re.sub(r"\s+", " ", snippet_text).strip()
        snippets.append({
            "start": r["start"],
            "end": r["end"],
            "text": snippet_text,
            "matchedTerms": list(set(h[1] for h in r["hits"])),
            "hitCount": len(r["hits"]),
        })
    return snippets


def main():
    if not FULLTEXT_FILE.exists():
        print(f"ERROR: {FULLTEXT_FILE} not found")
        sys.exit(1)

    sc_data = json.loads(FULLTEXT_FILE.read_text(encoding="utf-8"))
    print(f"Loaded {len(sc_data)} SC judgments")

    cases = {}
    topic_case_counts = {t["id"]: 0 for t in TOPICS}
    topic_hit_counts = {t["id"]: 0 for t in TOPICS}

    for sc in sc_data:
        jid = sc["jid"]
        text = sc.get("fullText", "")
        if not text:
            continue

        topic_hits = {}
        any_hit = False
        for topic in TOPICS:
            hits = find_all_matches(text, topic["patterns"])
            if not hits:
                continue
            snippets = extract_snippets(text, hits)
            topic_hits[topic["id"]] = {
                "hitCount": len(hits),
                "snippetCount": len(snippets),
                "snippets": snippets,
            }
            topic_case_counts[topic["id"]] += 1
            topic_hit_counts[topic["id"]] += len(hits)
            any_hit = True

        if any_hit:
            cases[jid] = {
                "title": sc.get("title", ""),
                "adDate": sc.get("adDate", ""),
                "caseType": "刑事" if "刑事" in sc.get("title", "") else "民事",
                "docType": "判決" if sc.get("title", "").endswith("判決") else "裁定",
                "reason": sc.get("reason", ""),
                "charCount": sc.get("charCount", len(text)),
                "topicHits": topic_hits,
            }

    out = {
        "version": "1.0",
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "sourceFile": FULLTEXT_FILE.name,
        "snippetRadius": SNIPPET_RADIUS,
        "topics": [
            {
                "id": t["id"],
                "name": t["name"],
                "icon": t["icon"],
                "lawArticle": t["lawArticle"],
                "description": t["description"],
                "patterns": t["patterns"],
            }
            for t in TOPICS
        ],
        "cases": cases,
        "stats": {
            "totalSC": len(sc_data),
            "casesWithAnyHit": len(cases),
            "topicCaseCounts": topic_case_counts,
            "topicHitCounts": topic_hit_counts,
        },
    }

    OUT_FILE.write_text(
        json.dumps(out, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    PUBLIC_OUT.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_OUT.write_text(
        json.dumps(out, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )

    print(f"\n{'='*56}")
    print(f"Index generated: {OUT_FILE}")
    print(f"  Size: {os.path.getsize(OUT_FILE):,} bytes")
    print(f"\nTopic case counts (out of {len(sc_data)}):")
    for t in TOPICS:
        cnt = topic_case_counts[t["id"]]
        hits = topic_hit_counts[t["id"]]
        print(f"  {t['name']:>16s} ({t['lawArticle']:>20s}): {cnt:>3d} cases, {hits:>4d} hits")
    print(f"\nCases with ≥1 topic hit: {len(cases)} / {len(sc_data)}")
    print(f"{'='*56}")


if __name__ == "__main__":
    main()
