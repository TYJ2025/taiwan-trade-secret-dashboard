#!/usr/bin/env python3
"""
Build the Taiwan Trade Secrets Case Tracker dashboard (v2 — Dark Theme Redesign).
Reads structured case data and generates a single-file HTML dashboard.

Design: Modern dark-theme dashboard with:
  - Fixed top navigation with search + type toggle
  - KPI header cards with trend indicators
  - Main content: case table (70%) + sidebar charts (30%)
  - Quick filter chips above table
  - Donut chart, stacked bar chart, horizontal bar chart
  - Responsive design (mobile card layout)
  - Color scheme: #0A2540 / #FF6B00 / #E63939 / #2A9D8F

Usage:
    python3 build_dashboard.py
"""

import json
import os
from pathlib import Path
from datetime import datetime

SCRIPT_DIR = Path(__file__).parent
INPUT_JSON = SCRIPT_DIR / "trade_secret_judgments_structured.json"
NEWS_JSON = SCRIPT_DIR / "news.json"
OUTPUT_HTML = SCRIPT_DIR / "index.html"

def trim_case_for_dashboard(c: dict) -> dict:
    """Trim case data to only what's needed for dashboard display."""
    ruling = c.get('ruling', '')
    if len(ruling) > 400:
        ruling = ruling[:397] + '...'

    return {
        's': c.get('seq', 0),
        'ct': c.get('court', ''),
        'ti': c.get('title', ''),
        'ci': c.get('caseId', ''),
        'yr': c.get('adYear', 0),
        'dt': c.get('adDate', ''),
        'tp': c.get('caseType', ''),
        'rs': c.get('reason', ''),
        'oc': c.get('outcome', '未知'),
        'pt': c.get('parties', ''),   # combined (for search/CSV fallback)
        'pl': c.get('plaintiff', ''), # 原告 / 上訴人
        'df': c.get('defendant', ''), # 被告 / 被上訴人
        'rl': ruling,
        'jg': c.get('judge', ''),
        'st': c.get('statutes', ''),
        'dm': c.get('damages', ''),
        'dn': c.get('damagesNum', 0),
        'url': c.get('judgmentUrl', ''),
        'nm': c.get('name', ''),
        'ind': c.get('industry', ''),
        'sm': c.get('summary', ''),
        'ki': c.get('keyIssues', ''),
        'sig': c.get('significance', ''),
        'cc': c.get('charCount', 0),
    }

def compute_stats(cases: list) -> dict:
    """Compute comprehensive stats from the structured cases."""
    total = len(cases)
    criminal = [c for c in cases if c.get('caseType') == '刑事']
    civil = [c for c in cases if c.get('caseType') == '民事']

    outcomes = {}
    for c in cases:
        oc = c.get('outcome', '未知')
        outcomes[oc] = outcomes.get(oc, 0) + 1

    # Year counts by type
    year_criminal = {}
    year_civil = {}
    for c in cases:
        yr = c.get('adYear', 0)
        if yr < 2012:
            continue
        tp = c.get('caseType', '')
        if tp == '刑事':
            year_criminal[yr] = year_criminal.get(yr, 0) + 1
        elif tp == '民事':
            year_civil[yr] = year_civil.get(yr, 0) + 1

    # Court counts
    courts = {}
    for c in cases:
        ct = c.get('court', '')
        courts[ct] = courts.get(ct, 0) + 1

    # Civil outcomes
    civil_plaintiff_win = sum(1 for c in civil if c.get('outcome') == '原告勝訴')
    civil_plaintiff_lose = sum(1 for c in civil if c.get('outcome') == '原告敗訴')
    civil_decided = civil_plaintiff_win + civil_plaintiff_lose
    civil_win_rate = round(civil_plaintiff_win / civil_decided * 100, 1) if civil_decided > 0 else 0

    # Criminal conviction rate
    criminal_guilty = outcomes.get('有罪', 0)
    criminal_not_guilty = outcomes.get('無罪', 0)
    criminal_decided = criminal_guilty + criminal_not_guilty
    conviction_rate = round(criminal_guilty / criminal_decided * 100, 1) if criminal_decided > 0 else 0

    # Damages stats — restrict to 民事 + 原告勝訴 cases with damages > 0
    # (Criminal cases and 原告敗訴 cases often contain text-extracted "claimed" amounts
    #  that are not actual awards, which inflated the stats.)
    damages_cases = [c for c in cases
                     if c.get('caseType') == '民事'
                     and c.get('outcome') == '原告勝訴'
                     and c.get('damagesNum', 0) > 0]
    damages_amounts = [c['damagesNum'] for c in damages_cases]
    avg_damages = round(sum(damages_amounts) / len(damages_amounts)) if damages_amounts else 0
    median_damages = sorted(damages_amounts)[len(damages_amounts) // 2] if damages_amounts else 0
    max_damages = max(damages_amounts) if damages_amounts else 0

    # Judge counts
    judges = {}
    for c in cases:
        jg = c.get('judge', '')
        if jg:
            judges[jg] = judges.get(jg, 0) + 1

    # Year-over-year change
    current_year_count = sum(1 for c in cases if c.get('adYear') == 2025)
    prev_year_count = sum(1 for c in cases if c.get('adYear') == 2024)
    yoy_change = round((current_year_count - prev_year_count) / prev_year_count * 100) if prev_year_count > 0 else 0

    return {
        'totalCases': total,
        'criminal': len(criminal),
        'civil': len(civil),
        'outcomes': outcomes,
        'yearCriminal': year_criminal,
        'yearCivil': year_civil,
        'courts': courts,
        'civilWinRate': civil_win_rate,
        'civilDecided': civil_decided,
        'civilPlaintiffWin': civil_plaintiff_win,
        'convictionRate': conviction_rate,
        'criminalDecided': criminal_decided,
        'criminalGuilty': criminal_guilty,
        'criminalNotGuilty': criminal_not_guilty,
        'damagesCases': len(damages_cases),
        'avgDamages': avg_damages,
        'medianDamages': median_damages,
        'maxDamages': max_damages,
        'judges': judges,
        'yoyChange': yoy_change,
        'currentYearCount': current_year_count,
    }

def format_money(amount: int) -> str:
    """Format money amount to readable string."""
    if amount >= 100_000_000:
        return f"{amount / 100_000_000:.1f}億"
    if amount >= 10_000:
        return f"{amount / 10_000:.0f}萬"
    return f"{amount:,}"

def build_html(cases_json: str, stats: dict, news=None) -> str:
    """Generate the complete dashboard HTML with dark theme design."""

    today = datetime.now().strftime('%Y-%m-%d')

    # News section meta text
    news = news or {'items': [], 'generatedAt': ''}
    news_items = news.get('items') or []
    if news_items:
        gen_at = news.get('generatedAt', '')
        # Trim to Asia/Taipei date display if possible
        try:
            gen_dt = datetime.fromisoformat(gen_at.replace('Z', '+00:00'))
            # display in UTC+8 yyyy-mm-dd HH:MM
            from datetime import timedelta, timezone as _tz
            gen_dt = gen_dt.astimezone(_tz(timedelta(hours=8)))
            gen_display = gen_dt.strftime('%Y-%m-%d %H:%M')
        except Exception:
            gen_display = gen_at[:16].replace('T', ' ') if gen_at else ''
        news_meta_text = f"{len(news_items)} 則・更新於 {gen_display}"
    else:
        news_meta_text = '尚未產生 news.json'

    news_json = json.dumps(news, ensure_ascii=False, separators=(',', ':'))

    # Pre-compute values for KPI cards
    total = stats['totalCases']
    criminal = stats['criminal']
    civil = stats['civil']
    criminal_pct = round(criminal / total * 100) if total else 0
    civil_pct = round(civil / total * 100) if total else 0
    guilty = stats['criminalGuilty']
    not_guilty = stats['criminalNotGuilty']
    conviction_rate = stats['convictionRate']
    civil_win_rate = stats['civilWinRate']
    yoy = stats['yoyChange']
    yoy_sign = '+' if yoy > 0 else ''
    yoy_arrow = '↑' if yoy > 0 else ('↓' if yoy < 0 else '→')

    return f'''<!DOCTYPE html>
<html lang="zh-TW" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>台灣營業秘密判決追蹤儀表板</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
/* ═══════════════════════════════════════════════ */
/* CSS VARIABLES — DARK THEME DEFAULT             */
/* ═══════════════════════════════════════════════ */
:root {{
  --bg-primary: #0A2540;
  --bg-secondary: #0F2F50;
  --bg-card: #122B45;
  --bg-card-hover: #163558;
  --bg-input: #0D2844;
  --bg-table-header: #0D2844;
  --bg-table-stripe: #0E2A48;
  --text-primary: #E8ECF1;
  --text-secondary: #8B9DB7;
  --text-muted: #5E7490;
  --border-color: #1C3A5A;
  --border-light: #1A3352;
  --accent-orange: #FF6B00;
  --accent-orange-dim: rgba(255,107,0,0.15);
  --accent-red: #E63939;
  --accent-red-dim: rgba(230,57,57,0.15);
  --accent-green: #2A9D8F;
  --accent-green-dim: rgba(42,157,143,0.15);
  --accent-blue: #3B82F6;
  --accent-blue-dim: rgba(59,130,246,0.15);
  --accent-yellow: #F59E0B;
  --accent-yellow-dim: rgba(245,158,11,0.15);
  --accent-purple: #8B5CF6;
  --accent-purple-dim: rgba(139,92,246,0.15);
  --accent-gray: #6B7280;
  --accent-gray-dim: rgba(107,114,128,0.15);
  --card-shadow: 0 2px 8px rgba(0,0,0,0.3);
  --radius: 8px;
  --radius-lg: 12px;
  --nav-height: 56px;
  --scrollbar-thumb: #1C3A5A;
  --scrollbar-track: #0A2540;
}}

[data-theme="light"] {{
  --bg-primary: #F0F4F8;
  --bg-secondary: #FFFFFF;
  --bg-card: #FFFFFF;
  --bg-card-hover: #F8FAFC;
  --bg-input: #F1F5F9;
  --bg-table-header: #F1F5F9;
  --bg-table-stripe: #F8FAFC;
  --text-primary: #1E293B;
  --text-secondary: #64748B;
  --text-muted: #94A3B8;
  --border-color: #E2E8F0;
  --border-light: #F1F5F9;
  --card-shadow: 0 1px 4px rgba(0,0,0,0.08);
  --scrollbar-thumb: #CBD5E1;
  --scrollbar-track: #F1F5F9;
}}

* {{ margin:0; padding:0; box-sizing:border-box; }}
html {{ scroll-behavior:smooth; }}
body {{
  font-family: 'Noto Sans TC', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.6;
  font-size: 14px;
  overflow-x: hidden;
}}
a {{ color: var(--accent-blue); text-decoration:none; }}
a:hover {{ text-decoration:underline; }}

/* Scrollbar */
::-webkit-scrollbar {{ width:6px; height:6px; }}
::-webkit-scrollbar-track {{ background:var(--scrollbar-track); }}
::-webkit-scrollbar-thumb {{ background:var(--scrollbar-thumb); border-radius:3px; }}

/* ═══════════════════════════════════════════════ */
/* TOP NAVIGATION — FIXED                        */
/* ═══════════════════════════════════════════════ */
.topnav {{
  position:fixed; top:0; left:0; right:0; z-index:100;
  height:var(--nav-height);
  background:linear-gradient(135deg, #061A2E 0%, #0A2540 100%);
  border-bottom:1px solid var(--border-color);
  display:flex; align-items:center; padding:0 24px; gap:16px;
  backdrop-filter:blur(12px);
}}
.topnav-brand {{
  display:flex; align-items:center; gap:10px; flex-shrink:0;
}}
.topnav-brand h1 {{
  font-size:1.05rem; font-weight:700; color:#fff; white-space:nowrap;
}}
.topnav-brand h1 .hl {{ color:var(--accent-orange); }}
.topnav-brand .year-tag {{
  font-size:0.65rem; background:rgba(255,255,255,0.1); color:var(--text-secondary);
  padding:2px 8px; border-radius:10px;
}}
.topnav-search {{
  flex:1; max-width:420px; position:relative;
}}
.topnav-search input {{
  width:100%; padding:7px 14px 7px 36px;
  background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12);
  border-radius:20px; color:#fff; font-size:0.85rem; outline:none;
  transition:border-color 0.2s, background 0.2s;
}}
.topnav-search input::placeholder {{ color:rgba(255,255,255,0.4); }}
.topnav-search input:focus {{ border-color:var(--accent-orange); background:rgba(255,255,255,0.12); }}
.topnav-search .search-icon {{
  position:absolute; left:12px; top:50%; transform:translateY(-50%);
  color:rgba(255,255,255,0.4); font-size:0.85rem; pointer-events:none;
}}
.topnav-actions {{
  display:flex; gap:6px; align-items:center; flex-shrink:0;
}}
.nav-btn {{
  padding:6px 14px; border-radius:var(--radius); border:1px solid rgba(255,255,255,0.15);
  background:transparent; color:rgba(255,255,255,0.8); font-size:0.8rem; cursor:pointer;
  transition:all 0.2s; white-space:nowrap;
}}
.nav-btn:hover {{ background:rgba(255,255,255,0.1); color:#fff; }}
.nav-btn.active {{ background:var(--accent-orange); color:#fff; border-color:var(--accent-orange); }}
.nav-divider {{ width:1px; height:24px; background:rgba(255,255,255,0.12); margin:0 4px; }}

/* ═══════════════════════════════════════════════ */
/* KPI CARDS                                      */
/* ═══════════════════════════════════════════════ */
.kpi-section {{
  margin-top:var(--nav-height);
  padding:16px 24px;
  display:grid;
  grid-template-columns:repeat(6, 1fr);
  gap:12px;
}}
.kpi-card {{
  background:var(--bg-card);
  border:1px solid var(--border-color);
  border-radius:var(--radius-lg);
  padding:16px 18px;
  box-shadow:var(--card-shadow);
  cursor:pointer;
  transition:transform 0.15s, border-color 0.15s;
  position:relative;
  overflow:hidden;
}}
.kpi-card:hover {{
  transform:translateY(-2px);
  border-color:var(--accent-orange);
}}
.kpi-card::before {{
  content:'';
  position:absolute; top:0; left:0; right:0; height:3px;
  background:var(--accent-blue);
}}
.kpi-card.orange::before {{ background:var(--accent-orange); }}
.kpi-card.red::before {{ background:var(--accent-red); }}
.kpi-card.green::before {{ background:var(--accent-green); }}
.kpi-card.purple::before {{ background:var(--accent-purple); }}
.kpi-card.yellow::before {{ background:var(--accent-yellow); }}
.kpi-label {{ font-size:0.75rem; color:var(--text-secondary); margin-bottom:6px; font-weight:500; }}
.kpi-value {{ font-size:1.8rem; font-weight:700; color:var(--text-primary); line-height:1.2; }}
.kpi-sub {{ font-size:0.7rem; color:var(--text-muted); margin-top:4px; display:flex; align-items:center; gap:4px; }}
.kpi-trend-up {{ color:var(--accent-green); }}
.kpi-trend-down {{ color:var(--accent-red); }}

/* ═══════════════════════════════════════════════ */
/* NEWS SECTION — 每日快訊                        */
/* ═══════════════════════════════════════════════ */
.news-section {{
  padding:4px 24px 8px;
  display:flex; flex-direction:column; align-items:center;
}}
.news-section-inner {{
  width:100%; max-width:1180px;
}}
.news-header {{
  display:flex; justify-content:space-between; align-items:center;
  margin-bottom:10px;
}}
.news-title {{
  font-size:0.95rem; font-weight:700; color:var(--text-primary);
  display:flex; align-items:center; gap:8px;
}}
.news-title .news-badge {{
  background:var(--accent-orange); color:#fff;
  font-size:0.65rem; padding:2px 8px; border-radius:10px;
  letter-spacing:0.5px;
}}
.news-meta {{
  font-size:0.72rem; color:var(--text-muted);
}}
.news-cards {{
  display:grid;
  grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));
  gap:10px;
}}
.news-card {{
  background:var(--bg-card);
  border:1px solid var(--border-color);
  border-left:3px solid var(--accent-orange);
  border-radius:var(--radius);
  padding:12px 14px;
  transition:transform 0.15s, border-color 0.15s;
  text-decoration:none; color:inherit;
  display:flex; flex-direction:column; gap:6px;
}}
.news-card:hover {{
  transform:translateY(-1px);
  border-color:var(--accent-orange);
  background:var(--bg-card-hover);
}}
.news-card-title {{
  font-size:0.85rem; font-weight:500; color:var(--text-primary);
  line-height:1.35;
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
  overflow:hidden;
}}
.news-card-meta {{
  font-size:0.7rem; color:var(--text-muted);
  display:flex; gap:8px; align-items:center;
}}
.news-card-source {{
  color:var(--accent-orange); font-weight:500;
}}
.news-card-date {{
  color:var(--text-muted);
}}
.news-card-fallback {{
  display:inline-block;
  padding:1px 8px;
  border-radius:10px;
  background:rgba(212,114,48,0.12);
  color:var(--accent-orange);
  font-size:0.65rem;
  font-weight:600;
}}
.news-card.is-fallback {{
  border-style:dashed;
}}
.news-card-snippet {{
  font-size:0.75rem; color:var(--text-secondary);
  line-height:1.45;
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
  overflow:hidden;
}}
.news-empty {{
  color:var(--text-muted); font-size:0.8rem;
  padding:20px; text-align:center;
  border:1px dashed var(--border-color);
  border-radius:var(--radius);
}}
.news-toggle-btn {{
  margin-top:10px; align-self:center;
  background:transparent; border:1px solid var(--border-color);
  color:var(--text-secondary); padding:5px 16px;
  border-radius:14px; font-size:0.75rem; cursor:pointer;
  transition:all 0.2s;
}}
.news-toggle-btn:hover {{
  border-color:var(--accent-orange); color:var(--text-primary);
}}
@media (max-width: 768px) {{
  .news-section {{ padding:4px 16px 8px; }}
  .news-cards {{ grid-template-columns:1fr; }}
}}

/* ═══════════════════════════════════════════════ */
/* QUICK FILTER CHIPS                             */
/* ═══════════════════════════════════════════════ */
.quick-filters {{
  padding:8px 24px 0;
  display:flex; gap:6px; flex-wrap:wrap; align-items:center;
}}
.chip {{
  padding:5px 14px; border-radius:16px;
  font-size:0.78rem; font-weight:500; cursor:pointer;
  background:var(--bg-card); border:1px solid var(--border-color);
  color:var(--text-secondary); transition:all 0.2s; white-space:nowrap;
}}
.chip:hover {{ border-color:var(--accent-orange); color:var(--text-primary); }}
.chip.active {{ background:var(--accent-orange); color:#fff; border-color:var(--accent-orange); }}
.chip-separator {{ color:var(--text-muted); font-size:0.7rem; }}

/* ═══════════════════════════════════════════════ */
/* ADVANCED FILTERS ROW                           */
/* ═══════════════════════════════════════════════ */
.filter-row {{
  padding:10px 24px;
  display:flex; flex-wrap:wrap; gap:10px; align-items:center;
}}
.filter-group {{
  display:flex; align-items:center; gap:4px;
}}
.filter-group label {{
  font-size:0.75rem; color:var(--text-muted); white-space:nowrap;
}}
.filter-group select, .filter-group input {{
  padding:5px 10px; border:1px solid var(--border-color); border-radius:var(--radius);
  background:var(--bg-input); color:var(--text-primary); font-size:0.82rem;
  outline:none; transition:border-color 0.2s;
}}
.filter-group select:focus, .filter-group input:focus {{
  border-color:var(--accent-orange);
}}
.filter-group input[type="number"] {{ width:100px; }}
.btn-reset {{
  padding:5px 14px; border-radius:var(--radius); border:1px solid var(--border-color);
  background:var(--bg-card); color:var(--text-secondary); font-size:0.8rem; cursor:pointer;
}}
.btn-reset:hover {{ border-color:var(--accent-orange); color:var(--text-primary); }}
.result-count {{
  font-size:0.8rem; color:var(--text-muted); margin-left:auto;
}}

/* ═══════════════════════════════════════════════ */
/* MAIN LAYOUT — TABLE + SIDEBAR                  */
/* ═══════════════════════════════════════════════ */
.main-layout {{
  display:grid;
  grid-template-columns:1fr 340px;
  gap:0;
  padding:0 24px 24px;
  min-height:calc(100vh - 320px);
}}
.main-table-area {{
  overflow:hidden;
  border-radius:var(--radius-lg);
  border:1px solid var(--border-color);
  background:var(--bg-card);
  box-shadow:var(--card-shadow);
}}

/* ═══════════════════════════════════════════════ */
/* CASE TABLE                                     */
/* ═══════════════════════════════════════════════ */
.table-scroll {{ overflow-x:auto; max-height:600px; overflow-y:auto; }}
table {{ width:100%; border-collapse:collapse; font-size:0.83rem; }}
thead th {{
  background:var(--bg-table-header);
  padding:10px 12px; text-align:left; font-weight:600;
  position:sticky; top:0; z-index:2;
  cursor:pointer; white-space:nowrap;
  border-bottom:2px solid var(--border-color);
  color:var(--text-secondary); font-size:0.78rem; text-transform:uppercase; letter-spacing:0.3px;
  transition:color 0.15s;
}}
thead th:hover {{ color:var(--accent-orange); }}
thead th .sort-arrow {{ font-size:0.65rem; margin-left:3px; opacity:0.5; }}
thead th.sorted .sort-arrow {{ opacity:1; color:var(--accent-orange); }}
tbody tr {{
  border-bottom:1px solid var(--border-light);
  transition:background 0.12s; cursor:pointer;
}}
tbody tr:nth-child(even) {{ background:var(--bg-table-stripe); }}
tbody tr:hover {{ background:var(--bg-card-hover); }}
tbody td {{ padding:9px 12px; vertical-align:middle; }}
td.col-date {{ white-space:nowrap; color:var(--text-secondary); font-size:0.8rem; }}
td.col-court {{ white-space:nowrap; font-size:0.8rem; }}
td.col-parties {{ max-width:200px; font-size:0.78rem; line-height:1.35; }}
td.col-parties .pt-row {{ display:flex; align-items:center; gap:4px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }}
td.col-parties .pt-row + .pt-row {{ margin-top:2px; }}
td.col-parties .pt-tag {{
  display:inline-block; width:16px; height:16px; line-height:16px; text-align:center;
  font-size:0.68rem; font-weight:700; border-radius:3px; flex-shrink:0;
}}
td.col-parties .pt-tag-p {{ background:var(--accent-green-dim); color:var(--accent-green); }}
td.col-parties .pt-tag-d {{ background:var(--accent-red-dim); color:var(--accent-red); }}
td.col-parties .pt-name {{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }}
td.col-ruling {{
  max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  color:var(--text-secondary); font-size:0.8rem;
}}
td.col-ruling .expand-btn {{
  color:var(--accent-blue); cursor:pointer; font-size:0.75rem; margin-left:4px;
}}

/* Badges */
.badge-type {{
  display:inline-block; padding:2px 8px; border-radius:4px;
  font-size:0.7rem; font-weight:600;
}}
.badge-type-刑事 {{ background:var(--accent-red-dim); color:var(--accent-red); }}
.badge-type-民事 {{ background:var(--accent-blue-dim); color:var(--accent-blue); }}

.badge-oc {{
  display:inline-block; padding:3px 10px; border-radius:12px;
  font-size:0.72rem; font-weight:600; white-space:nowrap;
}}
.badge-oc-有罪 {{ background:var(--accent-red-dim); color:var(--accent-red); }}
.badge-oc-無罪 {{ background:var(--accent-green-dim); color:var(--accent-green); }}
.badge-oc-不受理 {{ background:var(--accent-gray-dim); color:var(--accent-gray); }}
.badge-oc-上訴駁回 {{ background:var(--accent-orange-dim); color:var(--accent-orange); }}
.badge-oc-原告勝訴 {{ background:var(--accent-green-dim); color:var(--accent-green); }}
.badge-oc-原告敗訴 {{ background:var(--accent-orange-dim); color:var(--accent-orange); }}
.badge-oc-撤銷發回 {{ background:var(--accent-yellow-dim); color:var(--accent-yellow); }}
.badge-oc-撤銷改判 {{ background:var(--accent-purple-dim); color:var(--accent-purple); }}
.badge-oc-其他 {{ background:var(--accent-gray-dim); color:var(--accent-gray); }}
.badge-oc-未知 {{ background:rgba(100,116,139,0.1); color:#64748b; }}

/* Keyword highlighting */
mark {{
  background:var(--accent-yellow-dim); color:var(--accent-yellow);
  padding:0 2px; border-radius:2px;
}}

/* ═══════════════════════════════════════════════ */
/* PAGINATION                                     */
/* ═══════════════════════════════════════════════ */
.pagination {{
  display:flex; justify-content:space-between; align-items:center;
  padding:12px 16px; border-top:1px solid var(--border-color);
  font-size:0.8rem;
}}
.pagination-info {{ color:var(--text-muted); }}
.pagination-btns {{ display:flex; gap:3px; }}
.pagination-btns button {{
  padding:5px 10px; border:1px solid var(--border-color); background:var(--bg-input);
  border-radius:var(--radius); cursor:pointer; font-size:0.8rem; color:var(--text-secondary);
  transition:all 0.15s;
}}
.pagination-btns button.active {{ background:var(--accent-orange); color:#fff; border-color:var(--accent-orange); }}
.pagination-btns button:hover:not(.active):not(:disabled) {{ border-color:var(--accent-orange); color:var(--text-primary); }}
.pagination-btns button:disabled {{ opacity:0.3; cursor:default; }}

/* ═══════════════════════════════════════════════ */
/* SIDEBAR                                        */
/* ═══════════════════════════════════════════════ */
.sidebar {{
  display:flex; flex-direction:column; gap:16px;
  padding-left:16px;
  overflow-y:auto;
}}
.sidebar-card {{
  background:var(--bg-card);
  border:1px solid var(--border-color);
  border-radius:var(--radius-lg);
  padding:16px;
  box-shadow:var(--card-shadow);
}}
.sidebar-card h3 {{
  font-size:0.85rem; font-weight:600; color:var(--text-primary);
  margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid var(--border-light);
}}
.chart-wrap {{ position:relative; width:100%; height:200px; min-height:200px; }}
.chart-wrap canvas {{ width:100% !important; height:100% !important; }}
.chart-wrap-tall {{ position:relative; width:100%; height:220px; min-height:220px; }}
.chart-wrap-tall canvas {{ width:100% !important; height:100% !important; }}
.chart-wrap-bar {{ position:relative; width:100%; height:240px; min-height:240px; }}

/* Horizontal bar — court list */
.court-bar-list {{ list-style:none; }}
.court-bar-item {{
  display:flex; align-items:center; gap:8px; margin-bottom:8px; font-size:0.78rem;
}}
.court-bar-label {{ width:90px; text-align:right; color:var(--text-secondary); flex-shrink:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }}
.court-bar-track {{ flex:1; height:20px; background:var(--bg-input); border-radius:3px; overflow:hidden; position:relative; }}
.court-bar-fill {{ height:100%; border-radius:3px; transition:width 0.5s; display:flex; align-items:center; justify-content:flex-end; padding-right:6px; font-size:0.68rem; font-weight:600; color:#fff; }}
.court-bar-count {{ font-size:0.75rem; color:var(--text-secondary); flex-shrink:0; width:32px; text-align:right; }}

/* ═══════════════════════════════════════════════ */
/* MODAL                                          */
/* ═══════════════════════════════════════════════ */
.modal-overlay {{
  display:none; position:fixed; inset:0;
  background:rgba(0,0,0,0.65); z-index:200;
  justify-content:center; align-items:flex-start;
  padding:60px 20px 20px; overflow-y:auto;
  backdrop-filter:blur(4px);
}}
.modal-overlay.active {{ display:flex; }}
.modal {{
  background:var(--bg-secondary);
  border:1px solid var(--border-color);
  border-radius:var(--radius-lg);
  max-width:840px; width:100%;
  max-height:85vh; overflow-y:auto;
  box-shadow:0 25px 60px rgba(0,0,0,0.5);
}}
.modal-header {{
  padding:18px 24px;
  border-bottom:1px solid var(--border-color);
  display:flex; justify-content:space-between; align-items:center;
  position:sticky; top:0; background:var(--bg-secondary); z-index:1;
}}
.modal-header h2 {{ font-size:1rem; font-weight:700; }}
.modal-close {{
  background:none; border:none; font-size:1.5rem; cursor:pointer;
  color:var(--text-muted); padding:4px 8px; line-height:1;
}}
.modal-close:hover {{ color:var(--text-primary); }}
.modal-body {{ padding:24px; }}
.modal-meta {{
  display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px;
  margin-bottom:20px; padding-bottom:16px; border-bottom:1px solid var(--border-light);
}}
.meta-item {{ }}
.meta-label {{ font-size:0.7rem; color:var(--text-muted); font-weight:500; text-transform:uppercase; letter-spacing:0.3px; margin-bottom:2px; }}
.meta-value {{ font-size:0.9rem; font-weight:500; }}
.modal-section {{
  margin-bottom:18px;
}}
.modal-section .section-label {{
  font-size:0.75rem; color:var(--text-muted); font-weight:600;
  text-transform:uppercase; letter-spacing:0.3px; margin-bottom:6px;
}}
.modal-section .section-content {{
  font-size:0.88rem; line-height:1.8;
}}
.ruling-box {{
  background:var(--bg-input); padding:14px 18px;
  border-radius:var(--radius); border-left:3px solid var(--accent-orange);
  font-size:0.88rem; line-height:1.8; white-space:pre-wrap;
}}
.statute-tags {{ display:flex; flex-wrap:wrap; gap:6px; }}
.statute-tag {{
  padding:3px 10px; border-radius:var(--radius);
  background:var(--accent-blue-dim); color:var(--accent-blue);
  font-size:0.78rem; font-weight:500;
}}
.modal-link {{
  display:inline-flex; align-items:center; gap:6px;
  padding:8px 16px; border-radius:var(--radius);
  background:var(--accent-orange-dim); color:var(--accent-orange);
  font-size:0.85rem; font-weight:600; transition:background 0.2s;
}}
.modal-link:hover {{ background:var(--accent-orange); color:#fff; text-decoration:none; }}

/* ═══════════════════════════════════════════════ */
/* SIDEBAR TOGGLE                                 */
/* ═══════════════════════════════════════════════ */
.sidebar-toggle {{
  display:none; position:fixed; bottom:20px; right:20px; z-index:50;
  width:48px; height:48px; border-radius:50%;
  background:var(--accent-orange); color:#fff; border:none;
  font-size:1.2rem; cursor:pointer;
  box-shadow:0 4px 12px rgba(255,107,0,0.4);
}}

/* ═══════════════════════════════════════════════ */
/* FOOTER                                         */
/* ═══════════════════════════════════════════════ */
.footer {{
  text-align:center; padding:20px 24px; color:var(--text-muted);
  font-size:0.72rem; border-top:1px solid var(--border-color);
  margin-top:24px;
}}
.footer a {{ color:var(--text-secondary); }}

/* ═══════════════════════════════════════════════ */
/* RESPONSIVE                                     */
/* ═══════════════════════════════════════════════ */
@media (max-width:1200px) {{
  .kpi-section {{ grid-template-columns:repeat(3, 1fr); }}
}}
@media (max-width:1024px) {{
  .main-layout {{ grid-template-columns:1fr; }}
  .sidebar {{ padding-left:0; padding-top:16px; max-height:none; flex-direction:row; flex-wrap:wrap; gap:12px; }}
  .sidebar-card {{ flex:1; min-width:280px; }}
  .sidebar-toggle {{ display:block; }}
  .topnav-search {{ max-width:260px; }}
}}
@media (max-width:768px) {{
  .kpi-section {{ grid-template-columns:repeat(2, 1fr); padding:12px 16px; gap:8px; }}
  .kpi-value {{ font-size:1.4rem; }}
  .topnav {{ padding:0 12px; gap:8px; }}
  .topnav-brand h1 {{ font-size:0.9rem; }}
  .topnav-search {{ max-width:180px; }}
  .quick-filters {{ padding:8px 16px 0; }}
  .filter-row {{ padding:8px 16px; }}
  .main-layout {{ padding:0 12px 16px; }}
  .sidebar {{ flex-direction:column; }}
  .sidebar-card {{ min-width:100%; }}
  /* Card layout for mobile */
  .table-scroll {{ display:none; }}
  .card-list {{ display:block !important; }}
}}
@media (max-width:480px) {{
  .kpi-section {{ grid-template-columns:1fr 1fr; }}
  .topnav-actions .nav-btn span.btn-label {{ display:none; }}
}}

/* Card layout (mobile) */
.card-list {{
  display:none; padding:12px;
}}
.case-card {{
  background:var(--bg-card); border:1px solid var(--border-color);
  border-radius:var(--radius); padding:14px; margin-bottom:10px;
  cursor:pointer; transition:border-color 0.15s;
}}
.case-card:hover {{ border-color:var(--accent-orange); }}
.case-card-top {{ display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }}
.case-card-date {{ font-size:0.78rem; color:var(--text-muted); }}
.case-card-body {{ font-size:0.85rem; }}
.case-card-parties {{ font-weight:500; margin-bottom:4px; }}
.case-card-court {{ font-size:0.78rem; color:var(--text-secondary); }}
</style>
</head>
<body>

<!-- ═══════════════ TOP NAVIGATION ═══════════════ -->
<nav class="topnav">
  <div class="topnav-brand">
    <h1>台灣<span class="hl">營業秘密</span>判決追蹤</h1>
    <span class="year-tag">2001–2026</span>
  </div>
  <div class="topnav-search">
    <span class="search-icon">&#x1F50D;</span>
    <input type="text" id="globalSearch" placeholder="搜尋案號、當事人、法官、法條…" oninput="applyFilters()">
  </div>
  <div class="topnav-actions">
    <button class="nav-btn active" data-type="" onclick="setTypeFilter(this,'')"><span class="btn-label">全部</span></button>
    <button class="nav-btn" data-type="刑事" onclick="setTypeFilter(this,'刑事')"><span class="btn-label">刑事</span></button>
    <button class="nav-btn" data-type="民事" onclick="setTypeFilter(this,'民事')"><span class="btn-label">民事</span></button>
    <div class="nav-divider"></div>
    <button class="nav-btn" onclick="toggleTheme()" id="themeBtn" title="切換主題">☀️</button>
    <button class="nav-btn" onclick="exportCSV()" title="匯出 CSV">📥 <span class="btn-label">CSV</span></button>
  </div>
</nav>

<!-- ═══════════════ KPI CARDS ═══════════════ -->
<section class="kpi-section">
  <div class="kpi-card orange" onclick="resetAndFilter()">
    <div class="kpi-label">判決總數</div>
    <div class="kpi-value">{total}</div>
    <div class="kpi-sub"><span class="kpi-trend-{'up' if yoy >= 0 else 'down'}">{yoy_arrow} {yoy_sign}{yoy}%</span> vs 去年（{stats['currentYearCount']} 件）</div>
  </div>
  <div class="kpi-card red" onclick="filterByType('刑事')">
    <div class="kpi-label">刑事案件</div>
    <div class="kpi-value">{criminal}</div>
    <div class="kpi-sub">佔 {criminal_pct}%・定罪率 {conviction_rate}%</div>
  </div>
  <div class="kpi-card" onclick="filterByType('民事')">
    <div class="kpi-label">民事案件</div>
    <div class="kpi-value">{civil}</div>
    <div class="kpi-sub">佔 {civil_pct}%・原告勝訴率 {civil_win_rate}%</div>
  </div>
  <div class="kpi-card green" onclick="filterByOutcome('有罪')">
    <div class="kpi-label">有罪判決</div>
    <div class="kpi-value">{guilty}</div>
    <div class="kpi-sub">刑事定罪 {guilty}/{stats['criminalDecided']} 件</div>
  </div>
  <div class="kpi-card purple" onclick="filterByOutcome('無罪')">
    <div class="kpi-label">無罪判決</div>
    <div class="kpi-value">{not_guilty}</div>
    <div class="kpi-sub">刑事無罪 {not_guilty}/{stats['criminalDecided']} 件</div>
  </div>
  <div class="kpi-card yellow" onclick="filterDamages()">
    <div class="kpi-label">民事勝訴賠償（中位數）</div>
    <div class="kpi-value">{format_money(stats['medianDamages'])}</div>
    <div class="kpi-sub">{stats['damagesCases']} 件民事勝訴・最高 {format_money(stats['maxDamages'])}</div>
  </div>
</section>

<!-- ═══════════════ DAILY NEWS ═══════════════ -->
<section class="news-section">
  <div class="news-section-inner">
    <div class="news-header">
      <div class="news-title">
        <span class="news-badge">NEWS</span>
        <span>每日營業秘密快訊</span>
      </div>
      <div class="news-meta" id="newsMeta">{news_meta_text}</div>
    </div>
    <div class="news-cards" id="newsCards"></div>
    <button class="news-toggle-btn" id="newsToggleBtn" onclick="toggleNews()" style="display:none">顯示全部</button>
  </div>
</section>

<!-- ═══════════════ QUICK FILTER CHIPS ═══════════════ -->
<div class="quick-filters">
  <span class="chip active" data-quick="" onclick="quickFilter(this,'')">全部</span>
  <span class="chip" data-quick="ipc" onclick="quickFilter(this,'ipc')">智商法院</span>
  <span class="chip" data-quick="guilty" onclick="quickFilter(this,'guilty')">有罪</span>
  <span class="chip" data-quick="not-guilty" onclick="quickFilter(this,'not-guilty')">無罪</span>
  <span class="chip" data-quick="dismissed" onclick="quickFilter(this,'dismissed')">上訴駁回</span>
  <span class="chip" data-quick="plaintiff-lose" onclick="quickFilter(this,'plaintiff-lose')">原告敗訴</span>
  <span class="chip" data-quick="recent" onclick="quickFilter(this,'recent')">近6個月</span>
  <span class="chip" data-quick="damages" onclick="quickFilter(this,'damages')">民事勝訴+有賠償</span>
</div>

<!-- ═══════════════ ADVANCED FILTERS ═══════════════ -->
<div class="filter-row">
  <div class="filter-group">
    <label>年度</label>
    <select id="filterYear" onchange="applyFilters()"><option value="">全部</option></select>
  </div>
  <div class="filter-group">
    <label>法院</label>
    <select id="filterCourt" onchange="applyFilters()"><option value="">全部</option></select>
  </div>
  <div class="filter-group">
    <label>結果</label>
    <select id="filterOutcome" onchange="applyFilters()">
      <option value="">全部</option>
      <option value="有罪">有罪</option>
      <option value="無罪">無罪</option>
      <option value="不受理">不受理</option>
      <option value="上訴駁回">上訴駁回</option>
      <option value="原告勝訴">原告勝訴</option>
      <option value="原告敗訴">原告敗訴</option>
      <option value="撤銷發回">撤銷發回</option>
      <option value="撤銷改判">撤銷改判</option>
      <option value="其他">其他</option>
      <option value="未知">未知</option>
    </select>
  </div>
  <div class="filter-group">
    <label>賠償≥</label>
    <input type="number" id="filterDamagesMin" placeholder="萬元" onchange="applyFilters()">
  </div>
  <div class="filter-group">
    <label>法官</label>
    <select id="filterJudge" onchange="applyFilters()"><option value="">全部</option></select>
  </div>
  <button class="btn-reset" onclick="resetFilters()">重置篩選</button>
  <span class="result-count" id="resultCount"></span>
</div>

<!-- ═══════════════ MAIN LAYOUT ═══════════════ -->
<div class="main-layout">
  <!-- TABLE AREA -->
  <div class="main-table-area">
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th onclick="sortBy('s')" style="width:40px"># <span class="sort-arrow">▼</span></th>
            <th onclick="sortBy('dt')">日期 <span class="sort-arrow">▼</span></th>
            <th onclick="sortBy('ct')">法院 <span class="sort-arrow">▼</span></th>
            <th onclick="sortBy('tp')" style="width:52px">類型 <span class="sort-arrow">▼</span></th>
            <th onclick="sortBy('oc')">結果 <span class="sort-arrow">▼</span></th>
            <th onclick="sortBy('pt')">當事人 <span class="sort-arrow">▼</span></th>
            <th>主文摘要</th>
          </tr>
        </thead>
        <tbody id="caseTableBody"></tbody>
      </table>
    </div>
    <div class="card-list" id="cardList"></div>
    <div class="pagination" id="pagination">
      <span class="pagination-info" id="paginationInfo"></span>
      <div class="pagination-btns" id="paginationBtns"></div>
    </div>
  </div>

  <!-- SIDEBAR -->
  <div class="sidebar" id="sidebarPanel">
    <div class="sidebar-card">
      <h3>刑事判決結果分布</h3>
      <div class="chart-wrap"><canvas id="outcomeChartCriminal" width="300" height="200"></canvas></div>
    </div>
    <div class="sidebar-card">
      <h3>民事判決結果分布</h3>
      <div class="chart-wrap"><canvas id="outcomeChartCivil" width="300" height="200"></canvas></div>
    </div>
    <div class="sidebar-card">
      <h3>歷年案件數（刑事 / 民事）</h3>
      <div class="chart-wrap-tall"><canvas id="yearChart" width="300" height="220"></canvas></div>
    </div>
    <div class="sidebar-card">
      <h3>法院分布（前 10）</h3>
      <ul class="court-bar-list" id="courtBarList"></ul>
    </div>
  </div>
</div>

<!-- ═══════════════ MODAL ═══════════════ -->
<div class="modal-overlay" id="modalOverlay" onclick="if(event.target===this)closeModal()">
  <div class="modal">
    <div class="modal-header">
      <h2 id="modalTitle"></h2>
      <button class="modal-close" onclick="closeModal()">&times;</button>
    </div>
    <div class="modal-body" id="modalBody"></div>
  </div>
</div>

<!-- ═══════════════ SIDEBAR TOGGLE (mobile) ═══════════════ -->
<button class="sidebar-toggle" id="sidebarToggle" onclick="toggleSidebar()">📊</button>

<!-- ═══════════════ FOOTER ═══════════════ -->
<div class="footer">
  台灣營業秘密判決追蹤儀表板 &middot; 資料來源：<a href="https://judgment.judicial.gov.tw" target="_blank" rel="noopener">司法院裁判書系統</a> &middot; 資料更新至 {today} &middot; 共 {total} 件判決
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<script>
/* ═══════════════════════════════════════════════ */
/* DATA                                           */
/* ═══════════════════════════════════════════════ */
const C = {cases_json};
const NEWS = {news_json};

/* ═══════════════════════════════════════════════ */
/* STATE                                          */
/* ═══════════════════════════════════════════════ */
let filtered = [...C];
let page = 1;
const PAGE_SIZE = 25;
let sort = {{ key:'dt', asc:false }};
let activeTypeFilter = '';
let activeQuick = '';
let searchTerm = '';
let newsExpanded = false;
const NEWS_COLLAPSED_COUNT = 6;

/* ═══════════════════════════════════════════════ */
/* INIT                                           */
/* ═══════════════════════════════════════════════ */
populateFilterOptions();
applyFilters();
renderNews();

window.addEventListener('load', function() {{
  try {{
    buildOutcomeChart();
  }} catch(e) {{ console.error('Outcome chart error:', e); }}
  try {{
    buildYearChart();
  }} catch(e) {{ console.error('Year chart error:', e); }}
  try {{
    buildCourtBars();
  }} catch(e) {{ console.error('Court bars error:', e); }}
}});

/* ═══════════════════════════════════════════════ */
/* NEWS                                           */
/* ═══════════════════════════════════════════════ */
function formatNewsDate(iso) {{
  if (!iso) return '';
  try {{
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);
    if (diffMin < 60 && diffMin >= 0) return diffMin + ' 分鐘前';
    if (diffHr < 24) return diffHr + ' 小時前';
    if (diffDay < 7) return diffDay + ' 天前';
    const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0');
    return y+'/'+m+'/'+dd;
  }} catch(e) {{ return ''; }}
}}

function escapeHTML(s) {{
  return String(s||'').replace(/[&<>"']/g, ch => ({{
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }}[ch]));
}}

function renderNews() {{
  const host = document.getElementById('newsCards');
  const btn = document.getElementById('newsToggleBtn');
  if (!host) return;

  const items = (NEWS && NEWS.items) ? NEWS.items : [];
  if (!items.length) {{
    host.innerHTML = '<div class="news-empty">暫無快訊資料（可執行 python3 fetch_news.py 產生 news.json）</div>';
    if (btn) btn.style.display = 'none';
    return;
  }}

  const toShow = newsExpanded ? items : items.slice(0, NEWS_COLLAPSED_COUNT);
  host.innerHTML = toShow.map(it => {{
    const titleRaw = it.title || '';
    // 去除 Google News 尾綴 " - 來源"
    const title = titleRaw.replace(/\\s+-\\s+[^-]+$/, '');
    const source = it.source || (titleRaw.match(/\\s-\\s+([^-]+)$/) || [,''])[1] || '';
    // 優先用真實日期（realDate）、真實 URL（realUrl）
    const when = formatNewsDate(it.realDate || it.published);
    const linkUrl = it.realUrl || it.url;
    const snippet = it.snippet || '';
    const fallbackBadge = it.fallback
      ? '<span class="news-card-fallback">較舊新聞</span>'
      : '';
    return `<a class="news-card${{it.fallback ? ' is-fallback' : ''}}" href="${{escapeHTML(linkUrl)}}" target="_blank" rel="noopener noreferrer">
      <div class="news-card-title">${{escapeHTML(title)}}</div>
      <div class="news-card-meta">
        ${{source ? `<span class="news-card-source">${{escapeHTML(source)}}</span>` : ''}}
        ${{when ? `<span class="news-card-date">${{when}}</span>` : ''}}
        ${{fallbackBadge}}
      </div>
      ${{snippet ? `<div class="news-card-snippet">${{escapeHTML(snippet)}}</div>` : ''}}
    </a>`;
  }}).join('');

  if (btn) {{
    if (items.length > NEWS_COLLAPSED_COUNT) {{
      btn.style.display = 'inline-block';
      btn.textContent = newsExpanded
        ? '收合' : ('顯示全部（共 ' + items.length + ' 則）');
    }} else {{
      btn.style.display = 'none';
    }}
  }}
}}

function toggleNews() {{
  newsExpanded = !newsExpanded;
  renderNews();
}}

function populateFilterOptions() {{
  // Years
  const years = [...new Set(C.map(c=>c.yr))].filter(Boolean).sort((a,b)=>b-a);
  const ySel = document.getElementById('filterYear');
  years.forEach(y => {{ const o=document.createElement('option'); o.value=y; o.textContent=y+'年'; ySel.appendChild(o); }});

  // Courts
  const cts = {{}};
  C.forEach(c => {{ cts[c.ct] = (cts[c.ct]||0)+1; }});
  const cSorted = Object.entries(cts).sort((a,b)=>b[1]-a[1]);
  const cSel = document.getElementById('filterCourt');
  cSorted.forEach(([n,cnt]) => {{ const o=document.createElement('option'); o.value=n; o.textContent=shortCourt(n)+' ('+cnt+')'; cSel.appendChild(o); }});

  // Judges (top 30)
  const jgs = {{}};
  C.forEach(c => {{ if(c.jg) jgs[c.jg] = (jgs[c.jg]||0)+1; }});
  const jSorted = Object.entries(jgs).sort((a,b)=>b[1]-a[1]).slice(0,30);
  const jSel = document.getElementById('filterJudge');
  jSorted.forEach(([n,cnt]) => {{ const o=document.createElement('option'); o.value=n; o.textContent=n+' ('+cnt+')'; jSel.appendChild(o); }});
}}

function shortCourt(s) {{
  return s.replace('臺灣','').replace('地方法院','地院').replace('智慧財產及商業法院','智商法院').replace('智慧財產法院','智財法院');
}}

/* ═══════════════════════════════════════════════ */
/* FILTERS                                        */
/* ═══════════════════════════════════════════════ */
function applyFilters() {{
  const outcome = document.getElementById('filterOutcome').value;
  const year = document.getElementById('filterYear').value;
  const court = document.getElementById('filterCourt').value;
  const judge = document.getElementById('filterJudge').value;
  const dmgMin = parseInt(document.getElementById('filterDamagesMin').value || '0') * 10000;
  searchTerm = document.getElementById('globalSearch').value.toLowerCase().trim();

  filtered = C.filter(c => {{
    if (activeTypeFilter && c.tp !== activeTypeFilter) return false;
    if (outcome && c.oc !== outcome) return false;
    if (year && c.yr != year) return false;
    if (court && c.ct !== court) return false;
    if (judge && c.jg !== judge) return false;
    if (dmgMin && (c.dn||0) < dmgMin) return false;
    if (searchTerm) {{
      const h = (c.ti+c.ci+c.pt+(c.pl||'')+(c.df||'')+c.rs+c.rl+c.jg+c.nm+c.st+c.ct).toLowerCase();
      if (!h.includes(searchTerm)) return false;
    }}
    return true;
  }});

  sortCases();
  page = 1;
  renderTable();
  renderCards();
  updateResultCount();
}}

function resetFilters() {{
  activeTypeFilter = '';
  activeQuick = '';
  document.getElementById('filterOutcome').value = '';
  document.getElementById('filterYear').value = '';
  document.getElementById('filterCourt').value = '';
  document.getElementById('filterJudge').value = '';
  document.getElementById('filterDamagesMin').value = '';
  document.getElementById('globalSearch').value = '';
  // Reset type buttons
  document.querySelectorAll('.topnav-actions .nav-btn[data-type]').forEach(b => b.classList.remove('active'));
  document.querySelector('.topnav-actions .nav-btn[data-type=""]').classList.add('active');
  // Reset chips
  document.querySelectorAll('.chip').forEach(ch => ch.classList.remove('active'));
  document.querySelector('.chip[data-quick=""]').classList.add('active');
  applyFilters();
}}

function setTypeFilter(btn, type) {{
  activeTypeFilter = type;
  document.querySelectorAll('.topnav-actions .nav-btn[data-type]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyFilters();
}}

function filterByType(type) {{
  activeTypeFilter = type;
  document.querySelectorAll('.topnav-actions .nav-btn[data-type]').forEach(b => {{
    b.classList.toggle('active', b.getAttribute('data-type') === type);
  }});
  applyFilters();
}}

function filterByOutcome(oc) {{
  document.getElementById('filterOutcome').value = oc;
  applyFilters();
}}

function filterDamages() {{
  // 民事勝訴賠償 KPI：自動鎖定民事 + 原告勝訴 + 有賠償金額
  activeTypeFilter = '民事';
  document.querySelectorAll('.topnav-actions .nav-btn[data-type]').forEach(b => {{
    b.classList.toggle('active', b.getAttribute('data-type') === '民事');
  }});
  document.getElementById('filterOutcome').value = '原告勝訴';
  document.getElementById('filterDamagesMin').value = '1';
  applyFilters();
}}

function quickFilter(chip, key) {{
  activeQuick = key;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');

  // Reset specific filters before applying quick
  document.getElementById('filterOutcome').value = '';
  document.getElementById('filterCourt').value = '';
  document.getElementById('filterDamagesMin').value = '';

  if (key === '') {{
    // Reset all
    activeTypeFilter = '';
    document.querySelectorAll('.topnav-actions .nav-btn[data-type]').forEach(b => {{
      b.classList.toggle('active', b.getAttribute('data-type') === '');
    }});
  }} else if (key === 'ipc') {{
    const ipcCourts = C.filter(c => c.ct.includes('智慧財產')).map(c => c.ct);
    const mainCourt = ipcCourts.length > 0 ? [...new Set(ipcCourts)].sort((a,b) =>
      ipcCourts.filter(x=>x===b).length - ipcCourts.filter(x=>x===a).length
    )[0] : '';
    if (mainCourt) document.getElementById('filterCourt').value = mainCourt;
  }} else if (key === 'guilty') {{
    document.getElementById('filterOutcome').value = '有罪';
  }} else if (key === 'not-guilty') {{
    document.getElementById('filterOutcome').value = '無罪';
  }} else if (key === 'dismissed') {{
    document.getElementById('filterOutcome').value = '上訴駁回';
  }} else if (key === 'plaintiff-lose') {{
    document.getElementById('filterOutcome').value = '原告敗訴';
  }} else if (key === 'recent') {{
    // Find most recent 6 months of data
    const dates = C.map(c => c.dt).filter(Boolean).sort().reverse();
    if (dates.length > 0) {{
      const latest = new Date(dates[0]);
      latest.setMonth(latest.getMonth() - 6);
      const cutoff = latest.toISOString().slice(0,10);
      // Use year filter for approximate
      document.getElementById('filterYear').value = new Date(dates[0]).getFullYear();
    }}
  }} else if (key === 'damages') {{
    activeTypeFilter = '民事';
    document.querySelectorAll('.topnav-actions .nav-btn[data-type]').forEach(b => {{
      b.classList.toggle('active', b.getAttribute('data-type') === '民事');
    }});
    document.getElementById('filterOutcome').value = '原告勝訴';
    document.getElementById('filterDamagesMin').value = '1';
  }}

  applyFilters();
}}

function resetAndFilter() {{ resetFilters(); }}

function updateResultCount() {{
  document.getElementById('resultCount').textContent =
    filtered.length === C.length ? C.length + ' 筆' : filtered.length + ' / ' + C.length + ' 筆';
}}

/* ═══════════════════════════════════════════════ */
/* SORTING                                        */
/* ═══════════════════════════════════════════════ */
function sortBy(key) {{
  if (sort.key === key) sort.asc = !sort.asc;
  else {{ sort.key = key; sort.asc = key === 's'; }}
  // Update header style
  document.querySelectorAll('thead th').forEach(th => th.classList.remove('sorted'));
  sortCases();
  renderTable();
  renderCards();
}}

function sortCases() {{
  const {{key, asc}} = sort;
  filtered.sort((a,b) => {{
    let va = a[key]||'', vb = b[key]||'';
    if (typeof va === 'number') return asc ? va-vb : vb-va;
    return asc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  }});
}}

/* ═══════════════════════════════════════════════ */
/* TABLE RENDERING                                */
/* ═══════════════════════════════════════════════ */
function highlightText(text, term) {{
  if (!term || !text) return text || '-';
  const esc = term.replace(/[.*+?^${{}}()|[\\]\\\\]/g, '\\\\$&');
  return text.replace(new RegExp('(' + esc + ')', 'gi'), '<mark>$1</mark>');
}}

function renderParties(c) {{
  const rows = [];
  if (c.pl) rows.push(`<div class="pt-row"><span class="pt-tag pt-tag-p" title="原告/上訴人">原</span><span class="pt-name">${{highlightText(c.pl, searchTerm)}}</span></div>`);
  if (c.df) rows.push(`<div class="pt-row"><span class="pt-tag pt-tag-d" title="被告/被上訴人">被</span><span class="pt-name">${{highlightText(c.df, searchTerm)}}</span></div>`);
  if (!rows.length && c.pt) rows.push(`<div class="pt-row"><span class="pt-name">${{highlightText(c.pt, searchTerm)}}</span></div>`);
  return rows.length ? rows.join('') : '<span style="color:var(--text-muted)">-</span>';
}}

function renderTable() {{
  const tbody = document.getElementById('caseTableBody');
  const start = (page-1)*PAGE_SIZE;
  const slice = filtered.slice(start, start+PAGE_SIZE);

  tbody.innerHTML = slice.map((c,i) => {{
    const idx = start+i;
    const ruling = c.rl ? (c.rl.length > 100 ? c.rl.substring(0,100)+'…' : c.rl) : '-';
    return `<tr onclick="openModal(${{idx}})">
      <td style="color:var(--text-muted)">${{idx+1}}</td>
      <td class="col-date">${{c.dt}}</td>
      <td class="col-court">${{highlightText(shortCourt(c.ct), searchTerm)}}</td>
      <td><span class="badge-type badge-type-${{c.tp}}">${{c.tp}}</span></td>
      <td><span class="badge-oc badge-oc-${{c.oc}}">${{c.oc}}</span></td>
      <td class="col-parties">${{renderParties(c)}}</td>
      <td class="col-ruling">${{highlightText(ruling, searchTerm)}}</td>
    </tr>`;
  }}).join('');

  renderPagination();
}}

function renderCards() {{
  const list = document.getElementById('cardList');
  const start = (page-1)*PAGE_SIZE;
  const slice = filtered.slice(start, start+PAGE_SIZE);

  list.innerHTML = slice.map((c,i) => {{
    const idx = start+i;
    return `<div class="case-card" onclick="openModal(${{idx}})">
      <div class="case-card-top">
        <span class="badge-oc badge-oc-${{c.oc}}">${{c.oc}}</span>
        <span class="case-card-date">${{c.dt}}</span>
      </div>
      <div class="case-card-body">
        <div class="case-card-parties">${{renderParties(c)}}</div>
        <div class="case-card-court"><span class="badge-type badge-type-${{c.tp}}">${{c.tp}}</span> ${{shortCourt(c.ct)}}</div>
      </div>
    </div>`;
  }}).join('');
}}

function renderPagination() {{
  const total = Math.ceil(filtered.length / PAGE_SIZE);
  const start = (page-1)*PAGE_SIZE + 1;
  const end = Math.min(page*PAGE_SIZE, filtered.length);

  document.getElementById('paginationInfo').textContent =
    filtered.length > 0 ? `${{start}}-${{end}} / ${{filtered.length}} 筆` : '無結果';

  const div = document.getElementById('paginationBtns');
  if (total <= 1) {{ div.innerHTML = ''; return; }}

  let html = `<button ${{page<=1?'disabled':''}} onclick="goPage(${{page-1}})">‹</button>`;
  for (let i=1; i<=total; i++) {{
    if (i===1 || i===total || Math.abs(i-page)<=2)
      html += `<button class="${{i===page?'active':''}}" onclick="goPage(${{i}})">${{i}}</button>`;
    else if (Math.abs(i-page)===3)
      html += `<button disabled>…</button>`;
  }}
  html += `<button ${{page>=total?'disabled':''}} onclick="goPage(${{page+1}})">›</button>`;
  div.innerHTML = html;
}}

function goPage(p) {{
  page = p;
  renderTable();
  renderCards();
  document.querySelector('.main-table-area').scrollTo(0,0);
}}

/* ═══════════════════════════════════════════════ */
/* MODAL                                          */
/* ═══════════════════════════════════════════════ */
function openModal(idx) {{
  const c = filtered[idx];
  if (!c) return;

  document.getElementById('modalTitle').textContent = c.nm || c.ci;

  // Statute tags
  const statTags = c.st ? c.st.split('、').map(s =>
    `<span class="statute-tag">${{s}}</span>`
  ).join('') : '<span style="color:var(--text-muted)">-</span>';

  document.getElementById('modalBody').innerHTML = `
    <div class="modal-meta">
      <div class="meta-item"><div class="meta-label">法院</div><div class="meta-value">${{c.ct}}</div></div>
      <div class="meta-item"><div class="meta-label">裁判日期</div><div class="meta-value">${{c.dt}}</div></div>
      <div class="meta-item"><div class="meta-label">案件類型</div><div class="meta-value"><span class="badge-type badge-type-${{c.tp}}">${{c.tp}}</span></div></div>
      <div class="meta-item"><div class="meta-label">判決結果</div><div class="meta-value"><span class="badge-oc badge-oc-${{c.oc}}">${{c.oc}}</span></div></div>
      <div class="meta-item"><div class="meta-label">案由</div><div class="meta-value">${{c.rs || '-'}}</div></div>
      <div class="meta-item"><div class="meta-label">承審法官</div><div class="meta-value">${{c.jg || '-'}}</div></div>
      <div class="meta-item"><div class="meta-label">${{c.tp==='刑事' ? '告訴人/上訴人' : '原告/上訴人'}}</div><div class="meta-value">${{c.pl || '-'}}</div></div>
      <div class="meta-item"><div class="meta-label">${{c.tp==='刑事' ? '被告' : '被告/被上訴人'}}</div><div class="meta-value">${{c.df || '-'}}</div></div>
      <div class="meta-item"><div class="meta-label">損害賠償</div><div class="meta-value">${{c.dm || '-'}}</div></div>
      <div class="meta-item"><div class="meta-label">全文字數</div><div class="meta-value">${{c.cc ? c.cc.toLocaleString()+' 字' : '-'}}</div></div>
    </div>
    ${{c.rl ? `<div class="modal-section"><div class="section-label">判決主文</div><div class="ruling-box">${{c.rl}}</div></div>` : ''}}
    ${{c.sm ? `<div class="modal-section"><div class="section-label">判決摘要</div><div class="section-content">${{c.sm}}</div></div>` : ''}}
    ${{c.ki ? `<div class="modal-section"><div class="section-label">主要爭點</div><div class="section-content">${{c.ki}}</div></div>` : ''}}
    ${{c.sig ? `<div class="modal-section"><div class="section-label">案件意義</div><div class="section-content">${{c.sig}}</div></div>` : ''}}
    <div class="modal-section">
      <div class="section-label">引用法條</div>
      <div class="statute-tags">${{statTags}}</div>
    </div>
    ${{c.ind ? `<div class="modal-section"><div class="section-label">產業別</div><div class="section-content">${{c.ind}}</div></div>` : ''}}
    <div style="margin-top:20px">
      <a class="modal-link" href="${{c.url}}" target="_blank" rel="noopener">查看裁判書全文（司法院）→</a>
    </div>
  `;

  document.getElementById('modalOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}}

function closeModal() {{
  document.getElementById('modalOverlay').classList.remove('active');
  document.body.style.overflow = '';
}}

document.addEventListener('keydown', e => {{ if (e.key==='Escape') closeModal(); }});

/* ═══════════════════════════════════════════════ */
/* CHARTS                                         */
/* ═══════════════════════════════════════════════ */
const chartTextColor = () => getComputedStyle(document.body).getPropertyValue('--text-secondary').trim();
const chartBorderColor = () => getComputedStyle(document.body).getPropertyValue('--border-color').trim();

const OUTCOME_COLORS = {{
  '有罪':'#E63939','無罪':'#2A9D8F','不受理':'#6B7280','上訴駁回':'#FF6B00',
  '原告勝訴':'#2A9D8F','原告敗訴':'#FF6B00','撤銷發回':'#F59E0B','撤銷改判':'#8B5CF6',
  '其他':'#6B7280','未知':'#374151'
}};

function buildOneOutcomeChart(canvasId, subset, order) {{
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const counts = {{}};
  subset.forEach(c => {{ counts[c.oc] = (counts[c.oc]||0)+1; }});
  const labels = order.filter(k => counts[k]);
  const data = labels.map(l => counts[l]);

  new Chart(canvas, {{
    type:'doughnut',
    data:{{
      labels: labels,
      datasets:[{{ data, backgroundColor:labels.map(l=>OUTCOME_COLORS[l]||'#6B7280'), borderWidth:2,
        borderColor:getComputedStyle(document.body).getPropertyValue('--bg-card').trim(),
        hoverOffset:6
      }}]
    }},
    options:{{
      responsive:true, maintainAspectRatio:false,
      cutout:'55%',
      plugins:{{
        legend:{{ position:'right', labels:{{ font:{{size:11, family:"Noto Sans TC"}}, padding:6,
          color:chartTextColor(),
          generateLabels: function(chart) {{
            const ds = chart.data.datasets[0];
            const total = ds.data.reduce((a,b)=>a+b,0);
            return chart.data.labels.map((label,i) => ({{
              text: label + ' ' + Math.round(ds.data[i]/total*100) + '%',
              fillStyle: ds.backgroundColor[i],
              hidden: false,
              index: i
            }}));
          }}
        }} }},
        tooltip:{{
          callbacks:{{
            label: ctx => ctx.label + ': ' + ctx.parsed + ' 件 (' + Math.round(ctx.parsed/ctx.dataset.data.reduce((a,b)=>a+b,0)*100) + '%)'
          }}
        }}
      }}
    }}
  }});
}}

function buildOutcomeChart() {{
  // 刑事：有罪 / 無罪 / 不受理 / 上訴駁回 / 撤銷發回 / 撤銷改判 / 其他 / 未知
  const criminalOrder = ['有罪','無罪','上訴駁回','撤銷發回','撤銷改判','不受理','其他','未知'];
  // 民事：原告勝訴 / 原告敗訴 / 上訴駁回 / 撤銷發回 / 撤銷改判 / 不受理 / 其他 / 未知
  const civilOrder = ['原告勝訴','原告敗訴','上訴駁回','撤銷發回','撤銷改判','不受理','其他','未知'];

  const criminalSubset = C.filter(c => c.tp === '刑事');
  const civilSubset = C.filter(c => c.tp === '民事');

  buildOneOutcomeChart('outcomeChartCriminal', criminalSubset, criminalOrder);
  buildOneOutcomeChart('outcomeChartCivil', civilSubset, civilOrder);
}}

function buildYearChart() {{
  const crimCounts = {{}};
  const civilCounts = {{}};
  C.forEach(c => {{
    if (c.yr < 2012) return;
    if (c.tp==='刑事') crimCounts[c.yr] = (crimCounts[c.yr]||0)+1;
    else if (c.tp==='民事') civilCounts[c.yr] = (civilCounts[c.yr]||0)+1;
  }});
  const allYears = [...new Set([...Object.keys(crimCounts), ...Object.keys(civilCounts)])].sort();
  const crimData = allYears.map(y => crimCounts[y]||0);
  const civilData = allYears.map(y => civilCounts[y]||0);

  new Chart(document.getElementById('yearChart'), {{
    type:'bar',
    data:{{
      labels:allYears,
      datasets:[
        {{ label:'刑事', data:crimData, backgroundColor:'rgba(230,57,57,0.7)', borderRadius:2, barPercentage:0.7 }},
        {{ label:'民事', data:civilData, backgroundColor:'rgba(59,130,246,0.7)', borderRadius:2, barPercentage:0.7 }}
      ]
    }},
    options:{{
      responsive:true, maintainAspectRatio:false,
      scales:{{
        x:{{ stacked:true, grid:{{display:false}}, ticks:{{color:chartTextColor(), font:{{size:10}} }} }},
        y:{{ stacked:true, beginAtZero:true, grid:{{color:chartBorderColor()}}, ticks:{{color:chartTextColor()}} }}
      }},
      plugins:{{
        legend:{{ labels:{{font:{{size:11, family:"Noto Sans TC"}}, color:chartTextColor(), padding:8}} }},
        tooltip:{{
          callbacks:{{ label: ctx => ctx.dataset.label + ': ' + ctx.parsed.y + ' 件' }}
        }}
      }}
    }}
  }});
}}

function buildCourtBars() {{
  const counts = {{}};
  C.forEach(c => {{ counts[c.ct] = (counts[c.ct]||0)+1; }});
  const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const maxCount = sorted[0]?.[1] || 1;

  const colors = ['#FF6B00','#3B82F6','#2A9D8F','#F59E0B','#8B5CF6',
    '#E63939','#06B6D4','#84CC16','#EC4899','#6B7280'];

  document.getElementById('courtBarList').innerHTML = sorted.map(([name,count],i) => {{
    const pct = Math.round(count/maxCount*100);
    return `<li class="court-bar-item">
      <span class="court-bar-label" title="${{name}}">${{shortCourt(name)}}</span>
      <div class="court-bar-track">
        <div class="court-bar-fill" style="width:${{pct}}%;background:${{colors[i%colors.length]}}">${{pct>25?count:''}}</div>
      </div>
      <span class="court-bar-count">${{count}}</span>
    </li>`;
  }}).join('');
}}

/* ═══════════════════════════════════════════════ */
/* THEME                                          */
/* ═══════════════════════════════════════════════ */
function toggleTheme() {{
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('themeBtn').textContent = isDark ? '🌙' : '☀️';
}}

/* ═══════════════════════════════════════════════ */
/* SIDEBAR TOGGLE (mobile)                        */
/* ═══════════════════════════════════════════════ */
function toggleSidebar() {{
  const sb = document.getElementById('sidebarPanel');
  sb.style.display = sb.style.display === 'none' ? 'flex' : 'none';
}}

/* ═══════════════════════════════════════════════ */
/* CSV EXPORT                                     */
/* ═══════════════════════════════════════════════ */
function exportCSV() {{
  const headers = ['序號','法院','案號','年度','日期','類型','結果','原告','被告','主文','法官','法條','損害賠償','案由','裁判書連結'];
  const esc = v => '"' + String(v||'').replace(/"/g,'""') + '"';
  const rows = filtered.map(c => [
    c.s, esc(c.ct), esc(c.ci), c.yr, c.dt, c.tp, c.oc, esc(c.pl||''), esc(c.df||''),
    esc(c.rl), esc(c.jg), esc(c.st), esc(c.dm), esc(c.rs), c.url
  ]);
  const csv = '\\uFEFF' + [headers.join(','), ...rows.map(r=>r.join(','))].join('\\n');
  const blob = new Blob([csv], {{type:'text/csv;charset=utf-8'}});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'trade_secret_cases_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
}}
</script>
</body>
</html>'''


def main():
    if not INPUT_JSON.exists():
        print(f"ERROR: {INPUT_JSON} not found.")
        print("Please run extract_fields.py first.")
        return

    with open(INPUT_JSON, 'r', encoding='utf-8') as f:
        cases = json.load(f)
    print(f"Loaded {len(cases)} cases")

    # Compute comprehensive stats
    stats = compute_stats(cases)
    print(f"Criminal: {stats['criminal']}, Civil: {stats['civil']}")
    print(f"Conviction rate: {stats['convictionRate']}%")
    print(f"Civil plaintiff win rate: {stats['civilWinRate']}%")
    print(f"Damages cases: {stats['damagesCases']}, Median: {format_money(stats['medianDamages'])}")

    # Trim cases for dashboard
    trimmed = [trim_case_for_dashboard(c) for c in cases]
    cases_json = json.dumps(trimmed, ensure_ascii=False, separators=(',', ':'))
    print(f"Trimmed data size: {len(cases_json) / 1024:.0f} KB")

    # Load news (optional)
    news = {'items': [], 'generatedAt': ''}
    if NEWS_JSON.exists():
        try:
            with open(NEWS_JSON, 'r', encoding='utf-8') as f:
                news = json.load(f)
            print(f"Loaded news: {len(news.get('items', []))} items")
        except Exception as e:
            print(f"WARN: news.json parse failed: {e}")
    else:
        print(f"INFO: {NEWS_JSON} not found — dashboard will show 'no news' placeholder")

    # Generate HTML
    html = build_html(cases_json, stats, news)
    with open(OUTPUT_HTML, 'w', encoding='utf-8') as f:
        f.write(html)

    file_size = os.path.getsize(OUTPUT_HTML) / 1024
    print(f"Dashboard generated: {OUTPUT_HTML} ({file_size:.0f} KB)")
    print(f"Total lines: {html.count(chr(10))}")

if __name__ == '__main__':
    main()
