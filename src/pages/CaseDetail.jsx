import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Scale, Tag, AlertTriangle, Users, FileText, ExternalLink, Clock, Building2, Bookmark } from 'lucide-react';
import { useCase, getLawsnoteUrl, getJudgmentUrl } from '../hooks/useData';

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

  // Calculate duration if both dates exist
  const duration = c.filingDate && c.judgmentDate
    ? Math.round((new Date(c.judgmentDate) - new Date(c.filingDate)) / (1000 * 60 * 60 * 24))
    : null;

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
      <div className="card p-4 sm:p-6 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`badge ${c.caseType.includes('刑') ? 'badge-criminal' : 'badge-civil'}`}>
                {c.caseType}
              </span>
              <ResultBadge result={c.result} />
              <span className="text-[10px] px-2 py-0.5 bg-[var(--bg-secondary)] text-[var(--text-muted)]">
                {c.status}
              </span>
              {duration && (
                <span className="text-[10px] px-2 py-0.5 bg-[var(--bg-secondary)] text-[var(--text-muted)] flex items-center gap-1">
                  <Clock size={10} />
                  審理 {duration} 天
                </span>
              )}
            </div>
            <h1 className="font-display text-lg sm:text-xl font-bold mb-1 break-all">{c.caseNumber}</h1>
            <p className="text-sm text-[var(--text-secondary)] flex items-center gap-1.5">
              <Building2 size={13} />
              {c.court}
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2">
            {c.damages > 0 && (
              <div className="sm:text-right">
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">
                  損害賠償
                </p>
                <p className="font-display text-xl sm:text-2xl font-bold text-[var(--vermillion)]">
                  {c.damagesFormatted}
                </p>
              </div>
            )}
            {/* External links */}
            <div className="flex gap-2">
              <a
                href={getLawsnoteUrl(c)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[var(--bg-secondary)] text-[var(--accent-blue)] hover:text-[var(--vermillion)] border border-[var(--border)] transition-colors"
              >
                <ExternalLink size={12} />
                Lawsnote 查看判決
              </a>
              <a
                href={getJudgmentUrl(c)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[var(--bg-secondary)] text-[var(--accent-blue)] hover:text-[var(--vermillion)] border border-[var(--border)] transition-colors"
              >
                <ExternalLink size={12} />
                司法院裁判書
              </a>
            </div>
          </div>
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
                  className="text-xs px-3 py-1.5 bg-[rgba(200,164,90,0.1)] text-[var(--gold)] border border-[rgba(200,164,90,0.2)]"
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
              {duration && <InfoRow label="審理天數" value={`${duration} 天`} />}
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
    <div className="card p-4 sm:p-5">
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
      <span className="font-medium text-[var(--text-primary)] text-right max-w-[60%]">{value}</span>
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
