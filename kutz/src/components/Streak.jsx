import { useState, useEffect } from 'react';
import { getStreakDays } from '../lib/firestore';
import { COLORS } from '../lib/constants';

/**
 * 28-day dot grid streak calendar.
 * A day counts as "logged" only if it has calories beyond auto-entries
 * (prevents fish oil alone from maintaining a streak).
 */
export default function Streak({ uid }) {
  const [loggedDates, setLoggedDates] = useState(new Set());

  useEffect(() => {
    if (!uid) return;
    getStreakDays(uid, 28).then(days => {
      // Only count days with actual manually-entered food
      setLoggedDates(new Set(
        days.filter(d => d.hasManualFood).map(d => d.date)
      ));
    });
  }, [uid]);

  const today  = new Date();
  const days   = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    return d.toISOString().split('T')[0];
  });

  let streak = 0;
  for (const date of days) {
    if (loggedDates.has(date)) streak++;
    else break;
  }

  const todayStr = today.toISOString().split('T')[0];

  return (
    <div className="px-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: COLORS.textMuted }}>28-day streak</span>
        {streak > 0 && (
          <span className="text-xs font-semibold" style={{ color: COLORS.green }}>
            {streak > 1 ? `🔥 ${streak} days` : '1 day — keep going!'}
          </span>
        )}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {[...days].reverse().map(date => {
          const logged  = loggedDates.has(date);
          const isToday = date === todayStr;
          return (
            <div
              key={date}
              className="w-full aspect-square rounded-sm"
              style={{
                background:    logged ? COLORS.green : '#1e293b',
                opacity:       isToday ? 1 : 0.65,
                boxShadow:     isToday ? `0 0 0 1.5px ${COLORS.green}` : 'none',
              }}
              title={`${date}${logged ? ' ✓' : ''}`}
            />
          );
        })}
      </div>
    </div>
  );
}
