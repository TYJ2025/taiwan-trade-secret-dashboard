#!/usr/bin/env node
/**
 * 產製智慧財產法院「損害賠償」議題之 AI 認定摘要草稿（Phase 2 全批）
 *
 * 設計原則（見 CLAUDE.md §2/§3/§6）：
 * - holding 由 data/judgments.json 既有且通過 sanity-check 之結構化損害賠償欄位生成
 *   （outcome、damagesRequested 請求金額、damagesNum 判准金額、calcMethods、damagesStatutes），
 *   為「結構化抽取草稿」，非逐案通讀全文之分析；reviewed 一律 false。
 * - quotable 一律留空：damagesSnippet／holdings index snippet 均為空白正規化字串，
 *   逐字存在於原文之比率極低（4/157），不可作逐字引用；UI 已於下方提供 ±250 字命中 snippet
 *   作為逐字依據，不在此重複或冒充。
 * - 大立光終局判決（IPCV,102,民營訴,6,20171206,1）保留人工驗證之分析型 holding＋逐字 quotable，
 *   不被本批覆寫（見 PRESERVE 區）。
 *
 * 來源：data/factcourt_holdings_index.json（取命中 damages 議題之 jids）
 *      data/judgments.json（結構化欄位）
 * 輸出：data/factcourt_holdings_curated.json（+ public/data 同名）
 *
 * Usage: node scripts/gen_factcourt_curated_damages.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const IDX = path.join(ROOT, 'data', 'factcourt_holdings_index.json');
const META = path.join(ROOT, 'data', 'judgments.json');
const OUT = path.join(ROOT, 'data', 'factcourt_holdings_curated.json');
const PUB = path.join(ROOT, 'public', 'data', 'factcourt_holdings_curated.json');

const COURT_SHORT = { '智慧財產及商業法院': '智商法院', '智慧財產法院': '智財法院', '最高法院': '最高法院' };

// 人工驗證之分析型條目（不被結構化批次覆寫）
const PRESERVE_JID = 'IPCV,102,民營訴,6,20171206,7';

const fmt = (n) => (typeof n === 'number' && n > 0 ? n.toLocaleString('en-US') : null);

function caseNoOf(m) {
  return `${COURT_SHORT[m.court] || m.court} ${m.rocYear} ${m.caseWord} ${m.caseNum}`;
}

function buildHolding(m) {
  const award = fmt(m.damagesNum);
  const req = fmt(m.damagesRequested);
  const calc = Array.isArray(m.calcMethods) ? m.calcMethods.filter(Boolean) : [];
  const stat = Array.isArray(m.damagesStatutes) ? m.damagesStatutes.filter(Boolean) : [];
  const outcome = (m.outcome || '').trim();

  const parts = [];
  if (award) {
    parts.push(`本案${outcome ? `${outcome}，` : ''}損害賠償部分本院判准 ${award} 元${req ? `（原告請求 ${req} 元）` : ''}。`);
  } else {
    parts.push(`本案${outcome ? `${outcome}，` : ''}損害賠償部分判准 0 元${req ? `（原告請求 ${req} 元未獲准）` : ''}；營業秘密侵權之金錢賠償於原告未能證明營業秘密要件、侵害行為或損害（含因果關係）時多遭駁回。`);
  }
  if (calc.length) parts.push(`涉及之損害計算方法：${calc.join('、')}。`);
  if (stat.length) parts.push(`引用條文：${stat.join('、')}。`);
  return parts.join('');
}

function buildNature(m) {
  const isJudgment = String(m.title || '').endsWith('判決') || m.caseType ? true : true;
  // 判決：法院就損害賠償（含駁回）為實體論述 → 實體認定；裁定 → 程序脈絡
  const docType = String(m.title || '').includes('裁定') ? '裁定' : '判決';
  if (docType === '裁定') return '程序脈絡';
  // 判准>0 或有具體計算方法主張之判決 → 實體認定；其餘判決仍多有要件論述，預設實體認定
  return '實體認定';
}

function main() {
  const idx = JSON.parse(fs.readFileSync(IDX, 'utf8'));
  const metaArr = JSON.parse(fs.readFileSync(META, 'utf8')).judgments;
  const byJid = {};
  metaArr.forEach((m) => { byJid[m.judgmentId] = m; });

  // 保留既有大立光分析型條目（若存在）
  let preserved = null;
  if (fs.existsSync(OUT)) {
    try {
      const prev = JSON.parse(fs.readFileSync(OUT, 'utf8'));
      preserved = prev?.topics?.damages?.cases?.[PRESERVE_JID] || null;
    } catch { /* ignore */ }
  }

  const dmgJids = Object.entries(idx.cases)
    .filter(([, c]) => c.topicHits && c.topicHits.damages)
    .map(([j]) => j);

  const cases = {};
  let award0 = 0, awardPos = 0, natureCount = {};
  for (const jid of dmgJids) {
    const m = byJid[jid];
    if (!m) continue;
    if (jid === PRESERVE_JID && preserved) {
      cases[jid] = preserved; // 保留人工驗證版
      continue;
    }
    const docType = String(m.title || '').includes('裁定') ? '裁定' : '判決';
    const nature = buildNature(m);
    natureCount[nature] = (natureCount[nature] || 0) + 1;
    if (m.damagesNum > 0) awardPos++; else award0++;
    cases[jid] = {
      caseNo: caseNoOf(m),
      adDate: m.adDate || '',
      docType,
      caseType: m.caseType || '',
      natureOfDiscussion: nature,
      holding: buildHolding(m),
      quotable: '', // 結構化抽取草稿不附逐字引用；逐字依據見 UI 下方命中段落
      contextNote: '事實審；判准／請求金額、損害計算方法、引用條文係自判決全文以正則／啟發式抽取之結構化欄位（非逐案通讀全文之分析），引用前請核對司法院原文與後續審級結果。',
      reviewed: false,
    };
  }

  const out = {
    version: '1.1',
    scope: 'factcourt',
    generatedAt: new Date().toISOString().slice(0, 19),
    generator: 'scripts/gen_factcourt_curated_damages.mjs — 依結構化損害賠償欄位生成之認定摘要草稿（非逐案通讀全文）；大立光終局條目為人工驗證之分析型摘要',
    disclosure: '智慧財產法院「損害賠償」議題 AI 認定摘要（reviewed=false）。holding 由已抽取之結構化欄位（判准／請求金額、計算方法、條文）生成，屬抽取草稿而非逐案全文分析；quotable 多留空，逐字court語請見頁面下方「命中段落」snippet。大立光終局判決條目附人工驗證之逐字 quotable。',
    topics: {
      damages: {
        topicName: '損害賠償',
        natureStats: natureCount,
        cases,
      },
    },
  };

  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  fs.mkdirSync(path.dirname(PUB), { recursive: true });
  fs.writeFileSync(PUB, JSON.stringify(out, null, 1));

  // ── sanity checks（CLAUDE.md §2）──
  const tl = cases[PRESERVE_JID];
  console.log('='.repeat(56));
  console.log(`damages cases written: ${Object.keys(cases).length}（判准>0: ${awardPos}, 判准=0: ${award0}）`);
  console.log('natureOfDiscussion 分布:', JSON.stringify(natureCount));
  console.log('大立光終局條目存在:', !!tl, '| reviewed:', tl?.reviewed, '| quotable非空:', !!(tl?.quotable));
  console.log('大立光 holding 含 1,522,470,639:', !!(tl?.holding?.includes('1,522,470,639')));
  // 任一 award=0 案
  const z = Object.entries(cases).find(([j, c]) => byJid[j] && byJid[j].damagesNum === 0 && j !== PRESERVE_JID);
  if (z) console.log('抽樣敗訴/未准案:', z[0], '\n  holding:', z[1].holding.slice(0, 110));
  const p = Object.entries(cases).find(([j, c]) => byJid[j] && byJid[j].damagesNum > 0 && j !== PRESERVE_JID);
  if (p) console.log('抽樣判准>0案:', p[0], '| 判准', byJid[p[0]].damagesNum, '\n  holding:', p[1].holding.slice(0, 110));
  console.log('='.repeat(56));
}

main();
