import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const COLORS = ['#c23616', '#2980b9', '#c8a45a', '#27ae60', '#8e44ad', '#e67e22', '#1abc9c', '#95a5a6'];

export default function IndustryChart({ data }) {
  return (
    <div className="bg-white border border-[var(--border)] p-5">
      <h3 className="font-display text-sm font-bold mb-4 tracking-wide">
        涉案產業分布
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={95}
            dataKey="count"
            nameKey="name"
            paddingAngle={2}
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: '#332e27',
              border: 'none',
              borderRadius: 0,
              color: '#eae8e0',
              fontSize: 12,
            }}
            formatter={(value, name) => [`${value} 件`, name]}
          />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            wrapperStyle={{ fontSize: 11, lineHeight: '1.8em' }}
            iconType="square"
            iconSize={10}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
