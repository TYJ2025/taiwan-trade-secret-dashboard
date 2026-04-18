import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calculator, Search, FileSearch, Trophy, ScrollText, AlertCircle } from 'lucide-react';
import { useCases, useJudgments } from '../hooks/useData';
import StatsCards from '../components/StatsCards';
import YearChart from '../components/YearChart';
import IndustryChart from '../components/IndustryChart';
import ResultChart from '../components/ResultChart';
import StatuteChart from '../components/StatuteChart';
import TopDamages from '../components/TopDamages';
import RecentCases from '../components/RecentCases';

export default function Dashboard() {
  const { cases, stats, loading, error } = useCases();
  const { judgments, analysis, loading: jLoading, error: jError } = useJudgments();

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} />;
  if (!stats) return null;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ─── 第一區：492 筆判決總覽（方案 A） ─── */}
      <JudgmentsOverview
        judgments={judgments}
        analysis={analysis}
        loading={jLoading}
        error={jError}
      />

      {/* ─── 第二區：52 筆審理中／訴訟前追蹤（原資料集） ─── */}
      <section className="pt-2">
        <div className="flex items-baseline gap-3 mb-3 border-b border-[var(--border)] pb-2">
          <h3 className="font-display text-sm sm:text-base font-bold text-[var(--text-secondary)]">
            審理中／訴訟前追蹤
          </h3>
          <span className="text-[10px] text-[var(--text-muted)]">
            {stats.overview?.totalCases ?? cases.length} 件・與上方 492 筆判決為獨立資料集
          </span>
        </div>

        <StatsCards stats={stats.overview} />

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4">
          <div className="animate-fade-in-up stagger-3">
            <YearChart data={stats.byYear} />
          </div>
          <div className="animate-fade-in-up stagger-4">
            <IndustryChart data={stats.byIndustry} />
          </div>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-4">
          <div className="animate-fade-in-up stagger-5">
            <ResultChart data={stats.byResult} />
          </div>
          <div className="animate-fade-in-up stagger-5">
            <StatuteChart data={stats.byStatute} />
          </div>
          <div className="animate-fade-in-up stagger-6 md:col-span-2 lg:col-span-1">
            <TopDamages data={stats.topDamages} />
          </div>
        </div>

        {/* Recent cases */}
        <div className="animate-fade-in-up stagger-6 mt-4">
          <RecentCases cases={cases.slice(0, 5)} />
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// 492 筆判決總覽區塊
// ─────────────────────────────────────────────────────────────────
function JudgmentsOverview({ judgments, analysis, loading, error }) {
  const summary = useMemo(() => {
    if (!judgments || judgments.length === 0 || !analysis) return null;
    const damagesCases = judgments.filter((j) => j.isDamagesCase);
    const awarded = damagesCases.filter((c) => c.damagesNum > 0);
    const totalAwarded = awarded.reduce((s, c) => s + c.damagesNum, 0);

    // 最高判准額（取代平均值）
    const top = [...awarded].sort((a, b) => b.damagesNum - a.damagesNum)[0] || null;

    return {
      totalJudgments: judgments.length,
      damagesCaseCount: damagesCases.length,
      awardedCount: awarded.length,
      totalAwarded,
      topCase: top, // { caseId, court, damagesNum, ... }
    };
  }, [judgments, analysis]);

  if (loading) {
    return (
      <section>
        <div className="h-8 w-64 loading-shimmer rounded mb-3" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-24 loading-shimmer rounded" />)}
        </div>
      </section>
    );
  }
  if (error) {
    return (
      <section className="card p-4 flex items-center gap-2 text-[var(--vermillion)] text-xs">
        <AlertCircle size={14} /> 492 筆判決資料載入失敗：{error}
      </section>
    );
  }
  if (!summary) return null;

  return (
    <section>
      {/* 標題列 */}
      <div className="flex items-baseline justify-between gap-3 mb-3 border-b border-[var(--border)] pb-2">
        <div>
          <h3 className="font-display text-sm sm:text-base font-bold flex items-center gap-1.5">
            <ScrollText size={16} className="text-[var(--gold)]" />
            營業秘密判決總覽
          </h3>
          <p className="text-[10px] sm:text-xs text-[var(--text-muted)] mt-0.5">
            司法院裁判書系統 492 筆營業秘密相關判決之結構化抽取結果
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            to="/damages"
            className="text-[10px] sm:text-xs px-2.5 py-1 border border-[var(--gold)] text-[var(--gold)] hover:bg-[rgba(200,164,90,0.1)] transition flex items-center gap-1"
          >
            <Calculator size={11} /> 損害賠償分析
          </Link>
          <Link
            to="/search"
            className="text-[10px] sm:text-xs px-2.5 py-1 border border-[var(--accent-blue)] text-[var(--accent-blue)] hover:bg-[rgba(41,128,185,0.1)] transition flex items-center gap-1"
          >
            <Search size={11} /> 全文檢索
          </Link>
        </div>
      </div>

      {/* KPI 5 張 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <OverviewKpi
          icon={FileSearch}
          label="判決總數"
          value={summary.totalJudgments.toLocaleString()}
          suffix="件"
          color="text-[var(--text-primary)]"
        />
        <OverviewKpi
          icon={ScrollText}
          label="損害賠償案件"
          value={summary.damagesCaseCount}
          suffix="件"
          sub="民事含排除侵害"
          color="text-[var(--gold)]"
        />
        <OverviewKpi
          icon={Calculator}
          label="實際判准件數"
          value={summary.awardedCount}
          suffix="件"
          sub={
            summary.damagesCaseCount > 0
              ? `判准率 ${Math.round((summary.awardedCount / summary.damagesCaseCount) * 100)}%`
              : ''
          }
          color="text-[var(--vermillion)]"
        />
        <OverviewKpi
          icon={Calculator}
          label="判准總額"
          value={formatMoney(summary.totalAwarded)}
          sub="全部判准案件合計"
          color="text-[var(--accent-blue)]"
        />
        <OverviewKpi
          icon={Trophy}
          label="最高判准額"
          value={summary.topCase ? formatMoney(summary.topCase.damagesNum) : '—'}
          sub={
            summary.topCase
              ? `${summary.topCase.court}｜${summary.topCase.caseId}`
              : ''
          }
          color="text-[var(--accent-green)]"
          highlight
        />
      </div>

      {/* 誠實揭露 */}
      <p className="text-[10px] text-[var(--text-muted)] mt-2">
        註：金額以正則比對判決全文抽取；原告敗訴／駁回案件判准額歸零，該 heuristic 可能遺漏少數複雜主文，詳見損害賠償分析頁說明。
      </p>
    </section>
  );
}

function OverviewKpi({ icon: Icon, label, value, suffix, sub, color, highlight }) {
  return (
    <div className={`card p-3 ${highlight ? 'ring-1 ring-[var(--accent-green)]' : ''}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-[var(--text-muted)] tracking-wider">{label}</span>
        {Icon && <Icon size={12} className="text-[var(--text-muted)]" />}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`font-display text-lg sm:text-xl md:text-2xl font-bold font-mono leading-none ${color}`}>
          {value}
        </span>
        {suffix && <span className="text-[10px] text-[var(--text-muted)]">{suffix}</span>}
      </div>
      {sub && <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)] mt-1 truncate" title={sub}>{sub}</p>}
    </div>
  );
}

function formatMoney(n) {
  if (!n || n === 0) return '0';
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(2)} 億`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)} 萬`;
  return `${n.toLocaleString()}`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-24 loading-shimmer rounded" />
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 sm:h-28 loading-shimmer rounded" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="h-72 sm:h-80 loading-shimmer rounded" />
        <div className="h-72 sm:h-80 loading-shimmer rounded" />
      </div>
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-red-50 text-[var(--vermillion)] flex items-center justify-center rounded-full mb-4 text-2xl">
        !
      </div>
      <h2 className="font-display text-xl font-bold mb-2">資料載入失敗</h2>
      <p className="text-sm text-[var(--text-muted)] max-w-md">{message}</p>
    </div>
  );
}
