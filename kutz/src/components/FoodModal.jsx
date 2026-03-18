import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { MEALS, MEAL_COLORS, COLORS } from '../lib/constants';

/**
 * Add or Edit food modal — includes carbs + fat fields.
 * Add mode  (no `food` prop):  calls onAdd(foodData) then closes.
 * Edit mode (`food` prop set): calls onUpdate(foodId, foodData) then closes.
 */
export default function FoodModal({ defaultMeal = 'snacks', food = null, onAdd, onUpdate, onClose }) {
  const isEdit = Boolean(food);

  const [form, setForm] = useState({
    name:     food?.name     ?? '',
    quantity: food?.quantity ?? '1 serving',
    calories: food?.calories != null ? String(food.calories) : '',
    protein:  food?.protein  != null ? String(food.protein)  : '',
    carbs:    food?.carbs    != null ? String(food.carbs)    : '',
    fat:      food?.fat      != null ? String(food.fat)      : '',
    fiber:    food?.fiber    != null ? String(food.fiber)    : '',
    meal:     food?.meal     ?? defaultMeal,
  });
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.calories) return;
    setSaving(true);
    try {
      const payload = {
        name:     form.name.trim(),
        quantity: form.quantity || '1 serving',
        calories: Math.round(Number(form.calories) || 0),
        protein:  Math.round(Number(form.protein)  || 0),
        carbs:    Math.round(Number(form.carbs)     || 0),
        fat:      Math.round(Number(form.fat)       || 0),
        fiber:    Math.round(Number(form.fiber)     || 0),
        meal:     form.meal,
      };
      if (isEdit) {
        await onUpdate(food.id, payload);
      } else {
        await onAdd({ ...payload, source: 'manual', auto: false });
      }
      onClose();
    } catch {
      setSaving(false);
    }
  }

  const canSubmit = form.name.trim() && form.calories && !saving;

  const macroFields = [
    { key: 'calories', label: 'Calories *', color: COLORS.amber,  placeholder: '300' },
    { key: 'protein',  label: 'Protein g',  color: COLORS.green,  placeholder: '20'  },
    { key: 'carbs',    label: 'Carbs g',    color: COLORS.blue,   placeholder: '40'  },
    { key: 'fat',      label: 'Fat g',      color: COLORS.orange, placeholder: '10'  },
    { key: 'fiber',    label: 'Fiber g',    color: COLORS.purple, placeholder: '3'   },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div
        className="w-full max-w-md rounded-t-2xl p-6 space-y-4"
        style={{ background: '#0a0f1a', border: '1px solid #1e293b', borderBottom: 'none' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base" style={{ color: COLORS.textPrimary }}>
            {isEdit ? 'Edit Food' : 'Add Food'}
          </h2>
          <button onClick={onClose} disabled={saving}>
            <X size={18} style={{ color: COLORS.textMuted }} />
          </button>
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
            placeholder="Quantity (e.g. 1 bowl, 2 rotis)"
            value={form.quantity}
            onChange={e => set('quantity', e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: '#020617', border: '1px solid #1e293b', color: '#e2e8f0' }}
          />

          {/* Macro inputs — 3 + 2 layout */}
          <div className="flex gap-2">
            {macroFields.slice(0, 3).map(({ key, label, color, placeholder }) => (
              <div key={key} className="flex-1">
                <label className="text-xs block mb-1" style={{ color }}>{label}</label>
                <input
                  type="number" inputMode="numeric" placeholder={placeholder}
                  value={form[key]} onChange={e => set(key, e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none tabular"
                  style={{ background: '#020617', border: '1px solid #1e293b', color }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            {macroFields.slice(3).map(({ key, label, color, placeholder }) => (
              <div key={key} className="flex-1">
                <label className="text-xs block mb-1" style={{ color }}>{label}</label>
                <input
                  type="number" inputMode="numeric" placeholder={placeholder}
                  value={form[key]} onChange={e => set(key, e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none tabular"
                  style={{ background: '#020617', border: '1px solid #1e293b', color }}
                />
              </div>
            ))}
          </div>

          {/* Meal picker */}
          <div className="flex gap-2 flex-wrap">
            {MEALS.map(m => (
              <button
                key={m} type="button" onClick={() => set('meal', m)}
                className="px-3 py-1.5 rounded-full text-xs font-medium"
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
            type="submit" disabled={!canSubmit}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            style={{ background: '#34d399', color: '#020617', opacity: canSubmit ? 1 : 0.4 }}
          >
            {saving
              ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
              : isEdit ? 'Save Changes' : 'Add'
            }
          </button>
        </form>
      </div>
    </div>
  );
}
