import { useState, useEffect } from 'react';
import { getStreakDays } from '../lib/firestore';
import { COLORS } from '../lib/constants';

/**
 * 28-day dot grid streak calendar.
 * Green dot = day has food logged. Current streak counted from today backwards.
 */
export default function Streak({ uid }) {
  const [loggedDates, setLoggedDates] = useState(new Set());

  useEffect(() => {
    if (!uid) return;
    getStreakDays(uid, 28).then(days => {
      setLoggedDates(new Set(days.map(d => d.date)));
    });
  }, [uid]);

  // Build last 28 days array (newest first)
  const today = new Date();
  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    return d.toISOString().split('T')[0];
  });

  // Compute streak (consecutive days from today backwards)
  let streak = 0;
  for (const date of days) {
    if (loggedDates.has(date)) streak++;
    else break;
  }

  return (
    <div className="px-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: COLORS.textMuted }}>28-day streak</span>
        {streak > 1 && (
          <span className="text-xs font-semibold" style={{ color: COLORS.green }}>
            🔥 {streak} day{streak !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {[...days].reverse().map(date => (
          <div
            key={date}
            className="w-full aspect-square rounded-sm"
            style={{
              background: loggedDates.has(date) ? COLORS.green : '#1e293b',
              opacity: date === today.toISOString().split('T')[0] ? 1 : 0.7,
            }}
            title={date}
          />
        ))}
      </div>
    </div>
  );
}
