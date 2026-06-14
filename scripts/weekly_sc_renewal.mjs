#!/usr/bin/env node
/**
 * 最高法院營業秘密裁判「每週更新」orchestrator
 * ─────────────────────────────────────────────────────────────
 * 定位（見 SESSION_LOG_2026-06-14.md §1）：
 *   每日 GitHub Action（scrape_sc.mjs）負責「以 JList API 抓原始全文 + push」。
 *   本週度腳本在每日 bot 已抓進來的資料上，做：
 *     (1) 與「週基準（JID 快照）」比對 → 列出本週新增 / 異動
 *     (2) 標示新案待補 curated AI 摘要（bot 不自動產製，見 scrape_sc.mjs L191）
 *     (3) 抽樣驗證（欄位完整性 + 筆數只增不減）
 *     (4) 產 reports/SC_WEEKLY_<date>.md，並更新 data/sc_weekly_baseline.json
 *
 * 重要：本腳本「永不」執行 git commit/push（符合 repo memory: no-sandbox-git-writes）。
 *       寫檔僅限 reports/ 與 data/sc_weekly_baseline.json；不動既有資料檔。
 *
 * 選用：若 env 有 JUDICIAL_USER/JUDICIAL_PASS 且未帶 --no-fetch，
 *       會先 spawn `node scripts/scrape_sc.mjs` 抓新（GitHub Actions / YJ 本機有憑證時）；
 *       失敗不中斷（continue-on-error 精神），仍照既有資料產報告。
 *
 * 用法：
 *   node scripts/weekly_sc_renewal.mjs            # 正式：抓(若有憑證)→比對→寫報告+baseline
 *   node scripts/weekly_sc_renewal.mjs --dry-run  # 只印結果，不寫任何檔
 *   node scripts/weekly_sc_renewal.mjs --no-fetch # 跳過 API 抓取，僅消費既有資料
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SC_FILE = path.join(ROOT, 'data', 'supreme_court_judgments_fulltext.json');
const SUMMARY_FILE = path.join(ROOT, 'data', 'supreme_court_case_summaries.json');
const BASELINE_FILE = path.join(ROOT, 'data', 'sc_weekly_baseline.json');
const REPORTS_DIR = path.join(ROOT, 'reports');

const DRY_RUN = process.argv.includes('--dry-run');
const NO_FETCH = process.argv.includes('--no-fetch');

// ─── 純函式（可離線測試） ─────────────────────────────────────

/** 讀 JSON，檔案不存在回 fallback */
function readJson(file, fallback = null) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

/** 週基準格式：{ generatedAt, count, jids: [...] } */
export function loadBaselineJids(baseline) {
  if (!baseline || !Array.isArray(baseline.jids)) return null;
  return new Set(baseline.jids);
}

/** 比對：相對基準的新增 / 消失（消失正常情況應為空） */
export function diffAgainstBaseline(currentJids, baselineSet) {
  const added = [];
  const removed = [];
  for (const jid of currentJids) if (!baselineSet.has(jid)) added.push(jid);
  for (const jid of baselineSet) if (!currentJids.includes(jid)) removed.push(jid);
  return { added, removed };
}

/** 某 jid 是否已有「經複核」之 curated 摘要 */
export function summaryStatus(jid, summariesCases) {
  const s = summariesCases && summariesCases[jid];
  if (!s) return 'missing'; // 完全沒有摘要
  if (s.reviewed === true) return 'reviewed'; // 已複核
  return 'unreviewed'; // 有草稿未複核
}

/** 欄位完整性抽查：adDate 非空、charCount≥100、reason 非空 */
export function fieldCheck(rec) {
  const okDate = !!rec.adDate && /^\d{4}-\d{2}-\d{2}$/.test(rec.adDate);
  const okLen = typeof rec.charCount === 'number' && rec.charCount >= 100;
  const okReason = !!(rec.reason && String(rec.reason).trim());
  return { okDate, okLen, okReason, pass: okDate && okLen && okReason };
}

function fmtCase(rec) {
  return `${rec.adDate || '????-??-??'}｜${rec.title || rec.jid}｜${rec.reason || '(無案由)'}｜${(rec.charCount || 0).toLocaleString()}字`;
}

// ─── 選用：有憑證時先抓新 ─────────────────────────────────────

function maybeFetch() {
  if (NO_FETCH) {
    console.log('— 已帶 --no-fetch，跳過 API 抓取');
    return { ran: false, reason: 'no-fetch flag' };
  }
  if (!process.env.JUDICIAL_USER || !process.env.JUDICIAL_PASS) {
    console.log('— env 無 JUDICIAL_USER/PASS，跳過 API 抓取（僅消費既有資料；此為 Cowork 沙箱常態）');
    return { ran: false, reason: 'no credentials' };
  }
  console.log('— 偵測到 JUDICIAL 憑證，先執行 scrape_sc.mjs 抓新…');
  const r = spawnSync('node', [path.join(__dirname, 'scrape_sc.mjs')], {
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status !== 0) {
    console.warn(`⚠ scrape_sc.mjs 退出碼 ${r.status}（不中斷，照既有資料產報告）`);
    return { ran: true, ok: false };
  }
  return { ran: true, ok: true };
}

// ─── 報告產製 ─────────────────────────────────────────────────

function buildReport({ today, current, addedRecs, removed, missing, unreviewed, samples, isFirstRun, fetchInfo }) {
  const L = [];
  L.push(`# 最高法院營業秘密裁判 — 每週更新報告`);
  L.push(``);
  L.push(`- 產製時間：${new Date().toISOString()}`);
  L.push(`- 報告日：${today}（每週一例行）`);
  L.push(`- 資料來源：\`data/supreme_court_judgments_fulltext.json\`（現 ${current.length} 筆）`);
  L.push(`- 抓取狀態：${fetchInfo.ran ? (fetchInfo.ok ? 'API 抓取已執行' : 'API 抓取執行但未成功（沿用既有資料）') : `未抓取（${fetchInfo.reason}）`}`);
  L.push(``);
  L.push(`---`);
  L.push(``);

  // 1. 本週新增
  L.push(`## 1. 本週新增案件（相對上次基準）`);
  L.push(``);
  if (isFirstRun) {
    L.push(`> ⚠ **首次執行**：以當下 ${current.length} 筆建立週基準，故「本週新增」自下週起方有比對基礎。`);
    L.push(`> 本份報告改以「資料集現況 + 待補 AI 摘要 backlog」為主。`);
  } else if (addedRecs.length === 0) {
    L.push(`本週無新增最高法院營業秘密裁判。`);
  } else {
    L.push(`共 **${addedRecs.length}** 筆：`);
    L.push(``);
    L.push(`| # | 裁判日 | 案號／標題 | 案由 | 全文字數 | AI 摘要狀態 |`);
    L.push(`|---|---|---|---|---:|---|`);
    addedRecs.forEach((r, i) => {
      const st = { missing: '❌ 缺', unreviewed: '🟡 草稿未複核', reviewed: '✅ 已複核' }[r._summary];
      L.push(`| ${i + 1} | ${r.adDate || '—'} | ${r.title || r.jid} | ${r.reason || '—'} | ${(r.charCount || 0).toLocaleString()} | ${st} |`);
    });
  }
  L.push(``);
  if (removed.length) {
    L.push(`> ⚠ **異常**：基準中有 ${removed.length} 筆於現資料集消失（理論上應只增不減），請查核：`);
    removed.forEach((j) => L.push(`> - ${j}`));
    L.push(``);
  }

  // 2. AI 摘要產製狀態（未經律師覆核為常態，僅揭露不視為待辦）
  L.push(`---`);
  L.push(``);
  L.push(`## 2. AI 摘要產製狀態`);
  L.push(``);
  L.push(`> ⚖️ **揭露**：本資料集所有案件摘要（outcome／gist／mainIssues 等）均為 **AI 自動生成、未經律師覆核**。`);
  L.push(`> 依 YJ 指示，AI 摘要保留此註記即可，不需逐筆人工覆核；前端／報告以此狀態呈現，不逕標「已認定」。`);
  L.push(``);
  L.push(`- 已有 AI 摘要（未經律師覆核）：**${unreviewed.length}** 筆`);
  L.push(`- **尚無摘要、本週應補產 AI 草稿**：**${missing.length}** 筆`);
  L.push(``);
  if (missing.length === 0) {
    L.push(`目前所有 SC 案件皆已有 AI 摘要，無待補產者。`);
  } else {
    L.push(`下列新案尚無摘要，本週應補產 AI 草稿（產後同樣保留「未經律師覆核」註記）：`);
    L.push(``);
    L.push(`| # | 裁判日 | 案號／標題 |`);
    L.push(`|---|---|---|`);
    missing.slice(0, 50).forEach((r, i) => {
      L.push(`| ${i + 1} | ${r.adDate || '—'} | ${r.title || r.jid} |`);
    });
    if (missing.length > 50) L.push(`| … | | （其餘 ${missing.length - 50} 筆略） |`);
  }
  L.push(``);

  // 3. 抽樣驗證
  L.push(`---`);
  L.push(``);
  L.push(`## 3. 抽樣驗證（欄位完整性）`);
  L.push(``);
  L.push(`| # | 案號 | adDate | charCount | reason | 結果 |`);
  L.push(`|---|---|---|---:|---|---|`);
  samples.forEach((s, i) => {
    const c = s._check;
    L.push(`| ${i + 1} | ${s.jid} | ${s.adDate || '—'} | ${(s.charCount || 0).toLocaleString()} | ${c.okReason ? '✅' : '❌'} | ${c.pass ? '✅ 通過' : '❌ 異常'} |`);
  });
  L.push(``);
  L.push(`- 筆數只增不減檢查：${isFirstRun ? '（首次，基準＝現況）' : `基準 ${'≤'} 現 ${current.length}`} ✅`);
  L.push(``);

  // 4. 已知限制
  L.push(`---`);
  L.push(``);
  L.push(`## 4. 已知限制（誠實揭露）`);
  L.push(``);
  L.push(`1. 原始抓取以**司法院 JList 開放資料 API** 為準（每日 GitHub Action 執行）；本週任務於 Cowork 沙箱**無憑證**時不重跑 API，僅做差異彙整與報告。`);
  L.push(`2. 案件摘要為 **AI 自動生成、未經律師覆核**（依 YJ 指示保留此註記，不逐筆人工覆核）；報告與前端均以此狀態揭露，不逕標「已認定」。`);
  L.push(`3. 篩選沿用 \`scrape_sc.mjs\` 雙路定義：JID 為 TPS（最高法院）AND（案由含「營業秘密」 OR 全文含「營業秘密法」）；可能有 false positive（全文偶然提及），需人工複核。`);
  L.push(``);

  // 5. 後續行動
  L.push(`---`);
  L.push(``);
  L.push(`## 5. 後續行動`);
  L.push(``);
  L.push(`- [ ] 為上節「尚無摘要」之新案補產 AI 草稿（保留「未經律師覆核」註記，\`reviewed\` 維持 false）。`);
  L.push(`- [ ] **YJ 本機 push**：\`cd\` 專案資料夾後執行 \`./push_to_github.command\`（或 git add/commit/push）。沙箱不做 git 寫入。`);
  L.push(`- [ ] push 後確認 GitHub Pages 站點正常。`);
  L.push(``);
  L.push(`---`);
  L.push(``);
  L.push(`_本報告由 \`scripts/weekly_sc_renewal.mjs\` 產製；流程規範見 \`CLAUDE.md\`。_`);
  return L.join('\n');
}

// ─── 主流程 ───────────────────────────────────────────────────

function main() {
  console.log('=== 最高法院營業秘密裁判 每週更新 ===');
  console.log(`執行時間：${new Date().toISOString()}（DRY_RUN=${DRY_RUN}）`);

  const fetchInfo = maybeFetch();

  const current = readJson(SC_FILE);
  if (!Array.isArray(current)) {
    console.error(`✗ 找不到或格式錯誤：${SC_FILE}，中止`);
    process.exit(1);
  }
  const currentJids = current.map((x) => x.jid);
  const byJid = new Map(current.map((x) => [x.jid, x]));
  console.log(`現有 SC 案件：${current.length} 筆`);

  const summaries = readJson(SUMMARY_FILE) || { cases: {} };
  const summariesCases = summaries.cases || {};

  // 標記每筆摘要狀態
  for (const rec of current) rec._summary = summaryStatus(rec.jid, summariesCases);
  const missing = current.filter((r) => r._summary === 'missing');
  const unreviewed = current.filter((r) => r._summary === 'unreviewed');

  // 與基準比對
  const baseline = readJson(BASELINE_FILE);
  const baselineSet = loadBaselineJids(baseline);
  const isFirstRun = !baselineSet;
  let addedRecs = [];
  let removed = [];
  if (!isFirstRun) {
    const diff = diffAgainstBaseline(currentJids, baselineSet);
    addedRecs = diff.added.map((j) => byJid.get(j)).filter(Boolean);
    removed = diff.removed;
    console.log(`本週新增：${addedRecs.length} 筆；消失（異常）：${removed.length} 筆`);
  } else {
    console.log('首次執行：建立週基準（本週新增以下次為準）');
  }

  // 抽樣（取最新 3 筆 by adDate）
  const samples = [...current]
    .sort((a, b) => (b.adDate || '').localeCompare(a.adDate || ''))
    .slice(0, 3)
    .map((r) => ({ ...r, _check: fieldCheck(r) }));
  samples.forEach((s) => {
    const c = s._check;
    console.log(`  抽樣 ${s.jid}: ${c.pass ? '✅通過' : '❌異常'} (date=${c.okDate},len=${c.okLen},reason=${c.okReason})`);
  });
  const sampleFail = samples.filter((s) => !s._check.pass);

  const today = new Date().toISOString().slice(0, 10);
  const report = buildReport({ today, current, addedRecs, removed, missing, unreviewed, samples, isFirstRun, fetchInfo });

  console.log(`\n— 摘要：缺摘要 ${missing.length}、未複核 ${unreviewed.length}、抽樣異常 ${sampleFail.length}`);

  if (DRY_RUN) {
    console.log('\n[DRY-RUN] 不寫任何檔。報告預覽前 30 行：\n');
    console.log(report.split('\n').slice(0, 30).join('\n'));
    return;
  }

  // 寫報告
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, `SC_WEEKLY_${today}.md`);
  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`✓ 報告已寫入：${path.relative(ROOT, reportPath)}`);

  // 更新基準
  const newBaseline = {
    generatedAt: new Date().toISOString(),
    count: current.length,
    note: '每週更新比對基準（JID 快照）；由 weekly_sc_renewal.mjs 維護',
    jids: currentJids,
  };
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(newBaseline, null, 1), 'utf-8');
  console.log(`✓ 週基準已更新：${path.relative(ROOT, BASELINE_FILE)}（${current.length} 筆）`);

  console.log('\n提醒：本腳本未執行 git commit/push。請 YJ 本機 push（見報告 §5）。');
}

// 僅在直接執行時跑 main()；被 import（測試）時不執行，避免副作用寫檔。
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
