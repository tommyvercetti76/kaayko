import { useState, useEffect, useCallback } from 'react';
import { Flame, Plus, X, Loader2, Wifi, WifiOff, Dumbbell } from 'lucide-react';
import { COLORS } from '../lib/constants';
import { stepBurn, correctedFitbit } from '../lib/calculations';
import { addExercise, deleteExercise, onExercisesSnapshot, estimateBurn } from '../lib/firestore';
import { getFitbitStatus, syncFitbit, connectFitbit } from '../lib/claude';

const EXERCISE_TYPES = [
  { value: 'walk',     label: 'Walk',     icon: '🚶' },
  { value: 'run',      label: 'Run',      icon: '🏃' },
  { value: 'yoga',     label: 'Yoga',     icon: '🧘' },
  { value: 'gym',      label: 'Gym',      icon: '🏋️' },
  { value: 'cycling',  label: 'Cycling',  icon: '🚴' },
  { value: 'swimming', label: 'Swimming', icon: '🏊' },
  { value: 'hiit',     label: 'HIIT',     icon: '⚡' },
  { value: 'dance',    label: 'Dance',    icon: '💃' },
  { value: 'other',    label: 'Other',    icon: '🤸' },
];

export default function EnergySection({ uid, day, onUpdate, dateKey }) {
  const { steps = 0, fitbitCalories = '', bmr = 1450 } = day || {};

  // ── Exercise state ──────────────────────────────────────────────────────────
  const [exercises,   setExercises]   = useState([]);
  const [showForm,    setShowForm]    = useState(false);
  const [exType,      setExType]      = useState('walk');
  const [exDuration,  setExDuration]  = useState('30');
  const [exCalories,  setExCalories]  = useState('');
  const [exNotes,     setExNotes]     = useState('');
  const [exSaving,    setExSaving]    = useState(false);

  // ── Fitbit state ────────────────────────────────────────────────────────────
  const [fitbitConnected, setFitbitConnected] = useState(null); // null=loading
  const [fitbitSyncing,   setFitbitSyncing]   = useState(false);
  const [fitbitError,     setFitbitError]     = useState('');

  // ── Load exercises (real-time) ──────────────────────────────────────────────
  useEffect(() => {
    if (!uid || !dateKey) return;
    const unsub = onExercisesSnapshot(uid, dateKey, setExercises);
    return unsub;
  }, [uid, dateKey]);

  // ── Check Fitbit status ─────────────────────────────────────────────────────
  useEffect(() => {
    getFitbitStatus()
      .then(s => setFitbitConnected(s.connected))
      .catch(() => setFitbitConnected(false));
  }, []);

  // ── Burn calculation ────────────────────────────────────────────────────────
  const exerciseBurn = exercises.reduce((s, e) => s + (e.caloriesBurned || 0), 0);
  const baseBurn     = fitbitCalories
    ? correctedFitbit(Number(fitbitCalories), Number(steps))
    : bmr + stepBurn(Number(steps));
  const totalBurn    = fitbitCalories ? baseBurn + exerciseBurn
                                      : baseBurn; // stepBurn already in base when no fitbit

  // Auto-estimate calories when type/duration change
  useEffect(() => {
    if (!exCalories) return; // user typed override
    const est = estimateBurn(exType, Number(exDuration) || 0);
    setExCalories('');       // let placeholder show estimate
  }, [exType, exDuration]);

  // ── Save exercise ───────────────────────────────────────────────────────────
  async function saveExercise() {
    const dur = Number(exDuration) || 0;
    if (!dur) return;
    setExSaving(true);
    try {
      await addExercise(uid, dateKey, {
        type:          exType,
        durationMin:   dur,
        caloriesBurned: exCalories ? Number(exCalories) : estimateBurn(exType, dur),
        notes:         exNotes.trim(),
      });
      setShowForm(false);
      setExDuration('30');
      setExCalories('');
      setExNotes('');
    } finally {
      setExSaving(false);
    }
  }

  // ── Fitbit sync ─────────────────────────────────────────────────────────────
  async function handleSync() {
    setFitbitSyncing(true);
    setFitbitError('');
    try {
      const data = await syncFitbit();
      // onUpdate will re-render via Firestore snapshot; just show success briefly
      await onUpdate({ steps: data.steps, fitbitCalories: data.fitbitCalories });
    } catch (e) {
      setFitbitError(e.message || 'Sync failed');
    } finally {
      setFitbitSyncing(false);
    }
  }

  async function handleConnect() {
    try { await connectFitbit(); }
    catch (e) { setFitbitError(e.message || 'Could not connect Fitbit'); }
  }

  const estPlaceholder = String(estimateBurn(exType, Number(exDuration) || 30));

  return (
    <div
      className="px-4 py-3 rounded-xl space-y-3"
      style={{ background: '#0a0f1a', border: '1px solid #1e293b' }}
    >
      {/* ── Header row ── */}
      <div className="flex items-center gap-2">
        <Flame size={14} style={{ color: COLORS.amber }} />
        <span className="text-sm font-medium" style={{ color: COLORS.textPrimary }}>
          Energy
        </span>
        <span
          className="ml-auto tabular text-sm font-semibold"
          style={{ color: COLORS.amber }}
        >
          {totalBurn} kcal burned
        </span>
      </div>

      {/* ── Steps + Fitbit calories ── */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs block mb-1" style={{ color: COLORS.textMuted }}>
            Steps
          </label>
          <input
            type="number"
            value={steps || ''}
            onChange={e => onUpdate({ steps: Number(e.target.value) || 0 })}
            placeholder="0"
            className="w-full px-3 py-2 rounded-lg text-sm tabular outline-none"
            style={{ background: '#020617', border: '1px solid #1e293b', color: COLORS.textPrimary }}
          />
          <p className="text-xs mt-1 tabular" style={{ color: COLORS.textMuted }}>
            +{stepBurn(Number(steps) || 0)} kcal
          </p>
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs" style={{ color: COLORS.textMuted }}>
              Fitbit calories
            </label>
            {/* Fitbit connect / sync button */}
            {fitbitConnected === false && (
              <button
                onClick={handleConnect}
                className="flex items-center gap-1 text-xs active:opacity-60"
                style={{ color: '#a78bfa' }}
              >
                <WifiOff size={10} />
                Connect
              </button>
            )}
            {fitbitConnected === true && (
              <button
                onClick={handleSync}
                disabled={fitbitSyncing}
                className="flex items-center gap-1 text-xs active:opacity-60"
                style={{ color: COLORS.green }}
              >
                {fitbitSyncing
                  ? <Loader2 size={10} className="animate-spin" />
                  : <Wifi size={10} />
                }
                Sync
              </button>
            )}
          </div>
          <input
            type="number"
            value={fitbitCalories || ''}
            onChange={e => onUpdate({ fitbitCalories: e.target.value ? Number(e.target.value) : null })}
            placeholder="e.g. 2100"
            className="w-full px-3 py-2 rounded-lg text-sm tabular outline-none"
            style={{ background: '#020617', border: '1px solid #1e293b', color: COLORS.textPrimary }}
          />
          {fitbitCalories && (
            <p className="text-xs mt-1 tabular" style={{ color: COLORS.textMuted }}>
              ×{steps > 18000 ? '0.85' : steps > 12000 ? '0.90' : '0.95'} correction
            </p>
          )}
          {fitbitError && (
            <p className="text-xs mt-1" style={{ color: COLORS.red }}>{fitbitError}</p>
          )}
        </div>
      </div>

      {/* ── Exercise log ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Dumbbell size={12} style={{ color: COLORS.textMuted }} />
            <span className="text-xs font-medium" style={{ color: COLORS.textSecondary }}>
              Exercise
              {exerciseBurn > 0 && (
                <span className="ml-1.5 tabular" style={{ color: COLORS.amber }}>
                  +{exerciseBurn} kcal
                </span>
              )}
            </span>
          </div>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg active:opacity-60"
            style={{ background: '#1e293b', color: COLORS.textSecondary }}
          >
            <Plus size={10} />
            Add
          </button>
        </div>

        {/* Logged exercises */}
        {exercises.length > 0 && (
          <div className="space-y-1.5 mb-2">
            {exercises.map(ex => {
              const info = EXERCISE_TYPES.find(t => t.value === ex.type);
              return (
                <div
                  key={ex.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: '#020617', border: '1px solid #1e293b' }}
                >
                  <span className="text-sm">{info?.icon || '🤸'}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium" style={{ color: COLORS.textPrimary }}>
                      {info?.label || ex.type}
                    </span>
                    <span className="text-xs ml-2 tabular" style={{ color: COLORS.textSecondary }}>
                      {ex.durationMin} min
                    </span>
                    {ex.notes && (
                      <span className="text-xs ml-2" style={{ color: COLORS.textMuted }}>
                        · {ex.notes}
                      </span>
                    )}
                  </div>
                  <span className="text-xs tabular" style={{ color: COLORS.amber }}>
                    -{ex.caloriesBurned} kcal
                  </span>
                  <button
                    onClick={() => deleteExercise(uid, dateKey, ex.id)}
                    className="p-0.5 active:opacity-60"
                  >
                    <X size={12} style={{ color: COLORS.textMuted }} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add exercise form */}
        {showForm && (
          <div
            className="rounded-xl p-3 space-y-2"
            style={{ background: '#020617', border: '1px solid #334155' }}
          >
            {/* Type selector */}
            <div className="flex flex-wrap gap-1.5">
              {EXERCISE_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setExType(t.value)}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg active:opacity-70"
                  style={{
                    background: exType === t.value ? COLORS.green + '22' : '#1e293b',
                    border:     `1px solid ${exType === t.value ? COLORS.green : '#334155'}`,
                    color:      exType === t.value ? COLORS.green : COLORS.textSecondary,
                  }}
                >
                  <span>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Duration + calories row */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs block mb-1" style={{ color: COLORS.textMuted }}>
                  Duration (min)
                </label>
                <input
                  type="number"
                  value={exDuration}
                  onChange={e => setExDuration(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm tabular outline-none"
                  style={{ background: '#0a0f1a', border: '1px solid #1e293b', color: COLORS.textPrimary }}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs block mb-1" style={{ color: COLORS.textMuted }}>
                  Calories burned
                </label>
                <input
                  type="number"
                  value={exCalories}
                  onChange={e => setExCalories(e.target.value)}
                  placeholder={estPlaceholder}
                  className="w-full px-3 py-2 rounded-lg text-sm tabular outline-none"
                  style={{ background: '#0a0f1a', border: '1px solid #1e293b', color: COLORS.textPrimary }}
                />
              </div>
            </div>

            {/* Notes */}
            <input
              type="text"
              value={exNotes}
              onChange={e => setExNotes(e.target.value)}
              placeholder="Notes (optional)"
              maxLength={80}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: '#0a0f1a', border: '1px solid #1e293b', color: COLORS.textPrimary }}
            />

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={saveExercise}
                disabled={exSaving || !exDuration}
                className="flex-1 py-2 rounded-lg text-sm font-medium active:opacity-70"
                style={{ background: COLORS.green, color: '#020617', opacity: exSaving ? 0.5 : 1 }}
              >
                {exSaving ? 'Saving…' : 'Log Exercise'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-sm active:opacity-70"
                style={{ background: '#1e293b', color: COLORS.textSecondary }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {exercises.length === 0 && !showForm && (
          <p className="text-xs" style={{ color: COLORS.textMuted }}>
            No exercise logged today
          </p>
        )}
      </div>
    </div>
  );
}
