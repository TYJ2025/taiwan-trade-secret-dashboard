import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X, ExternalLink, Download, AlertCircle, FileText, Loader2, Scale, Gavel } from 'lucide-react';
import { useJudgments, useJudgmentsFullText, useSupremeCourt, getJudicialUrl } from '../hooks/useData';

const PAGE_SIZE = 15;
const SNIPPET_RADIUS = 90;
const MAX_SNIPPETS_PER_CASE = 3;

export default function FullTextSearch() {
  const { judgments, loading: metaLoading, error: metaError } = useJudgments();
  const { fulltext, loading: ftLoading, error: ftError, progress } = useJudgmentsFullText();
  const { data: scData, loading: scLoading } = useSupremeCourt();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlQuery = searchParams.get('q') || '';
  const urlMode = searchParams.get('mode') || '';
  const urlCourts = searchParams.get('courts') || '';

  const [rawQuery, setRawQuery] = useState(urlQuery);
  const [submittedQuery, setSubmittedQuery] = useState(urlQuery);
  const [mode, setMode] = useState(['AND', 'OR', 'PHRASE'].includes(urlMode) ? urlMode : 'AND');
  const [typeFilter, setTypeFilter] = useState('all');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [selectedCourts, setSelectedCourts] = useState(() =>
    urlCourts ? new Set(urlCourts.split(',').filter(Boolean)) : new Set()
  );
  const [page, setPage] = useState(1);

  // Sync URL → state when the query param changes (external link navigation)
  useEffect(() => {
    if (urlQuery && urlQuery !== submittedQuery) {
      setRawQuery(urlQuery);
      setSubmittedQuery(urlQuery);
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQuery]);

  const tokens = useMemo(() => {
    const q = (submittedQuery || '').trim();
    if (!q) return [];
    if (mode === 'PHRASE') return [q];
    return q.split(/\s+/).filter(Boolean);
  }, [submittedQuery, mode]);

  const onSubmit = useCallback((e) => {
    e?.preventDefault?.();
    setSubmittedQuery(rawQuery.trim());
    setPage(1);
  }, [rawQuery]);

  // 合成最高法院 35 筆裁定為 judgment-like records，併入搜尋語料庫
  // seq 用 `sc_<jid>` 避免與既有 492 筆的數字 seq 衝突。
  const scRulings = useMemo(() => {
    if (!scData) return [];
    return scData
      .filter((x) => x.title.endsWith('裁定'))
      .map((x) => ({
        seq: `sc_${x.jid}`,
        caseId: x.title.replace(' 號刑事裁定', ' 號').replace(' 號民事裁定', ' 號'),
        title: x.title,
        court: '最高法院',
        caseType: x.title.includes('刑事') ? '刑事' : '民事',
        adYear: parseInt((x.adDate || '').slice(0, 4)) || null,
        adDate: x.adDate,
        outcome: '—',
        reason: x.reason,
        judgmentUrl: getJudicialUrl(x.jid),
        docType: '裁定',
        damagesNum: 0,
        calcMethods: [],
        _scFullText: x.fullText,
      }));
  }, [scData]);

  // 將判決與裁定合併為單一 corpus
  const allJudgments = useMemo(() => {
    return [...judgments, ...scRulings];
  }, [judgments, scRulings]);

  const ftIndex = useMemo(() => {
    if (!fulltext) return null;
    const map = new Map();
    fulltext.forEach((c) => map.set(c.seq, c.fullText || ''));
    // 將合成的 SC 裁定 fullText 也加入索引
    scRulings.forEach((r) => map.set(r.seq, r._scFullText || ''));
    return map;
  }, [fulltext, scRulings]);

  // 從 corpus 動態抽出全部法院列表（依筆數降序）
  const courtList = useMemo(() => {
    const counts = new Map();
    allJudgments.forEach((j) => {
      counts.set(j.court, (counts.get(j.court) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, n]) => ({ name, n }));
  }, [allJudgments]);

  // 切換法院勾選並同步 URL
  const toggleCourt = useCallback((name) => {
    setSelectedCourts((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      // sync URL
      const params = new URLSearchParams(searchParams);
      if (next.size === 0) params.delete('courts');
      else params.set('courts', Array.from(next).join(','));
      setSearchParams(params, { replace: true });
      setPage(1);
      return next;
    });
  }, [searchParams, setSearchParams]);

  const clearCourts = useCallback(() => {
    setSelectedCourts(new Set());
    const params = new URLSearchParams(searchParams);
    params.delete('courts');
    setSearchParams(params, { replace: true });
    setPage(1);
  }, [searchParams, setSearchParams]);

  // Core search pipeline
  const results = useMemo(() => {
    if (!ftIndex || !allJudgments.length || tokens.length === 0) return [];
    const out = [];
    for (const j of allJudgments) {
      // metadata filters
      if (typeFilter !== 'all' && j.caseType !== typeFilter) continue;
      if (yearFrom && j.adYear < Number(yearFrom)) continue;
      if (yearTo && j.adYear > Number(yearTo)) continue;
      if (selectedCourts.size > 0 && !selectedCourts.has(j.court)) continue;

      const text = ftIndex.get(j.seq) || '';
      if (!text) continue;

      let hitCount = 0;
      let tokenHits = {};
      let matched;

      if (mode === 'AND') {
        matched = tokens.every((t) => text.includes(t));
        if (matched) {
          tokens.forEach((t) => {
            const n = countOccurrences(text, t);
            hitCount += n;
            tokenHits[t] = n;
          });
        }
      } else if (mode === 'OR') {
        let any = false;
        tokens.forEach((t) => {
          const n = countOccurrences(text, t);
          if (n > 0) any = true;
          hitCount += n;
          tokenHits[t] = n;
        });
        matched = any;
      } else { // PHRASE
        const n = countOccurrences(text, tokens[0]);
        matched = n > 0;
        hitCount = n;
        tokenHits[tokens[0]] = n;
      }

      if (!matched) continue;

      out.push({
        ...j,
        hitCount,
        tokenHits,
        snippets: buildSnippets(text, tokens, MAX_SNIPPETS_PER_CASE),
      });
    }
    out.sort((a, b) => b.hitCount - a.hitCount || b.adYear - a.adYear);
    return out;
  }, [ftIndex, allJudgments, tokens, mode, typeFilter, yearFrom, yearTo, selectedCourts]);

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const paged = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const downloadCSV = () => {
    const rows = [
      ['案號', '法院', '類型', '文書類型', '案由', '命中次數', '結果', '判決書網址'],
      ...results.map((r) => [
        r.caseId,
        r.court,
        r.caseType,
        r.docType || '判決',
        r.reason,
        r.hitCount,
        r.outcome,
        r.judgmentUrl,
      ]),
    ];
    const csv = '\uFEFF' + rows.map((r) =>
      r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `搜尋結果_${submittedQuery}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in-up">
      <header>
        <h2 className="font-display text-lg sm:text-xl font-bold mb-1">
          判決全文檢索
        </h2>
        <p className="text-xs text-[var(--text-muted)]">
          在 <strong>{allJudgments.length}</strong> 筆台灣營業秘密裁判全文中進行關鍵字檢索（{judgments.length} 筆判決 + {scRulings.length} 筆最高法院裁定）。
          支援 AND / OR / 片語 三種模式，結果依命中次數排序並顯示上下文摘要。
          可勾選下方「法院」chip 限定來源（例如：只看最高法院之見解）。
        </p>
      </header>

      {/* Loading bar */}
      {ftLoading && (
        <div className="card p-3 flex items-center gap-3">
          <Loader2 size={16} className="animate-spin text-[var(--gold)]" />
          <div className="flex-1">
            <p className="text-xs text-[var(--text-secondary)]">
              首次使用需下載判決全文（約 18 MB，gzip 壓縮後較小）...
            </p>
            <div className="h-1 bg-[var(--bg-secondary)] mt-1 overflow-hidden">
              <div
                className="h-full bg-[var(--gold)] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <span className="text-[10px] text-[var(--text-muted)] font-mono">{progress}%</span>
        </div>
      )}

      {(metaError || ftError) && (
        <div className="card p-3 flex items-center gap-2 text-[var(--vermillion)]">
          <AlertCircle size={14} />
          <span className="text-xs">載入失敗：{metaError || ftError}</span>
        </div>
      )}

      {/* Query form */}
      <form onSubmit={onSubmit} className="card p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              placeholder="輸入關鍵字，例：損害賠償 合理權利金  (空白分隔多個詞)"
              className="search-input"
              disabled={ftLoading}
            />
            {rawQuery && (
              <button
                type="button"
                onClick={() => { setRawQuery(''); setSubmittedQuery(''); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={ftLoading || !rawQuery.trim()}
            className="px-4 py-2 bg-[var(--vermillion)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-40 whitespace-nowrap"
          >
            {ftLoading ? '資料載入中...' : '搜尋'}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-[var(--border)]">
          <span className="text-[10px] text-[var(--text-muted)]">搜尋模式:</span>
          {['AND', 'OR', 'PHRASE'].map((m) => (
            <button
              type="button"
              key={m}
              onClick={() => setMode(m)}
              className={`px-2.5 py-1 text-[10px] border transition-colors ${
                mode === m
                  ? 'border-[var(--gold)] text-[var(--gold)] bg-[rgba(200,164,90,0.06)]'
                  : 'border-[var(--border)] text-[var(--text-secondary)]'
              }`}
            >
              {m === 'AND' ? '全部符合' : m === 'OR' ? '任一符合' : '完整片語'}
            </button>
          ))}

          <span className="text-[10px] text-[var(--text-muted)] ml-3">案件類型:</span>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="filter-select">
            <option value="all">全部</option>
            <option value="刑事">刑事</option>
            <option value="民事">民事</option>
          </select>

          <span className="text-[10px] text-[var(--text-muted)] ml-3">判決年度:</span>
          <input
            type="number" value={yearFrom} onChange={(e) => setYearFrom(e.target.value)}
            placeholder="起" className="filter-select w-20" min="2001" max="2030"
          />
          <span className="text-[10px] text-[var(--text-muted)]">~</span>
          <input
            type="number" value={yearTo} onChange={(e) => setYearTo(e.target.value)}
            placeholder="迄" className="filter-select w-20" min="2001" max="2030"
          />
        </div>

        {/* 法院多選 chip filter */}
        <div className="pt-2 border-t border-[var(--border)]">
          <div className="flex items-center gap-2 mb-1.5">
            <Scale size={11} className="text-[var(--text-muted)]" />
            <span className="text-[10px] text-[var(--text-muted)]">法院（複選；不勾選＝全部）：</span>
            {selectedCourts.size > 0 && (
              <button
                type="button"
                onClick={clearCourts}
                className="text-[10px] text-[var(--vermillion)] hover:underline"
              >
                清除（已選 {selectedCourts.size}）
              </button>
            )}
            <span className="text-[10px] text-[var(--text-muted)] ml-auto">
              共 {courtList.length} 個法院
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {courtList.map(({ name, n }) => {
              const active = selectedCourts.has(name);
              const isSupreme = name === '最高法院';
              return (
                <button
                  type="button"
                  key={name}
                  onClick={() => toggleCourt(name)}
                  className={`px-2 py-1 text-[10px] border transition-colors flex items-center gap-1 ${
                    active
                      ? 'border-[var(--vermillion)] bg-[rgba(192,57,43,0.10)] text-[var(--vermillion)] font-medium'
                      : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--gold)] hover:text-[var(--gold)]'
                  } ${isSupreme && !active ? 'border-[var(--gold)] text-[var(--gold)]' : ''}`}
                  title={`${name}：語料庫含 ${n} 筆`}
                >
                  {isSupreme && <Gavel size={9} />}
                  <span>{name.replace('臺灣', '').replace('地方法院', '地院')}</span>
                  <span className="opacity-60">{n}</span>
                </button>
              );
            })}
          </div>
        </div>
      </form>

      {/* Quick-pick presets */}
      {!submittedQuery && !metaLoading && !ftLoading && (
        <div className="card p-3 sm:p-4">
          <p className="text-xs text-[var(--text-secondary)] mb-2">快速關鍵字：</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              '損害賠償', '合理權利金', '授權金', '三倍', '酌定',
              '所失利益', '所受損害', '連帶', '競業禁止',
              '合理保密措施', '第13條之1', '第13條之2', '國家核心關鍵技術',
              '客戶名單', '製程', '研發', '離職',
            ].map((kw) => (
              <button
                key={kw}
                onClick={() => { setRawQuery(kw); setSubmittedQuery(kw); }}
                disabled={ftLoading}
                className="text-[10px] px-2 py-1 border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--gold)] hover:text-[var(--gold)] disabled:opacity-40"
              >
                {kw}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Result stats */}
      {submittedQuery && !ftLoading && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-[var(--text-secondary)]">
            「<span className="text-[var(--gold)] font-medium">{submittedQuery}</span>」
            命中 <span className="text-[var(--text-primary)] font-medium">{results.length}</span> 筆
            （
            <span className="text-[var(--text-primary)] font-mono">{results.filter((r) => r.docType !== '裁定').length}</span> 判決
            {' + '}
            <span className="text-[var(--accent-green)] font-mono">{results.filter((r) => r.docType === '裁定').length}</span> 裁定
            ）
            / 共 <span className="font-mono">{results.reduce((s, r) => s + r.hitCount, 0)}</span> 次
            {selectedCourts.size > 0 && (
              <span className="ml-2 text-[var(--vermillion)]">
                · 限定法院：{Array.from(selectedCourts).join('、')}
              </span>
            )}
          </div>
          {results.length > 0 && (
            <button
              onClick={downloadCSV}
              className="flex items-center gap-1 text-[10px] text-[var(--vermillion)] hover:underline"
            >
              <Download size={11} /> 下載 CSV
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {submittedQuery && !ftLoading && (
        <div className="space-y-3">
          {paged.length === 0 ? (
            <div className="card p-8 text-center text-[var(--text-muted)] text-sm">
              無符合條件的判決
            </div>
          ) : (
            paged.map((r) => <ResultCard key={r.seq} item={r} tokens={tokens} />)
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-2 py-1 text-xs border border-[var(--border)] disabled:opacity-30"
              >
                上一頁
              </button>
              <span className="text-xs text-[var(--text-muted)] px-2">
                第 {page} / {totalPages} 頁
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-2 py-1 text-xs border border-[var(--border)] disabled:opacity-30"
              >
                下一頁
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function ResultCard({ item, tokens }) {
  return (
    <article className="card p-4 hover:border-[var(--gold)] transition-colors">
      <header className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-sm text-[var(--text-primary)] leading-snug">
            <FileText size={12} className="inline mr-1 text-[var(--gold)]" />
            {item.title || item.caseId}
          </h3>
          <div className="flex flex-wrap gap-2 text-[10px] text-[var(--text-muted)] mt-1">
            <span className="px-1.5 py-0.5 bg-[var(--bg-secondary)]">{item.court}</span>
            <span className={`px-1.5 py-0.5 ${
              item.caseType === '刑事' ? 'bg-[rgba(192,57,43,0.08)] text-[var(--vermillion)]' :
              'bg-[rgba(41,128,185,0.08)] text-[var(--accent-blue)]'
            }`}>{item.caseType}</span>
            {item.docType === '裁定' && (
              <span className="px-1.5 py-0.5 bg-[rgba(46,125,50,0.10)] text-[var(--accent-green)] font-medium" title="此為最高法院裁定（程序事項），無實體判准金額">
                裁定
              </span>
            )}
            <span>{item.adDate || item.adYear}</span>
            {item.outcome && item.outcome !== '—' && <span>{item.outcome}</span>}
            {item.reason && (
              <span className="text-[var(--text-muted)] truncate max-w-[24ch]">
                {item.reason}
              </span>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[10px] text-[var(--text-muted)]">命中</div>
          <div className="font-mono text-sm text-[var(--gold)] font-bold">{item.hitCount}</div>
        </div>
      </header>

      <div className="space-y-1.5">
        {item.snippets.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] italic">（無可預覽上下文）</p>
        ) : (
          item.snippets.map((s, i) => (
            <p key={i} className="text-xs leading-relaxed text-[var(--text-secondary)] pl-2 border-l-2 border-[var(--border)]">
              ...<Highlighted text={s} tokens={tokens} />...
            </p>
          ))
        )}
      </div>

      <footer className="flex flex-wrap gap-3 mt-3 pt-2 border-t border-[var(--border)] text-[10px]">
        {item.damagesNum > 0 && (
          <span className="text-[var(--text-secondary)]">
            判准金額：<span className="font-mono font-medium text-[var(--gold)]">
              {formatMoney(item.damagesNum)}
            </span>
          </span>
        )}
        {item.calcMethods && item.calcMethods.length > 0 && (
          <span className="text-[var(--text-secondary)]">
            計算方式：<span className="text-[var(--text-primary)]">{item.calcMethods.join('、')}</span>
          </span>
        )}
        {item.judgmentUrl && (
          <a href={item.judgmentUrl} target="_blank" rel="noopener noreferrer"
             className="ml-auto flex items-center gap-1 text-[var(--vermillion)] hover:underline">
            司法院原文 <ExternalLink size={10} />
          </a>
        )}
      </footer>
    </article>
  );
}

function Highlighted({ text, tokens }) {
  if (!tokens || tokens.length === 0) return <>{text}</>;
  const parts = [];
  const lowerTokens = tokens.filter(Boolean);
  let idx = 0;
  while (idx < text.length) {
    let earliest = -1;
    let earliestToken = '';
    for (const t of lowerTokens) {
      const pos = text.indexOf(t, idx);
      if (pos !== -1 && (earliest === -1 || pos < earliest)) {
        earliest = pos;
        earliestToken = t;
      }
    }
    if (earliest === -1) {
      parts.push(text.slice(idx));
      break;
    }
    if (earliest > idx) parts.push(text.slice(idx, earliest));
    parts.push(
      <mark key={parts.length} className="bg-[rgba(200,164,90,0.35)] text-[var(--text-primary)] px-0.5 font-medium">
        {text.slice(earliest, earliest + earliestToken.length)}
      </mark>
    );
    idx = earliest + earliestToken.length;
  }
  return <>{parts.map((p, i) => <React.Fragment key={i}>{p}</React.Fragment>)}</>;
}

// ─────────────────────────────────────────────────────────────────
function countOccurrences(text, token) {
  if (!token) return 0;
  let count = 0;
  let idx = text.indexOf(token);
  while (idx !== -1) {
    count++;
    idx = text.indexOf(token, idx + token.length);
  }
  return count;
}

function buildSnippets(text, tokens, maxCount) {
  if (!text || tokens.length === 0) return [];
  const snippets = [];
  const seen = new Set();
  outer:
  for (const t of tokens) {
    let startSearch = 0;
    while (snippets.length < maxCount) {
      const pos = text.indexOf(t, startSearch);
      if (pos === -1) break;
      const s = Math.max(0, pos - SNIPPET_RADIUS);
      const e = Math.min(text.length, pos + t.length + SNIPPET_RADIUS);
      const snip = text.slice(s, e).replace(/\s+/g, ' ').trim();
      const key = `${s}_${e}`;
      if (!seen.has(key)) {
        seen.add(key);
        snippets.push(snip);
      }
      startSearch = pos + t.length;
      if (snippets.length >= maxCount) break outer;
    }
  }
  return snippets;
}

function formatMoney(n) {
  if (!n) return '—';
  if (n >= 100000000) return `${(n / 100000000).toFixed(2)} 億元`;
  if (n >= 10000) return `${(n / 10000).toFixed(1)} 萬元`;
  return `${n.toLocaleString()} 元`;
}
