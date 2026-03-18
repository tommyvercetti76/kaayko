import { useState, useEffect } from 'react';
import { onFrequentFoodsSnapshot } from '../lib/firestore';
import { COLORS } from '../lib/constants';

/**
 * Top 6 frequent foods — one-tap add to snacks.
 */
export default function QuickBar({ uid, onAdd, disabled }) {
  const [foods, setFoods] = useState([]);

  useEffect(() => {
    if (!uid) return;
    return onFrequentFoodsSnapshot(uid, setFoods);
  }, [uid]);

  if (foods.length === 0) return null;

  return (
    <div className="px-4">
      <p className="text-xs mb-2" style={{ color: COLORS.textMuted }}>Quick add</p>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {foods.map(f => (
          <button
            key={f.id}
            onClick={() => onAdd({ ...f, quantity: f.defaultQuantity || '1 serving', meal: 'snacks', source: 'quick', auto: false })}
            disabled={disabled}
            className="flex-shrink-0 px-3 py-2 rounded-xl text-left transition-opacity active:scale-95"
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
