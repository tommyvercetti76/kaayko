import { useState, useEffect } from 'react';
import { Trash2, Plus, Loader2, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { COLORS, ACTIVITY_LEVELS, DEFAULT_AUTO_ENTRIES, MEALS, DIET_TYPES } from '../lib/constants';
import { calcBMR, calcTDEE } from '../lib/calculations';
import { useProfile } from '../context/ProfileContext';
import {
  logWeight, getWeightHistory,
  onProductsSnapshot, saveProduct, deleteProduct,
  getRecentDays,
} from '../lib/firestore';
import { auth } from '../lib/firebase';

// ─── Collapsible section wrapper ─────────────────────────────────────────────
function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e293b' }}>
      <button
        className="w-full flex items-center justify-between px-4 py-3"
        style={{ background: '#0a0f1a' }}
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-sm font-medium" style={{ color: COLORS.textPrimary }}>{title}</span>
        {open ? <ChevronDown size={14} style={{ color: COLORS.textMuted }} /> : <ChevronRight size={14} style={{ color: COLORS.textMuted }} />}
      </button>
      {open && <div className="px-4 py-4 space-y-3" style={{ background: '#020617' }}>{children}</div>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SettingsView({ onLogout }) {
  const { profile, updateProfile } = useProfile();
  const uid = auth.currentUser?.uid;

  // Profile form
  const [form, setForm] = useState({ weight: '', height: '', age: '', gender: 'female', activity: 1.375 });
  const [dietType, setDietType] = useState('lacto-ovo-vegetarian');
  const [targetForm,  setTargetForm]  = useState({ calories: 1650, protein: 110, carbs: 200, fat: 55, fiber: 25 });
  const [waterTarget, setWaterTarget] = useState(2500);
  const [bmr, setBmr] = useState(null);
  const [saved, setSaved] = useState(false);

  // Weight log
  const [weightInput, setWeightInput] = useState('');
  const [weightHistory, setWeightHistory] = useState([]);
  const [weightSaving, setWeightSaving] = useState(false);

  // Auto-entries
  const [autoEntries, setAutoEntries] = useState(DEFAULT_AUTO_ENTRIES);
  const [newEntry, setNewEntry] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '', fiber: '', quantity: '1 serving', meal: 'snacks' });

  // Products
  const [products, setProducts] = useState([]);
  const [newProduct, setNewProduct] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '', fiber: '', per: '100g' });
  const [productSaving, setProductSaving] = useState(false);

  // Export
  const [exporting, setExporting] = useState(false);

  // Load profile
  useEffect(() => {
    if (!profile) return;
    setForm({
      weight:   profile.weight   || '',
      height:   profile.height   || '',
      age:      profile.age      || '',
      gender:   profile.gender   || 'female',
      activity: profile.activity || 1.375,
    });
    setBmr(profile.bmr || null);
    setTargetForm({
      calories: profile.targets?.calories ?? 1650,
      protein:  profile.targets?.protein  ?? 110,
      carbs:    profile.targets?.carbs    ?? 200,
      fat:      profile.targets?.fat      ?? 55,
      fiber:    profile.targets?.fiber    ?? 25,
    });
    setAutoEntries(profile.autoEntries ?? DEFAULT_AUTO_ENTRIES);
    setDietType(profile.dietType ?? 'lacto-ovo-vegetarian');
    setWaterTarget(profile.waterTarget ?? 2500);
  }, [profile]);

  // Load weight history
  useEffect(() => {
    if (!uid) return;
    getWeightHistory(uid, 10).then(setWeightHistory);
  }, [uid]);

  // Real-time products
  useEffect(() => {
    if (!uid) return;
    return onProductsSnapshot(uid, setProducts);
  }, [uid]);

  function recalcBMR(f) {
    const updated = { ...form, ...f };
    setForm(updated);
    const b = calcBMR(Number(updated.weight), Number(updated.height), Number(updated.age), updated.gender);
    setBmr(b);
  }

  async function save() {
    await updateProfile({
      weight:   Number(form.weight) || 0,
      height:   Number(form.height) || 0,
      age:      Number(form.age)    || 0,
      gender:   form.gender,
      activity: Number(form.activity),
      targets: {
        calories: Number(targetForm.calories) || 1650,
        protein:  Number(targetForm.protein)  || 110,
        carbs:    Number(targetForm.carbs)    || 200,
        fat:      Number(targetForm.fat)      || 55,
        fiber:    Number(targetForm.fiber)    || 25,
      },
      autoEntries,
      dietType,
      waterTarget: Number(waterTarget) || 2500,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleLogWeight() {
    if (!weightInput || !uid) return;
    setWeightSaving(true);
    try {
      await logWeight(uid, Number(weightInput));
      const hist = await getWeightHistory(uid, 10);
      setWeightHistory(hist);
      setWeightInput('');
    } finally {
      setWeightSaving(false);
    }
  }

  function addAutoEntry() {
    if (!newEntry.name || !newEntry.calories) return;
    setAutoEntries(prev => [
      ...prev,
      {
        name:     newEntry.name,
        calories: Number(newEntry.calories) || 0,
        protein:  Number(newEntry.protein)  || 0,
        carbs:    Number(newEntry.carbs)    || 0,
        fat:      Number(newEntry.fat)      || 0,
        fiber:    Number(newEntry.fiber)    || 0,
        quantity: newEntry.quantity || '1 serving',
        meal:     newEntry.meal,
      },
    ]);
    setNewEntry({ name: '', calories: '', protein: '', carbs: '', fat: '', fiber: '', quantity: '1 serving', meal: 'snacks' });
  }

  async function handleSaveProduct() {
    if (!newProduct.name || !newProduct.calories || !uid) return;
    setProductSaving(true);
    try {
      await saveProduct(uid, {
        name:     newProduct.name,
        calories: Number(newProduct.calories) || 0,
        protein:  Number(newProduct.protein)  || 0,
        carbs:    Number(newProduct.carbs)    || 0,
        fat:      Number(newProduct.fat)      || 0,
        fiber:    Number(newProduct.fiber)    || 0,
        per:      newProduct.per || '100g',
      });
      setNewProduct({ name: '', calories: '', protein: '', carbs: '', fat: '', fiber: '', per: '100g' });
    } finally {
      setProductSaving(false);
    }
  }

  async function exportCSV() {
    if (!uid) return;
    setExporting(true);
    try {
      const days = await getRecentDays(uid, 30);
      const headers = ['Date', 'Calories', 'Protein_g', 'Carbs_g', 'Fat_g', 'Fiber_g', 'Steps', 'Locked'];
      const rows    = [...days].reverse().map(d => [
        d.date,
        Math.round(d.calories || 0),
        Math.round(d.protein  || 0),
        Math.round(d.carbs    || 0),
        Math.round(d.fat      || 0),
        Math.round(d.fiber    || 0),
        d.steps || 0,
        d.locked ? 'yes' : 'no',
      ]);
      const csv  = [headers, ...rows].map(r => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `kalekutz-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const canSave = form.weight && form.height && form.age;
  const tdee    = bmr ? calcTDEE(bmr, Number(form.activity)) : null;

  return (
    <div className="px-4 space-y-4 pb-10 pt-4">

      {/* ── Profile ── */}
      <Section title="Your Profile">
        <div className="flex gap-2">
          {[
            { key: 'weight', label: 'Weight (kg)', placeholder: '60'  },
            { key: 'height', label: 'Height (cm)', placeholder: '165' },
            { key: 'age',    label: 'Age',         placeholder: '30'  },
          ].map(({ key, label, placeholder }) => (
            <div key={key} className="flex-1">
              <label className="text-xs block mb-1" style={{ color: COLORS.textMuted }}>{label}</label>
              <input
                type="number" value={form[key]} placeholder={placeholder}
                onChange={e => recalcBMR({ [key]: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl text-sm tabular outline-none"
                style={{ background: '#0a0f1a', border: '1px solid #1e293b', color: COLORS.textPrimary }}
              />
            </div>
          ))}
        </div>

        {/* Gender */}
        <div className="flex gap-2">
          {['female', 'male'].map(g => (
            <button
              key={g} type="button"
              onClick={() => recalcBMR({ gender: g })}
              className="flex-1 py-2 rounded-xl text-sm font-medium"
              style={{
                background: form.gender === g ? (g === 'female' ? COLORS.pink : COLORS.blue) + '22' : '#0a0f1a',
                border: `1px solid ${form.gender === g ? (g === 'female' ? COLORS.pink : COLORS.blue) : '#1e293b'}`,
                color: form.gender === g ? (g === 'female' ? COLORS.pink : COLORS.blue) : COLORS.textSecondary,
              }}
            >
              {g === 'female' ? 'Female ♀' : 'Male ♂'}
            </button>
          ))}
        </div>

        {bmr && (
          <div className="rounded-xl px-4 py-3" style={{ background: '#0a0f1a', border: '1px solid #1e293b' }}>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs" style={{ color: COLORS.textMuted }}>BMR (Mifflin-St Jeor)</p>
                <p className="tabular text-xl font-bold mt-0.5" style={{ color: COLORS.textPrimary }}>
                  {bmr} <span className="text-sm font-normal" style={{ color: COLORS.textSecondary }}>kcal/day</span>
                </p>
              </div>
              {tdee && (
                <div className="text-right">
                  <p className="text-xs" style={{ color: COLORS.textMuted }}>TDEE</p>
                  <p className="tabular text-xl font-bold mt-0.5" style={{ color: COLORS.green }}>
                    {tdee} <span className="text-sm font-normal" style={{ color: COLORS.textSecondary }}>kcal/day</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Activity level */}
        <div>
          <p className="text-xs mb-2" style={{ color: COLORS.textMuted }}>Activity level</p>
          <div className="space-y-1.5">
            {ACTIVITY_LEVELS.map(({ value, label, desc }) => (
              <button
                key={value} type="button"
                onClick={() => setForm(f => ({ ...f, activity: value }))}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm"
                style={{
                  background: Number(form.activity) === value ? COLORS.green + '15' : '#0a0f1a',
                  border: `1px solid ${Number(form.activity) === value ? COLORS.green + '66' : '#1e293b'}`,
                  color: Number(form.activity) === value ? COLORS.green : COLORS.textSecondary,
                }}
              >
                <span className="font-medium">{label}</span>
                <span className="text-xs" style={{ color: COLORS.textMuted }}>{desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Diet Pattern */}
        <div>
          <p className="text-xs mb-2" style={{ color: COLORS.textMuted }}>Diet pattern — tells the AI what foods to include</p>
          <div className="grid grid-cols-2 gap-2">
            {DIET_TYPES.map(({ value, label, desc, emoji }) => {
              const active = dietType === value;
              return (
                <button
                  key={value} type="button"
                  onClick={() => setDietType(value)}
                  className="flex flex-col items-start px-3 py-2.5 rounded-xl text-left"
                  style={{
                    background: active ? COLORS.green + '15' : '#0a0f1a',
                    border: `1px solid ${active ? COLORS.green + '66' : '#1e293b'}`,
                  }}
                >
                  <span className="text-base mb-0.5">{emoji}</span>
                  <span className="text-xs font-medium leading-tight" style={{ color: active ? COLORS.green : COLORS.textPrimary }}>{label}</span>
                  <span className="text-xs leading-tight mt-0.5" style={{ color: COLORS.textMuted }}>{desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      {/* ── Daily Targets ── */}
      <Section title="Daily Targets">
        {[
          { key: 'calories', label: 'Calories (kcal)', color: COLORS.amber  },
          { key: 'protein',  label: 'Protein (g)',     color: COLORS.green  },
          { key: 'carbs',    label: 'Carbs (g)',       color: COLORS.blue   },
          { key: 'fat',      label: 'Fat (g)',         color: COLORS.orange },
          { key: 'fiber',    label: 'Fiber (g)',       color: COLORS.purple },
        ].map(({ key, label, color }) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <span className="text-sm flex-1" style={{ color: COLORS.textSecondary }}>{label}</span>
            <input
              type="number" inputMode="numeric"
              value={targetForm[key]}
              onChange={e => setTargetForm(prev => ({ ...prev, [key]: e.target.value }))}
              className="w-20 px-3 py-1.5 rounded-lg text-sm tabular text-right outline-none"
              style={{ background: '#0a0f1a', border: `1px solid ${color}44`, color }}
            />
          </div>
        ))}
        {/* Water target */}
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm flex-1" style={{ color: COLORS.textSecondary }}>💧 Water (ml/day)</span>
          <input
            type="number" inputMode="numeric"
            value={waterTarget}
            onChange={e => setWaterTarget(e.target.value)}
            placeholder="2500"
            className="w-20 px-3 py-1.5 rounded-lg text-sm tabular text-right outline-none"
            style={{ background: '#0a0f1a', border: '1px solid #38bdf844', color: '#38bdf8' }}
          />
        </div>
        <p className="text-xs" style={{ color: COLORS.textMuted }}>Targets update live after saving.</p>
      </Section>

      {/* ── Weight Log ── */}
      <Section title="Weight Log" defaultOpen={false}>
        <div className="flex gap-2">
          <input
            type="number" inputMode="decimal" placeholder="Today's weight (kg)"
            value={weightInput} onChange={e => setWeightInput(e.target.value)}
            className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none tabular"
            style={{ background: '#0a0f1a', border: '1px solid #1e293b', color: COLORS.textPrimary }}
          />
          <button
            onClick={handleLogWeight}
            disabled={!weightInput || weightSaving}
            className="px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2"
            style={{ background: COLORS.green + '22', border: `1px solid ${COLORS.green}44`, color: COLORS.green, opacity: weightInput ? 1 : 0.4 }}
          >
            {weightSaving ? <Loader2 size={14} className="animate-spin" /> : 'Log'}
          </button>
        </div>
        {weightHistory.length > 0 && (
          <div className="space-y-1">
            {[...weightHistory].reverse().slice(0, 7).map(w => (
              <div key={w.date} className="flex justify-between text-xs tabular px-1">
                <span style={{ color: COLORS.textMuted }}>{w.date}</span>
                <span style={{ color: COLORS.textPrimary }}>{w.weight} kg</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Auto-Entries ── */}
      <Section title="Daily Auto-Entries" defaultOpen={false}>
        <p className="text-xs" style={{ color: COLORS.textMuted }}>Added automatically to every new day.</p>
        <div className="space-y-2">
          {autoEntries.map((e, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: '#0a0f1a', border: '1px solid #1e293b' }}>
              <div>
                <p className="text-sm" style={{ color: COLORS.textPrimary }}>{e.name}</p>
                <p className="text-xs tabular" style={{ color: COLORS.textSecondary }}>
                  {e.quantity} · {e.calories}kcal · {e.protein}P · {e.meal}
                </p>
              </div>
              <button onClick={() => setAutoEntries(prev => prev.filter((_, j) => j !== i))}>
                <Trash2 size={14} style={{ color: COLORS.red }} />
              </button>
            </div>
          ))}
        </div>
        {/* Add new */}
        <div className="space-y-2 pt-1">
          <input
            placeholder="Name *" value={newEntry.name}
            onChange={e => setNewEntry(p => ({ ...p, name: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: '#0a0f1a', border: '1px solid #1e293b', color: COLORS.textPrimary }}
          />
          <div className="flex gap-2">
            {['calories','protein','fat'].map(k => (
              <input
                key={k} type="number" placeholder={k.slice(0,3)} value={newEntry[k]}
                onChange={e => setNewEntry(p => ({ ...p, [k]: e.target.value }))}
                className="flex-1 px-3 py-2 rounded-xl text-sm outline-none tabular"
                style={{ background: '#0a0f1a', border: '1px solid #1e293b', color: COLORS.textPrimary }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <input
              placeholder="Quantity" value={newEntry.quantity}
              onChange={e => setNewEntry(p => ({ ...p, quantity: e.target.value }))}
              className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: '#0a0f1a', border: '1px solid #1e293b', color: COLORS.textPrimary }}
            />
            <select
              value={newEntry.meal}
              onChange={e => setNewEntry(p => ({ ...p, meal: e.target.value }))}
              className="px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: '#0a0f1a', border: '1px solid #1e293b', color: COLORS.textPrimary }}
            >
              {MEALS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <button
            onClick={addAutoEntry}
            disabled={!newEntry.name || !newEntry.calories}
            className="w-full py-2 rounded-xl text-sm flex items-center justify-center gap-2"
            style={{ background: '#0a0f1a', border: '1px solid #1e293b', color: COLORS.green, opacity: newEntry.name && newEntry.calories ? 1 : 0.4 }}
          >
            <Plus size={14} /> Add entry
          </button>
        </div>
        <p className="text-xs" style={{ color: COLORS.textMuted }}>Tap Save below to apply changes.</p>
      </Section>

      {/* ── My Products ── */}
      <Section title="My Products (Barcode Overrides)" defaultOpen={false}>
        <p className="text-xs" style={{ color: COLORS.textMuted }}>Label-accurate values injected into AI parsing. Used for branded items like Epigamia, Yoga Bar, etc.</p>
        <div className="space-y-2">
          {products.map(p => (
            <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: '#0a0f1a', border: '1px solid #1e293b' }}>
              <div>
                <p className="text-sm" style={{ color: COLORS.textPrimary }}>{p.name}</p>
                <p className="text-xs tabular" style={{ color: COLORS.textSecondary }}>
                  {p.calories}kcal · {p.protein}P · {p.carbs}C · {p.fat}F per {p.per}
                </p>
              </div>
              <button onClick={() => deleteProduct(uid, p.id)}>
                <Trash2 size={14} style={{ color: COLORS.red }} />
              </button>
            </div>
          ))}
        </div>
        {/* Add new product */}
        <div className="space-y-2 pt-1">
          <input
            placeholder="Product name *" value={newProduct.name}
            onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: '#0a0f1a', border: '1px solid #1e293b', color: COLORS.textPrimary }}
          />
          <div className="flex gap-2">
            {['calories','protein','carbs','fat','fiber'].map(k => (
              <input
                key={k} type="number" placeholder={k.slice(0,3)} value={newProduct[k]}
                onChange={e => setNewProduct(p => ({ ...p, [k]: e.target.value }))}
                className="flex-1 px-3 py-2 rounded-xl text-xs outline-none tabular"
                style={{ background: '#0a0f1a', border: '1px solid #1e293b', color: COLORS.textPrimary }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <input
              placeholder="Per (e.g. 100g, 1 cup)" value={newProduct.per}
              onChange={e => setNewProduct(p => ({ ...p, per: e.target.value }))}
              className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: '#0a0f1a', border: '1px solid #1e293b', color: COLORS.textPrimary }}
            />
            <button
              onClick={handleSaveProduct}
              disabled={!newProduct.name || !newProduct.calories || productSaving}
              className="px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1"
              style={{ background: COLORS.purple + '22', border: `1px solid ${COLORS.purple}44`, color: COLORS.purple, opacity: newProduct.name && newProduct.calories ? 1 : 0.4 }}
            >
              {productSaving ? <Loader2 size={13} className="animate-spin" /> : <><Plus size={13} /> Add</>}
            </button>
          </div>
        </div>
      </Section>

      {/* ── Save ── */}
      <button
        onClick={save} disabled={!canSave}
        className="w-full py-3 rounded-xl text-sm font-semibold"
        style={{ background: '#34d399', color: '#020617', opacity: canSave ? 1 : 0.4 }}
      >
        {saved ? 'Saved ✓' : 'Save Profile & Targets'}
      </button>

      {/* ── Export ── */}
      <button
        onClick={exportCSV} disabled={exporting}
        className="w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
        style={{ background: '#0a0f1a', border: '1px solid #1e293b', color: COLORS.textSecondary }}
      >
        {exporting
          ? <><Loader2 size={14} className="animate-spin" /> Exporting…</>
          : <><Download size={14} /> Export last 30 days (CSV)</>
        }
      </button>

      {/* ── Sign Out ── */}
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
