import React from 'react';
import { FileText, Gavel, Scale, TrendingUp } from 'lucide-react';

export default function StatsCards({ stats }) {
  const cards = [
    {
      label: '案件總數',
      value: stats.totalCases,
      sub: `刑事 ${stats.criminalCases} / 民事 ${stats.civilCases}`,
      icon: FileText,
      accent: 'vermillion',
    },
    {
      label: '定罪率',
      value: `${(stats.convictionRate * 100).toFixed(0)}%`,
      sub: `${stats.pendingCases} 件審理中`,
      icon: Gavel,
      accent: 'gold',
    },
    {
      label: '損害賠償總額',
      value: formatCurrency(stats.totalDamagesAwarded),
      sub: `平均 ${formatCurrency(stats.averageDamages)}`,
      icon: TrendingUp,
      accent: 'blue',
    },
    {
      label: '平均審理天數',
      value: stats.medianCaseDuration,
      sub: '自起訴至判決',
      icon: Scale,
      accent: 'green',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <div
          key={card.label}
          className={`stat-card ${card.accent} animate-fade-in-up stagger-${i + 1}`}
        >
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs font-medium text-[var(--text-muted)] tracking-wider uppercase">
              {card.label}
            </span>
            <card.icon size={16} className="text-[var(--text-muted)]" />
          </div>
          <p className="font-display text-2xl md:text-3xl font-bold text-[var(--text-primary)] leading-none mb-1">
            {card.value}
          </p>
          <p className="text-xs text-[var(--text-muted)]">{card.sub}</p>
        </div>
      ))}
    </div>
  );
}

function formatCurrency(amount) {
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(1)}億`;
  if (amount >= 10000) return `${(amount / 10000).toFixed(0)}萬`;
  return amount.toLocaleString();
}
