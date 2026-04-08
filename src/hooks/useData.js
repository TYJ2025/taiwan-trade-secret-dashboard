import { useState, useEffect } from 'react';

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
