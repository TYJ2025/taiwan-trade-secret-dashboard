import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { ExternalLink, Scale, Calculator, BookOpen, TrendingUp, AlertCircle, ArrowUpRight } from 'lucide-react';
import { useJudgments } from '../hooks/useData';
import { formatJudgmentCaseName } from '../utils/caseName';

const COLORS = [
  '#C8A45A', '#C0392B', '#2980B9', '#27AE60', '#8E44AD',
  '#E67E22', '#16A085', '#D35400', '#7F8C8D', '#2C3E50',
];

export default function DamagesAnalysis() {
  const { judgments, analysis, loading, error } = useJudgments();
  const [courtFilter, setCourtFilter] = useState('all');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');

  const courts = useMemo(() => {
    const s = new Set(judgments.map((j) => j.court));
    return [...s].sort();
  }, [judgments]);

  // Damages cases after filters
  const damagesCases = useMemo(() => {
    return judgments
      .filter((j) => j.isDamagesCase)
      .filter((j) => courtFilter === 'all' || j.court === courtFilter)
      .filter((j) => !yearFrom || j.adYear >= Number(yearFrom))
      .filter((j) => !yearTo || j.adYear <= Number(yearTo));
  }, [judgments, courtFilter, yearFrom, yearTo]);

  const filteredStats = useMemo(() => {
    const awarded = damagesCases.filter((c) => c.damagesNum > 0);
    const totalAwarded = awarded.reduce((s, c) => s + c.damagesNum, 0);
    // 最高判准額：法律讀者較關心 TOP 值（標竿案件）而非算術平均
    const sortedDesc = [...awarded].sort((a, b) => b.damagesNum - a.damagesNum);
    const topCase = sortedDesc[0] || null;
    const maxAwarded = topCase ? topCase.damagesNum : 0;
    const medAwarded = awarded.length > 0
      ? [...awarded.map((c) => c.damagesNum)].sort((a, b) => a - b)[Math.floor(awarded.length / 2)]
      : 0;
    return {
      total: damagesCases.length,
      awarded: awarded.length,
      totalAwarded,
      maxAwarded,
      maxCase: topCase,
      medAwarded,
      awardRate: damagesCases.length > 0
        ? Math.round((awarded.length / damagesCases.length) * 100)
        : 0,
    };
  }, [damagesCases]);

  // Calc method breakdown within filtered set
  const calcBreakdown = useMemo(() => {
    if (!analysis) return [];
    const counts = {};
    damagesCases.forEach((c) => {
      (c.calcMethods || []).forEach((m) => {
        counts[m] = (counts[m] || 0) + 1;
      });
    });
    const dict = Object.fromEntries((analysis.calcMethodDictionary || []).map((m) => [m.key, m]));
    return Object.entries(counts)
      .map(([key, count]) => ({
        key,
        label: dict[key]?.label || key,
        statute: dict[key]?.statute || '',
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [damagesCases, analysis]);

  // Yearly aggregation
  const yearly = useMemo(() => {
    const m = {};
    damagesCases.forEach((c) => {
      const y = c.adYear || 0;
      if (!y) return;
      if (!m[y]) m[y] = { year: y, count: 0, awarded: 0, awardedCount: 0 };
      m[y].count++;
      if (c.damagesNum > 0) {
        m[y].awarded += c.damagesNum;
        m[y].awardedCount++;
      }
    });
    return Object.values(m).sort((a, b) => a.year - b.year);
  }, [damagesCases]);

  // Amount distribution buckets
  const amountBuckets = useMemo(() => {
    const buckets = [
      { label: '0（駁回/未判准）', min: 0, max: 0, count: 0 },
      { label: '~10萬', min: 1, max: 100_000, count: 0 },
      { label: '10萬~100萬', min: 100_000, max: 1_000_000, count: 0 },
      { label: '100萬~1千萬', min: 1_000_000, max: 10_000_000, count: 0 },
      { label: '1千萬~1億', min: 10_000_000, max: 100_000_000, count: 0 },
      { label: '>1億', min: 100_000_000, max: Infinity, count: 0 },
    ];
    damagesCases.forEach((c) => {
      const v = c.damagesNum || 0;
      if (v === 0) { buckets[0].count++; return; }
      const b = buckets.slice(1).find((b) => v > b.min && v <= b.max) || buckets[buckets.length - 1];
      b.count++;
    });
    return buckets;
  }, [damagesCases]);

  const topCases = useMemo(() => {
    return [...damagesCases]
      .filter((c) => c.damagesNum > 0)
      .sort((a, b) => b.damagesNum - a.damagesNum)
      .slice(0, 15);
  }, [damagesCases]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <div className="card p-6 flex items-center gap-2 text-[var(--vermillion)]">
    <AlertCircle size={14} /> 載入失敗：{error}
  </div>;
  if (!analysis) return null;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in-up">
      <header>
        <h2 className="font-display text-lg sm:text-xl font-bold mb-1">損害賠償分析</h2>
        <p className="text-xs text-[var(--text-muted)]">
          對 {judgments.length} 筆營業秘密判決中之損害賠償案件進行數量、金額分布、計算方式與法條引用之多維度分析。
          {(() => {
            const latest = judgments.map((j) => j.adDate).filter(Boolean).sort().slice(-1)[0];
            return latest ? (
              <span className="ml-1 text-[var(--text-secondary)]">
                資料更新至 <span className="font-mono">{latest}</span>（最近一筆判決日期）。
              </span>
            ) : null;
          })()}
        </p>
      </header>

      {/* Filters */}
      <div className="card p-3 flex flex-wrap gap-3 items-center">
        <span className="text-[10px] text-[var(--text-muted)]">法院:</span>
        <select value={courtFilter} onChange={(e) => setCourtFilter(e.target.value)} className="filter-select">
          <option value="all">全部</option>
          {courts.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="text-[10px] text-[var(--text-muted)]">判決年度:</span>
        <input type="number" value={yearFrom} onChange={(e) => setYearFrom(e.target.value)}
          placeholder="起" className="filter-select w-24" />
        <span className="text-[10px] text-[var(--text-muted)]">~</span>
        <input type="number" value={yearTo} onChange={(e) => setYearTo(e.target.value)}
          placeholder="迄" className="filter-select w-24" />
        <button
          onClick={() => { setCourtFilter('all'); setYearFrom(''); setYearTo(''); }}
          className="ml-auto text-[10px] text-[var(--vermillion)] hover:underline"
        >
          清除篩選
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="損害賠償案件" value={filteredStats.total} suffix="件" color="gold" />
        <KpiCard label="實際判准件數" value={filteredStats.awarded} suffix="件" color="red"
          sub={`勝訴率 ${filteredStats.awardRate}%`} />
        <KpiCard label="判准總額" value={formatMoney(filteredStats.totalAwarded)} color="blue" />
        <KpiCard
          label="最高判准額"
          value={formatMoney(filteredStats.maxAwarded)}
          color="green"
          sub={filteredStats.maxCase
            ? `${filteredStats.maxCase.court}｜${filteredStats.maxCase.caseId}`
            : '—'}
          href={filteredStats.maxCase?.judgmentUrl}
        />
        <KpiCard label="中位數判准額" value={formatMoney(filteredStats.medAwarded)} color="purple" />
      </div>

      {/* Calc method & Amount distribution side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Calc methods */}
        <div className="card p-4">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-1.5">
            <Calculator size={14} className="text-[var(--gold)]" />
            計算方式分布（法條對應）
          </h3>
          {calcBreakdown.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-4">此篩選條件下無資料</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={calcBreakdown.slice(0, 9)} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="label" type="category" tick={{ fontSize: 9 }} width={180} />
                  <Tooltip formatter={(v) => [`${v} 件`, '案件數']} />
                  <Bar dataKey="count" fill="#C8A45A" />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 text-[10px] text-[var(--text-muted)] space-y-0.5">
                <p className="font-medium">計算方式對應法條（台灣營業秘密法 §13 體系）：</p>
                {calcBreakdown.slice(0, 9).map((m) => (
                  <p key={m.key}>
                    <span className="text-[var(--text-secondary)]">{m.label}</span>
                    <span className="text-[var(--text-muted)]"> — {m.statute} — {m.count} 件</span>
                  </p>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Amount distribution */}
        <div className="card p-4">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-1.5">
            <TrendingUp size={14} className="text-[var(--gold)]" />
            判准金額分布
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={amountBuckets} margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => [`${v} 件`, '案件數']} />
              <Bar dataKey="count" fill="#2980B9" />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-[var(--text-muted)] mt-2">
            註：「0 元」係指該案件經判決駁回、部分駁回或損害賠償部分未獲准。
          </p>
        </div>
      </div>

      {/* Statute citation & Yearly trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-1.5">
            <BookOpen size={14} className="text-[var(--gold)]" />
            損害賠償相關條文引用 TOP 10
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={(analysis.byStatute || []).slice(0, 10)} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="statute" type="category" tick={{ fontSize: 10 }} width={150} />
              <Tooltip formatter={(v) => [`${v} 件`, '引用次數']} />
              <Bar dataKey="count" fill="#C0392B" />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-[var(--text-muted)] mt-2">
            註：以全文正則比對條文字串，未細分援引於主文或理由。
          </p>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-1.5">
            <Scale size={14} className="text-[var(--gold)]" />
            年度損害賠償趨勢
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={yearly} margin={{ top: 10, right: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="year" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} label={{ value: '案件數', angle: -90, position: 'insideLeft', fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }}
                label={{ value: '金額(億)', angle: 90, position: 'insideRight', fontSize: 10 }}
                tickFormatter={(v) => (v / 1e8).toFixed(0)} />
              <Tooltip
                formatter={(v, name) => name === '案件數'
                  ? [`${v} 件`, name]
                  : [formatMoney(v), name]
                }
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line yAxisId="left" dataKey="count" name="案件數" stroke="#C8A45A" strokeWidth={2} />
              <Line yAxisId="right" dataKey="awarded" name="判准金額" stroke="#C0392B" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top 15 damages table */}
      <div className="card p-4">
        <h3 className="text-sm font-medium mb-3">
          判准金額最高 TOP {topCases.length}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                <th className="text-left py-2 px-2">#</th>
                <th className="text-left py-2 px-2">案號</th>
                <th className="text-left py-2 px-2">法院</th>
                <th className="text-left py-2 px-2">案由</th>
                <th className="text-left py-2 px-2">結果</th>
                <th className="text-right py-2 px-2">判准金額</th>
                <th className="text-left py-2 px-2">計算方式</th>
                <th className="text-center py-2 px-2">原文</th>
              </tr>
            </thead>
            <tbody>
              {topCases.map((c, i) => (
                <tr key={c.seq} className="border-b border-[var(--border)] hover:bg-[var(--bg-secondary)]">
                  <td className="py-2 px-2 text-[var(--text-muted)]">{i + 1}</td>
                  <td className="py-2 px-2 whitespace-nowrap">
                    <span className="font-medium" title={c.caseId}>
                      {formatJudgmentCaseName(c)}
                    </span>
                  </td>
                  <td className="py-2 px-2 whitespace-nowrap">{c.court}</td>
                  <td className="py-2 px-2 max-w-[18ch] truncate" title={c.reason}>{c.reason}</td>
                  <td className="py-2 px-2">{c.outcome}</td>
                  <td className="py-2 px-2 text-right font-mono font-medium text-[var(--gold)]">
                    {formatMoney(c.damagesNum)}
                  </td>
                  <td className="py-2 px-2">
                    <div className="flex flex-wrap gap-1">
                      {(c.calcMethods || []).slice(0, 3).map((m) => (
                        <span key={m} className="text-[9px] px-1 py-0.5 bg-[rgba(200,164,90,0.1)] text-[var(--gold)]">
                          {m}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-center">
                    {c.judgmentUrl && (
                      <a href={c.judgmentUrl} target="_blank" rel="noopener noreferrer"
                         className="text-[var(--vermillion)] hover:underline">
                        <ExternalLink size={12} className="inline" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Methodology note */}
      <div className="card p-4 text-[10px] text-[var(--text-muted)] space-y-1">
        <p className="font-medium text-[var(--text-secondary)]">資料抽取說明（給法律專業人士）：</p>
        <p>
          1. 「損害賠償案件」範圍：案由含「損害賠償」或「排除侵害」之民事案件（含勞動專業法庭），
          刑事附帶民事判決另列。
        </p>
        <p>
          2. 計算方式偵測：以正則比對判決全文中出現之「具體損害／差額說／利益說／授權金說／酌定／三倍懲罰性賠償」
          等關鍵片語，同一判決可能命中多項。
        </p>
        <p>
          3. 判准金額：優先從主文抽取「新臺幣…元」；中文數字、Arabic 及混合格式（「2 億 2,356 萬元」）皆支援；
          未滿 1,000 元或明顯為日期之數字已過濾。
        </p>
        <p>
          4. 請求金額（原告主張）：以啟發式正則抽取，僅作為參考，部分判決因敘述格式不規則，
          抽取可能偏低或留白。
        </p>
        <p>
          5. 資料更新：每次執行 <code className="bg-[var(--bg-secondary)] px-1">python3 extract_damages.py</code> 重新生成 <code>data/damages_analysis.json</code>。
        </p>
      </div>
    </div>
  );
}

function KpiCard({ label, value, suffix, color, sub, href }) {
  const colorMap = {
    gold: 'text-[var(--gold)]',
    red: 'text-[var(--vermillion)]',
    blue: 'text-[var(--accent-blue)]',
    green: 'text-[var(--accent-green)]',
    purple: 'text-[#8E44AD]',
  };
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-[var(--text-muted)]">{label}</p>
        {href && <ExternalLink size={11} className="text-[var(--text-muted)] group-hover:text-[var(--accent-green)] transition" />}
      </div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className={`text-lg sm:text-xl font-bold font-mono ${colorMap[color]}`}>
          {value}
        </span>
        {suffix && <span className="text-[10px] text-[var(--text-muted)]">{suffix}</span>}
      </div>
      {sub && <p className="text-[9px] text-[var(--text-muted)] mt-0.5 truncate" title={sub}>{sub}</p>}
    </>
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer"
         className="card p-3 group block cursor-pointer transition hover:border-[var(--text-secondary)] hover:shadow-sm"
         title="開啟判決原文">
        {inner}
      </a>
    );
  }
  return <div className="card p-3">{inner}</div>;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 loading-shimmer rounded" />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => <div key={i} className="h-20 loading-shimmer rounded" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-72 loading-shimmer rounded" />
        <div className="h-72 loading-shimmer rounded" />
      </div>
    </div>
  );
}

function formatMoney(n) {
  if (!n || n === 0) return '0';
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(2)} 億`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)} 萬`;
  return `${n.toLocaleString()}`;
}
