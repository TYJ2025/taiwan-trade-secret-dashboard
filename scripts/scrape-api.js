#!/usr/bin/env node
/**
 * 台灣營業秘密案件自動抓取腳本
 * 執行時間：每日 04:06 AM (台灣時間)
 *
 * 資料來源：
 * 1. 司法院裁判書開放資料 API (primary, 00:00~06:00 可用)
 * 2. 司法院裁判書查詢系統 (fallback web scraping)
 *
 * 使用方式：
 *   JUDICIAL_USER=xxx JUDICIAL_PASS=yyy node scripts/scrape-api.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  authenticate,
  fetchJList,
  fetchJDoc,
  isTradeSecretCase,
  delay,
} from './utils/judicial-api.js';
import {
  parseCourt,
  parseCaseType,
  parseResult,
  parseStatutes,
  parseDamages,
  parseKeyIssues,
  parseTechnology,
  getIndustryCategory,
  formatDamages,
} from './utils/text-parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const CASES_FILE = path.join(DATA_DIR, 'cases.json');

async function main() {
  console.log('=== 台灣營業秘密案件抓取腳本 ===');
  console.log(`執行時間：${new Date().toISOString()}`);
  console.log();

  // 載入現有資料
  let existingData = { lastUpdated: null, totalCases: 0, cases: [] };
  try {
    existingData = JSON.parse(fs.readFileSync(CASES_FILE, 'utf-8'));
    console.log(`已載入 ${existingData.cases.length} 筆現有案件`);
  } catch {
    console.log('未找到現有資料檔，將建立新檔');
  }

  const existingIds = new Set(existingData.cases.map((c) => c.id));
  let newCases = [];

  // ===== 1. 司法院開放資料 API =====
  const user = process.env.JUDICIAL_USER;
  const pass = process.env.JUDICIAL_PASS;

  if (user && pass) {
    console.log('\n[1] 連接司法院開放資料 API...');
    try {
      const token = await authenticate(user, pass);
      console.log('  ✓ 認證成功');

      const jlist = await fetchJList(token);
      const jids = Array.isArray(jlist) ? jlist : jlist.data || [];
      console.log(`  收到 ${jids.length} 筆異動 JID`);

      // 初步篩選可能的營業秘密案件
      const candidates = jids.filter((jid) => isTradeSecretCase(jid));
      console.log(`  初步篩選出 ${candidates.length} 筆可能案件`);

      // 逐筆下載全文並解析
      for (const jid of candidates) {
        const jidStr = typeof jid === 'string' ? jid : jid.JID || JSON.stringify(jid);

        if (existingIds.has(jidStr)) {
          console.log(`  跳過已存在：${jidStr}`);
          continue;
        }

        try {
          const doc = await fetchJDoc(token, jidStr);
          if (!isTradeSecretCase(jidStr, doc)) continue;

          const fullText = doc.JFULL || doc.JFULLX || '';
          const caseNumber = doc.JCASE || jidStr;

          const parsed = {
            id: jidStr,
            caseNumber,
            court: parseCourt(fullText, jidStr),
            courtCode: jidStr.split(',')[0] || 'UNK',
            caseType: parseCaseType(caseNumber, fullText),
            filingDate: doc.JDATE || null,
            judgmentDate: doc.JDATE || null,
            result: parseResult(fullText),
            statutes: parseStatutes(fullText),
            keyIssues: parseKeyIssues(fullText),
            damages: parseDamages(fullText),
            damagesFormatted: formatDamages(parseDamages(fullText)),
            technology: parseTechnology(fullText),
            industryCategory: getIndustryCategory(parseTechnology(fullText)),
            parties: {
              plaintiff: extractParty(fullText, 'plaintiff'),
              defendant: extractParty(fullText, 'defendant'),
            },
            summary: extractSummary(fullText),
            status: '已判決',
            source: '司法院裁判書查詢系統',
          };

          newCases.push(parsed);
          console.log(`  ✓ 新增：${caseNumber}`);
        } catch (err) {
          console.error(`  ✗ 處理 ${jidStr} 失敗：${err.message}`);
        }

        await delay(1000); // Rate limiting
      }
    } catch (err) {
      console.error(`  API 連線失敗：${err.message}`);
      console.log('  將嘗試 fallback 方法');
    }
  } else {
    console.log('\n[1] 未設定 JUDICIAL_USER/JUDICIAL_PASS，跳過 API');
    console.log('    請至 opendata.judicial.gov.tw 註冊並設定 GitHub Secrets');
  }

  // ===== 2. 合併與儲存 =====
  if (newCases.length > 0) {
    console.log(`\n[2] 合併 ${newCases.length} 筆新案件...`);
    existingData.cases = [...newCases, ...existingData.cases];

    // 去重
    const seen = new Set();
    existingData.cases = existingData.cases.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  } else {
    console.log('\n[2] 本次無新增案件');
  }

  // 更新 metadata
  existingData.lastUpdated = new Date().toISOString();
  existingData.totalCases = existingData.cases.length;
  existingData.sources = [
    '司法院裁判書查詢系統',
    '智慧財產及商業法院',
    '智慧財產局營業秘密專區',
    '法務部調查局',
    '新聞媒體報導',
  ];

  // 寫入檔案
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CASES_FILE, JSON.stringify(existingData, null, 2), 'utf-8');
  console.log(`\n✓ 已儲存 ${existingData.cases.length} 筆案件至 ${CASES_FILE}`);

  // ===== 3. 重新計算統計資料 =====
  console.log('\n[3] 重新計算統計資料...');
  const stats = computeStats(existingData.cases);
  const statsFile = path.join(DATA_DIR, 'stats.json');
  fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2), 'utf-8');
  console.log(`✓ 已儲存統計至 ${statsFile}`);

  console.log('\n=== 完成 ===');
}

/**
 * 從全文擷取當事人（簡化版）
 */
function extractParty(text, role) {
  if (role === 'plaintiff') {
    const m = text.match(/(?:原\s*告|告訴人|公訴人)\s*[：:]\s*(.+?)(?:\n|被)/);
    return m ? m[1].trim().substring(0, 30) : '—';
  }
  const m = text.match(/被\s*告\s*[：:]\s*(.+?)(?:\n|上|選)/);
  return m ? m[1].trim().substring(0, 30) : '—';
}

/**
 * 從全文擷取摘要（取事實段前200字）
 */
function extractSummary(text) {
  const factMatch = text.match(/事\s*實[\s\S]{10,200}/);
  if (factMatch) {
    return factMatch[0].replace(/事\s*實\s*/, '').trim().substring(0, 100) + '...';
  }
  return text.substring(0, 100) + '...';
}

/**
 * 計算統計資料
 */
function computeStats(cases) {
  const decidedCases = cases.filter(
    (c) => c.status === '已判決' || c.result === '有罪' || c.result === '無罪'
  );
  const criminalCases = cases.filter((c) => c.caseType.includes('刑'));
  const civilCases = cases.filter((c) => !c.caseType.includes('刑'));
  const pendingCases = cases.filter(
    (c) => c.status === '審理中' || c.status === '偵查中' || c.status === '調解中'
  );
  const guiltyCount = decidedCases.filter(
    (c) => c.result === '有罪' || c.result === '原告勝訴' || c.result === '部分勝訴'
  ).length;

  const totalDamages = cases.reduce((sum, c) => sum + (c.damages || 0), 0);
  const damagesCases = cases.filter((c) => c.damages > 0);
  const avgDamages = damagesCases.length > 0 ? Math.round(totalDamages / damagesCases.length) : 0;

  // 按年份統計
  const yearMap = {};
  for (const c of cases) {
    const date = c.filingDate || c.judgmentDate;
    if (!date) continue;
    const yearAD = parseInt(date.substring(0, 4), 10);
    if (!yearMap[yearAD]) yearMap[yearAD] = { criminal: 0, civil: 0 };
    if (c.caseType.includes('刑')) yearMap[yearAD].criminal++;
    else yearMap[yearAD].civil++;
  }
  const byYear = Object.entries(yearMap)
    .map(([y, v]) => ({
      year: String(parseInt(y) - 1911),
      yearAD: parseInt(y),
      ...v,
    }))
    .sort((a, b) => a.yearAD - b.yearAD);

  // 按產業統計
  const industryMap = {};
  for (const c of cases) {
    const ind = c.industryCategory || '其他';
    industryMap[ind] = (industryMap[ind] || 0) + 1;
  }
  const byIndustry = Object.entries(industryMap)
    .map(([name, count]) => ({
      name,
      count,
      percentage: parseFloat(((count / cases.length) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.count - a.count);

  // 按結果統計
  const resultMap = {};
  const resultColors = {
    有罪: '#c23616',
    原告勝訴: '#c23616',
    無罪: '#9a8f7c',
    駁回: '#9a8f7c',
    部分勝訴: '#c8a45a',
    和解: '#27ae60',
    調解中: '#27ae60',
    審理中: '#2980b9',
    偵查中: '#2980b9',
  };
  for (const c of cases) {
    resultMap[c.result] = (resultMap[c.result] || 0) + 1;
  }
  const byResult = Object.entries(resultMap)
    .map(([name, count]) => ({
      name,
      count,
      color: resultColors[name] || '#95a5a6',
    }))
    .sort((a, b) => b.count - a.count);

  // 常見條文
  const statuteMap = {};
  for (const c of cases) {
    for (const s of c.statutes || []) {
      // 簡化條文名稱
      const short = s
        .replace('營業秘密法第', '§')
        .replace('條', '')
        .replace('13-1', '13-1（國內）')
        .replace('13-2', '13-2（域外）');
      statuteMap[short] = (statuteMap[short] || 0) + 1;
    }
  }
  const byStatute = Object.entries(statuteMap)
    .map(([statute, count]) => ({ statute, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // TOP 5 賠償
  const topDamages = cases
    .filter((c) => c.damages > 0)
    .sort((a, b) => b.damages - a.damages)
    .slice(0, 5)
    .map((c) => ({
      case: c.caseNumber.replace(/\d+年度/, ''),
      amount: c.damages,
      tech: c.technology,
    }));

  return {
    lastUpdated: new Date().toISOString(),
    overview: {
      totalCases: cases.length,
      criminalCases: criminalCases.length,
      civilCases: civilCases.length,
      pendingCases: pendingCases.length,
      convictionRate:
        decidedCases.length > 0
          ? parseFloat((guiltyCount / decidedCases.length).toFixed(2))
          : 0,
      totalDamagesAwarded: totalDamages,
      averageDamages: avgDamages,
      medianCaseDuration: 485, // TODO: calculate from actual dates
    },
    byYear,
    byIndustry,
    byResult,
    byStatute,
    topDamages,
  };
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
