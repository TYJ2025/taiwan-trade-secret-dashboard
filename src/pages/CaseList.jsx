import React, { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, X, ExternalLink, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import Fuse from 'fuse.js';
import { useCases, getLawsnoteUrl } from '../hooks/useData';
import Pagination from '../components/Pagination';

const PAGE_SIZES = [10, 20, 50];

export default function CaseList() {
  const { cases, loading, error } = useCases();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortField, setSortField] = useState('filingDate');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const fuse = useMemo(
    () =>
      new Fuse(cases, {
        keys: [
          { name: 'caseNumber', weight: 2 },
          { name: 'court', weight: 1 },
          { name: 'technology', weight: 1.5 },
          { name: 'summary', weight: 0.8 },
          { name: 'parties.plaintiff', weight: 1.2 },
          { name: 'parties.defendant', weight: 1.2 },
          { name: 'keyIssues', weight: 1 },
          { name: 'statutes', weight: 1 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [cases]
  );

  const industries = useMemo(
    () => [...new Set(cases.map((c) => c.industryCategory))].sort(),
    [cases]
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (typeFilter !== 'all') count++;
    if (resultFilter !== 'all') count++;
    if (industryFilter !== 'all') count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    return count;
  }, [typeFilter, resultFilter, industryFilter, dateFrom, dateTo]);

  const clearAllFilters = useCallback(() => {
    setQuery('');
    setTypeFilter('all');
    setResultFilter('all');
    setIndustryFilter('all');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }, []);

  const filtered = useMemo(() => {
    let result = query ? fuse.search(query).map((r) => r.item) : [...cases];

    if (typeFilter !== 'all') {
      result = result.filter((c) => c.caseType.includes(typeFilter));
    }
    if (resultFilter !== 'all') {
      result = result.filter((c) => c.result === resultFilter);
    }
    if (industryFilter !== 'all') {
      result = result.filter((c) => c.industryCategory === industryFilter);
    }
    if (dateFrom) {
      result = result.filter((c) => c.filingDate >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((c) => c.filingDate <= dateTo);
    }

    result.sort((a, b) => {
      let va = a[sortField] || '';
      let vb = b[sortField] || '';
      if (sortField === 'damages') {
        va = a.damages || 0;
        vb = b.damages || 0;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [cases, query, typeFilter, resultFilter, industryFilter, dateFrom, dateTo, sortField, sortDir, fuse]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // Reset page when filters change
  useMemo(() => {
    setPage(1);
  }, [query, typeFilter, resultFilter, industryFilter, dateFrom, dateTo]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="text-[var(--text-muted)] ml-1 opacity-40">↕</span>;
    return <span className="text-[var(--gold)] ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-12 loading-shimmer rounded" />
        <div className="h-96 loading-shimmer rounded" />
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-20 text-[var(--text-muted)]">載入失敗：{error}</div>;
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Search & Filters */}
      <div className="card p-3 sm:p-4">
        <div className="flex flex-col gap-3">
          {/* Search row */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜尋案號、技術、當事人、關鍵字..."
                className="search-input"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border transition-colors whitespace-nowrap ${
                showAdvanced || activeFilterCount > 0
                  ? 'border-[var(--gold)] text-[var(--gold)] bg-[rgba(200,164,90,0.06)]'
                  : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]'
              }`}
            >
              <Filter size={13} />
              篩選{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>

          {/* Advanced filters */}
          {showAdvanced && (
            <div className="animate-slide-down border-t border-[var(--border)] pt-3 space-y-3">
              <div className="flex flex-wrap gap-2">
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="filter-select">
                  <option value="all">全部類型</option>
                  <option value="刑">刑事</option>
                  <option value="民">民事</option>
                </select>

                <select value={resultFilter} onChange={(e) => setResultFilter(e.target.value)} className="filter-select">
                  <option value="all">全部結果</option>
                  <option value="有罪">有罪</option>
                  <option value="無罪">無罪</option>
                  <option value="原告勝訴">原告勝訴</option>
                  <option value="部分勝訴">部分勝訴</option>
                  <option value="駁回">駁回</option>
                  <option value="審理中">審理中</option>
                  <option value="偵查中">偵查中</option>
                  <option value="調解中">調解中</option>
                </select>

                <select value={industryFilter} onChange={(e) => setIndustryFilter(e.target.value)} className="filter-select">
                  <option value="all">全部產業</option>
                  {industries.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>

              {/* Date range */}
              <div className="flex flex-wrap items-center gap-2">
                <Calendar size={13} className="text-[var(--text-muted)]" />
                <span className="text-xs text-[var(--text-muted)]">起訴日期：</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="date-input"
                  placeholder="起始日期"
                />
                <span className="text-xs text-[var(--text-muted)]">至</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="date-input"
                  placeholder="結束日期"
                />
              </div>
            </div>
          )}

          {/* Active filters & result count */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border)]">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-[var(--text-muted)]">
                共 <span className="font-medium text-[var(--text-primary)]">{filtered.length}</span> 筆結果
              </p>
              {/* Active filter chips */}
              {typeFilter !== 'all' && (
                <FilterChip label={`類型: ${typeFilter === '刑' ? '刑事' : '民事'}`} onRemove={() => setTypeFilter('all')} />
              )}
              {resultFilter !== 'all' && (
                <FilterChip label={`結果: ${resultFilter}`} onRemove={() => setResultFilter('all')} />
              )}
              {industryFilter !== 'all' && (
                <FilterChip label={`產業: ${industryFilter}`} onRemove={() => setIndustryFilter('all')} />
              )}
              {dateFrom && (
                <FilterChip label={`從: ${dateFrom}`} onRemove={() => setDateFrom('')} />
              )}
              {dateTo && (
                <FilterChip label={`至: ${dateTo}`} onRemove={() => setDateTo('')} />
              )}
              {activeFilterCount > 1 && (
                <button
                  onClick={clearAllFilters}
                  className="text-[10px] text-[var(--vermillion)] hover:underline"
                >
                  清除全部
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--text-muted)]">每頁</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="filter-select !py-1 !px-2 !pr-6 !text-[10px]"
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card table-container">
        <table className="case-table w-full text-sm">
          <thead>
            <tr>
              <th className="text-left px-4 sm:px-5 py-3 text-xs cursor-pointer select-none" onClick={() => toggleSort('caseNumber')}>
                案號 <SortIcon field="caseNumber" />
              </th>
              <th className="text-left px-3 py-3 text-xs">法院</th>
              <th className="text-center px-3 py-3 text-xs">類型</th>
              <th className="text-center px-3 py-3 text-xs cursor-pointer select-none" onClick={() => toggleSort('result')}>
                結果 <SortIcon field="result" />
              </th>
              <th className="text-left px-3 py-3 text-xs">涉及條文</th>
              <th className="text-left px-3 py-3 text-xs">主要爭點</th>
              <th className="text-left px-3 py-3 text-xs">涉案技術</th>
              <th className="text-right px-3 py-3 text-xs cursor-pointer select-none" onClick={() => toggleSort('damages')}>
                賠償金額 <SortIcon field="damages" />
              </th>
              <th className="text-center px-3 py-3 text-xs cursor-pointer select-none" onClick={() => toggleSort('filingDate')}>
                日期 <SortIcon field="filingDate" />
              </th>
              <th className="text-center px-3 py-3 text-xs">判決書</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-12 text-[var(--text-muted)] text-sm">
                  無符合條件的案件
                </td>
              </tr>
            ) : (
              paginated.map((c) => {
                const lawsnoteUrl = getLawsnoteUrl(c);
                return (
                  <tr key={c.id}>
                    <td className="px-4 sm:px-5 py-3">
                      <Link
                        to={`/cases/${encodeURIComponent(c.id)}`}
                        className="text-[var(--vermillion)] hover:underline font-medium text-xs leading-tight block"
                      >
                        {c.caseNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                      {c.court}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`badge ${c.caseType.includes('刑') ? 'badge-criminal' : 'badge-civil'}`}>
                        {c.caseType}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <ResultBadge result={c.result} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.statutes.slice(0, 2).map((s) => (
                          <span key={s} className="text-[10px] px-1.5 py-0.5 bg-[var(--bg-secondary)] text-[var(--text-secondary)] whitespace-nowrap">
                            {s}
                          </span>
                        ))}
                        {c.statutes.length > 2 && (
                          <span className="text-[10px] text-[var(--text-muted)]">+{c.statutes.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.keyIssues.slice(0, 2).map((issue) => (
                          <span key={issue} className="text-[10px] px-1.5 py-0.5 bg-[rgba(200,164,90,0.1)] text-[var(--gold)] whitespace-nowrap">
                            {issue}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                      {c.technology}
                    </td>
                    <td className="px-3 py-3 text-right text-xs font-mono font-medium whitespace-nowrap">
                      {c.damagesFormatted}
                    </td>
                    <td className="px-3 py-3 text-center text-[10px] text-[var(--text-muted)] whitespace-nowrap">
                      {c.filingDate}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {lawsnoteUrl ? (
                        <a
                          href={lawsnoteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="external-link-icon"
                          title="在 Lawsnote 查看判決書"
                        >
                          <ExternalLink size={13} />
                        </a>
                      ) : (
                        <span
                          className="text-[10px] text-[var(--text-muted)]"
                          title="尚未判決或非正式案號，無法外連 Lawsnote"
                        >
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-[var(--text-muted)]">
            顯示第 {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filtered.length)} 筆，共 {filtered.length} 筆
          </p>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, onRemove }) {
  return (
    <button className="filter-chip" onClick={onRemove}>
      {label}
      <span className="chip-x">✕</span>
    </button>
  );
}

function ResultBadge({ result }) {
  let cls = 'badge ';
  if (result === '有罪' || result === '原告勝訴') cls += 'badge-guilty';
  else if (result === '無罪') cls += 'badge-innocent';
  else if (result === '駁回') cls += 'badge-dismissed';
  else if (result === '部分勝訴') cls += 'badge-won';
  else cls += 'bg-[rgba(41,128,185,0.08)] text-[var(--accent-blue)]';
  return <span className={cls}>{result}</span>;
}
