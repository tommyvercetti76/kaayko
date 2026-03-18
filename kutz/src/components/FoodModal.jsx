import { useState } from 'react';
import { X } from 'lucide-react';
import { MEALS, MEAL_COLORS, COLORS } from '../lib/constants';

/**
 * Manual food entry modal. Pre-filled meal from context.
 */
export default function FoodModal({ defaultMeal = 'snacks', onAdd, onClose }) {
  const [form, setForm] = useState({
    name: '',
    quantity: '1 serving',
    calories: '',
    protein: '',
    fiber: '',
    meal: defaultMeal,
  });

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function submit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.calories) return;
    onAdd({
      name: form.name.trim(),
      quantity: form.quantity || '1 serving',
      calories: Math.round(Number(form.calories) || 0),
      protein: Math.round(Number(form.protein) || 0),
      fiber: Math.round(Number(form.fiber) || 0),
      meal: form.meal,
      source: 'manual',
      auto: false,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div
        className="w-full max-w-md rounded-t-2xl p-6 space-y-4"
        style={{ background: '#0a0f1a', border: '1px solid #1e293b', borderBottom: 'none' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base" style={{ color: COLORS.textPrimary }}>Add Food</h2>
          <button onClick={onClose}><X size={18} style={{ color: COLORS.textMuted }} /></button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            autoFocus
            placeholder="Food name *"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: '#020617', border: '1px solid #1e293b', color: '#e2e8f0' }}
          />
          <input
            placeholder="Quantity (e.g. 1 bowl)"
            value={form.quantity}
            onChange={e => set('quantity', e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: '#020617', border: '1px solid #1e293b', color: '#e2e8f0' }}
          />
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Calories *"
              value={form.calories}
              onChange={e => set('calories', e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none tabular"
              style={{ background: '#020617', border: '1px solid #1e293b', color: COLORS.amber }}
            />
            <input
              type="number"
              placeholder="Protein g"
              value={form.protein}
              onChange={e => set('protein', e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none tabular"
              style={{ background: '#020617', border: '1px solid #1e293b', color: COLORS.green }}
            />
            <input
              type="number"
              placeholder="Fiber g"
              value={form.fiber}
              onChange={e => set('fiber', e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none tabular"
              style={{ background: '#020617', border: '1px solid #1e293b', color: COLORS.blue }}
            />
          </div>

          {/* Meal picker */}
          <div className="flex gap-2 flex-wrap">
            {MEALS.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => set('meal', m)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-opacity"
                style={{
                  background: form.meal === m ? MEAL_COLORS[m] + '33' : '#020617',
                  border: `1px solid ${form.meal === m ? MEAL_COLORS[m] : '#1e293b'}`,
                  color: form.meal === m ? MEAL_COLORS[m] : COLORS.textSecondary,
                }}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={!form.name.trim() || !form.calories}
            className="w-full py-3 rounded-xl font-semibold text-sm"
            style={{ background: '#34d399', color: '#020617', opacity: (!form.name.trim() || !form.calories) ? 0.4 : 1 }}
          >
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
