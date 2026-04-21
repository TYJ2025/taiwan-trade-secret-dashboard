import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowUpRight } from 'lucide-react';

export default function StatuteChart({ data }) {
  const navigate = useNavigate();
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm font-bold tracking-wide">常見引用條文</h3>
        <span className="text-[10px] text-[var(--text-muted)]">點條文查明細</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical" barSize={14}>
          <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border)' }} allowDecimals={false} />
          <YAxis type="category" dataKey="statute" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} width={100} />
          <Tooltip
            contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--border)', color: 'var(--tooltip-text)', fontSize: 12 }}
            formatter={(v) => [`${v} 件`, '引用次數']}
          />
          <Bar
            dataKey="count"
            fill="var(--gold)"
            radius={[0, 2, 2, 0]}
            cursor="pointer"
            onClick={(d) => d?.statute && navigate(`/cases?statute=${encodeURIComponent(d.statute)}`)}
          />
        </BarChart>
      </ResponsiveContainer>
      {/* Drill-down list (complements the chart with clickable rows) */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {data.slice(0, 8).map((d) => (
          <Link
            key={d.statute}
            to={`/cases?statute=${encodeURIComponent(d.statute)}`}
            className="text-[10px] px-2 py-0.5 border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors flex items-center gap-1 group"
            title={`查看 ${d.count} 件引用「${d.statute}」的案件`}
          >
            {d.statute}
            <span className="text-[var(--text-muted)] group-hover:text-[var(--gold)]">· {d.count}</span>
            <ArrowUpRight size={9} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </div>
    </div>
  );
}
