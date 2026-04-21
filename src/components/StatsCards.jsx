import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Gavel, Scale, TrendingUp, ArrowUpRight } from 'lucide-react';

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
      icon: FileText,
      accent: 'vermillion',
      to: '/cases',
      subParts: [
        { text: '刑事 ', to: '/cases?type=刑' },
        { text: `${stats.criminalCases}`, to: '/cases?type=刑' },
        { text: ' / ', to: null },
        { text: '民事 ', to: '/cases?type=民' },
        { text: `${stats.civilCases}`, to: '/cases?type=民' },
      ],
    },
    {
      label: '定罪率（刑事）',
      value: stats.convictionRate,
      displayValue: `${(stats.convictionRate * 100).toFixed(0)}%`,
      animated: false,
      icon: Gavel,
      accent: 'gold',
      to: '/cases?type=刑&result=有罪',
      subParts: [
        stats.criminalGuiltyCount && stats.criminalDecidedCount
          ? { text: `${stats.criminalGuiltyCount}/${stats.criminalDecidedCount} 已判決`, to: '/cases?type=刑&result=有罪,無罪' }
          : null,
        { text: ' · ', to: null },
        { text: `${stats.pendingCases} 未終結`, to: '/cases?result=審理中,偵查中,調解中' },
      ].filter(Boolean),
    },
    {
      label: '損害賠償總額',
      value: stats.totalDamagesAwarded,
      displayValue: formatCurrency(stats.totalDamagesAwarded),
      animated: false,
      icon: TrendingUp,
      accent: 'blue',
      to: '/cases',
      subParts: [
        { text: '平均 ', to: null },
        { text: formatCurrency(stats.averageDamages), to: '/cases' },
      ],
    },
    {
      label: '平均審理天數',
      value: stats.medianCaseDuration,
      displayValue: stats.medianCaseDuration,
      animated: true,
      icon: Scale,
      accent: 'green',
      to: null,
      subParts: [{ text: '自起訴至判決', to: null }],
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
            <div className="flex items-center gap-1">
              <card.icon size={14} className="text-[var(--text-muted)] hidden sm:block" />
              {card.to && (
                <ArrowUpRight
                  size={12}
                  className="text-[var(--text-muted)] hidden sm:block"
                />
              )}
            </div>
          </div>

          {/* 主數字：如果有 to 則為 Link */}
          {card.to ? (
            <Link
              to={card.to}
              title="點擊查看對應案件"
              className="font-display text-xl sm:text-2xl md:text-3xl font-bold text-[var(--text-primary)] leading-none mb-1 block hover:text-[var(--vermillion)] transition-colors"
            >
              {card.animated ? <AnimatedNumber value={card.value} /> : card.displayValue}
            </Link>
          ) : (
            <p className="font-display text-xl sm:text-2xl md:text-3xl font-bold text-[var(--text-primary)] leading-none mb-1">
              {card.animated ? <AnimatedNumber value={card.value} /> : card.displayValue}
            </p>
          )}

          {/* Sub-label：分段 inline Link */}
          <p className="text-[10px] sm:text-xs text-[var(--text-muted)]">
            {card.subParts.map((p, idx) =>
              p.to ? (
                <Link
                  key={idx}
                  to={p.to}
                  className="hover:text-[var(--vermillion)] hover:underline decoration-dotted underline-offset-2 transition"
                >
                  {p.text}
                </Link>
              ) : (
                <span key={idx}>{p.text}</span>
              )
            )}
          </p>
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
