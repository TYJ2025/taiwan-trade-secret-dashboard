import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { getLawsnoteUrl } from '../hooks/useData';

export default function RecentCases({ cases }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-[var(--border)]">
        <h3 className="font-display text-sm font-bold tracking-wide">
          近期重要案件
        </h3>
        <Link
          to="/cases"
          className="text-xs text-[var(--vermillion)] hover:underline flex items-center gap-1"
        >
          查看全部 <ArrowRight size={12} />
        </Link>
      </div>
      <div className="table-container">
        <table className="case-table w-full text-sm">
          <thead>
            <tr>
              <th className="text-left px-4 sm:px-5 py-3 text-xs">案號</th>
              <th className="text-left px-3 py-3 text-xs">法院</th>
              <th className="text-center px-3 py-3 text-xs">類型</th>
              <th className="text-center px-3 py-3 text-xs">結果</th>
              <th className="text-left px-3 py-3 text-xs">涉案技術</th>
              <th className="text-right px-4 sm:px-5 py-3 text-xs">賠償金額</th>
              <th className="text-center px-3 py-3 text-xs">判決書</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => {
              const lawsnoteUrl = getLawsnoteUrl(c);
              return (
                <tr key={c.id}>
                  <td className="px-4 sm:px-5 py-3">
                    <Link
                      to={`/cases/${encodeURIComponent(c.id)}`}
                      className="text-[var(--vermillion)] hover:underline font-medium text-xs"
                    >
                      {c.caseNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-xs text-[var(--text-secondary)]">
                    {c.court}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`badge ${c.caseType.includes('刑') ? 'badge-criminal' : 'badge-civil'}`}>
                      {c.caseType}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <ResultBadge result={c.result} />
                  </td>
                  <td className="px-3 py-3 text-xs text-[var(--text-secondary)]">
                    {c.technology}
                  </td>
                  <td className="px-4 sm:px-5 py-3 text-right text-xs font-mono font-medium">
                    {c.damagesFormatted}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {lawsnoteUrl ? (
                      <a
                        href={lawsnoteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="external-link-icon text-[10px]"
                        title="在 Lawsnote 查看判決書"
                      >
                        <ExternalLink size={12} />
                      </a>
                    ) : (
                      <span
                        className="text-[10px] text-[var(--text-muted)]"
                        title="尚未判決或非正式案號，無法外連 Lawsnote"
                      >
                        —
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
