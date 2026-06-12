import React, { useState, useMemo } from 'react';
import { useSupremeCourt, useScSummaries, getJudicialUrl } from '../hooks/useData';
import { ExternalLink, Search, FileText, Scale, AlertCircle, Building2, Sparkles } from 'lucide-react';

// outcome 顏色：廢棄／發回類＝醒目（值得讀）、駁回類＝中性、其他＝弱化
const OUTCOME_STYLE = {
  '廢棄發回': 'bg-[var(--vermillion)] text-white',
  '部分廢棄發回、部分駁回': 'bg-[rgba(192,57,43,0.14)] text-[var(--vermillion)]',
  '廢棄自為裁判': 'bg-[var(--vermillion)] text-white',
  '上訴駁回': 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]',
  '抗告駁回': 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]',
  '聲請駁回': 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]',
  '移送': 'bg-[var(--bg-secondary)] text-[var(--text-muted)]',
  '其他': 'bg-[var(--bg-secondary)] text-[var(--text-muted)]',
};

/**
 * 最高法院營業秘密相關裁判專頁
 *
 * 資料源：data/supreme_court_judgments_fulltext.json（74 筆＝39 判決 + 35 裁定）
 * 取得方式：以「法院＝最高法院、案由含營業秘密 OR 全文含營業秘密法」雙路檢索後聯集，
 * 日期區間：2009-03-19 ~ 2026-02-11。
 *
 * 此頁與既有 492 筆判決資料完全獨立；不影響 Dashboard、CaseList、DamagesAnalysis 之 KPI。
 */
export default function SupremeCourt() {
  const { data, loading, error } = useSupremeCourt();
  const { data: summariesData } = useScSummaries();
  const summaries = summariesData?.cases || {};
  const [q, setQ] = useState('');
  const [docType, setDocType] = useState('all'); // all / 判決 / 裁定
  const [caseType, setCaseType] = useState('all'); // all / 刑事 / 民事
  const [year, setYear] = useState('all');
  const [selected, setSelected] = useState(null);

  const years = useMemo(() => {
    if (!data) return [];
    const s = new Set(data.map((x) => x.adDate?.slice(0, 4)).filter(Boolean));
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [data]);

  // 日期範圍由資料動態計算（每日自動增補後不需改碼）
  const dateRange = useMemo(() => {
    if (!data || data.length === 0) return null;
    const ds = data.map((x) => x.adDate).filter(Boolean).sort();
    return { min: ds[0], max: ds[ds.length - 1] };
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const qLower = q.trim().toLowerCase();
    return data.filter((x) => {
      if (docType !== 'all' && !x.title.endsWith(docType)) return false;
      if (caseType !== 'all' && !x.title.includes(caseType)) return false;
      if (year !== 'all' && !x.adDate?.startsWith(year)) return false;
      if (qLower) {
        const hay = (x.title + x.reason + (x.excerpt || '') + (x.fullText || '')).toLowerCase();
        if (!hay.includes(qLower)) return false;
      }
      return true;
    });
  }, [data, q, docType, caseType, year]);

  const stats = useMemo(() => {
    if (!data) return null;
    const judgments = data.filter((x) => x.title.endsWith('判決')).length;
    const rulings = data.filter((x) => x.title.endsWith('裁定')).length;
    const criminal = data.filter((x) => x.title.includes('刑事')).length;
    const civil = data.filter((x) => x.title.includes('民事')).length;
    return { total: data.length, judgments, rulings, criminal, civil };
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-[var(--text-secondary)]">
        載入最高法院資料中…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
        <AlertCircle size={16} />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-l-4 border-[var(--vermillion)] pl-4">
        <h1 className="font-display text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Scale size={22} className="text-[var(--vermillion)]" />
          最高法院營業秘密相關裁判
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          以「法院＝最高法院、案由含營業秘密 OR 全文含營業秘密法」雙路檢索之聯集，共 <strong>{stats?.total ?? 0}</strong> 筆（
          <strong>{stats?.judgments ?? 0}</strong> 判決 + <strong>{stats?.rulings ?? 0}</strong> 裁定）
          {dateRange && <>，日期範圍 {dateRange.min} ~ {dateRange.max}</>}。每日由司法院開放資料 API 自動增補。
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          資料來源：司法院裁判書系統（judgment.judicial.gov.tw）。本頁資料與既有 492 筆判決儀表板統計獨立，不混入 KPI／損害賠償分析。
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox label="判決" value={stats?.judgments ?? 0} sub="實體第三審" color="vermillion" />
        <StatBox label="裁定" value={stats?.rulings ?? 0} sub="程序事項" color="green" />
        <StatBox label="刑事" value={stats?.criminal ?? 0} sub="台上／台抗 等" />
        <StatBox label="民事" value={stats?.civil ?? 0} sub="台上／台抗／台聲 等" />
      </div>

      {/* Filters */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="搜尋案號、案由、全文（如「半導體」「秘密保持命令」「損害賠償」）"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--bg-input)] border border-[var(--border)] focus:border-[var(--vermillion)] outline-none"
            />
          </div>
          <Selector label="文書類型" value={docType} onChange={setDocType} options={[
            { v: 'all', l: '全部' },
            { v: '判決', l: '判決' },
            { v: '裁定', l: '裁定' },
          ]} />
          <Selector label="案件類別" value={caseType} onChange={setCaseType} options={[
            { v: 'all', l: '全部' },
            { v: '刑事', l: '刑事' },
            { v: '民事', l: '民事' },
          ]} />
          <Selector label="年度" value={year} onChange={setYear} options={[
            { v: 'all', l: '全部' },
            ...years.map((y) => ({ v: y, l: y })),
          ]} />
        </div>
        <div className="text-xs text-[var(--text-muted)]">
          篩選結果：<strong>{filtered.length}</strong> / {stats?.total ?? 0} 筆
        </div>
      </div>

      {/* List + detail split */}
      <div className="grid lg:grid-cols-5 gap-4">
        {/* List */}
        <div className="lg:col-span-2 bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
          <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-secondary)] text-xs font-semibold text-[var(--text-secondary)] flex items-center justify-between">
            <span>案件列表（依日期新到舊）</span>
            <span className="text-[var(--text-muted)]">點擊查看全文</span>
          </div>
          <div className="max-h-[700px] overflow-y-auto">
            {filtered.map((x, i) => (
              <button
                key={x.jid}
                onClick={() => setSelected(x)}
                className={`w-full text-left px-3 py-2.5 border-b border-[var(--border)] hover:bg-[var(--bg-secondary)] transition-colors ${
                  selected?.jid === x.jid ? 'bg-[var(--bg-secondary)] border-l-4 border-l-[var(--vermillion)]' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-mono text-[var(--text-muted)]">{x.adDate}</span>
                  <DocTypeBadge title={x.title} />
                </div>
                <div className="text-sm font-medium text-[var(--text-primary)] mt-0.5 line-clamp-2">
                  {x.title.replace('最高法院 ', '')}
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-1">
                  {x.reason}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  {summaries[x.jid] && (
                    <span className={`px-1.5 py-0.5 text-[10px] font-medium ${OUTCOME_STYLE[summaries[x.jid].outcome] || ''}`}>
                      {summaries[x.jid].outcome}
                    </span>
                  )}
                  {summaries[x.jid]?.mainIssues?.slice(0, 3).map((t) => (
                    <span key={t} className="px-1.5 py-0.5 text-[10px] border border-[var(--border)] text-[var(--text-muted)]">
                      {t}
                    </span>
                  ))}
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {x.charCount?.toLocaleString()} 字
                  </span>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="p-6 text-center text-sm text-[var(--text-muted)]">
                無符合條件之案件
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-3 bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
          {selected ? (
            <div className="flex flex-col h-full">
              <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)] sticky top-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-[var(--text-muted)]">
                      {selected.adDate}　·　{selected.charCount?.toLocaleString()} 字
                    </div>
                    <h2 className="font-display text-base font-bold text-[var(--text-primary)] mt-0.5">
                      {selected.title}
                    </h2>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                      案由：{selected.reason}
                    </p>
                    <div className="flex gap-2 mt-2">
                      {selected.sources?.map((s) => (
                        <span key={s} className="inline-block px-2 py-0.5 text-[10px] bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-secondary)]">
                          {s.replace('B1_', '').replace('B2_', '')}
                        </span>
                      ))}
                    </div>
                  </div>
                  <a
                    href={getJudicialUrl(selected.jid)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--vermillion)] text-white hover:opacity-90 whitespace-nowrap"
                  >
                    <ExternalLink size={12} />
                    <span>司法院原文</span>
                  </a>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto max-h-[700px] p-4">
                {!summaries[selected.jid] && summariesData && (
                  <div className="mb-4 text-[11px] text-[var(--text-muted)] border border-dashed border-[var(--border)] p-2">
                    本案為自動增補之新案件，尚未產製 AI 重點摘要；以下為司法院原文全文。
                  </div>
                )}
                {summaries[selected.jid] && (
                  <div className="mb-4 bg-[rgba(200,164,90,0.07)] border-l-2 border-[var(--gold)] p-3">
                    <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] mb-1.5">
                      <Sparkles size={11} className="text-[var(--gold)]" />
                      重點摘要
                      <span className="px-1.5 py-0.5 bg-[rgba(200,164,90,0.18)] text-[var(--gold)]">
                        {summaries[selected.jid].reviewed ? '已複核' : 'AI 產製・未複核'}
                      </span>
                      <span className={`px-1.5 py-0.5 font-medium ${OUTCOME_STYLE[summaries[selected.jid].outcome] || ''}`}>
                        {summaries[selected.jid].outcome}
                      </span>
                    </div>
                    <p className="text-[13px] leading-relaxed text-[var(--text-primary)]">
                      {summaries[selected.jid].gist}
                    </p>
                    <div className="mt-1.5 text-[11px] text-[var(--text-muted)]">
                      主文：「{summaries[selected.jid].outcomeVerbatim}」（原文逐字，經程式驗證）
                    </div>
                    <div className="flex gap-1.5 flex-wrap mt-1.5">
                      {summaries[selected.jid].mainIssues?.map((t) => (
                        <span key={t} className="px-1.5 py-0.5 text-[10px] border border-[var(--border)] text-[var(--text-secondary)]">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <pre className="text-[13px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap break-words font-sans">
                  {selected.fullText}
                </pre>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[400px] text-sm text-[var(--text-muted)]">
              <div className="text-center">
                <FileText size={32} className="mx-auto mb-2 opacity-40" />
                <div>選擇左側案件以查看全文</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Data caveats */}
      <div className="bg-[var(--bg-secondary)] border-l-4 border-[var(--accent-green)] p-4 text-xs text-[var(--text-secondary)] space-y-1">
        <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
          <Building2 size={14} />
          <span>資料抽取說明</span>
        </div>
        <p>· 案件範圍＝法院＝最高法院、（案由含「營業秘密」OR 全文含「營業秘密法」）兩條檢索之聯集去重。</p>
        <p>· 初始 74 筆（截至 2026-02-11）以司法院網站檢索＋EXPORTFILE 端點建置；2026-06-11 起由 GitHub Actions 每日透過司法院開放資料 API 自動增補（`scripts/scrape_sc.mjs`）。新增補案件之「重點摘要」與 /holdings 認定摘要須另行產製，補產前僅顯示全文與關鍵字段落。</p>
        <p>· 全文以 regex 去除 HTML 標籤後保留；換行、空白已正規化。文末「中華民國 XX 年 XX 月 XX 日」之發文／公告日期保留原樣。</p>
        <p>· 本頁不參與損害賠償統計；最高法院多為法律審，判准金額之決定通常在事實審（智財法院／高等法院）。</p>
        <p>· 「重點摘要」（含 outcome 分類與爭點標籤）由 Claude 通讀 74 件全文產製，<strong>未經律師逐案複核</strong>（已複核者會標示）；「主文」引文經程式驗證為原文逐字，摘要與分類屬 AI 詮釋，引用前請以司法院原文為準。</p>
        <p>· <strong>檢索式已知漏案類型</strong>：以刑法§317-318 妨害工商秘密罪起訴而全文未提及營業秘密法、以競業禁止或不正競爭為案由而實質涉營業秘密、及國安法§8（2022 年後國家核心關鍵技術營業秘密）案件，可能未被「案由含營業秘密 OR 全文含營業秘密法」檢索式涵蓋；引用本頁統計時請注意此範圍限制。</p>
      </div>
    </div>
  );
}

function StatBox({ label, value, sub, color }) {
  const colorClass = color === 'vermillion'
    ? 'text-[var(--vermillion)]'
    : color === 'green'
    ? 'text-[var(--accent-green)]'
    : 'text-[var(--text-primary)]';
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] p-3">
      <div className="text-xs text-[var(--text-secondary)]">{label}</div>
      <div className={`font-display text-2xl font-bold mt-1 ${colorClass}`}>{value}</div>
      <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{sub}</div>
    </div>
  );
}

function Selector({ label, value, onChange, options }) {
  return (
    <div className="flex items-center gap-1">
      <label className="text-xs text-[var(--text-secondary)] whitespace-nowrap">{label}：</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs px-2 py-1.5 bg-[var(--bg-input)] border border-[var(--border)] focus:border-[var(--vermillion)] outline-none"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>{o.l}</option>
        ))}
      </select>
    </div>
  );
}

function DocTypeBadge({ title }) {
  const isJudgment = title.endsWith('判決');
  const isCriminal = title.includes('刑事');
  return (
    <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap ${
      isJudgment
        ? 'bg-[var(--vermillion)] text-white'
        : 'bg-[var(--accent-green)] text-white opacity-80'
    }`}>
      {isCriminal ? '刑' : '民'}{isJudgment ? '判' : '裁'}
    </span>
  );
}
