import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, Download, ExternalLink } from 'lucide-react';
import Fuse from 'fuse.js';
import { useCases } from '../hooks/useData';

export default function CaseList() {
  const { cases, loading, error } = useCases();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [sortField, setSortField] = useState('filingDate');
  const [sortDir, setSortDir] = useState('desc');

  const fuse = useMemo(
    () =>
      new Fuse(cases, {
        keys: [
          'caseNumber',
          'court',
          'technology',
          'summary',
          'parties.plaintiff',
          'parties.defendant',
          'keyIssues',
          'statutes',
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
  }, [cases, query, typeFilter, resultFilter, industryFilter, sortField, sortDir, fuse]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="text-[var(--text-muted)] ml-1">↕</span>;
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
    return (
      <div className="text-center py-20 text-[var(--text-muted)]">載入失敗：{error}</div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Search & Filters */}
      <div className="bg-white border border-[var(--border)] p-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋案號、技術、當事人、關鍵字..."
              className="search-input"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">全部類型</option>
              <option value="刑">刑事</option>
              <option value="民">民事</option>
            </select>

            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className="filter-select"
            >
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

            <select
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">全部產業</option>
              {industries.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border)]">
          <p className="text-xs text-[var(--text-muted)]">
            共 <span className="font-medium text-[var(--text-primary)]">{filtered.length}</span>{' '}
            筆結果
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[var(--border)] overflow-x-auto">
        <table className="case-table w-full text-sm">
          <thead>
            <tr>
              <th
                className="text-left px-5 py-3 text-xs cursor-pointer select-none"
                onClick={() => toggleSort('caseNumber')}
              >
                案號 <SortIcon field="caseNumber" />
              </th>
              <th className="text-left px-3 py-3 text-xs">法院</th>
              <th className="text-center px-3 py-3 text-xs">類型</th>
              <th
                className="text-center px-3 py-3 text-xs cursor-pointer select-none"
                onClick={() => toggleSort('result')}
              >
                結果 <SortIcon field="result" />
              </th>
              <th className="text-left px-3 py-3 text-xs">涉及條文</th>
              <th className="text-left px-3 py-3 text-xs">主要爭點</th>
              <th className="text-left px-3 py-3 text-xs">涉案技術</th>
              <th
                className="text-right px-5 py-3 text-xs cursor-pointer select-none"
                onClick={() => toggleSort('damages')}
              >
                賠償金額 <SortIcon field="damages" />
              </th>
              <th
                className="text-center px-3 py-3 text-xs cursor-pointer select-none"
                onClick={() => toggleSort('filingDate')}
              >
                日期 <SortIcon field="filingDate" />
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-[var(--text-muted)] text-sm">
                  無符合條件的案件
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3">
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
                    <span
                      className={`badge ${
                        c.caseType.includes('刑') ? 'badge-criminal' : 'badge-civil'
                      }`}
                    >
                      {c.caseType}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <ResultBadge result={c.result} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.statutes.slice(0, 2).map((s) => (
                        <span
                          key={s}
                          className="text-[10px] px-1.5 py-0.5 bg-[var(--bg-secondary)] text-[var(--text-secondary)] whitespace-nowrap"
                        >
                          {s}
                        </span>
                      ))}
                      {c.statutes.length > 2 && (
                        <span className="text-[10px] text-[var(--text-muted)]">
                          +{c.statutes.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.keyIssues.slice(0, 2).map((issue) => (
                        <span
                          key={issue}
                          className="text-[10px] px-1.5 py-0.5 bg-[rgba(200,164,90,0.1)] text-[var(--gold-dark,#a07830)] whitespace-nowrap"
                        >
                          {issue}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                    {c.technology}
                  </td>
                  <td className="px-5 py-3 text-right text-xs font-mono font-medium whitespace-nowrap">
                    {c.damagesFormatted}
                  </td>
                  <td className="px-3 py-3 text-center text-[10px] text-[var(--text-muted)] whitespace-nowrap">
                    {c.filingDate}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
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
