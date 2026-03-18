import { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { onFoodsSnapshot, copyMeal } from '../lib/firestore';
import { MEALS, MEAL_COLORS, COLORS } from '../lib/constants';

/**
 * Shows yesterday's meals as one-tap copy buttons.
 * Only appears if yesterday has non-auto entries.
 */
export default function RepeatMeal({ uid, todayKey, yesterdayKey }) {
  const [yesterdayFoods, setYesterdayFoods] = useState([]);
  const [copying, setCopying] = useState(null);
  const [copied, setCopied] = useState({});

  useEffect(() => {
    if (!uid || !yesterdayKey) return;
    return onFoodsSnapshot(uid, yesterdayKey, setYesterdayFoods);
  }, [uid, yesterdayKey]);

  const nonAutoFoods = yesterdayFoods.filter(f => !f.auto);
  const mealsWithFood = MEALS.filter(m => nonAutoFoods.some(f => f.meal === m));

  if (mealsWithFood.length === 0) return null;

  async function handleCopy(meal) {
    setCopying(meal);
    try {
      await copyMeal(uid, yesterdayKey, todayKey, meal);
      setCopied(prev => ({ ...prev, [meal]: true }));
    } finally {
      setCopying(null);
    }
  }

  return (
    <div className="px-4">
      <p className="text-xs mb-2" style={{ color: COLORS.textMuted }}>Repeat from yesterday</p>
      <div className="flex gap-2 flex-wrap">
        {mealsWithFood.map(meal => {
          const count = nonAutoFoods.filter(f => f.meal === meal).length;
          const color = MEAL_COLORS[meal];
          const done = copied[meal];
          return (
            <button
              key={meal}
              onClick={() => handleCopy(meal)}
              disabled={copying === meal || done}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-opacity"
              style={{
                background: color + '22',
                border: `1px solid ${color}55`,
                color: done ? COLORS.textMuted : color,
                opacity: (copying === meal) ? 0.6 : 1,
              }}
            >
              <RotateCcw size={11} />
              {done ? '✓' : `${meal} (${count})`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
