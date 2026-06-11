#!/usr/bin/env python3
"""
最高法院見解預索引腳本

針對 data/supreme_court_judgments_fulltext.json 之 74 筆裁判，
依 config/holdings_topics.json 定義之議題，用 keyword pattern 抓出
命中段落並抽 ±250 字 context snippet，
輸出 data/supreme_court_holdings_index.json 供前端 /holdings 頁面使用。

Usage:
    python3 scripts/build_holdings_index.py

擴充議題：
    編輯 config/holdings_topics.json（規則見該檔 _howToExtend 欄位），
    重跑本腳本即可；前端為 data-driven，無需改碼。

Design notes:
- 議題定義（含每個 pattern 之法條依據 ref）集中於 config，本腳本不含議題內容。
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
CONFIG_FILE = ROOT / "config" / "holdings_topics.json"
OUT_FILE = ROOT / "data" / "supreme_court_holdings_index.json"
PUBLIC_OUT = ROOT / "public" / "data" / "supreme_court_holdings_index.json"

SNIPPET_RADIUS = 250  # 命中位置前後各 250 字
MERGE_OVERLAP = 100   # 兩段 snippet 距離 < 100 字則合併

# 前端 ICON_MAP 已知之 icon 值；未知值前端 fallback 為 file（僅警告不報錯）
KNOWN_ICONS = {"lock", "shield", "coin", "calculator", "users", "scale", "key", "gavel", "file"}

# ─────────────────────────────────────────────────────────────────
# 議題定義：自 config/holdings_topics.json 載入（可擴充式）
# ─────────────────────────────────────────────────────────────────
def load_topics(config_file=CONFIG_FILE):
    """載入並驗證議題 config；違反規則即報錯退出。

    回傳之 topic dict 內 patterns 為字串 list（依 config 順序），
    並另附 patternRefs（term -> 法條依據）供輸出 metadata。
    """
    if not config_file.exists():
        print(f"ERROR: 議題設定檔不存在：{config_file}")
        sys.exit(1)
    cfg = json.loads(config_file.read_text(encoding="utf-8"))
    raw_topics = cfg.get("topics", [])
    if not raw_topics:
        print("ERROR: config 內無任何 topic")
        sys.exit(1)

    topics = []
    seen_ids = set()
    required = ("id", "name", "icon", "lawArticle", "description", "patterns")
    for i, t in enumerate(raw_topics):
        missing = [k for k in required if not t.get(k)]
        assert not missing, f"topic[{i}] 缺必填欄位：{missing}"
        assert t["id"] not in seen_ids, f"topic id 重複：{t['id']}"
        seen_ids.add(t["id"])
        if t["icon"] not in KNOWN_ICONS:
            print(f"WARN: topic '{t['id']}' icon '{t['icon']}' 非前端已知值，將 fallback 為 file")
        terms = []
        refs = {}
        seen_terms = set()
        for j, pat in enumerate(t["patterns"]):
            term = pat.get("term", "").strip()
            ref = pat.get("ref", "").strip()
            assert term, f"topic '{t['id']}' patterns[{j}] term 為空"
            assert ref, f"topic '{t['id']}' pattern「{term}」缺 ref（法條依據，守則§5）"
            assert term not in seen_terms, f"topic '{t['id']}' pattern 重複：{term}"
            seen_terms.add(term)
            terms.append(term)
            refs[term] = ref
        topics.append({
            "id": t["id"],
            "name": t["name"],
            "icon": t["icon"],
            "lawArticle": t["lawArticle"],
            "description": t["description"],
            "patterns": terms,
            "patternRefs": refs,
        })
    print(f"Loaded {len(topics)} topics from {config_file.name}: {[t['id'] for t in topics]}")
    return cfg.get("configVersion", "?"), topics


CONFIG_VERSION, TOPICS = load_topics()


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
            "matchedTerms": sorted(set(h[1] for h in r["hits"])),  # sorted 確保重跑產出 deterministic
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
        "version": "1.1",
        "configVersion": CONFIG_VERSION,
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
                "patternRefs": t["patternRefs"],
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
