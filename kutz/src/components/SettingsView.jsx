import { useState, useEffect } from 'react';
import { TARGETS, COLORS } from '../lib/constants';
import { calcBMR } from '../lib/calculations';
import { getProfile, saveProfile } from '../lib/firestore';

export default function SettingsView({ uid, onLogout }) {
  const [form, setForm] = useState({ weight: '', height: '', age: '' });
  const [saved, setSaved] = useState(false);
  const [bmr, setBmr] = useState(null);

  useEffect(() => {
    if (!uid) return;
    getProfile(uid).then(p => {
      if (p) {
        setForm({ weight: p.weight || '', height: p.height || '', age: p.age || '' });
        setBmr(p.bmr);
      }
    });
  }, [uid]);

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
    const updated = { ...form, [field]: value };
    const computed = calcBMR(Number(updated.weight), Number(updated.height), Number(updated.age));
    setBmr(computed);
  }

  async function save() {
    await saveProfile(uid, {
      weight: Number(form.weight) || 0,
      height: Number(form.height) || 0,
      age: Number(form.age) || 0,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="px-4 space-y-6 pb-8 pt-4">
      <div className="space-y-3">
        <p className="text-sm font-medium" style={{ color: COLORS.textPrimary }}>Your Profile</p>

        <div className="flex gap-2">
          {[
            { key: 'weight', label: 'Weight (kg)', placeholder: '60' },
            { key: 'height', label: 'Height (cm)', placeholder: '165' },
            { key: 'age', label: 'Age', placeholder: '30' },
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
              {bmr} <span className="text-sm font-normal" style={{ color: COLORS.textSecondary }}>kcal/day</span>
            </p>
          </div>
        )}

        <button
          onClick={save}
          disabled={!form.weight || !form.height || !form.age}
          className="w-full py-3 rounded-xl text-sm font-semibold"
          style={{ background: '#34d399', color: '#020617', opacity: (!form.weight || !form.height || !form.age) ? 0.4 : 1 }}
        >
          {saved ? 'Saved ✓' : 'Save Profile'}
        </button>
      </div>

      {/* Targets display */}
      <div className="rounded-xl px-4 py-4 space-y-2" style={{ background: '#0a0f1a', border: '1px solid #1e293b' }}>
        <p className="text-sm font-medium mb-3" style={{ color: COLORS.textPrimary }}>Daily Targets</p>
        {[
          { label: 'Calories', value: `${TARGETS.calories} kcal`, color: COLORS.amber },
          { label: 'Protein', value: `${TARGETS.protein}g`, color: COLORS.green },
          { label: 'Fiber', value: `${TARGETS.fiber}g`, color: COLORS.blue },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-sm" style={{ color: COLORS.textSecondary }}>{label}</span>
            <span className="tabular font-semibold text-sm" style={{ color }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Sign out */}
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
