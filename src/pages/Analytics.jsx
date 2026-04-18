import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { TrendingUp, Building2, Scale, Clock, GitCompare, ExternalLink, ArrowUpRight } from 'lucide-react';
import { useCases, useAnalytics, getLawsnoteUrl } from '../hooks/useData';

export default function Analytics() {
  const { cases, loading, error } = useCases();
  const analytics = useAnalytics(cases);
  const [activeTab, setActiveTab] = useState('damages');
  const [compareIds, setCompareIds] = useState([]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <div className="text-center py-20 text-[var(--text-muted)]">載入失敗：{error}</div>;
  if (!analytics) return null;

  const tabs = [
    { id: 'damages', label: '賠償趨勢', icon: TrendingUp },
    { id: 'court', label: '法院分析', icon: Building2 },
    { id: 'duration', label: '審理期間', icon: Clock },
    { id: 'issues', label: '爭點分析', icon: Scale },
    { id: 'compare', label: '案件比較', icon: GitCompare },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in-up">
      <div>
        <h2 className="font-display text-lg sm:text-xl font-bold mb-1">進階分析</h2>
        <p className="text-xs text-[var(--text-muted)]">
          深入探索營業秘密案件的多維度統計分析
          {(() => {
            const total = cases.length;
            const withJudg = cases.filter((c) => c.judgmentDate).length;
            const pending = total - withJudg;
            return (
              <span className="ml-2 text-[var(--text-secondary)]">
                ·&nbsp;樣本範圍：已判決 <span className="font-mono">{withJudg}</span> 件
                （共 <span className="font-mono">{total}</span> 件中扣除 <span className="font-mono">{pending}</span> 件訴訟前／偵查中／審理中）；
                本頁為「審理中／訴訟前」資料集，與總覽頁 492 筆判決為獨立來源。
              </span>
            );
          })()}
        </p>
      </div>

      {/* Tab navigation */}
      <div className="tab-group overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-item flex items-center gap-1.5 whitespace-nowrap ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="animate-fade-in-up">
        {activeTab === 'damages' && <DamagesTrend data={analytics.damagesTrend} convictionByIndustry={analytics.convictionByIndustry} />}
        {activeTab === 'court' && <CourtAnalysis data={analytics.byCourt} cases={cases} />}
        {activeTab === 'duration' && <DurationAnalysis durations={analytics.durations} buckets={analytics.durationBuckets} />}
        {activeTab === 'issues' && <IssuesAnalysis data={analytics.byKeyIssue} />}
        {activeTab === 'compare' && <CaseComparison cases={cases} compareIds={compareIds} setCompareIds={setCompareIds} />}
      </div>
    </div>
  );
}

/* ===== Damages Trend Tab ===== */
function DamagesTrend({ data, convictionByIndustry }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      {/* Damages over time */}
      <div className="card p-4 sm:p-5">
        <h3 className="font-display text-sm font-bold mb-4 tracking-wide">歷年賠償金額趨勢</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              tickFormatter={(v) => v >= 100000000 ? `${(v / 100000000).toFixed(0)}億` : v >= 10000 ? `${(v / 10000).toFixed(0)}萬` : v}
            />
            <Tooltip
              contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--border)', color: 'var(--tooltip-text)', fontSize: 12 }}
              formatter={(v) => [formatAmount(v)]}
              labelFormatter={(v) => `${v} 年`}
            />
            <Area type="monotone" dataKey="totalDamages" name="賠償總額" stroke="var(--vermillion)" fill="var(--vermillion)" fillOpacity={0.1} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Average damages over time */}
      <div className="card p-4 sm:p-5">
        <h3 className="font-display text-sm font-bold mb-4 tracking-wide">歷年平均賠償金額</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              tickFormatter={(v) => v >= 100000000 ? `${(v / 100000000).toFixed(0)}億` : v >= 10000 ? `${(v / 10000).toFixed(0)}萬` : v}
            />
            <Tooltip
              contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--border)', color: 'var(--tooltip-text)', fontSize: 12 }}
              formatter={(v) => [formatAmount(v)]}
              labelFormatter={(v) => `${v} 年`}
            />
            <Line type="monotone" dataKey="avgDamages" name="平均賠償" stroke="var(--gold)" strokeWidth={2} dot={{ fill: 'var(--gold)', r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Conviction rate by industry */}
      <div className="card p-4 sm:p-5 lg:col-span-2">
        <h3 className="font-display text-sm font-bold mb-4 tracking-wide">各產業勝訴率比較</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={convictionByIndustry} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <Tooltip
              contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--border)', color: 'var(--tooltip-text)', fontSize: 12 }}
              formatter={(v, name) => [name === '勝訴率' ? `${v}%` : `${v} 件`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" iconSize={10} />
            <Bar dataKey="total" name="案件數" fill="var(--accent-blue)" radius={[2, 2, 0, 0]} />
            <Bar dataKey="convicted" name="勝訴數" fill="var(--vermillion)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ===== Court Analysis Tab ===== */
function CourtAnalysis({ data, cases }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      <div className="card p-4 sm:p-5">
        <h3 className="font-display text-sm font-bold mb-4 tracking-wide">案件法院分布</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} layout="vertical" barSize={18}>
            <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} width={140} />
            <Tooltip
              contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--border)', color: 'var(--tooltip-text)', fontSize: 12 }}
              formatter={(v) => [`${v} 件`, '案件數']}
            />
            <Bar dataKey="count" fill="var(--accent-blue)" radius={[0, 2, 2, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card p-4 sm:p-5">
        <h3 className="font-display text-sm font-bold mb-4 tracking-wide">法院統計摘要</h3>
        <div className="space-y-3">
          {data.map((court) => {
            const courtCases = cases.filter((c) => c.court === court.name);
            const convicted = courtCases.filter((c) => c.result === '有罪' || c.result === '原告勝訴').length;
            const totalDamages = courtCases.reduce((s, c) => s + (c.damages || 0), 0);
            return (
              <div key={court.name} className="p-3 bg-[var(--bg-secondary)] border border-[var(--border)]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-[var(--text-primary)]">{court.name}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">{court.count} 件</span>
                </div>
                <div className="flex gap-4 text-[10px] text-[var(--text-muted)]">
                  <span>勝訴率 <strong className="text-[var(--vermillion)]">{court.count > 0 ? Math.round((convicted / court.count) * 100) : 0}%</strong></span>
                  <span>賠償總額 <strong className="text-[var(--text-primary)]">{formatAmount(totalDamages)}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ===== Duration Analysis Tab ===== */
function DurationAnalysis({ durations, buckets }) {
  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((s, d) => s + d.durationDays, 0) / durations.length)
    : 0;
  const medianDuration = durations.length > 0
    ? durations[Math.floor(durations.length / 2)].durationDays
    : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      {/* Summary stats */}
      <div className="card p-4 sm:p-5 lg:col-span-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MiniStat label="平均審理天數" value={`${avgDuration} 天`} />
          <MiniStat label="中位數" value={`${medianDuration} 天`} />
          <MiniStat label="最短" value={durations.length > 0 ? `${durations[0].durationDays} 天` : '—'} />
          <MiniStat label="最長" value={durations.length > 0 ? `${durations[durations.length - 1].durationDays} 天` : '—'} />
        </div>
      </div>

      {/* Duration distribution */}
      <div className="card p-4 sm:p-5">
        <h3 className="font-display text-sm font-bold mb-4 tracking-wide">審理期間分布</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={buckets}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="range" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--border)', color: 'var(--tooltip-text)', fontSize: 12 }}
              formatter={(v) => [`${v} 件`]}
            />
            <Bar dataKey="count" name="案件數" fill="var(--gold)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Duration by case type */}
      <div className="card p-4 sm:p-5">
        <h3 className="font-display text-sm font-bold mb-4 tracking-wide">各案件審理天數明細</h3>
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
          {durations.map((c, i) => (
            <div key={c.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-dashed border-[var(--border)] last:border-0">
              <span className="text-[var(--text-muted)] w-6 text-right">{i + 1}</span>
              <Link to={`/cases/${encodeURIComponent(c.id)}`} className="text-[var(--vermillion)] hover:underline flex-1 truncate font-medium">
                {c.caseNumber}
              </Link>
              <span className={`badge text-[10px] ${c.caseType.includes('刑') ? 'badge-criminal' : 'badge-civil'}`}>
                {c.caseType.includes('刑') ? '刑' : '民'}
              </span>
              <span className="font-mono font-medium text-[var(--text-primary)] w-16 text-right">
                {c.durationDays} 天
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ===== Issues Analysis Tab ===== */
function IssuesAnalysis({ data }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      <div className="card p-4 sm:p-5">
        <h3 className="font-display text-sm font-bold mb-4 tracking-wide">主要爭點出現頻率 TOP 10</h3>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data} layout="vertical" barSize={16}>
            <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} width={100} />
            <Tooltip
              contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--border)', color: 'var(--tooltip-text)', fontSize: 12 }}
              formatter={(v) => [`${v} 件`, '出現次數']}
            />
            <Bar dataKey="count" fill="var(--vermillion)" radius={[0, 2, 2, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card p-4 sm:p-5">
        <h3 className="font-display text-sm font-bold mb-1 tracking-wide">爭點分析摘要</h3>
        <p className="text-[10px] text-[var(--text-muted)] mb-3">點擊爭點列 → 開啟對應案件清單</p>
        <div className="space-y-3">
          {data.slice(0, 10).map((item, i) => {
            const maxCount = data[0]?.count || 1;
            return (
              <Link
                key={item.name}
                to={`/cases?issue=${encodeURIComponent(item.name)}`}
                className="block group hover:bg-[var(--bg-secondary)] -mx-2 px-2 py-1 transition-colors"
                title={`查看 ${item.count} 件爭點「${item.name}」的案件清單`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-[var(--text-primary)] group-hover:text-[var(--gold)] transition-colors">
                    {item.name}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-mono text-[var(--text-muted)] group-hover:text-[var(--text-primary)]">
                    {item.count} 件
                    <ArrowUpRight size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[var(--bg-secondary)] overflow-hidden">
                  <div
                    className="h-full transition-all duration-500"
                    style={{ width: `${(item.count / maxCount) * 100}%`, background: i < 3 ? 'var(--vermillion)' : 'var(--gold)' }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ===== Case Comparison Tab ===== */
function CaseComparison({ cases, compareIds, setCompareIds }) {
  const [searchTerm, setSearchTerm] = useState('');

  const searchResults = useMemo(() => {
    if (!searchTerm) return [];
    const q = searchTerm.toLowerCase();
    return cases
      .filter((c) =>
        c.caseNumber.toLowerCase().includes(q) ||
        c.technology.toLowerCase().includes(q) ||
        (c.parties.plaintiff || '').toLowerCase().includes(q) ||
        (c.parties.defendant || '').toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [cases, searchTerm]);

  const selectedCases = useMemo(
    () => compareIds.map((id) => cases.find((c) => c.id === id)).filter(Boolean),
    [cases, compareIds]
  );

  const addCase = (id) => {
    if (!compareIds.includes(id) && compareIds.length < 4) {
      setCompareIds([...compareIds, id]);
      setSearchTerm('');
    }
  };

  const removeCase = (id) => {
    setCompareIds(compareIds.filter((cid) => cid !== id));
  };

  return (
    <div className="space-y-4">
      {/* Search to add cases */}
      <div className="card p-4 sm:p-5">
        <h3 className="font-display text-sm font-bold mb-3 tracking-wide">選擇要比較的案件（最多 4 件）</h3>
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="輸入案號、技術或當事人搜尋..."
            className="search-input !pl-3"
          />
          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-[var(--bg-card)] border border-[var(--border)] shadow-lg z-20 max-h-60 overflow-y-auto">
              {searchResults.map((c) => (
                <button
                  key={c.id}
                  onClick={() => addCase(c.id)}
                  disabled={compareIds.includes(c.id)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-secondary)] transition-colors flex items-center justify-between ${
                    compareIds.includes(c.id) ? 'opacity-40' : ''
                  }`}
                >
                  <div>
                    <span className="font-medium text-[var(--text-primary)]">{c.caseNumber}</span>
                    <span className="text-[var(--text-muted)] ml-2">{c.technology}</span>
                  </div>
                  <span className={`badge text-[10px] ${c.caseType.includes('刑') ? 'badge-criminal' : 'badge-civil'}`}>
                    {c.caseType}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected chips */}
        {selectedCases.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {selectedCases.map((c) => (
              <button
                key={c.id}
                onClick={() => removeCase(c.id)}
                className="filter-chip"
              >
                {c.caseNumber}
                <span className="chip-x">✕</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Comparison table */}
      {selectedCases.length >= 2 && (
        <div className="card table-container">
          <table className="compare-table w-full">
            <tbody>
              <tr>
                <th>案號</th>
                {selectedCases.map((c) => (
                  <td key={c.id}>
                    <Link to={`/cases/${encodeURIComponent(c.id)}`} className="text-[var(--vermillion)] hover:underline font-medium text-xs">
                      {c.caseNumber}
                    </Link>
                  </td>
                ))}
              </tr>
              <tr>
                <th>法院</th>
                {selectedCases.map((c) => <td key={c.id} className="text-xs">{c.court}</td>)}
              </tr>
              <tr>
                <th>類型</th>
                {selectedCases.map((c) => (
                  <td key={c.id}>
                    <span className={`badge text-[10px] ${c.caseType.includes('刑') ? 'badge-criminal' : 'badge-civil'}`}>{c.caseType}</span>
                  </td>
                ))}
              </tr>
              <tr>
                <th>結果</th>
                {selectedCases.map((c) => <td key={c.id}><ResultBadge result={c.result} /></td>)}
              </tr>
              <tr>
                <th>涉案技術</th>
                {selectedCases.map((c) => <td key={c.id} className="text-xs">{c.technology}</td>)}
              </tr>
              <tr>
                <th>產業</th>
                {selectedCases.map((c) => <td key={c.id} className="text-xs">{c.industryCategory}</td>)}
              </tr>
              <tr>
                <th>賠償金額</th>
                {selectedCases.map((c) => (
                  <td key={c.id} className="font-mono font-medium text-sm">
                    {c.damagesFormatted || '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <th>起訴日期</th>
                {selectedCases.map((c) => <td key={c.id} className="text-xs font-mono">{c.filingDate || '—'}</td>)}
              </tr>
              <tr>
                <th>判決日期</th>
                {selectedCases.map((c) => <td key={c.id} className="text-xs font-mono">{c.judgmentDate || '—'}</td>)}
              </tr>
              <tr>
                <th>主要爭點</th>
                {selectedCases.map((c) => (
                  <td key={c.id}>
                    <div className="flex flex-wrap gap-1">
                      {c.keyIssues.map((issue) => (
                        <span key={issue} className="text-[10px] px-1.5 py-0.5 bg-[rgba(200,164,90,0.1)] text-[var(--gold)]">{issue}</span>
                      ))}
                    </div>
                  </td>
                ))}
              </tr>
              <tr>
                <th>涉及條文</th>
                {selectedCases.map((c) => (
                  <td key={c.id}>
                    <div className="flex flex-wrap gap-1">
                      {c.statutes.map((s) => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 bg-[var(--bg-secondary)] text-[var(--text-secondary)]">{s}</span>
                      ))}
                    </div>
                  </td>
                ))}
              </tr>
              <tr>
                <th>判決書</th>
                {selectedCases.map((c) => {
                  const lawsnoteUrl = getLawsnoteUrl(c);
                  return (
                    <td key={c.id}>
                      {lawsnoteUrl ? (
                        <a href={lawsnoteUrl} target="_blank" rel="noopener noreferrer" className="external-link-icon text-xs">
                          <ExternalLink size={12} /> 查看
                        </a>
                      ) : (
                        <span className="text-[10px] text-[var(--text-muted)]" title="尚未判決或非正式案號">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {selectedCases.length < 2 && (
        <div className="card p-8 text-center">
          <GitCompare size={32} className="mx-auto text-[var(--text-muted)] mb-3" />
          <p className="text-sm text-[var(--text-muted)]">
            請至少選擇 2 件案件進行比較
          </p>
        </div>
      )}
    </div>
  );
}

/* ===== Shared components ===== */
function MiniStat({ label, value }) {
  return (
    <div className="text-center p-3 bg-[var(--bg-secondary)] border border-[var(--border)]">
      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">{label}</p>
      <p className="font-display text-lg sm:text-xl font-bold text-[var(--text-primary)]">{value}</p>
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

function formatAmount(n) {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}億`;
  if (n >= 10000) return `${(n / 10000).toLocaleString()}萬`;
  return `${n.toLocaleString()}`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 loading-shimmer rounded" />
      <div className="h-10 loading-shimmer rounded" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-80 loading-shimmer rounded" />
        <div className="h-80 loading-shimmer rounded" />
      </div>
    </div>
  );
}
