import { useState, useEffect, useMemo } from 'react';

const BASE = import.meta.env.BASE_URL || '/';

export function useCases() {
  const [cases, setCases] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [casesRes, statsRes] = await Promise.all([
          fetch(`${BASE}data/cases.json`),
          fetch(`${BASE}data/stats.json`),
        ]);
        if (!casesRes.ok || !statsRes.ok) throw new Error('Failed to fetch data');
        const casesData = await casesRes.json();
        const statsData = await statsRes.json();
        setCases(casesData.cases || []);
        setStats(statsData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { cases, stats, loading, error };
}

export function useCase(id) {
  const { cases, loading, error } = useCases();
  const caseItem = cases.find((c) => c.id === id) || null;
  return { caseItem, loading, error };
}

/**
 * Build the judgment URL for a case on judicial.gov.tw
 * @param {object} c - case object with caseNumber, court
 * @returns {string} URL to the judicial search for this case
 */
export function getJudgmentUrl(c) {
  if (!c || !c.caseNumber) return null;
  const base = 'https://judgment.judicial.gov.tw/FJUD/default.aspx';
  return `${base}`;
}

/**
 * Build a direct LAWSNOTE search URL for the case
 */
export function getLawsnoteUrl(c) {
  if (!c || !c.caseNumber) return null;
  const q = encodeURIComponent(c.caseNumber);
  return `https://www.lawsnote.com/search?q=${q}`;
}

/**
 * Compute derived analytics from raw case data
 */
export function useAnalytics(cases) {
  return useMemo(() => {
    if (!cases || cases.length === 0) return null;

    // Court distribution
    const courtMap = {};
    cases.forEach((c) => {
      courtMap[c.court] = (courtMap[c.court] || 0) + 1;
    });
    const byCourt = Object.entries(courtMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Damages trend by year
    const damagesByYear = {};
    cases.forEach((c) => {
      if (!c.filingDate) return;
      const year = parseInt(c.filingDate.split('-')[0]);
      if (!damagesByYear[year]) {
        damagesByYear[year] = { year, totalDamages: 0, caseCount: 0, avgDamages: 0 };
      }
      if (c.damages) {
        damagesByYear[year].totalDamages += c.damages;
      }
      damagesByYear[year].caseCount++;
    });
    const damagesTrend = Object.values(damagesByYear)
      .map((d) => ({
        ...d,
        avgDamages: d.caseCount > 0 ? Math.round(d.totalDamages / d.caseCount) : 0,
      }))
      .sort((a, b) => a.year - b.year);

    // Case duration analysis
    const durations = cases
      .filter((c) => c.filingDate && c.judgmentDate)
      .map((c) => {
        const filing = new Date(c.filingDate);
        const judgment = new Date(c.judgmentDate);
        const days = Math.round((judgment - filing) / (1000 * 60 * 60 * 24));
        return { ...c, durationDays: days };
      })
      .filter((c) => c.durationDays > 0)
      .sort((a, b) => a.durationDays - b.durationDays);

    const durationBuckets = [
      { range: '< 6個月', min: 0, max: 180, count: 0 },
      { range: '6-12個月', min: 180, max: 365, count: 0 },
      { range: '1-2年', min: 365, max: 730, count: 0 },
      { range: '> 2年', min: 730, max: Infinity, count: 0 },
    ];
    durations.forEach((c) => {
      const bucket = durationBuckets.find((b) => c.durationDays >= b.min && c.durationDays < b.max);
      if (bucket) bucket.count++;
    });

    // Key issues frequency
    const issueMap = {};
    cases.forEach((c) => {
      (c.keyIssues || []).forEach((issue) => {
        issueMap[issue] = (issueMap[issue] || 0) + 1;
      });
    });
    const byKeyIssue = Object.entries(issueMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Conviction rate by industry
    const industryResults = {};
    cases.forEach((c) => {
      const ind = c.industryCategory || '其他';
      if (!industryResults[ind]) {
        industryResults[ind] = { total: 0, convicted: 0 };
      }
      industryResults[ind].total++;
      if (c.result === '有罪' || c.result === '原告勝訴') {
        industryResults[ind].convicted++;
      }
    });
    const convictionByIndustry = Object.entries(industryResults)
      .map(([name, data]) => ({
        name,
        total: data.total,
        convicted: data.convicted,
        rate: data.total > 0 ? Math.round((data.convicted / data.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      byCourt,
      damagesTrend,
      durations,
      durationBuckets,
      byKeyIssue,
      convictionByIndustry,
    };
  }, [cases]);
}
