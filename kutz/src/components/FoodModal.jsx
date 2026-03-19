import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { MEALS, MEAL_COLORS, COLORS } from '../lib/constants';

/**
 * Add or Edit food modal.
 * Fix #9  — backdrop tap closes modal
 * Fix #10 — validation highlights missing fields on submit attempt
 * Fix #11 — macros stored with 1 decimal (not Math.round stripped)
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
    iron:     food?.iron     != null ? String(food.iron)     : '',
    calcium:  food?.calcium  != null ? String(food.calcium)  : '',
    b12:      food?.b12      != null ? String(food.b12)      : '',
    zinc:     food?.zinc     != null ? String(food.zinc)     : '',
    meal:     food?.meal     ?? defaultMeal,
  });
  const [saving,     setSaving]     = useState(false);
  const [showErrors, setShowErrors] = useState(false); // Fix #10

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
    if (showErrors) setShowErrors(false); // clear errors on any change
  }

  const r1 = x => Math.round((Number(x) || 0) * 10) / 10; // 1 decimal precision

  async function submit(e) {
    e.preventDefault();
    // Fix #10 — show which fields are missing instead of silent no-op
    if (!form.name.trim() || !form.calories) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name:     form.name.trim(),
        quantity: form.quantity || '1 serving',
        calories: Math.round(Number(form.calories) || 0), // calories = integer always
        protein:  r1(form.protein),  // Fix #11 — allow decimals
        carbs:    r1(form.carbs),
        fat:      r1(form.fat),
        fiber:    r1(form.fiber),
        iron:     r1(form.iron),
        calcium:  r1(form.calcium),
        b12:      r1(form.b12),
        zinc:     r1(form.zinc),
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

  const macroFields = [
    { key: 'calories', label: 'Calories *', color: COLORS.amber,  placeholder: '300' },
    { key: 'protein',  label: 'Protein g',  color: COLORS.green,  placeholder: '20'  },
    { key: 'carbs',    label: 'Carbs g',    color: COLORS.textSecondary, placeholder: '40' },
    { key: 'fat',      label: 'Fat g',      color: COLORS.textSecondary, placeholder: '10' },
    { key: 'fiber',    label: 'Fiber g',    color: COLORS.textSecondary, placeholder: '3'  },
  ];

  const microFields = [
    { key: 'iron',    label: 'Iron mg',    placeholder: '3.0', step: '0.1' },
    { key: 'calcium', label: 'Calcium mg', placeholder: '180', step: '1'   },
    { key: 'b12',     label: 'B12 mcg',   placeholder: '0.4', step: '0.1' },
    { key: 'zinc',    label: 'Zinc mg',   placeholder: '1.0', step: '0.1' },
  ];

  const missingName     = showErrors && !form.name.trim();
  const missingCalories = showErrors && !form.calories;

  return (
    // Fix #9 — backdrop tap dismisses modal
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl p-6 space-y-4"
        style={{ background: '#0a0f1a', border: '1px solid #1e293b', borderBottom: 'none', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()} // prevent backdrop close from firing inside modal
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base" style={{ color: COLORS.textPrimary }}>
            {isEdit ? 'Edit Food' : 'Add Food'}
          </h2>
          <button onClick={onClose} disabled={saving} className="p-1">
            <X size={18} style={{ color: COLORS.textMuted }} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {/* Name — red border if missing on submit */}
          <div>
            <input
              autoFocus
              placeholder="Food name *"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{
                background: '#020617',
                border: `1px solid ${missingName ? COLORS.red : '#1e293b'}`,
                color: COLORS.textPrimary,
              }}
            />
            {missingName && <p className="text-xs mt-1" style={{ color: COLORS.red }}>Name is required</p>}
          </div>

          <input
            placeholder="Quantity (e.g. 1 bowl, 2 rotis, 100g)"
            value={form.quantity}
            onChange={e => set('quantity', e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: '#020617', border: '1px solid #1e293b', color: COLORS.textPrimary }}
          />

          {/* Macro inputs — 3+2 layout */}
          <div className="flex gap-2">
            {macroFields.slice(0, 3).map(({ key, label, color, placeholder }) => (
              <div key={key} className="flex-1">
                <label className="text-xs block mb-1" style={{ color }}>{label}</label>
                <input
                  type="number" inputMode="decimal" placeholder={placeholder}
                  value={form[key]} onChange={e => set(key, e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none tabular"
                  style={{
                    background: '#020617',
                    border: `1px solid ${key === 'calories' && missingCalories ? COLORS.red : '#1e293b'}`,
                    color: COLORS.textPrimary,
                  }}
                />
                {key === 'calories' && missingCalories && (
                  <p className="text-xs mt-1" style={{ color: COLORS.red }}>Required</p>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            {macroFields.slice(3).map(({ key, label, color, placeholder }) => (
              <div key={key} className="flex-1">
                <label className="text-xs block mb-1" style={{ color }}>{label}</label>
                <input
                  type="number" inputMode="decimal" placeholder={placeholder}
                  value={form[key]} onChange={e => set(key, e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none tabular"
                  style={{ background: '#020617', border: '1px solid #1e293b', color: COLORS.textPrimary }}
                />
              </div>
            ))}
          </div>

          {/* Micronutrients — optional, muted */}
          <p className="text-xs" style={{ color: COLORS.textMuted }}>Micronutrients (optional)</p>
          <div className="grid grid-cols-2 gap-2">
            {microFields.map(({ key, label, placeholder, step }) => (
              <div key={key}>
                <label className="text-xs block mb-1" style={{ color: COLORS.textMuted }}>{label}</label>
                <input
                  type="number" inputMode="decimal" placeholder={placeholder} step={step}
                  value={form[key]} onChange={e => set(key, e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none tabular"
                  style={{ background: '#020617', border: '1px solid #1e293b', color: COLORS.textPrimary }}
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
            type="submit" disabled={saving}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            style={{ background: COLORS.green, color: '#020617', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : isEdit ? 'Save Changes' : 'Add Food'}
          </button>
        </form>
      </div>
    </div>
  );
}
