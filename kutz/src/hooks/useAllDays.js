import { useState, useEffect } from 'react';
import { getRecentDays } from '../lib/firestore';

/**
 * Fetch recent days for charts (not real-time — fetched once per render).
 * @param {string} uid
 * @param {number} count number of days to fetch
 */
export function useAllDays(uid, count = 30) {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    getRecentDays(uid, count)
      .then(data => {
        // Reverse so oldest is first (charts go left→right chronologically)
        setDays([...data].reverse());
      })
      .finally(() => setLoading(false));
  }, [uid, count]);

  function refresh() {
    if (!uid) return;
    setLoading(true);
    getRecentDays(uid, count)
      .then(data => setDays([...data].reverse()))
      .finally(() => setLoading(false));
  }

  return { days, loading, refresh };
}
