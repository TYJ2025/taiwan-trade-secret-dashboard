import React from 'react';
import { TrendingUp } from 'lucide-react';

export default function TopDamages({ data }) {
  const maxAmount = Math.max(...data.map((d) => d.amount));

  return (
    <div className="card p-4 sm:p-5">
      <h3 className="font-display text-sm font-bold mb-4 tracking-wide flex items-center gap-2">
        <TrendingUp size={14} className="text-[var(--vermillion)]" />
        最高賠償金額 TOP 5
      </h3>
      <div className="space-y-3">
        {data.map((item, i) => (
          <div key={i} className="group">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[var(--text-secondary)] font-medium truncate mr-2">
                {item.case}
                <span className="text-[var(--text-muted)] ml-1.5">{item.tech}</span>
              </span>
              <span className="text-xs font-mono font-medium text-[var(--text-primary)] whitespace-nowrap">
                {formatAmount(item.amount)}
              </span>
            </div>
            <div className="w-full h-2 bg-[var(--bg-secondary)] overflow-hidden">
              <div
                className="h-full transition-all duration-700 ease-out group-hover:opacity-80"
                style={{
                  width: `${(item.amount / maxAmount) * 100}%`,
                  background: i === 0 ? 'var(--vermillion)' : i === 1 ? 'var(--gold)' : 'var(--text-muted)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatAmount(n) {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}億`;
  if (n >= 10000) return `${(n / 10000).toLocaleString()}萬`;
  return `${n.toLocaleString()}`;
}
