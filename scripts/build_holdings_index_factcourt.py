#!/usr/bin/env python3
"""
事實審（智慧財產法院）見解預索引腳本

本腳本與 build_holdings_index.py 平行，差異僅在資料源與輸出檔：
- 來源：data/judgments.json（492 筆 metadata）join data/judgments_fulltext.json（seq→fullText），
  篩選法院為「智慧財產及商業法院」或「智慧財產法院」之 243 筆。
- 議題定義沿用同一份 config/holdings_topics.json（與 SC 索引完全一致，確保跨法院可比對）。
- snippet 抽取邏輯（find_all_matches / extract_snippets）與 SC 腳本相同；此處 import 重用，
  不重複維護，避免兩份邏輯漂移。
- 輸出：data/factcourt_holdings_index.json + public/data/ 同名；前端與 SC 索引於載入時合併。

**不覆寫** data/supreme_court_holdings_index.json（該檔由每週 weekly_sc_renewal/scrape 流程維護）。

Usage:
    python3 scripts/build_holdings_index_factcourt.py

設計備註：
- 每案附 court 欄位（智慧財產及商業法院／智慧財產法院），供前端「法院」篩選器。
- jid 採 metadata 之 judgmentId（與 SC 之 jid 同為 FJUD id 格式，getJudicialUrl 可共用）。
- docType 由 fulltext title 結尾判斷（判決／裁定）；caseType 取 metadata 之 caseType（民事／刑事）。
- 索引不判斷「是否真正屬該要件之論述」，可能 false positive；前端 UI 已提示複核。
"""
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# 重用 SC 腳本之 config 載入、pattern 比對、snippet 抽取邏輯（單一事實來源）
import importlib.util

ROOT = Path(__file__).parent.parent
_sc_path = ROOT / "scripts" / "build_holdings_index.py"
_spec = importlib.util.spec_from_file_location("build_holdings_index", _sc_path)
_sc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_sc)  # 載入時即執行 load_topics()，TOPICS/PROC_MARKERS 已備妥

TOPICS = _sc.TOPICS
PROC_MARKERS = _sc.PROC_MARKERS
PROC_MARKER_REFS = _sc.PROC_MARKER_REFS
CONFIG_VERSION = _sc.CONFIG_VERSION
find_all_matches = _sc.find_all_matches
extract_snippets = _sc.extract_snippets
SNIPPET_RADIUS = _sc.SNIPPET_RADIUS

META_FILE = ROOT / "data" / "judgments.json"
FULLTEXT_FILE = ROOT / "data" / "judgments_fulltext.json"
OUT_FILE = ROOT / "data" / "factcourt_holdings_index.json"
PUBLIC_OUT = ROOT / "public" / "data" / "factcourt_holdings_index.json"

# 智財法院（含改制前後）；地院／高院於本次範圍外（YJ 2026-06-22 指示：加智財法院 243 筆）
IP_COURTS = {"智慧財產及商業法院", "智慧財產法院"}


def doc_type_from_title(title: str) -> str:
    if title.endswith("判決"):
        return "判決"
    if title.endswith("裁定"):
        return "裁定"
    # fallback：標題含「裁定」者為裁定，餘視為判決
    return "裁定" if "裁定" in title else "判決"


def main():
    for f in (META_FILE, FULLTEXT_FILE):
        if not f.exists():
            print(f"ERROR: {f} not found")
            sys.exit(1)

    meta_raw = json.loads(META_FILE.read_text(encoding="utf-8"))
    judgments = meta_raw.get("judgments", [])
    fulltext = json.loads(FULLTEXT_FILE.read_text(encoding="utf-8"))

    # seq → fullText（含 title 備援）
    ft_by_seq = {}
    for ft in fulltext:
        ft_by_seq[ft.get("seq")] = ft

    # sanity：seq 對齊
    aligned = sum(1 for j in judgments if j.get("seq") in ft_by_seq)
    print(f"Loaded meta={len(judgments)}, fulltext={len(fulltext)}, seq aligned={aligned}/{len(judgments)}")
    assert aligned == len(judgments), "metadata 與 fulltext 之 seq 未完全對齊，請先檢查資料"

    ip_judgments = [j for j in judgments if j.get("court") in IP_COURTS]
    print(f"IP-court judgments (智商+智財): {len(ip_judgments)}")
    assert len(ip_judgments) == 243, f"預期智財法院 243 筆，實得 {len(ip_judgments)}（資料異動請更新 assert 並於 log 說明）"

    cases = {}
    court_counts = {}
    topic_case_counts = {t["id"]: 0 for t in TOPICS}
    topic_hit_counts = {t["id"]: 0 for t in TOPICS}
    skipped_no_text = 0

    for j in ip_judgments:
        ft = ft_by_seq.get(j["seq"], {})
        text = ft.get("fullText", "")
        if not text:
            skipped_no_text += 1
            continue
        jid = j.get("judgmentId")
        if not jid:
            # 無 jid 之案件跳過（無法生司法院連結，避免產出無法回溯之條目）
            continue
        title = ft.get("title") or j.get("title") or j.get("caseId", "")

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
            proc_hits = sorted(m for m in PROC_MARKERS if m in text)
            court = j.get("court", "")
            court_counts[court] = court_counts.get(court, 0) + 1
            cases[jid] = {
                "title": title,
                "court": court,
                "adDate": j.get("adDate", ""),
                "caseType": j.get("caseType", ""),
                "docType": doc_type_from_title(title),
                "reason": j.get("reason", ""),
                "charCount": j.get("charCount", len(text)),
                "judgmentUrl": j.get("judgmentUrl", ""),
                "proceduralHits": proc_hits,
                "topicHits": topic_hits,
            }

    out = {
        "version": "1.0",
        "configVersion": CONFIG_VERSION,
        "scope": "factcourt",
        "courts": sorted(IP_COURTS),
        "proceduralMarkers": [
            {"term": m, "ref": PROC_MARKER_REFS[m]} for m in PROC_MARKERS
        ],
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "sourceFiles": [META_FILE.name, FULLTEXT_FILE.name],
        "snippetRadius": SNIPPET_RADIUS,
        # topics 與 SC 索引一致；前端合併時以 SC 索引之 topics 為主，此處保留供獨立檢視
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
            "totalScope": len(ip_judgments),
            "casesWithAnyHit": len(cases),
            "courtCounts": court_counts,
            "proceduralCaseCount": sum(1 for c in cases.values() if c["proceduralHits"]),
            "topicCaseCounts": topic_case_counts,
            "topicHitCounts": topic_hit_counts,
        },
    }

    OUT_FILE.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    PUBLIC_OUT.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"\n{'='*56}")
    print(f"Index generated: {OUT_FILE}")
    print(f"  Size: {os.path.getsize(OUT_FILE):,} bytes")
    print(f"  Cases with ≥1 hit: {len(cases)} / {len(ip_judgments)}（無全文跳過 {skipped_no_text}）")
    print(f"  Court counts: {court_counts}")
    print(f"\nTopic case counts (out of {len(ip_judgments)}):")
    for t in TOPICS:
        print(f"  {t['name']:>16s} ({t['lawArticle']:>22s}): {topic_case_counts[t['id']]:>3d} cases, {topic_hit_counts[t['id']]:>4d} hits")
    print(f"{'='*56}")

    # sanity：標竿案（大立光）須在庫且命中損害賠償
    bench = [jid for jid, c in cases.items() if ("民營上,1," in jid or "民營訴,6," in jid)]
    print(f"Sanity 大立光 jids in index: {bench}")
    for jid in bench:
        has_dmg = "damages" in cases[jid]["topicHits"]
        print(f"  {jid}: 命中損害賠償={has_dmg}")


if __name__ == "__main__":
    main()
