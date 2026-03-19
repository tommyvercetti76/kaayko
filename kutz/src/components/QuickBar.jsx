import { useState, useEffect } from 'react';
import { onFrequentFoodsSnapshot } from '../lib/firestore';
import { COLORS, MEAL_COLORS } from '../lib/constants';

const MEAL_ORDER = ['breakfast', 'lunch', 'snacks', 'dinner'];

// Fix #13 — infer meal from time of day (same logic as FoodSearch)
function inferMeal() {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 18) return 'snacks';
  return 'dinner';
}

export default function QuickBar({ uid, onAdd, disabled }) {
  const [foods,      setFoods]      = useState([]);
  const [targetMeal, setTargetMeal] = useState(inferMeal);

  useEffect(() => {
    if (!uid) return;
    return onFrequentFoodsSnapshot(uid, setFoods);
  }, [uid]);

  // Fix #23 — show helpful empty state for new users
  if (foods.length === 0) return (
    <div className="px-4">
      <p className="text-xs" style={{ color: COLORS.textMuted }}>
        Your most-logged foods will appear here for one-tap adding.
      </p>
    </div>
  );

  function cycleMeal() {
    setTargetMeal(m => MEAL_ORDER[(MEAL_ORDER.indexOf(m) + 1) % MEAL_ORDER.length]);
  }

  return (
    <div className="px-4 space-y-2">
      {/* Meal target chip — tap to cycle, same pattern as FoodSearch */}
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: COLORS.textMuted }}>Quick add</p>
        <button
          onClick={cycleMeal}
          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
          style={{
            background: MEAL_COLORS[targetMeal] + '22',
            border:     `1px solid ${MEAL_COLORS[targetMeal]}44`,
            color:      MEAL_COLORS[targetMeal],
          }}
        >
          → {targetMeal} ↻
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {foods.map(f => (
          <button
            key={f.id}
            onClick={() => onAdd({ ...f, quantity: f.defaultQuantity || '1 serving', meal: targetMeal, source: 'quick', auto: false })}
            disabled={disabled}
            className="flex-shrink-0 px-3 py-2 rounded-xl text-left active:scale-95 transition-transform"
            style={{ background: '#0a0f1a', border: '1px solid #1e293b', opacity: disabled ? 0.5 : 1 }}
          >
            <p className="text-xs font-medium truncate max-w-24" style={{ color: COLORS.textPrimary }}>{f.name}</p>
            <p className="text-xs tabular mt-0.5" style={{ color: COLORS.amber }}>{f.calories} kcal</p>
          </button>
        ))}
      </div>
    </div>
  );
}
