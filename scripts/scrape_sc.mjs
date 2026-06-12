#!/usr/bin/env node
/**
 * 最高法院營業秘密裁判每日增補腳本
 *
 * 篩選條件（與既有 74 件之雙路檢索定義一致）：
 *   法院＝最高法院（JID 以 TPS 開頭：TPSV 民事／TPSM 刑事）
 *   AND（案由含「營業秘密」 OR 全文含「營業秘密法」）
 *
 * 資料流：
 *   司法院開放資料 API JList（7 日前異動清單）→ 篩 TPS → JDoc 全文
 *   → 正規化為既有 schema → 去重後增補 data/supreme_court_judgments_fulltext.json
 *
 * 注意：
 *   - keyword 見解索引由 deploy.yml 之 build_holdings_index.py 自動重建。
 *   - curated AI 摘要（/holdings 認定摘要、/supreme 重點摘要）不在此自動產製，
 *     新案件在補產前頁面僅顯示全文與 keyword snippet（前端已容忍缺摘要）。
 *   - 任何錯誤都不得毀損既有資料檔：僅在成功解析後才寫檔，寫檔採整檔重寫
 *     前先於記憶體完成合併與排序。
 *
 * 使用：JUDICIAL_USER=xxx JUDICIAL_PASS=yyy node scripts/scrape_sc.mjs
 * 測試：node scripts/scrape_sc.mjs --dry-run-fixture <fixture.json>
 *       （以 fixture 取代 API 回應，離線驗證篩選/去重/正規化邏輯）
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticate, fetchJList, fetchJDoc, delay } from './utils/judicial-api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SC_FILE = path.join(__dirname, '..', 'data', 'supreme_court_judgments_fulltext.json');

// ─── 純函式（可離線測試） ─────────────────────────────────────

/** JID 是否為最高法院（TPSV 民事／TPSM 刑事） */
export function isSupremeCourtJid(jid) {
  return typeof jid === 'string' && /^TPS[VM],/.test(jid);
}

/** 雙路檢索：案由含「營業秘密」 OR 全文含「營業秘密法」 */
export function isTradeSecretSC(doc) {
  const reason = doc.JTITLE || '';
  const fullText = doc.JFULL || doc.JFULLX || '';
  return reason.includes('營業秘密') || fullText.includes('營業秘密法');
}

/** 去除 HTML 標籤並正規化空白（與既有資料同樣處理） */
export function cleanFullText(raw) {
  return String(raw)
    .replace(/<[^>]+>/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t　]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** JDATE: 'YYYYMMDD' 或 'YYYY-MM-DD' → 'YYYY-MM-DD' */
export function normalizeDate(jdate) {
  const s = String(jdate || '').replace(/-/g, '');
  if (!/^\d{8}$/.test(s)) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/** 正規化為既有 schema（title 例：最高法院 114 年度 台上 字第 5831 號刑事判決） */
export function normalizeDoc(jid, doc) {
  const fullText = cleanFullText(doc.JFULL || doc.JFULLX || '');
  const caseType = jid.startsWith('TPSV') ? '民事' : '刑事';
  // 文書類型：取全文前 60 字判斷（「最高法院刑事判決」「最高法院民事裁定」等）
  const head = fullText.slice(0, 60);
  const docType = head.includes('裁定') ? '裁定' : '判決';
  const [, year, word, no] = jid.split(',');
  return {
    jid,
    title: `最高法院 ${year} 年度 ${word} 字第 ${no} 號${caseType}${docType}`,
    adDate: normalizeDate(doc.JDATE),
    reason: doc.JTITLE || '',
    charCount: fullText.length,
    sources: ['daily_api'],
    fullText,
  };
}

/** 合併：existing 優先保留，新案去重後加入，依日期排序 */
export function mergeCases(existing, incoming) {
  const seen = new Set(existing.map((x) => x.jid));
  const added = incoming.filter((x) => {
    if (seen.has(x.jid)) return false;
    seen.add(x.jid);
    return true;
  });
  const all = [...existing, ...added].sort((a, b) =>
    (a.adDate || '').localeCompare(b.adDate || '')
  );
  return { all, added };
}

// ─── 主流程 ───────────────────────────────────────────────────

async function main() {
  console.log('=== 最高法院營業秘密裁判增補 ===');
  console.log(`執行時間：${new Date().toISOString()}`);

  if (!fs.existsSync(SC_FILE)) {
    console.error(`✗ 找不到 ${SC_FILE}，中止（不建立新檔，避免覆蓋風險）`);
    process.exit(1);
  }
  const existing = JSON.parse(fs.readFileSync(SC_FILE, 'utf-8'));
  console.log(`既有最高法院案件：${existing.length} 筆`);

  // 取得候選文件：fixture（離線測試）或 API
  let docs = []; // [{ jid, doc }]
  const fixtureIdx = process.argv.indexOf('--dry-run-fixture');
  if (fixtureIdx !== -1) {
    const fixture = JSON.parse(fs.readFileSync(process.argv[fixtureIdx + 1], 'utf-8'));
    docs = fixture.filter(({ jid }) => isSupremeCourtJid(jid));
    console.log(`[dry-run] fixture ${fixture.length} 筆，TPS 篩選後 ${docs.length} 筆`);
  } else {
    const user = process.env.JUDICIAL_USER;
    const pass = process.env.JUDICIAL_PASS;
    if (!user || !pass) {
      console.log('未設定 JUDICIAL_USER/JUDICIAL_PASS，跳過（不視為錯誤）');
      return;
    }
    const token = await authenticate(user, pass);
    const jlist = await fetchJList(token);
    const jids = (Array.isArray(jlist) ? jlist : jlist.data || [])
      .map((j) => (typeof j === 'string' ? j : j.JID || ''))
      .filter(isSupremeCourtJid);
    console.log(`JList 異動清單中最高法院案件：${jids.length} 筆`);
    const existingIds = new Set(existing.map((x) => x.jid));
    for (const jid of jids) {
      if (existingIds.has(jid)) {
        console.log(`  跳過已存在：${jid}`);
        continue;
      }
      try {
        const doc = await fetchJDoc(token, jid);
        docs.push({ jid, doc });
      } catch (err) {
        console.error(`  ✗ JDoc ${jid} 失敗：${err.message}（略過，明日 JList 仍會再見到異動則補抓）`);
      }
      await delay(1000);
    }
  }

  // 雙路篩選 + 正規化
  const incoming = [];
  for (const { jid, doc } of docs) {
    if (!isTradeSecretSC(doc)) {
      console.log(`  非營業秘密相關，排除：${jid}`);
      continue;
    }
    const norm = normalizeDoc(jid, doc);
    if (!norm.adDate || norm.charCount < 100) {
      console.error(`  ✗ 欄位異常（日期或全文過短），排除：${jid}`);
      continue;
    }
    incoming.push(norm);
  }

  const { all, added } = mergeCases(existing, incoming);
  if (added.length === 0) {
    console.log('無新增案件，資料檔不變動。');
    return;
  }
  for (const x of added) console.log(`  ✓ 新增：${x.title}（${x.adDate}，${x.charCount.toLocaleString()} 字）`);

  // sanity：合併後筆數只增不減
  if (all.length < existing.length) {
    console.error('✗ 合併後筆數少於既有筆數，中止寫檔');
    process.exit(1);
  }
  fs.writeFileSync(SC_FILE, JSON.stringify(all, null, 1), 'utf-8');
  console.log(`已寫入 ${SC_FILE}：${existing.length} → ${all.length} 筆`);
  console.log('提醒：新案件之 AI 摘要（curated）尚未產製，請於 Cowork session 補產後複核。');
}

main().catch((err) => {
  console.error(`✗ 執行失敗：${err.message}`);
  process.exit(1);
});
