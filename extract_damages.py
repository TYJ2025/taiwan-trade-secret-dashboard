#!/usr/bin/env python3
"""
營業秘密損害賠償深度抽取 v1
Extract damages calculation methods, request vs award amounts, and statute
citations from Taiwan trade-secret judgments (492 cases).

Inputs:
    trade_secret_judgments_fulltext.json
    trade_secret_judgments_structured.json (for ruling/damagesNum fallback)

Outputs:
    data/judgments.json              — structured 492 judgments (NO fullText)
    data/judgments_fulltext.json     — 492 judgments fullText only (lazy-load)
    data/damages_analysis.json       — aggregated damages analytics

Usage:
    python3 extract_damages.py
"""

import json
import os
import re
from pathlib import Path
from collections import Counter, defaultdict

# Re-use the robust 中文數字 parser from extract_fields.py
from extract_fields import (
    cn_to_int_mixed,
    extract_ruling,
    extract_damages as _extract_award_amount,
)

SCRIPT_DIR = Path(__file__).parent
FULLTEXT_JSON = SCRIPT_DIR / "trade_secret_judgments_fulltext.json"
STRUCTURED_JSON = SCRIPT_DIR / "trade_secret_judgments_structured.json"

DATA_DIR = SCRIPT_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

OUT_JUDGMENTS = DATA_DIR / "judgments.json"
OUT_FULLTEXT = DATA_DIR / "judgments_fulltext.json"
OUT_ANALYSIS = DATA_DIR / "damages_analysis.json"


# ═══════════════════════════════════════════════════════════════════
# 計算方式關鍵字 (台灣營業秘密法 §13 / 民法 §216 架構)
# ═══════════════════════════════════════════════════════════════════

# 編號對應說明（供前端提示用）
CALC_METHODS = [
    {
        "key": "具體損害",
        "label": "具體損害計算（§13 I①）",
        "statute": "營業秘密法§13 I (1)",
        "pattern": re.compile(
            r"具\s*體\s*損\s*害(?:額|金額|之\s*計\s*算)?"
            r"|營業秘密法第13條第1項第1款"
            r"|所受損害及所失利益"
        ),
    },
    {
        "key": "差額說",
        "label": "差額說（§13 I①但書）",
        "statute": "營業秘密法§13 I (1)但書",
        "pattern": re.compile(
            r"差\s*額\s*說"
            r"|(?:侵害前|一般情形)(?:所能|可).{0,6}獲得之利益(?:，|,|與|及)"
            r".{0,40}(?:所得利益|獲得利益|現獲利益)"
            r"|(?:一般情形)可獲得之利益減除受侵害後使用同一營業秘密所得之利益"
        ),
    },
    {
        "key": "利益說",
        "label": "利益說／獲利說（§13 I②）",
        "statute": "營業秘密法§13 I (2)",
        "pattern": re.compile(
            r"利\s*益\s*說"
            r"|營業秘密法第13條第1項第2款"
            r"|侵害.{0,10}所得(?:之)?利益"
            r"|獲利\s*所得|因侵害所取得之利益"
        ),
    },
    {
        "key": "授權金說",
        "label": "授權金說／合理權利金（§13 II）",
        "statute": "營業秘密法§13 II",
        "pattern": re.compile(
            r"授\s*權\s*金\s*說"
            r"|合\s*理\s*(?:權利金|授權金|使用報酬)"
            r"|(?:相當於|按|以).{0,15}授權實施"
            r"|營業秘密法第13條第2項"
        ),
    },
    {
        "key": "酌定",
        "label": "法院酌定（民訴§222 II）",
        "statute": "民事訴訟法§222 II",
        "pattern": re.compile(
            r"(?:民事訴訟法|民訴)第222條(?:第2項|第二項)?"
            r"|(?:法院|本院)\s*(?:依|得)\s*(?:所\s*調查|職權|職權調查).{0,12}(?:酌定|酌量|核定)"
            r"|(?:審酌|酌定)(?:一切情況|情事|損害額)"
        ),
    },
    {
        "key": "三倍懲罰",
        "label": "三倍酌定／懲罰性賠償（§13 III）",
        "statute": "營業秘密法§13 III",
        "pattern": re.compile(
            r"(?:三|3|參|叄)\s*倍.{0,12}(?:損害|酌定|賠償)"
            r"|故意侵害.{0,10}(?:三倍|3倍)"
            r"|營業秘密法第13條第3項"
        ),
    },
    {
        "key": "所失利益",
        "label": "所失利益（民§216 II）",
        "statute": "民法§216 II",
        "pattern": re.compile(r"所\s*失\s*利\s*益"),
    },
    {
        "key": "所受損害",
        "label": "所受損害（民§216 I）",
        "statute": "民法§216 I",
        "pattern": re.compile(r"所\s*受\s*(?:之\s*)?損\s*害"),
    },
    {
        "key": "連帶賠償",
        "label": "連帶責任（民§185 / 公§23）",
        "statute": "民§185 / 公司法§23",
        "pattern": re.compile(r"連\s*帶\s*(?:賠\s*償|負\s*擔|給\s*付)"),
    },
]

# Statutes commonly cited in damages disputes
STATUTE_CHECK = [
    ("營業秘密法§13 I (1)", re.compile(r"營業秘密法第13條第[1一壹]項第[1一壹]款")),
    ("營業秘密法§13 I (2)", re.compile(r"營業秘密法第13條第[1一壹]項第[2二貳]款")),
    ("營業秘密法§13 II", re.compile(r"營業秘密法第13條第[2二貳]項")),
    ("營業秘密法§13 III", re.compile(r"營業秘密法第13條第[3三參]項")),
    ("營業秘密法§12", re.compile(r"營業秘密法第12條")),
    ("民§184", re.compile(r"民法第184條")),
    ("民§185", re.compile(r"民法第185條")),
    ("民§216", re.compile(r"民法第216條(?!之)")),
    ("民§216-1", re.compile(r"民法第216條之1")),
    ("民§222 (公平裁量)", re.compile(r"民法第222條")),
    ("民訴§222 II (酌定)", re.compile(r"民事訴訟法第222條")),
    ("公司法§23", re.compile(r"公司法第23條")),
    ("勞基法§12", re.compile(r"勞動基準法第12條")),
    ("競業禁止", re.compile(r"競業禁止(?:約款|條款|義務)")),
]

# 請求金額（原告主張） - 從 "請求…元" 片語
_REQUEST_PATTERNS = [
    re.compile(
        r"(?:請\s*求|起\s*訴\s*請\s*求|聲\s*明)\s*(?:被\s*告|上\s*訴\s*人|對\s*造)?\s*"
        r"(?:應)?\s*(?:連\s*帶)?\s*(?:賠\s*償|給\s*付|返\s*還)?\s*"
        r"(?:原告|伊|本人)?\s*"
        r"(?:新\s*[臺台]\s*幣|NT\$?|＄)?\s*"
        r"([0-9０-９,，\s零〇○一二三四五六七八九兩十百千萬億兆壹貳貮參叄肆伍陸陆柒捌玖拾佰仟亿万]{1,40}?)"
        r"\s*元"
    ),
]

# ═══════════════════════════════════════════════════════════════════


def detect_calc_methods(text: str) -> list:
    """Return list of calculation-method keys found in the text."""
    if not text:
        return []
    out = []
    for m in CALC_METHODS:
        if m["pattern"].search(text):
            out.append(m["key"])
    return out


def detect_statutes(text: str) -> list:
    """Return list of statute keys cited in the text (damages-related)."""
    if not text:
        return []
    return [k for k, pat in STATUTE_CHECK if pat.search(text)]


def extract_request_amount(text: str) -> int:
    """Heuristic: best guess at 請求金額 (plaintiff-claimed amount)."""
    if not text:
        return 0
    best = 0
    # Only scan the first 8k chars (事實/請求部分通常在前段)
    scope = text[:8000]
    for pat in _REQUEST_PATTERNS:
        for m in pat.finditer(scope):
            raw = m.group(1)
            val = cn_to_int_mixed(raw)
            if val >= 10000 and val > best:
                best = val
    return best


def damages_snippet(text: str, n: int = 280) -> str:
    """Grab a short snippet around the best damages discussion for UI tooltip."""
    if not text:
        return ""
    # Look for 「損害賠償額以」「本件損害」「酌定」first occurrences
    triggers = [
        "損害賠償額以", "本件損害", "損害額應", "酌定", "綜上",
        "爰請求", "故請求", "合理權利金",
    ]
    for t in triggers:
        idx = text.find(t)
        if idx >= 0:
            s = max(0, idx - 30)
            e = min(len(text), idx + n)
            snip = text[s:e].replace("\n", " ").strip()
            return snip
    return ""


# ═══════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════

def is_damages_case(reason: str, case_type: str) -> bool:
    """Return True if the reason suggests a damages-claim civil case."""
    if not reason:
        return False
    if case_type != "民事":
        return False
    triggers = ["損害賠償", "賠償", "排除侵害"]
    return any(t in reason for t in triggers)


def main():
    print(f"Loading full text from {FULLTEXT_JSON.name}...")
    with open(FULLTEXT_JSON, "r", encoding="utf-8") as f:
        fulltext_cases = json.load(f)
    print(f"  → {len(fulltext_cases)} cases")

    print(f"Loading structured from {STRUCTURED_JSON.name}...")
    with open(STRUCTURED_JSON, "r", encoding="utf-8") as f:
        structured = json.load(f)
    struct_map = {s["seq"]: s for s in structured}
    print(f"  → {len(structured)} cases")

    judgments = []
    fulltext_out = []

    # Analytics accumulators
    calc_counter = Counter()
    statute_counter = Counter()
    reason_counter = Counter()
    outcome_counter = Counter()
    yearly = defaultdict(lambda: {"count": 0, "damages": 0, "damagesRequested": 0})
    court_dmg = defaultdict(lambda: {"count": 0, "total": 0})
    damages_cases = 0
    damages_awarded_cases = 0
    total_requested = 0
    total_awarded = 0

    for case in fulltext_cases:
        seq = case.get("seq")
        ft = case.get("fullText", "") or ""
        s = struct_map.get(seq, {})

        reason = case.get("reason", "")
        case_type = case.get("caseType", "")
        ruling = s.get("ruling", "") or extract_ruling(ft)
        raw_damages_num = s.get("damagesNum", 0) or _extract_award_amount(ruling, ft).get("amount", 0)
        raw_damages_text = s.get("damages", "") or ""
        outcome = s.get("outcome", "未知")

        # ── 關鍵修正：當判決結果為「原告敗訴 / 上訴駁回 / 其他純駁回」時，
        #   原本抽到的高額數字屬於「請求金額」，不是「判准金額」。
        #   主文僅含「駁回」、「訴訟費用由原告負擔」等字時，判准額應為 0。
        ruling_short = (ruling or "").strip()
        has_award_verb = any(kw in ruling_short for kw in ["應給付", "應連帶給付", "應賠償", "應連帶賠償", "應返還"])
        pure_dismiss = (
            outcome in ("原告敗訴", "上訴駁回") or
            (not has_award_verb and ("駁回" in ruling_short or not ruling_short))
        )
        if pure_dismiss and raw_damages_num > 0:
            # Plaintiff won nothing → treat raw as request amount
            damages_num = 0
            damages_text = ""
            # If request wasn't captured elsewhere, seed it
            requested_from_raw = raw_damages_num
        else:
            damages_num = raw_damages_num
            damages_text = raw_damages_text
            requested_from_raw = 0

        # New: request amount & calc methods
        req_amt = 0
        calc_methods = []
        damages_statutes = []
        snippet = ""

        is_dmg = is_damages_case(reason, case_type)

        # ── 清污：若非「損害賠償性質案件」（例：純刑事違反營業秘密法），
        #   主文中抽到的大金額通常是「侵害額」「不法所得」「起訴金額」，
        #   而非民事判准金額，不應累計進判准總額。
        #   保留 raw 數字於 rawAmountInText 供審計，但 damagesNum / damages 歸零。
        #   刑事附帶民事之判准金額應由獨立案由（案由含「損害賠償」）的民事判決承接。
        raw_amount_in_text = 0
        if not is_dmg and damages_num > 0:
            raw_amount_in_text = damages_num
            damages_num = 0
            damages_text = ""

        # 抽取計算方式 / 請求金額: 即使不是「典型損害賠償案」也要掃（刑事附民事）
        if ft:
            calc_methods = detect_calc_methods(ft)
            damages_statutes = detect_statutes(ft)
            if is_dmg or damages_num > 0 or requested_from_raw > 0:
                req_amt = extract_request_amount(ft)
                # 若啟發式取到的請求金額比 raw 小，改以「raw 數字」作為請求金額
                if requested_from_raw > req_amt:
                    req_amt = requested_from_raw
                snippet = damages_snippet(ft)

        # Build record
        record = {
            "seq": seq,
            "title": case.get("title", ""),
            "caseId": s.get("caseId", ""),
            "court": case.get("court", ""),
            "courtCode": case.get("courtCode", ""),
            "rocYear": case.get("rocYear", 0),
            "adYear": case.get("adYear", 0),
            "caseWord": case.get("caseWord", ""),
            "caseNum": case.get("caseNum", 0),
            "caseType": case_type,
            "rocDate": case.get("rocDate", ""),
            "adDate": case.get("adDate", ""),
            "reason": reason,
            "judgmentId": case.get("judgmentId", ""),
            "judgmentUrl": s.get("judgmentUrl", ""),
            # Structured (from v2)
            "ruling": ruling,
            "outcome": s.get("outcome", "未知"),
            "plaintiff": s.get("plaintiff", ""),
            "defendant": s.get("defendant", ""),
            "judge": s.get("judge", ""),
            "statutes": s.get("statutes", ""),
            # NEW damages-related
            "isDamagesCase": is_dmg,
            "damages": damages_text,
            "damagesNum": damages_num,
            "rawAmountInText": raw_amount_in_text,  # 僅非損害賠償案件時 > 0，供審計
            "damagesRequested": req_amt,
            "calcMethods": calc_methods,
            "damagesStatutes": damages_statutes,
            "damagesSnippet": snippet,
            "charCount": case.get("charCount", len(ft)),
        }
        judgments.append(record)

        # Fulltext out (thin)
        fulltext_out.append({
            "seq": seq,
            "title": case.get("title", ""),
            "fullText": ft,
        })

        # Analytics
        reason_counter[reason] += 1
        outcome_counter[record["outcome"]] += 1
        for m in calc_methods:
            calc_counter[m] += 1
        for st in damages_statutes:
            statute_counter[st] += 1

        year = case.get("adYear") or 0
        yearly[year]["count"] += 1
        if damages_num > 0:
            yearly[year]["damages"] += damages_num
        if req_amt > 0:
            yearly[year]["damagesRequested"] += req_amt

        if is_dmg:
            damages_cases += 1
        if damages_num > 0 and is_dmg:
            damages_awarded_cases += 1
            total_awarded += damages_num
            court_dmg[case.get("court", "")]["count"] += 1
            court_dmg[case.get("court", "")]["total"] += damages_num
        if req_amt > 0:
            total_requested += req_amt

    # ───── Save judgments.json (no fullText) ─────────────────────────
    with open(OUT_JUDGMENTS, "w", encoding="utf-8") as f:
        json.dump({
            "totalCases": len(judgments),
            "judgments": judgments,
        }, f, ensure_ascii=False)
    sz1 = os.path.getsize(OUT_JUDGMENTS) / 1024 / 1024
    print(f"\nSaved {OUT_JUDGMENTS.name} ({sz1:.1f} MB)")

    # ───── Save fulltext (thin) ──────────────────────────────────────
    with open(OUT_FULLTEXT, "w", encoding="utf-8") as f:
        json.dump(fulltext_out, f, ensure_ascii=False)
    sz2 = os.path.getsize(OUT_FULLTEXT) / 1024 / 1024
    print(f"Saved {OUT_FULLTEXT.name} ({sz2:.1f} MB)")

    # ───── Save damages_analysis.json ────────────────────────────────
    # Top cases by awarded amount
    top_awarded = sorted(
        [j for j in judgments if j["damagesNum"] > 0 and j["isDamagesCase"]],
        key=lambda j: -j["damagesNum"]
    )[:30]
    top_awarded_slim = [
        {
            "seq": j["seq"],
            "caseId": j["caseId"],
            "court": j["court"],
            "rocYear": j["rocYear"],
            "adYear": j["adYear"],
            "caseType": j["caseType"],
            "reason": j["reason"],
            "outcome": j["outcome"],
            "damagesNum": j["damagesNum"],
            "damagesRequested": j["damagesRequested"],
            "calcMethods": j["calcMethods"],
            "judgmentUrl": j["judgmentUrl"],
        }
        for j in top_awarded
    ]

    # Calculation method labels map
    calc_label_map = {m["key"]: m for m in CALC_METHODS}
    calc_method_breakdown = [
        {
            "key": k,
            "label": calc_label_map[k]["label"],
            "statute": calc_label_map[k]["statute"],
            "count": cnt,
        }
        for k, cnt in calc_counter.most_common()
    ]

    # Yearly totals sorted
    yearly_sorted = [
        {
            "year": y,
            "count": v["count"],
            "totalAwarded": v["damages"],
            "totalRequested": v["damagesRequested"],
        }
        for y, v in sorted(yearly.items()) if y
    ]

    # Court totals
    court_sorted = [
        {"court": c, "count": v["count"], "totalAwarded": v["total"]}
        for c, v in sorted(court_dmg.items(), key=lambda x: -x[1]["total"])
    ]

    analysis = {
        "generatedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "totalCases": len(judgments),
        "damagesCaseCount": damages_cases,
        "damagesAwardedCount": damages_awarded_cases,
        "totalAwarded": total_awarded,
        "totalRequested": total_requested,
        "byCalcMethod": calc_method_breakdown,
        "byStatute": [
            {"statute": s, "count": c}
            for s, c in statute_counter.most_common()
        ],
        "byYear": yearly_sorted,
        "byCourt": court_sorted,
        "topCases": top_awarded_slim,
        "reasonBuckets": [
            {"reason": r, "count": c}
            for r, c in reason_counter.most_common(20)
        ],
        "outcomeBuckets": [
            {"outcome": o, "count": c}
            for o, c in outcome_counter.most_common()
        ],
        "calcMethodDictionary": [
            {"key": m["key"], "label": m["label"], "statute": m["statute"]}
            for m in CALC_METHODS
        ],
    }
    with open(OUT_ANALYSIS, "w", encoding="utf-8") as f:
        json.dump(analysis, f, ensure_ascii=False, indent=2)
    sz3 = os.path.getsize(OUT_ANALYSIS) / 1024
    print(f"Saved {OUT_ANALYSIS.name} ({sz3:.1f} KB)")

    # ───── Summary ────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("損害賠償抽取摘要")
    print("=" * 60)
    print(f"總判決數:                 {len(judgments)}")
    print(f"損害賠償性質案件:          {damages_cases}  (民事+案由含『賠償/排除侵害』)")
    print(f"判准損害賠償(>0)案件:      {damages_awarded_cases}")
    print(f"請求金額合計:              {total_requested:,} 元")
    print(f"判准金額合計:              {total_awarded:,} 元")
    print(f"\n計算方式出現次數 TOP:")
    for m in calc_method_breakdown[:10]:
        print(f"  {m['count']:4d}  {m['label']:30s}  [{m['statute']}]")
    print(f"\n條文引用 TOP:")
    for s in analysis["byStatute"][:10]:
        print(f"  {s['count']:4d}  {s['statute']}")
    print("=" * 60)


if __name__ == "__main__":
    main()
