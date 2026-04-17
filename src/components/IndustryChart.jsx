import React, { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector } from 'recharts';

const COLORS = ['#c23616', '#2980b9', '#c8a45a', '#27ae60', '#8e44ad', '#e67e22', '#1abc9c', '#95a5a6'];

const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  return (
    <g>
      <text x={cx} y={cy - 8} textAnchor="middle" fill="var(--text-primary)" fontSize={14} fontWeight={700}>
        {payload.name}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--text-muted)" fontSize={11}>
        {value} 件 ({(percent * 100).toFixed(0)}%)
      </text>
      <Sector
        cx={cx} cy={cy} innerRadius={innerRadius - 2} outerRadius={outerRadius + 6}
        startAngle={startAngle} endAngle={endAngle} fill={fill}
      />
      <Sector
        cx={cx} cy={cy} innerRadius={innerRadius - 2} outerRadius={innerRadius}
        startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.3}
      />
    </g>
  );
};

export default function IndustryChart({ data }) {
  const [activeIndex, setActiveIndex] = useState(-1);

  return (
    <div className="card p-4 sm:p-5">
      <h3 className="font-display text-sm font-bold mb-4 tracking-wide">
        涉案產業分布
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={90}
            dataKey="count" nameKey="name" paddingAngle={2} stroke="none"
            activeIndex={activeIndex} activeShape={renderActiveShape}
            onMouseEnter={(_, i) => setActiveIndex(i)}
            onMouseLeave={() => setActiveIndex(-1)}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} style={{ cursor: 'pointer' }} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--border)', color: 'var(--tooltip-text)', fontSize: 12 }}
            formatter={(value, name) => [`${value} 件`, name]}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Legend below chart for better mobile layout */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 justify-center">
        {data.map((d, i) => (
          <span
            key={d.name}
            className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-primary)] transition-colors"
            onMouseEnter={() => setActiveIndex(i)}
            onMouseLeave={() => setActiveIndex(-1)}
          >
            <span className="w-2.5 h-2.5 flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
            {d.name} ({d.percentage}%)
          </span>
        ))}
      </div>
    </div>
  );
}
