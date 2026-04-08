import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function StatuteChart({ data }) {
  return (
    <div className="bg-white border border-[var(--border)] p-5">
      <h3 className="font-display text-sm font-bold mb-4 tracking-wide">
        常見引用條文
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical" barSize={14}>
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: '#9a8f7c' }}
            axisLine={{ stroke: '#d5d0c4' }}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="statute"
            tick={{ fontSize: 10, fill: '#635a4e' }}
            axisLine={false}
            tickLine={false}
            width={100}
          />
          <Tooltip
            contentStyle={{
              background: '#332e27',
              border: 'none',
              borderRadius: 0,
              color: '#eae8e0',
              fontSize: 12,
            }}
            formatter={(v) => [`${v} 件`, '引用次數']}
          />
          <Bar dataKey="count" fill="#c8a45a" radius={[0, 2, 2, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
