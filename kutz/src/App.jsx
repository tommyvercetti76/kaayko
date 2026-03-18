import { useState, useCallback } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { Utensils, BarChart2, TrendingUp, Settings, Lock, Unlock, ChevronLeft, ChevronRight } from 'lucide-react';

import { auth, googleProvider } from './lib/firebase';
import { useAuth } from './hooks/useAuth';
import { useDay } from './hooks/useDay';
import { useFoods } from './hooks/useFoods';
import { addFood, addFoods, deleteFood, updateDay } from './lib/firestore';
import { computeTotals } from './lib/calculations';
import { MEALS, COLORS } from './lib/constants';

import Cockpit from './components/Cockpit';
import VoiceInput from './components/VoiceInput';
import MealGroup from './components/MealGroup';
import QuickBar from './components/QuickBar';
import RepeatMeal from './components/RepeatMeal';
import EnergySection from './components/EnergySection';
import Streak from './components/Streak';
import FoodModal from './components/FoodModal';
import WeekView from './components/WeekView';
import TrendsView from './components/TrendsView';
import SettingsView from './components/SettingsView';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toDateKey(date) {
  return date.toISOString().split('T')[0];
}

function addDays(dateKey, n) {
  const d = new Date(dateKey + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

// ─── Sign-in screen ───────────────────────────────────────────────────────────

function SignInScreen({ signIn }) {
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    try { await signIn(); } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: COLORS.bg }}>
      <div className="text-center space-y-6 max-w-xs w-full">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: COLORS.textPrimary }}>KaleKutz 🥗</h1>
          <p className="text-sm mt-2" style={{ color: COLORS.textSecondary }}>Voice-first nutrition tracker</p>
        </div>
        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-3"
          style={{ background: '#34d399', color: '#020617', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Signing in…' : 'Sign in with Google'}
        </button>
      </div>
    </div>
  );
}

// ─── Today view ───────────────────────────────────────────────────────────────

function TodayView({ uid, dateKey, prevDateKey, onDateChange }) {
  const { day, loading: dayLoading } = useDay(uid, dateKey);
  const { foods } = useFoods(uid, dateKey);
  const [foodModal, setFoodModal] = useState(null); // meal name or null
  const [energyDebounce, setEnergyDebounce] = useState(null);

  const totals = computeTotals(foods);
  const locked = day?.locked || false;
  const today = toDateKey(new Date());
  const isToday = dateKey === today;

  const handleAddFoods = useCallback(async (items) => {
    await addFoods(uid, dateKey, items);
  }, [uid, dateKey]);

  const handleAddSingle = useCallback(async (food) => {
    await addFood(uid, dateKey, food);
  }, [uid, dateKey]);

  const handleDelete = useCallback(async (foodId) => {
    await deleteFood(uid, dateKey, foodId);
  }, [uid, dateKey]);

  const handleEnergyUpdate = useCallback((data) => {
    if (energyDebounce) clearTimeout(energyDebounce);
    setEnergyDebounce(setTimeout(() => {
      updateDay(uid, dateKey, data);
    }, 800));
  }, [uid, dateKey, energyDebounce]);

  async function toggleLock() {
    await updateDay(uid, dateKey, { locked: !locked });
  }

  if (dayLoading) {
    return <div className="flex justify-center py-20 text-sm" style={{ color: COLORS.textMuted }}>Loading…</div>;
  }

  return (
    <div className="space-y-5 pb-4">
      {/* Date navigation */}
      <div className="flex items-center justify-between px-4 pt-2">
        <button onClick={() => onDateChange(-1)} className="p-2 rounded-lg" style={{ color: COLORS.textMuted }}>
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="text-sm font-medium" style={{ color: COLORS.textPrimary }}>
            {isToday ? 'Today' : dateKey}
          </p>
          {locked && (
            <span className="text-xs" style={{ color: COLORS.red }}>Locked</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleLock}
            className="p-2 rounded-lg"
            style={{ color: locked ? COLORS.red : COLORS.textMuted }}
          >
            {locked ? <Lock size={16} /> : <Unlock size={16} />}
          </button>
          <button
            onClick={() => onDateChange(1)}
            disabled={isToday}
            className="p-2 rounded-lg"
            style={{ color: isToday ? COLORS.textMuted + '44' : COLORS.textMuted }}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <Cockpit totals={totals} day={day} />

      <VoiceInput onAdd={handleAddFoods} disabled={locked} />

      <QuickBar uid={uid} onAdd={handleAddSingle} disabled={locked} />

      <RepeatMeal uid={uid} todayKey={dateKey} yesterdayKey={prevDateKey} />

      {/* Meal groups */}
      <div className="px-4 space-y-3">
        {MEALS.map(meal => (
          <MealGroup
            key={meal}
            meal={meal}
            foods={foods}
            onDelete={handleDelete}
            onAddClick={m => setFoodModal(m)}
            locked={locked}
          />
        ))}
      </div>

      {/* Energy section */}
      {day && (
        <div className="px-4">
          <EnergySection day={day} onUpdate={handleEnergyUpdate} />
        </div>
      )}

      <Streak uid={uid} />

      {/* Food modal */}
      {foodModal && (
        <FoodModal
          defaultMeal={foodModal}
          onAdd={handleAddSingle}
          onClose={() => setFoodModal(null)}
        />
      )}
    </div>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'today', label: 'Today', icon: Utensils },
  { id: 'week', label: 'Week', icon: BarChart2 },
  { id: 'trends', label: 'Trends', icon: TrendingUp },
  { id: 'settings', label: 'Settings', icon: Settings },
];

// ─── App root ─────────────────────────────────────────────────────────────────

export default function App() {
  const { user, signIn, logOut, loading } = useAuth();
  const [tab, setTab] = useState('today');
  const [dateKey, setDateKey] = useState(toDateKey(new Date()));

  const today = toDateKey(new Date());
  const prevDateKey = addDays(dateKey, -1);

  function navigateDate(delta) {
    const next = addDays(dateKey, delta);
    if (next <= today) setDateKey(next);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: COLORS.bg }}>
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: COLORS.green }} />
      </div>
    );
  }

  if (!user) return <SignInScreen signIn={signIn} />;

  return (
    <div className="min-h-screen" style={{ background: COLORS.bg }}>
      {/* Main content area */}
      <div className="max-w-md mx-auto overflow-y-auto" style={{ paddingBottom: '96px' }}>
        {tab === 'today' && (
          <TodayView
            uid={user.uid}
            dateKey={dateKey}
            prevDateKey={prevDateKey}
            onDateChange={navigateDate}
          />
        )}
        {tab === 'week' && <WeekView uid={user.uid} />}
        {tab === 'trends' && <TrendsView uid={user.uid} />}
        {tab === 'settings' && (
          <div className="pt-4">
            <div className="px-4 mb-4">
              <h1 className="text-lg font-bold" style={{ color: COLORS.textPrimary }}>Settings</h1>
            </div>
            <SettingsView uid={user.uid} onLogout={logOut} />
          </div>
        )}
      </div>

      {/* Bottom tab bar */}
      <div
        className="fixed bottom-0 left-0 right-0 pb-safe"
        style={{
          background: 'rgba(10,15,26,0.95)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid #1e293b',
        }}
      >
        <div className="max-w-md mx-auto flex">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors"
                style={{ color: active ? COLORS.green : COLORS.textMuted }}
              >
                <Icon size={20} />
                <span className="text-xs">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
