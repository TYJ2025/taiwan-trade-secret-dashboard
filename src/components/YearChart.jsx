import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div style={{ background: 'var(--tooltip-bg)', color: 'var(--tooltip-text)', padding: '10px 14px', fontSize: 12, border: '1px solid var(--border)' }}>
      <p style={{ fontWeight: 600, marginBottom: 4 }}>{label} 年</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.fill }}>
          {p.name}：{p.value} 件
        </p>
      ))}
      <p style={{ marginTop: 4, opacity: 0.7 }}>
        合計：{payload.reduce((s, p) => s + p.value, 0)} 件
      </p>
    </div>
  );
};

export default function YearChart({ data }) {
  return (
    <div className="card p-4 sm:p-5">
      <h3 className="font-display text-sm font-bold mb-4 tracking-wide">
        歷年案件趨勢
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis dataKey="yearAD" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border)' }} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" iconSize={10} />
          <Bar dataKey="criminal" name="刑事" fill="var(--vermillion)" radius={[2, 2, 0, 0]} />
          <Bar dataKey="civil" name="民事" fill="var(--accent-blue)" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
