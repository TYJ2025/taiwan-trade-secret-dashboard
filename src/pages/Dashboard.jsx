import React from 'react';
import { Link } from 'react-router-dom';
import { useCases } from '../hooks/useData';
import StatsCards from '../components/StatsCards';
import YearChart from '../components/YearChart';
import IndustryChart from '../components/IndustryChart';
import ResultChart from '../components/ResultChart';
import StatuteChart from '../components/StatuteChart';
import TopDamages from '../components/TopDamages';
import RecentCases from '../components/RecentCases';

export default function Dashboard() {
  const { cases, stats, loading, error } = useCases();

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} />;
  if (!stats) return null;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Stats cards */}
      <StatsCards stats={stats.overview} />

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="animate-fade-in-up stagger-3">
          <YearChart data={stats.byYear} />
        </div>
        <div className="animate-fade-in-up stagger-4">
          <IndustryChart data={stats.byIndustry} />
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
      <div className="animate-fade-in-up stagger-6">
        <RecentCases cases={cases.slice(0, 5)} />
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
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
