import { useState, useEffect } from 'react';
import { getStreakDays } from '../lib/firestore';

/** Returns current consecutive-day streak (days with real food logged). */

function localDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function prevDateKey(dateKey) {
  const d = new Date(dateKey + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function calcStreak(days) {
  // days: [{ date, hasManualFood }] sorted DESC by date (most recent first)
  if (!days.length) return 0;
  const today = localDateKey();
  let streak   = 0;
  let expected = today;

  for (const d of days) {
    if (d.date > expected) continue; // skip any future-date docs
    if (d.date < expected) break;    // gap found — streak is broken
    if (!d.hasManualFood) break;     // auto-entry only day doesn't count
    streak++;
    expected = prevDateKey(expected);
  }
  return streak;
}

export function useStreak(uid) {
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!uid) return;
    getStreakDays(uid, 28).then(days => setStreak(calcStreak(days)));
  }, [uid]);

  return streak;
}
