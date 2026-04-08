import React, { useState, useEffect, useRef } from 'react';
import { FileText, Gavel, Scale, TrendingUp } from 'lucide-react';

function AnimatedNumber({ value, duration = 800 }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const numValue = typeof value === 'number' ? value : parseInt(value) || 0;

  useEffect(() => {
    if (numValue === 0) return;
    let start = null;
    const animate = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * numValue));
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    };
    ref.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(ref.current);
  }, [numValue, duration]);

  return <>{display}</>;
}

export default function StatsCards({ stats }) {
  const cards = [
    {
      label: '案件總數',
      value: stats.totalCases,
      displayValue: stats.totalCases,
      animated: true,
      sub: `刑事 ${stats.criminalCases} / 民事 ${stats.civilCases}`,
      icon: FileText,
      accent: 'vermillion',
    },
    {
      label: '定罪率',
      value: stats.convictionRate,
      displayValue: `${(stats.convictionRate * 100).toFixed(0)}%`,
      animated: false,
      sub: `${stats.pendingCases} 件審理中`,
      icon: Gavel,
      accent: 'gold',
    },
    {
      label: '損害賠償總額',
      value: stats.totalDamagesAwarded,
      displayValue: formatCurrency(stats.totalDamagesAwarded),
      animated: false,
      sub: `平均 ${formatCurrency(stats.averageDamages)}`,
      icon: TrendingUp,
      accent: 'blue',
    },
    {
      label: '平均審理天數',
      value: stats.medianCaseDuration,
      displayValue: stats.medianCaseDuration,
      animated: true,
      sub: '自起訴至判決',
      icon: Scale,
      accent: 'green',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((card, i) => (
        <div
          key={card.label}
          className={`stat-card ${card.accent} animate-fade-in-up stagger-${i + 1}`}
        >
          <div className="flex items-start justify-between mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-xs font-medium text-[var(--text-muted)] tracking-wider uppercase">
              {card.label}
            </span>
            <card.icon size={14} className="text-[var(--text-muted)] hidden sm:block" />
          </div>
          <p className="font-display text-xl sm:text-2xl md:text-3xl font-bold text-[var(--text-primary)] leading-none mb-1">
            {card.animated ? <AnimatedNumber value={card.value} /> : card.displayValue}
          </p>
          <p className="text-[10px] sm:text-xs text-[var(--text-muted)]">{card.sub}</p>
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
