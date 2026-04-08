import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function YearChart({ data }) {
  return (
    <div className="bg-white border border-[var(--border)] p-5">
      <h3 className="font-display text-sm font-bold mb-4 tracking-wide">
        歷年案件趨勢
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eae8e0" />
          <XAxis
            dataKey="yearAD"
            tick={{ fontSize: 11, fill: '#9a8f7c' }}
            axisLine={{ stroke: '#d5d0c4' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9a8f7c' }}
            axisLine={{ stroke: '#d5d0c4' }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: '#332e27',
              border: 'none',
              borderRadius: 0,
              color: '#eae8e0',
              fontSize: 12,
            }}
            labelFormatter={(v) => `${v} 年`}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            iconType="square"
            iconSize={10}
          />
          <Bar dataKey="criminal" name="刑事" fill="#c23616" radius={[2, 2, 0, 0]} />
          <Bar dataKey="civil" name="民事" fill="#2980b9" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
