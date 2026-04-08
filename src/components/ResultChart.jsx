import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

export default function ResultChart({ data }) {
  return (
    <div className="card p-4 sm:p-5">
      <h3 className="font-display text-sm font-bold mb-4 tracking-wide">
        判決結果分布
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data} cx="50%" cy="50%" outerRadius={75} dataKey="count" nameKey="name"
            stroke="var(--bg-card)" strokeWidth={2}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} style={{ cursor: 'pointer' }} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--border)', color: 'var(--tooltip-text)', fontSize: 12 }}
            formatter={(v) => [`${v} 件`]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-2 mt-2 justify-center">
        {data.map((d) => (
          <span key={d.name} className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
            <span className="w-2 h-2" style={{ background: d.color }} />
            {d.name} ({d.count})
          </span>
        ))}
      </div>
    </div>
  );
}
