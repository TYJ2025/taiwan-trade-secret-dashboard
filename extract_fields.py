#!/usr/bin/env python3
"""
台灣營業秘密判決結構化欄位擷取腳本 (v2)
Extract structured fields (ruling, outcome, parties, etc.) from full judgment text.

v2 改動重點:
1. 當事人區分為 plaintiff (原告/上訴人/告訴人) 及 defendant (被告/被上訴人/相對人),
   排除 辯護人、訴訟代理人、法定代理人、代表人 等非當事人角色。
2. 法官姓名改用嚴格 Han-char 邊界 + 共同非名字後綴 (以上/中華/書記/本件)
   lookahead, 避免將 "以上正本證明" 的「以」誤併入姓名。
3. 損害賠償金額支援中文數字 (億、萬、千、百、十、拾、佰、仟、壹貳參... 等) 及
   Arabic/中文混合格式, 大立光等 10 億以上案件可正確識別。

Usage:
    python3 extract_fields.py
"""

import json
import re
import os
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
INPUT_JSON = SCRIPT_DIR / "trade_secret_judgments_fulltext.json"
OUTPUT_JSON = SCRIPT_DIR / "trade_secret_judgments_structured.json"
OLD_CASES_HTML = SCRIPT_DIR / "index.html"

# ═══════════════════════════════════════════════════════════════════
# 中文數字解析 (供損害賠償金額擷取使用)
# ═══════════════════════════════════════════════════════════════════

CN_DIGITS = {
    '零': 0, '〇': 0, '○': 0,
    '一': 1, '二': 2, '兩': 2, '三': 3, '四': 4,
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
    '壹': 1, '貳': 2, '貮': 2, '參': 3, '叄': 3, '肆': 4,
    '伍': 5, '陸': 6, '陆': 6, '柒': 7, '捌': 8, '玖': 9,
}
CN_UNITS_SMALL = {'十': 10, '拾': 10, '百': 100, '佰': 100, '千': 1000, '仟': 1000}
CN_UNITS_BIG = {'萬': 10000, '万': 10000, '億': 100000000, '亿': 100000000, '兆': 1000000000000}

CN_NUM_CHARS = set(CN_DIGITS) | set(CN_UNITS_SMALL) | set(CN_UNITS_BIG)


def cn_to_int_mixed(s: str):
    """Convert a string of Chinese + Arabic numerals to int.

    Supports:
      - Pure Chinese: 壹拾伍億貳仟貳佰肆拾柒萬零陸佰參拾玖
      - Mixed: 2億2,356萬, 2,408萬0,486, 1,522,062,059
      - Arabic: 1,522,062,059
    Returns 0 on failure / empty.
    """
    if not s:
        return 0
    total = 0
    section = 0       # accumulator below 萬 (or between 萬 and 億)
    current = 0       # single number being built (Chinese digit)
    num_buf = ''      # Arabic digit buffer (may contain , ，)

    def flush_num():
        nonlocal num_buf, current
        if num_buf:
            cleaned = num_buf.replace(',', '').replace('，', '').strip()
            if cleaned.isdigit():
                current = int(cleaned)
            num_buf = ''

    for ch in s:
        if ch.isdigit() or ch in ',，':
            num_buf += ch
        elif ch in CN_DIGITS:
            flush_num()
            current = CN_DIGITS[ch]
        elif ch in CN_UNITS_SMALL:
            flush_num()
            unit = CN_UNITS_SMALL[ch]
            if current == 0:
                current = 1  # 十 alone = 10
            section += current * unit
            current = 0
        elif ch in CN_UNITS_BIG:
            flush_num()
            unit = CN_UNITS_BIG[ch]
            section += current
            current = 0
            # 億/兆 flushes to total, 萬 accumulates into section that is
            # later multiplied by 億. For simplicity treat each big unit as
            # a pure multiplier applied to whatever accumulated so far.
            if unit == 10000:
                # 萬 — fold section into a running "萬-level" accumulator,
                # stored temporarily back in section * 10000
                total += section * 10000
                section = 0
            else:
                # 億/兆
                total = (total + section) * unit
                section = 0
        elif ch in ' \t\n\u3000':
            # whitespace ignored
            continue
        else:
            # Unexpected char — stop parsing here
            break

    flush_num()
    total += section + current
    return total


# Quick sanity tests
assert cn_to_int_mixed('壹拾伍億貳仟貳佰肆拾柒萬零陸佰參拾玖') == 1_522_470_639, \
    cn_to_int_mixed('壹拾伍億貳仟貳佰肆拾柒萬零陸佰參拾玖')
assert cn_to_int_mixed('2億2,356萬') == 223_560_000, cn_to_int_mixed('2億2,356萬')
assert cn_to_int_mixed('2,408萬0,486') == 24_080_486, cn_to_int_mixed('2,408萬0,486')
assert cn_to_int_mixed('1,522,062,059') == 1_522_062_059
assert cn_to_int_mixed('新臺幣') == 0  # no numerals


# ═══════════════════════════════════════════════════════════════════
# Extraction Functions
# ═══════════════════════════════════════════════════════════════════

def extract_ruling(text: str) -> str:
    """Extract 主文 (ruling/disposition) section from judgment text."""
    if not text:
        return ''
    patterns = [
        r'主\s*文\s*(.*?)(?=理\s*由|事\s*實|犯\s*罪\s*事\s*實)',
        r'主文\s*(.*?)(?=理由|事實|犯罪事實)',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.DOTALL)
        if match:
            ruling = match.group(1).strip()
            ruling = re.sub(r'\n{3,}', '\n', ruling)
            ruling = ruling.strip()
            if len(ruling) > 5:
                return ruling
    return ''


# ─── 當事人 (原告 / 被告) ──────────────────────────────────────────

# 全部可能出現在判決書 "當事人欄位" 的角色名稱。
# 注意: 排列順序必須 "長字串優先" 以防 alternation 回頭誤匹配
#        (例如 "訴訟代理人" 必須在 "代理人" 之前)。
_ALL_ROLE_WORDS = [
    # 非當事人角色 (律師/代理人/代表人等)
    '共同選任辯護人', '共同訴訟代理人', '共同代理人',
    '選任辯護人', '指定辯護人',
    '訴訟代理人', '非訟代理人', '複代理人',
    '法定代理人', '特別代理人',
    '辯護人', '代理人', '代表人',
    '輔佐人', '參加人', '參與人', '被害人', '鑑定人', '通譯',
    # 當事人角色
    '被上訴人', '上訴人',
    '告訴人', '自訴人', '公訴人', '檢察官',
    '原告', '被告',
    '聲請人', '抗告人', '異議人', '再審原告', '再審被告',
    '相對人',
    # 連接/修飾詞 (僅用於切分, 不當作 role 使用)
    '共同', '兼',
]

PARTY_ROLES_PLAINTIFF = {
    '原告', '上訴人', '告訴人', '自訴人', '聲請人', '抗告人',
    '異議人', '再審原告',
}
PARTY_ROLES_DEFENDANT = {
    '被告', '被上訴人', '相對人', '再審被告',
}
# 非當事人 (辯護人/代理人等) — 我們忽略這些角色捕獲的姓名
NON_PARTY_ROLES = {
    '共同選任辯護人', '共同訴訟代理人', '共同代理人',
    '選任辯護人', '指定辯護人',
    '訴訟代理人', '非訟代理人', '複代理人',
    '法定代理人', '特別代理人',
    '辯護人', '代理人', '代表人',
    '輔佐人', '參加人', '參與人', '被害人', '鑑定人', '通譯',
    '公訴人', '檢察官',
    '共同', '兼',
}


def _spaced(word: str) -> str:
    """Build a regex that allows arbitrary whitespace between characters."""
    return r'\s*'.join(re.escape(c) for c in word)


_ROLE_PATTERNS = sorted(_ALL_ROLE_WORDS, key=len, reverse=True)
_ROLE_REGEX = re.compile('(' + '|'.join(_spaced(w) for w in _ROLE_PATTERNS) + ')')


def _normalise_role(raw: str) -> str:
    return re.sub(r'\s+', '', raw)


def _clean_names_from_segment(seg: str) -> list:
    """Extract 1..n candidate names from a segment of text.

    The segment is the text between two role markers. It may contain:
      - a single name: "蔡宜君"
      - multi-line names: "蔡宜君\n李佩力"
      - name + trailing descriptive text: "湯千慧律師"  (律師 — attorney)
      - name + address/ID: "蔡宜君男民國00年..."
    """
    if not seg:
        return []

    # First, split by common separators (newlines, tabs, 、, ，)
    pieces = re.split(r'[\n\r\t　 、，]+', seg)
    names = []
    for p in pieces:
        p = p.strip()
        if not p:
            continue
        # Strip leading "即 " "共同" "兼" markers attached to name
        p = re.sub(r'^(即|共同|兼|及|與)+', '', p)
        # Remove trailing attorney marker 律師
        p = re.sub(r'律師$', '', p)
        # Stop at first occurrence of 男/女 (gender) or 民國/身分/住/設/居/電話/地址/營業所/原名
        p = re.split(r'(男|女|民\s*國|身\s*分|住\s*[:：]?|設\s*[:：]?|居\s*[:：]?|電\s*話|地\s*址|營\s*業\s*所|原\s*名|年\s*籍|即\s*原\s*名|即\b)', p)[0]
        # Remove trailing "上" "下" modifier attached to name-end artifacts
        p = re.sub(r'(上|下)$', '', p)
        p = p.strip()
        if not p:
            continue
        # Filter obvious non-names
        if re.search(r'(辯護人|代理人|代表人|律師|檢察官|法院|書記|卷|理由|主文)', p):
            continue
        # Length sanity
        if not (2 <= len(p) <= 40):
            continue
        if p not in names:
            names.append(p)
    return names


def extract_parties_structured(text: str, case_type: str) -> dict:
    """Return {'plaintiff': 'str', 'defendant': 'str'}."""
    result = {'plaintiff': '', 'defendant': ''}
    if not text:
        return result

    # Look only at the header (before "上列..." which is typical end of parties block)
    header = text[:2500]
    end = re.search(r'上\s*列', header)
    if end:
        header = header[:end.start()]

    plaintiff = []
    defendant = []

    role_matches = list(_ROLE_REGEX.finditer(header))
    for i, m in enumerate(role_matches):
        role = _normalise_role(m.group(0))
        next_start = role_matches[i + 1].start() if i + 1 < len(role_matches) else len(header)
        seg = header[m.end():next_start]

        if role in NON_PARTY_ROLES:
            continue  # 辯護人/代理人/代表人 → 忽略

        names = _clean_names_from_segment(seg)
        if not names:
            continue

        if role in PARTY_ROLES_PLAINTIFF:
            for n in names:
                if n not in plaintiff:
                    plaintiff.append(n)
        elif role in PARTY_ROLES_DEFENDANT:
            for n in names:
                if n not in defendant:
                    defendant.append(n)

    result['plaintiff'] = '、'.join(plaintiff[:6])
    result['defendant'] = '、'.join(defendant[:6])
    return result


def extract_parties(text: str, case_type: str) -> str:
    """Backward-compatible combined-parties string."""
    d = extract_parties_structured(text, case_type)
    parts = []
    if d['plaintiff']:
        parts.append(f"原告：{d['plaintiff']}" if case_type != '刑事' else '')
    if d['defendant']:
        parts.append(f"被告：{d['defendant']}")
    return ' / '.join(p for p in parts if p)


# ─── 判決結果分類 ───────────────────────────────────────────────

def classify_outcome(ruling: str, case_type: str) -> str:
    if not ruling:
        return '未知'
    r = ruling
    if case_type == '刑事':
        if '無罪' in r: return '無罪'
        if '不受理' in r: return '不受理'
        if '免訴' in r: return '免訴'
        if '免刑' in r: return '免刑'
        if '撤銷' in r and '發回' in r: return '撤銷發回'
        if any(kw in r for kw in ['有期徒刑', '拘役']): return '有罪'
        if '罰金' in r and ('科' in r or '處' in r): return '有罪'
        if '駁回' in r: return '上訴駁回'
        if '撤銷' in r: return '撤銷改判'
    else:
        if '被告應' in r and any(kw in r for kw in ['給付', '賠償', '連帶']):
            return '原告勝訴'
        if '上訴人應' in r and any(kw in r for kw in ['給付', '賠償', '連帶']):
            return '原告勝訴'
        if '駁回' in r and any(kw in r for kw in ['原告', '之訴']):
            return '原告敗訴'
        if '撤銷' in r and '發回' in r: return '撤銷發回'
        if '駁回' in r: return '上訴駁回'
        if '和解' in r: return '和解'
        if '撤銷' in r: return '撤銷改判'
    return '其他'


# ─── 損害賠償金額 ───────────────────────────────────────────────

# 辨識 "新臺幣 + 金額 + 元" 的金額字串
# 允許金額包含 Arabic 數字、逗號、以及中文大/小寫數字、單位。
_AMOUNT_RE = re.compile(
    r'新\s*[臺台]\s*幣\s*'
    r'(?:[（(][^)）]{0,20}[)）]\s*)?'   # optional parenthetical e.g. "(下同)"
    r'(?:下\s*同[，,、\s]*)?'          # optional "下同" without parens
    r'([0-9０-９,，\s零〇○一二三四五六七八九兩十百千萬億兆'
    r'壹貳貮參叄肆伍陸陆柒捌玖拾佰仟亿万]{1,60}?)'
    r'\s*元'
)
# 純 Arabic 的備援 (某些判決不寫「新臺幣」)
_AMOUNT_RE_ARABIC = re.compile(r'([0-9]{1,3}(?:[,，][0-9]{3})+)\s*元')


def extract_damages(ruling: str, full_text: str) -> dict:
    """Extract the damages amount. Returns dict with 'text' (display) and 'amount' (int)."""
    result = {'text': '', 'amount': 0}

    if not (ruling or full_text):
        return result

    # Build search sources in priority order.
    # Priority 1: ruling 主文 (authoritative)
    # Priority 2: full_text but ONLY for civil cases or if ruling had none
    sources = []
    if ruling:
        sources.append(('ruling', ruling))
    if full_text:
        # Ruling is already embedded in full_text, but it's fine to re-scan.
        sources.append(('full', full_text))

    best_amount = 0
    best_text = ''

    for tag, src in sources:
        # 先找 新臺幣 X 元
        for m in _AMOUNT_RE.finditer(src):
            raw = m.group(1)
            val = cn_to_int_mixed(raw)
            if val >= 1000:  # ignore tiny values (could be 年、日)
                if val > best_amount:
                    best_amount = val
                    best_text = f"新臺幣{_format_amount_text(raw, val)}元"
        # 備援: 純 Arabic 大額 (例: "2,408,486元")
        if tag == 'ruling' and best_amount == 0:
            for m in _AMOUNT_RE_ARABIC.finditer(src):
                raw = m.group(1)
                val = cn_to_int_mixed(raw)
                if val >= 10000 and val > best_amount:
                    best_amount = val
                    best_text = f"新臺幣{val:,}元"
        # 若 ruling 找到就夠用了 (無需再從 full_text 找更大的)
        if tag == 'ruling' and best_amount >= 10000:
            break

    if best_amount > 0:
        result['amount'] = best_amount
        result['text'] = best_text or f"新臺幣{best_amount:,}元"

    return result


def _format_amount_text(raw: str, val: int) -> str:
    """Return a human-readable rendering. If raw is pure Chinese, keep it."""
    raw_stripped = raw.strip()
    # If the raw string has any Chinese numeral / unit characters, keep original
    if any(c in CN_NUM_CHARS for c in raw_stripped):
        return raw_stripped
    # Otherwise format with commas
    return f"{val:,}"


# ─── 法官姓名 ───────────────────────────────────────────────────

# 允許姓名中有空格 (最高法院常見格式 "鍾 任 賜")
# 邊界使用 lookahead 檢查下一段不是常見非名字區塊 (以上/中華民國/書記官/本件/本判決...)
_JUDGE_END_LOOKAHEAD = r'(?=\s|以\s*上|中\s*華|本\s*件|本\s*案|本\s*判|書\s*記|法\s*官|上\s*日|$|[0-9A-Za-z])'
_JUDGE_NAME = r'((?:[\u4e00-\u9fff]\s*){2,5}[\u4e00-\u9fff])'

_JUDGE_PATTERNS = [
    re.compile(r'審\s*判\s*長\s*法\s*官\s*[:：]?\s*' + _JUDGE_NAME + _JUDGE_END_LOOKAHEAD),
    re.compile(r'審\s*判\s*長\s*' + _JUDGE_NAME + _JUDGE_END_LOOKAHEAD),
    re.compile(r'法\s*官\s*[:：]?\s*' + _JUDGE_NAME + _JUDGE_END_LOOKAHEAD),
]


def _normalise_judge_name(name: str) -> str:
    """Remove internal spaces + trailing known artifacts."""
    n = re.sub(r'\s+', '', name).strip()
    # Strip trailing common artifacts (safety net): 以, 上, 中, 本, 書, 法, 官
    while n and n[-1] in '以上中本書法官':
        if len(n) <= 2:
            break
        n = n[:-1]
    return n


def extract_judge(text: str) -> str:
    """Extract presiding judge (審判長) name."""
    if not text:
        return ''
    # Search in the last 800 chars (judge names appear near the end)
    tail = text[-800:] if len(text) > 800 else text

    for pat in _JUDGE_PATTERNS:
        m = pat.search(tail)
        if m:
            name = _normalise_judge_name(m.group(1))
            if 2 <= len(name) <= 4 and re.match(r'^[\u4e00-\u9fff]{2,4}$', name):
                return name
    return ''


# ─── 引用法條 ───────────────────────────────────────────────────

def extract_statutes(text: str) -> str:
    if not text:
        return ''
    statutes = set()
    if '第13條之1' in text or '第十三條之一' in text:
        statutes.add('營業秘密法§13-1')
    if '第13條之2' in text or '第十三條之二' in text:
        statutes.add('營業秘密法§13-2')
    if '第13條之3' in text or '第十三條之三' in text:
        statutes.add('營業秘密法§13-3')
    if '第13條之4' in text or '第十三條之四' in text:
        statutes.add('營業秘密法§13-4')
    if re.search(r'營業秘密法第[2二]條', text):
        statutes.add('營業秘密法§2')
    if re.search(r'營業秘密法第10條|營業秘密法第十條', text):
        statutes.add('營業秘密法§10')
    if re.search(r'營業秘密法第11條|營業秘密法第十一條', text):
        statutes.add('營業秘密法§11')
    if re.search(r'營業秘密法第12條|營業秘密法第十二條', text):
        statutes.add('營業秘密法§12')
    if re.search(r'營業秘密法第13條(?!之)', text) or re.search(r'營業秘密法第十三條(?!之)', text):
        statutes.add('營業秘密法§13')
    return '、'.join(sorted(statutes)) if statutes else ''


# ─── 舊資料交叉比對 ─────────────────────────────────────────────

def load_old_cases() -> dict:
    old_map = {}
    if not OLD_CASES_HTML.exists():
        return old_map
    try:
        with open(OLD_CASES_HTML, 'r', encoding='utf-8') as f:
            html = f.read()
        match = re.search(r'const cases = (\[.*?\]);\s*\n', html, re.DOTALL)
        if match:
            cases_json = match.group(1)
            old_cases = json.loads(cases_json)
            for c in old_cases:
                case_no = c.get('caseNo', '')
                if case_no:
                    old_map[case_no] = c
            print(f"Loaded {len(old_map)} old cases for cross-reference")
    except Exception as e:
        print(f"Warning: Could not load old cases: {e}")
    return old_map


def match_old_case(case: dict, old_map: dict) -> dict:
    roc_year = case.get('rocYear', 0)
    case_word = case.get('caseWord', '')
    case_num = case.get('caseNum', 0)
    candidates = [
        f"{roc_year}年度{case_word}字第{case_num}號",
        f"{roc_year}年{case_word}字第{case_num}號",
    ]
    for key in candidates:
        for old_key, old_case in old_map.items():
            if key in old_key or old_key in key:
                return old_case
    return {}


# ═══════════════════════════════════════════════════════════════════
# Main Processing
# ═══════════════════════════════════════════════════════════════════

def main():
    if not INPUT_JSON.exists():
        print(f"ERROR: {INPUT_JSON} not found.")
        print(f"Please run download_fulltext.py first.")
        return

    with open(INPUT_JSON, 'r', encoding='utf-8') as f:
        cases = json.load(f)
    print(f"Loaded {len(cases)} cases")

    has_text = sum(1 for c in cases if c.get('fullText') and len(c.get('fullText', '')) > 50)
    print(f"Cases with substantial full text (>50 chars): {has_text}")

    old_map = load_old_cases()

    enriched = []
    outcomes = {}
    matched_old = 0

    for c in cases:
        text = c.get('fullText', '')
        case_type = c.get('caseType', '')

        ruling = extract_ruling(text)
        parties = extract_parties_structured(text, case_type)
        outcome = classify_outcome(ruling, case_type)
        damages = extract_damages(ruling, text)
        judge = extract_judge(text)
        statutes = extract_statutes(text)

        outcomes[outcome] = outcomes.get(outcome, 0) + 1

        old_case = match_old_case(c, old_map)
        if old_case:
            matched_old += 1

        # Combined parties display (for CSV/export/backward compat)
        combined_parts = []
        if parties['plaintiff']:
            combined_parts.append(f"原告：{parties['plaintiff']}" if case_type != '刑事' else parties['plaintiff'])
        if parties['defendant']:
            combined_parts.append(f"被告：{parties['defendant']}")
        parties_combined = ' / '.join(combined_parts)

        record = {
            # Layer 1: Basic metadata
            'seq': c.get('seq', 0),
            'court': c.get('court', ''),
            'courtCode': c.get('courtCode', ''),
            'title': c.get('title', ''),
            'caseId': f"{c.get('court','')} {c.get('rocYear','')} 年度 {c.get('caseWord','')} 字第 {c.get('caseNum','')} 號",
            'rocYear': c.get('rocYear', 0),
            'adYear': c.get('adYear', 0),
            'caseWord': c.get('caseWord', ''),
            'caseNum': c.get('caseNum', 0),
            'caseType': case_type,
            'rocDate': c.get('rocDate', ''),
            'adDate': c.get('adDate', ''),
            'reason': c.get('reason', ''),
            'judgmentId': c.get('judgmentId', ''),
            'judgmentUrl': f"https://judgment.judicial.gov.tw/FJUD/data.aspx?ty=JD&id={c.get('judgmentId', '')}",

            # Layer 2: Extracted from full text
            'ruling': ruling or old_case.get('ruling', ''),
            'summary': old_case.get('summary', ''),
            'outcome': outcome if outcome != '未知' else old_case.get('outcome', '未知'),
            'plaintiff': parties['plaintiff'],
            'defendant': parties['defendant'],
            'parties': parties_combined or old_case.get('parties', ''),
            'keyIssues': old_case.get('keyIssues', ''),
            'damages': damages['text'] or old_case.get('damages', ''),
            'damagesNum': damages['amount'] or old_case.get('damagesNum', 0),
            'judge': judge,
            'statutes': statutes,

            # Layer 3: Enrichment (from old cases or manual)
            'name': old_case.get('name', ''),
            'nameEn': old_case.get('nameEn', ''),
            'industry': old_case.get('industry', ''),
            'significance': old_case.get('significance', ''),
            'category': old_case.get('category', ''),

            # Meta
            'charCount': c.get('charCount', 0),
            'hasFullText': bool(text) and len(text) > 50,
            'hasOldData': bool(old_case),
        }
        enriched.append(record)

    # Statistics
    print(f"\n{'='*50}")
    print(f"Extraction Summary (v2)")
    print(f"{'='*50}")
    print(f"Total cases:        {len(enriched)}")
    print(f"With full text:     {has_text}")
    print(f"With ruling:        {sum(1 for r in enriched if r['ruling'])}")
    print(f"With plaintiff:     {sum(1 for r in enriched if r['plaintiff'])}")
    print(f"With defendant:     {sum(1 for r in enriched if r['defendant'])}")
    print(f"With outcome:       {sum(1 for r in enriched if r['outcome'] != '未知')}")
    print(f"With damages(>0):   {sum(1 for r in enriched if r['damagesNum'] > 0)}")
    print(f"With judge:         {sum(1 for r in enriched if r['judge'])}")
    print(f"With statutes:      {sum(1 for r in enriched if r['statutes'])}")
    print(f"Matched old cases:  {matched_old}")

    # Top damages (sanity-check for Largan etc.)
    top_dmg = sorted(
        [r for r in enriched if r['damagesNum'] > 0],
        key=lambda r: -r['damagesNum']
    )[:10]
    print(f"\nTop 10 damages:")
    for r in top_dmg:
        print(f"  {r['damagesNum']:>15,} | {r['caseId'][:55]}")

    # Judge names ending in 以/上/中/本 (should be empty now)
    bad = [r for r in enriched if r['judge'].endswith(('以', '上', '中', '本'))]
    print(f"\nJudges with suspicious trailing char: {len(bad)}")
    for r in bad[:10]:
        print(f"  {r['judge']:10s} | {r['caseId'][:55]}")

    print(f"\nOutcome distribution:")
    for k, v in sorted(outcomes.items(), key=lambda x: -x[1]):
        print(f"  {k}: {v}")

    # Save
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(enriched, f, ensure_ascii=False, indent=2)
    file_size = os.path.getsize(OUTPUT_JSON) / (1024 * 1024)
    print(f"\nSaved: {OUTPUT_JSON} ({file_size:.1f} MB)")
    print(f"{'='*50}")

    # Save stats
    stats = {
        'totalCases': len(enriched),
        'withFullText': has_text,
        'withRuling': sum(1 for r in enriched if r['ruling']),
        'withSummary': sum(1 for r in enriched if r['summary']),
        'matchedOldCases': matched_old,
        'outcomes': outcomes,
        'caseTypes': {},
        'yearCounts': {},
        'courtCounts': {},
    }
    for r in enriched:
        t = r['caseType']
        stats['caseTypes'][t] = stats['caseTypes'].get(t, 0) + 1
        y = str(r['adYear'])
        stats['yearCounts'][y] = stats['yearCounts'].get(y, 0) + 1
        ct = r['court']
        stats['courtCounts'][ct] = stats['courtCounts'].get(ct, 0) + 1

    stats_file = SCRIPT_DIR / "extraction_stats.json"
    with open(stats_file, 'w', encoding='utf-8') as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
    print(f"Stats saved: {stats_file}")


if __name__ == '__main__':
    main()
