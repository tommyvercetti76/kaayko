import { useState, useEffect } from 'react';
import { RotateCcw, CopyCheck } from 'lucide-react';
import { onFoodsSnapshot, copyMeal, copyDay } from '../lib/firestore';
import { MEALS, MEAL_COLORS, COLORS } from '../lib/constants';

export default function RepeatMeal({ uid, todayKey, yesterdayKey, sourceLabel = 'yesterday' }) {
  const [yesterdayFoods, setYesterdayFoods] = useState([]);
  const [copying, setCopying] = useState(null);
  const [copied,  setCopied]  = useState({});

  useEffect(() => {
    if (!uid || !yesterdayKey) return;
    return onFoodsSnapshot(uid, yesterdayKey, setYesterdayFoods);
  }, [uid, yesterdayKey]);

  // Fix #12 — reset copied badges when source date changes
  useEffect(() => { setCopied({}); }, [yesterdayKey]);

  const nonAutoFoods  = yesterdayFoods.filter(f => !f.auto);
  const mealsWithFood = MEALS.filter(m => nonAutoFoods.some(f => f.meal === m));

  if (mealsWithFood.length === 0) return null;

  async function handleCopyMeal(meal) {
    setCopying(meal);
    try {
      await copyMeal(uid, yesterdayKey, todayKey, meal);
      setCopied(prev => ({ ...prev, [meal]: true }));
    } finally {
      setCopying(null);
    }
  }

  async function handleCopyAll() {
    setCopying('all');
    try {
      await copyDay(uid, yesterdayKey, todayKey);
      const allCopied = {};
      mealsWithFood.forEach(m => { allCopied[m] = true; });
      allCopied['all'] = true;
      setCopied(allCopied);
    } finally {
      setCopying(null);
    }
  }

  const allDone = mealsWithFood.every(m => copied[m]);

  return (
    <div>
      {/* Fix #12 — dynamic label based on what date is being viewed */}
      <p className="text-xs mb-2" style={{ color: COLORS.textMuted }}>Repeat from {sourceLabel}</p>
      <div className="flex gap-2 flex-wrap items-center">
        {mealsWithFood.map(meal => {
          const count = nonAutoFoods.filter(f => f.meal === meal).length;
          const color = MEAL_COLORS[meal];
          const done  = copied[meal];
          return (
            <button
              key={meal}
              onClick={() => handleCopyMeal(meal)}
              disabled={copying === meal || done}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
              style={{
                background: color + '22',
                border:     `1px solid ${color}55`,
                color:      done ? COLORS.textMuted : color,
                opacity:    copying === meal ? 0.6 : 1,
              }}
            >
              <RotateCcw size={11} />
              {done ? '✓' : `${meal} (${count})`}
            </button>
          );
        })}

        {mealsWithFood.length > 1 && !allDone && (
          <button
            onClick={handleCopyAll}
            disabled={!!copying || copied['all']}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
            style={{
              background: '#0a0f1a',
              border:     `1px solid ${COLORS.green}55`,
              color:      COLORS.green,
              opacity:    copying === 'all' ? 0.6 : 1,
            }}
          >
            <CopyCheck size={11} />
            Copy all day
          </button>
        )}
      </div>
    </div>
  );
}
