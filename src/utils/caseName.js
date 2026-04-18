/**
 * 判決／案件字號格式化工具
 *
 * 原則：所有列表、圖表、KPI 子標都以完整案號顯示
 *   格式：「<法院簡稱 >? <rocYear> 年度 <caseWord> 字第 <caseNum> 號」
 *   範例：「107 年度民營上字第 1 號」 / 「智慧財產法院 107 年度民營上字第 1 號」
 *
 * 兼容三種輸入：
 *   - judgments.json 物件：{ rocYear, caseWord, caseNum, court }
 *   - cases.json 物件    ：{ caseNumber, court }（caseNumber 已含「<rocYear>年度…」）
 *   - 已格式化的字串     ：原樣回傳
 */

export function formatJudgmentCaseName(j, { withCourt = false } = {}) {
  if (!j) return '';
  // judgments.json 結構
  if (typeof j.rocYear === 'number' && j.caseWord && typeof j.caseNum !== 'undefined') {
    const core = `${j.rocYear} 年度${j.caseWord}字第 ${j.caseNum} 號`;
    return withCourt && j.court ? `${j.court} ${core}` : core;
  }
  // judgments.json 的 caseId 已是完整字串（例：「智慧財產法院 107 年度 民營上 字第 1 號」）
  if (j.caseId && typeof j.caseId === 'string') {
    return withCourt ? j.caseId : stripCourt(j.caseId);
  }
  // cases.json 結構
  if (j.caseNumber) {
    return withCourt && j.court ? `${j.court} ${j.caseNumber}` : j.caseNumber;
  }
  return '';
}

function stripCourt(s) {
  // 把開頭的法院名稱去掉（保留「107 年度...號」）
  return String(s).replace(/^[^\d]*?(\d)/, '$1').trim();
}

/**
 * 把 stats.json 裡已被剝掉「XXX年度」的字號，嘗試補回完整年份。
 * 若找不到對應 cases，就原樣回傳。
 */
export function restoreYearFromCases(stripped, cases) {
  if (!stripped || !cases?.length) return stripped;
  const match = cases.find((c) => (c.caseNumber || '').endsWith(stripped));
  return match ? match.caseNumber : stripped;
}
