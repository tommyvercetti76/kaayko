import { useState, useEffect, useRef } from 'react';
import { getOrCreateDay, onDaySnapshot } from '../lib/firestore';

/**
 * Real-time listener for a day document.
 * Auto-creates today's day (with default entries) on first access;
 * past dates are read-only (no phantom creation).
 */
export function useDay(uid, dateKey) {
  const [day, setDay] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !dateKey) return;
    setLoading(true);
    let unsub = () => {};

    // Await creation before subscribing (fixes race condition)
    getOrCreateDay(uid, dateKey)
      .then(() => {
        unsub = onDaySnapshot(uid, dateKey, (dayData) => {
          setDay(dayData);
          setLoading(false);
        });
      })
      .catch(() => setLoading(false));

    // Fallback: stop loading after 4s if Firestore is slow
    const timer = setTimeout(() => setLoading(false), 4000);

    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, [uid, dateKey]);

  return { day, loading };
}
