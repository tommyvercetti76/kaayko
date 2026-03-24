import { useState, useEffect } from 'react';
import { getRecentDays } from '../lib/firestore';

/**
 * Fetch recent days for charts (not real-time — fetched once per render).
 * @param {string} uid
 * @param {number} count         number of days to fetch
 * @param {string|null} startDate  YYYY-MM-DD — hide days before this date (profileStartDate)
 */
export function useAllDays(uid, count = 30, startDate = null) {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);

  function applyFilter(data) {
    const filtered = startDate ? data.filter(d => d.date >= startDate) : data;
    return [...filtered].reverse(); // oldest first for charts
  }

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    getRecentDays(uid, count)
      .then(data => setDays(applyFilter(data)))
      .finally(() => setLoading(false));
  }, [uid, count, startDate]);

  function refresh() {
    if (!uid) return;
    setLoading(true);
    getRecentDays(uid, count)
      .then(data => setDays(applyFilter(data)))
      .finally(() => setLoading(false));
  }

  return { days, loading, refresh };
}
