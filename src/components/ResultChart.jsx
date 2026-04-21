import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowUpRight } from 'lucide-react';

export default function ResultChart({ data }) {
  const navigate = useNavigate();
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm font-bold tracking-wide">判決結果分布</h3>
        <span className="text-[10px] text-[var(--text-muted)]">點結果查明細</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data} cx="50%" cy="50%" outerRadius={75} dataKey="count" nameKey="name"
            stroke="var(--bg-card)" strokeWidth={2}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
            onClick={(d) => d?.name && navigate(`/cases?result=${encodeURIComponent(d.name)}`)}
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
          <Link
            key={d.name}
            to={`/cases?result=${encodeURIComponent(d.name)}`}
            className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] group transition-colors"
            title={`查看 ${d.count} 件「${d.name}」案件`}
          >
            <span className="w-2 h-2" style={{ background: d.color }} />
            {d.name} ({d.count})
            <ArrowUpRight size={9} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </div>
    </div>
  );
}
