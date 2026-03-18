import { useState, useEffect, useRef } from 'react';
import { getOrCreateDay, onDaySnapshot } from '../lib/firestore';

/**
 * Real-time listener for a day document.
 * Auto-creates the day (with fish oil entry) on first access.
 */
export function useDay(uid, dateKey) {
  const [day, setDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  useEffect(() => {
    if (!uid || !dateKey) return;

    initialized.current = false;
    setLoading(true);

    // Ensure the day doc exists before subscribing
    getOrCreateDay(uid, dateKey).then(() => {
      initialized.current = true;
    });

    const unsub = onDaySnapshot(uid, dateKey, (dayData) => {
      setDay(dayData);
      if (initialized.current) setLoading(false);
    });

    // Fallback: stop loading after 3s even if no snapshot
    const timer = setTimeout(() => setLoading(false), 3000);

    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, [uid, dateKey]);

  return { day, loading };
}
