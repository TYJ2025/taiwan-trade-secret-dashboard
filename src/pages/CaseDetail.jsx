import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Scale, Tag, AlertTriangle, Users, FileText } from 'lucide-react';
import { useCase } from '../hooks/useData';

export default function CaseDetail() {
  const { id } = useParams();
  const { caseItem: c, loading, error } = useCase(decodeURIComponent(id));

  if (loading) return <div className="h-96 loading-shimmer rounded" />;
  if (error) return <div className="text-center py-20 text-[var(--text-muted)]">{error}</div>;
  if (!c)
    return (
      <div className="text-center py-20">
        <p className="text-[var(--text-muted)] mb-4">找不到此案件</p>
        <Link to="/cases" className="text-[var(--vermillion)] hover:underline text-sm">
          返回案件列表
        </Link>
      </div>
    );

  return (
    <div className="animate-fade-in-up max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <Link
        to="/cases"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--vermillion)] mb-4 transition-colors"
      >
        <ArrowLeft size={13} /> 返回案件列表
      </Link>

      {/* Header */}
      <div className="bg-white border border-[var(--border)] p-6 mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`badge ${
                  c.caseType.includes('刑') ? 'badge-criminal' : 'badge-civil'
                }`}
              >
                {c.caseType}
              </span>
              <ResultBadge result={c.result} />
              <span className="text-[10px] px-2 py-0.5 bg-[var(--bg-secondary)] text-[var(--text-muted)]">
                {c.status}
              </span>
            </div>
            <h1 className="font-display text-xl font-bold mb-1">{c.caseNumber}</h1>
            <p className="text-sm text-[var(--text-secondary)]">{c.court}</p>
          </div>
          {c.damages > 0 && (
            <div className="text-right">
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">
                損害賠償
              </p>
              <p className="font-display text-2xl font-bold text-[var(--vermillion)]">
                {c.damagesFormatted}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Main info */}
        <div className="md:col-span-2 space-y-4">
          {/* Summary */}
          <Section title="案件摘要" icon={FileText}>
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{c.summary}</p>
          </Section>

          {/* Key issues */}
          <Section title="主要爭點" icon={AlertTriangle}>
            <div className="flex flex-wrap gap-2">
              {c.keyIssues.map((issue) => (
                <span
                  key={issue}
                  className="text-xs px-3 py-1.5 bg-[rgba(200,164,90,0.1)] text-[#a07830] border border-[rgba(200,164,90,0.2)]"
                >
                  {issue}
                </span>
              ))}
            </div>
          </Section>

          {/* Statutes */}
          <Section title="涉及條文" icon={Scale}>
            <div className="flex flex-wrap gap-2">
              {c.statutes.map((s) => (
                <span
                  key={s}
                  className="text-xs px-3 py-1.5 bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border)]"
                >
                  {s}
                </span>
              ))}
            </div>
          </Section>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Parties */}
          <Section title="當事人" icon={Users}>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">
                  {c.caseType.includes('刑') ? '告訴人/檢察官' : '原告'}
                </p>
                <p className="text-sm font-medium">{c.parties.plaintiff}</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">
                  被告
                </p>
                <p className="text-sm font-medium">{c.parties.defendant}</p>
              </div>
            </div>
          </Section>

          {/* Meta */}
          <Section title="案件資訊" icon={Calendar}>
            <div className="space-y-2 text-xs">
              <InfoRow label="涉案技術" value={c.technology} />
              <InfoRow label="產業類別" value={c.industryCategory} />
              <InfoRow label="起訴日期" value={c.filingDate || '—'} />
              <InfoRow label="判決日期" value={c.judgmentDate || '尚未判決'} />
              <InfoRow label="資料來源" value={c.source} />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="bg-white border border-[var(--border)] p-5">
      <h3 className="font-display text-xs font-bold tracking-wide flex items-center gap-2 mb-3 text-[var(--text-secondary)] uppercase">
        <Icon size={13} />
        {title}
      </h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-dashed border-[var(--border)] last:border-0">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="font-medium text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

function ResultBadge({ result }) {
  let cls = 'badge ';
  if (result === '有罪' || result === '原告勝訴') cls += 'badge-guilty';
  else if (result === '無罪') cls += 'badge-innocent';
  else if (result === '駁回') cls += 'badge-dismissed';
  else if (result === '部分勝訴') cls += 'badge-won';
  else cls += 'bg-[rgba(41,128,185,0.08)] text-[var(--accent-blue)]';
  return <span className={cls}>{result}</span>;
}
