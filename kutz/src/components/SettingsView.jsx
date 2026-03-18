import { useState, useEffect } from 'react';
import { COLORS } from '../lib/constants';
import { calcBMR } from '../lib/calculations';
import { useProfile } from '../context/ProfileContext';

export default function SettingsView({ onLogout }) {
  const { profile, updateProfile } = useProfile();

  const [form, setForm] = useState({ weight: '', height: '', age: '' });
  const [targetForm, setTargetForm] = useState({ calories: 1650, protein: 110, fiber: 25 });
  const [bmr, setBmr] = useState(null);
  const [saved, setSaved] = useState(false);

  // Populate from profile once loaded
  useEffect(() => {
    if (!profile) return;
    setForm({
      weight: profile.weight || '',
      height: profile.height || '',
      age:    profile.age    || '',
    });
    setBmr(profile.bmr || null);
    setTargetForm({
      calories: profile.targets?.calories ?? 1650,
      protein:  profile.targets?.protein  ?? 110,
      fiber:    profile.targets?.fiber    ?? 25,
    });
  }, [profile]);

  function set(field, value) {
    const updated = { ...form, [field]: value };
    setForm(updated);
    const computed = calcBMR(Number(updated.weight), Number(updated.height), Number(updated.age));
    setBmr(computed);
  }

  async function save() {
    await updateProfile({
      weight: Number(form.weight) || 0,
      height: Number(form.height) || 0,
      age:    Number(form.age)    || 0,
      targets: {
        calories: Number(targetForm.calories) || 1650,
        protein:  Number(targetForm.protein)  || 110,
        fiber:    Number(targetForm.fiber)    || 25,
      },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const canSave = form.weight && form.height && form.age;

  return (
    <div className="px-4 space-y-6 pb-8 pt-4">

      {/* ── Profile ──────────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-sm font-medium" style={{ color: COLORS.textPrimary }}>Your Profile</p>

        <div className="flex gap-2">
          {[
            { key: 'weight', label: 'Weight (kg)', placeholder: '60'  },
            { key: 'height', label: 'Height (cm)', placeholder: '165' },
            { key: 'age',    label: 'Age',         placeholder: '30'  },
          ].map(({ key, label, placeholder }) => (
            <div key={key} className="flex-1">
              <label className="text-xs block mb-1" style={{ color: COLORS.textMuted }}>{label}</label>
              <input
                type="number"
                value={form[key]}
                onChange={e => set(key, e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2.5 rounded-xl text-sm tabular outline-none"
                style={{ background: '#0a0f1a', border: '1px solid #1e293b', color: COLORS.textPrimary }}
              />
            </div>
          ))}
        </div>

        {bmr && (
          <div className="rounded-xl px-4 py-3" style={{ background: '#0a0f1a', border: '1px solid #1e293b' }}>
            <p className="text-xs" style={{ color: COLORS.textMuted }}>BMR (Mifflin-St Jeor, female)</p>
            <p className="tabular text-xl font-bold mt-1" style={{ color: COLORS.textPrimary }}>
              {bmr}{' '}
              <span className="text-sm font-normal" style={{ color: COLORS.textSecondary }}>kcal/day</span>
            </p>
          </div>
        )}
      </div>

      {/* ── Daily Targets — editable ─────────────────────────── */}
      <div className="space-y-3">
        <p className="text-sm font-medium" style={{ color: COLORS.textPrimary }}>Daily Targets</p>
        <div className="rounded-xl px-4 py-4 space-y-3" style={{ background: '#0a0f1a', border: '1px solid #1e293b' }}>
          {[
            { key: 'calories', label: 'Calories (kcal)', color: COLORS.amber, placeholder: '1650' },
            { key: 'protein',  label: 'Protein (g)',     color: COLORS.green, placeholder: '110'  },
            { key: 'fiber',    label: 'Fiber (g)',       color: COLORS.blue,  placeholder: '25'   },
          ].map(({ key, label, color, placeholder }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <span className="text-sm flex-1" style={{ color: COLORS.textSecondary }}>{label}</span>
              <input
                type="number"
                inputMode="numeric"
                value={targetForm[key]}
                onChange={e => setTargetForm(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-20 px-3 py-1.5 rounded-lg text-sm tabular text-right outline-none"
                style={{ background: '#020617', border: `1px solid ${color}44`, color }}
              />
            </div>
          ))}
        </div>
        <p className="text-xs" style={{ color: COLORS.textMuted }}>
          Targets update live on the Today ring after saving.
        </p>
      </div>

      {/* ── Save ─────────────────────────────────────────────── */}
      <button
        onClick={save}
        disabled={!canSave}
        className="w-full py-3 rounded-xl text-sm font-semibold"
        style={{ background: '#34d399', color: '#020617', opacity: canSave ? 1 : 0.4 }}
      >
        {saved ? 'Saved ✓' : 'Save Profile & Targets'}
      </button>

      {/* ── Sign out ──────────────────────────────────────────── */}
      <button
        onClick={onLogout}
        className="w-full py-3 rounded-xl text-sm font-medium"
        style={{ background: '#0a0f1a', border: '1px solid #1e293b', color: COLORS.red }}
      >
        Sign Out
      </button>
    </div>
  );
}
