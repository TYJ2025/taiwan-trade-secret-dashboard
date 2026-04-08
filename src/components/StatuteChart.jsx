import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function StatuteChart({ data }) {
  return (
    <div className="card p-4 sm:p-5">
      <h3 className="font-display text-sm font-bold mb-4 tracking-wide">
        常見引用條文
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical" barSize={14}>
          <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border)' }} allowDecimals={false} />
          <YAxis type="category" dataKey="statute" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} width={100} />
          <Tooltip
            contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--border)', color: 'var(--tooltip-text)', fontSize: 12 }}
            formatter={(v) => [`${v} 件`, '引用次數']}
          />
          <Bar dataKey="count" fill="var(--gold)" radius={[0, 2, 2, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
