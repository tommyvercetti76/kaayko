import { useState, useCallback, useRef, lazy, Suspense, useEffect } from 'react';
import { Utensils, BarChart2, TrendingUp, Settings, Lock, Unlock, ChevronLeft, ChevronRight, CheckCircle, AlertCircle, Loader2, Download } from 'lucide-react';

import { useAuth } from './hooks/useAuth';
import { useDay } from './hooks/useDay';
import { useFoods } from './hooks/useFoods';
import { addFood, addFoods, deleteFood, updateFood, updateDay, getOrCreateDay } from './lib/firestore';
import { computeTotals } from './lib/calculations';
import { MEALS, COLORS } from './lib/constants';
import { ProfileProvider } from './context/ProfileContext';
import ErrorBoundary from './components/ErrorBoundary';

import Cockpit         from './components/Cockpit';
import VoiceInput      from './components/VoiceInput';
import MealGroup       from './components/MealGroup';
import QuickBar        from './components/QuickBar';
import WaterTracker    from './components/WaterTracker';
import RepeatMeal      from './components/RepeatMeal';
import EnergySection   from './components/EnergySection';
import FoodModal       from './components/FoodModal';
import OnboardingTour, { useOnboarding } from './components/OnboardingTour';
import Achievements    from './components/Achievements';

const WeekView     = lazy(() => import('./components/WeekView'));
const TrendsView   = lazy(() => import('./components/TrendsView'));
const SettingsView = lazy(() => import('./components/SettingsView'));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateKey(date) { return date.toISOString().split('T')[0]; }

/** Timezone-safe date arithmetic — works across DST boundaries */
function addDays(dateKey, n) {
  const d = new Date(dateKey + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, type }) {
  if (!msg) return null;
  const bg   = type === 'error' ? '#f87171' : '#34d399';
  const Icon = type === 'error' ? AlertCircle : CheckCircle;
  return (
    <div
      className="fixed top-4 left-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium"
      style={{ transform: 'translateX(-50%)', background: bg, color: '#020617', maxWidth: '90vw' }}
    >
      <Icon size={15} />{msg}
    </div>
  );
}

function useToast() {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);
  function show(msg, type = 'success', ms = 2500) {
    clearTimeout(timerRef.current);
    setToast({ msg, type });
    timerRef.current = setTimeout(() => setToast(null), ms);
  }
  return { toast, show };
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function TabSpinner() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 size={22} className="animate-spin" style={{ color: COLORS.textMuted }} />
    </div>
  );
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
          onClick={handleSignIn} disabled={loading}
          className="w-full py-4 rounded-2xl font-semibold text-base"
          style={{ background: '#34d399', color: '#020617', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Signing in…' : 'Sign in with Google'}
        </button>
      </div>
    </div>
  );
}

function NotAuthorizedScreen({ logOut }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-5" style={{ background: COLORS.bg }}>
      <div className="text-4xl">🔒</div>
      <div>
        <p className="font-semibold text-base" style={{ color: COLORS.textPrimary }}>Access restricted</p>
        <p className="text-sm mt-1" style={{ color: COLORS.textSecondary }}>
          This app is private. Sign in with the correct account.
        </p>
      </div>
      <button
        onClick={logOut}
        className="px-6 py-3 rounded-2xl text-sm font-medium"
        style={{ background: '#0a0f1a', border: '1px solid #1e293b', color: COLORS.red }}
      >
        Try another account
      </button>
    </div>
  );
}

// ─── PWA install banner ───────────────────────────────────────────────────────

function InstallBanner({ onInstall, onDismiss }) {
  return (
    <div
      className="fixed bottom-24 left-4 right-4 z-40 flex items-center justify-between px-4 py-3 rounded-2xl shadow-xl max-w-md mx-auto"
      style={{ background: '#0a0f1a', border: `1px solid ${COLORS.green}55` }}
    >
      <div>
        <p className="text-sm font-medium" style={{ color: COLORS.textPrimary }}>Add to Home Screen</p>
        <p className="text-xs mt-0.5" style={{ color: COLORS.textSecondary }}>Install for offline access</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onDismiss}
          className="text-xs px-3 py-1.5 rounded-lg"
          style={{ color: COLORS.textMuted }}
        >
          Later
        </button>
        <button
          onClick={onInstall}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
          style={{ background: COLORS.green, color: '#020617' }}
        >
          <Download size={12} /> Install
        </button>
      </div>
    </div>
  );
}

// ─── Today view ───────────────────────────────────────────────────────────────

function TodayView({ uid, dateKey, prevDateKey, onDateChange }) {
  const { day, loading: dayLoading } = useDay(uid, dateKey);
  const { foods } = useFoods(uid, dateKey);
  const [foodModal,   setFoodModal]   = useState(null);
  const [writeError,  setWriteError]  = useState('');
  const [repeatOpen,  setRepeatOpen]  = useState(false);
  const energyTimer = useRef(null);
  const { toast, show: showToast } = useToast();

  const totals  = computeTotals(foods);
  const locked  = day?.locked || false;
  const today   = toDateKey(new Date());
  const isToday = dateKey === today;

  // ensureDay only works for today; for past dates it's a no-op (returns null)
  async function ensureDay() { await getOrCreateDay(uid, dateKey); }

  const handleAddFoods = useCallback(async (items) => {
    setWriteError('');
    try {
      await ensureDay();
      await addFoods(uid, dateKey, items);
      showToast(`Added ${items.length} item${items.length !== 1 ? 's' : ''}`);
    } catch (e) {
      setWriteError(e.message || 'Failed to save.');
      showToast('Failed to save — check connection', 'error');
    }
  }, [uid, dateKey]);

  const handleAddSingle = useCallback(async (food) => {
    setWriteError('');
    try {
      await ensureDay();
      await addFood(uid, dateKey, food);
      showToast(`${food.name} added`);
    } catch (e) {
      setWriteError(e.message || 'Failed to save.');
      showToast('Failed to save — check connection', 'error');
    }
  }, [uid, dateKey]);

  const handleDelete = useCallback(async (foodId) => {
    try { await deleteFood(uid, dateKey, foodId); }
    catch { showToast('Could not delete item', 'error'); }
  }, [uid, dateKey]);

  const handleUpdate = useCallback(async (foodId, updates) => {
    try {
      await updateFood(uid, dateKey, foodId, updates);
      showToast('Updated');
    } catch (e) {
      showToast('Could not update item', 'error');
      throw e;
    }
  }, [uid, dateKey]);

  // Fix #4 — listen for kutz:addFoods events dispatched by WeekView's SuggestPanel
  useEffect(() => {
    function onAddFoods(e) {
      const foods = e.detail;
      if (!Array.isArray(foods) || !foods.length) return;
      handleAddFoods(foods);
    }
    window.addEventListener('kutz:addFoods', onAddFoods);
    return () => window.removeEventListener('kutz:addFoods', onAddFoods);
  }, [handleAddFoods]);

  const handleEnergyUpdate = useCallback((data) => {
    clearTimeout(energyTimer.current);
    energyTimer.current = setTimeout(() => {
      updateDay(uid, dateKey, data).catch(e => console.error('[updateDay]', e));
    }, 800);
  }, [uid, dateKey]);

  async function toggleLock() {
    try { await updateDay(uid, dateKey, { locked: !locked }); }
    catch { showToast('Could not toggle lock', 'error'); }
  }

  const openAdd  = (meal) => setFoodModal({ mode: 'add',  meal });
  const openEdit = (food) => setFoodModal({ mode: 'edit', food });

  if (dayLoading) {
    return <div className="flex justify-center py-20 text-sm" style={{ color: COLORS.textMuted }}>Loading…</div>;
  }

  return (
    <div className="space-y-5 pb-4">
      <Toast {...(toast || { msg: null })} />

      {/* Date nav */}
      <div className="flex items-center justify-between px-4 pt-2">
        <button onClick={() => onDateChange(-1)} className="p-2 rounded-lg" style={{ color: COLORS.textMuted }}>
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="text-sm font-medium" style={{ color: COLORS.textPrimary }}>
            {isToday ? 'Today' : dateKey}
          </p>
          {locked && <span className="text-xs" style={{ color: COLORS.red }}>Locked</span>}
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

      <Cockpit totals={totals} water={day?.water || 0} />

      <WaterTracker uid={uid} dateKey={dateKey} water={day?.water || 0} />

      <Achievements totals={totals} water={day?.water || 0} />

      <VoiceInput onAdd={handleAddFoods} disabled={locked} />

      {writeError && <p className="px-4 text-xs" style={{ color: COLORS.red }}>{writeError}</p>}

      <div className="px-4 space-y-2">
        <QuickBar uid={uid} onAdd={handleAddSingle} disabled={locked} />
        {/* Compact repeat-from-yesterday link */}
        <button
          onClick={() => setRepeatOpen(o => !o)}
          className="text-xs"
          style={{ color: COLORS.textMuted }}
        >
          ↩ {isToday ? 'Copy from yesterday' : `Copy from ${prevDateKey}`}
        </button>
        {repeatOpen && (
          <RepeatMeal
            uid={uid}
            todayKey={dateKey}
            yesterdayKey={prevDateKey}
            sourceLabel={isToday ? 'yesterday' : prevDateKey}
          />
        )}
      </div>

      <div className="px-4 space-y-3">
        {MEALS.map(meal => (
          <MealGroup
            key={meal} meal={meal} foods={foods}
            onDelete={handleDelete} onEdit={openEdit}
            onAddClick={openAdd} locked={locked}
          />
        ))}
      </div>

      {day && (
        <div className="px-4">
          <EnergySection
            uid={uid}
            dateKey={dateKey}
            day={day}
            onUpdate={handleEnergyUpdate}
          />
        </div>
      )}

      {foodModal?.mode === 'add' && (
        <FoodModal defaultMeal={foodModal.meal} onAdd={handleAddSingle} onClose={() => setFoodModal(null)} />
      )}
      {foodModal?.mode === 'edit' && (
        <FoodModal food={foodModal.food} onUpdate={handleUpdate} onClose={() => setFoodModal(null)} />
      )}
    </div>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'today',    label: 'Today',    icon: Utensils   },
  { id: 'week',     label: 'Week',     icon: BarChart2  },
  { id: 'trends',   label: 'Trends',   icon: TrendingUp },
  { id: 'settings', label: 'Settings', icon: Settings   },
];

// ─── App root ─────────────────────────────────────────────────────────────────

export default function App() {
  const { user, signIn, logOut, loading, unauthorized } = useAuth();
  const [tab, setTab]         = useState('today');
  const [dateKey, setDateKey] = useState(toDateKey(new Date()));
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstall, setShowInstall]     = useState(false);
  const { show: showOnboarding, dismiss: dismissOnboarding } = useOnboarding();

  const today       = toDateKey(new Date());
  const prevDateKey = addDays(dateKey, -1);

  // Capture PWA install prompt
  useEffect(() => {
    function handler(e) {
      e.preventDefault();
      setInstallPrompt(e);
      const dismissed = sessionStorage.getItem('pwa_dismissed');
      if (!dismissed) setShowInstall(true);
    }
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Handle Fitbit OAuth callback query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fitbit = params.get('fitbit');
    if (fitbit === 'connected') {
      // Clean URL and show success
      window.history.replaceState({}, '', window.location.pathname);
      // Toast shown via TodayView's own toast — just flag it
      sessionStorage.setItem('fitbit_just_connected', '1');
    } else if (fitbit === 'error') {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setShowInstall(false);
    setInstallPrompt(null);
  }

  function dismissInstall() {
    setShowInstall(false);
    sessionStorage.setItem('pwa_dismissed', '1');
  }

  function navigateDate(delta) {
    const next = addDays(dateKey, delta);
    if (next <= today) {
      setDateKey(next);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: COLORS.bg }}>
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: COLORS.green }} />
      </div>
    );
  }

  if (unauthorized) return <NotAuthorizedScreen logOut={logOut} />;
  if (!user) return <SignInScreen signIn={signIn} />;

  return (
    <ErrorBoundary>
      <ProfileProvider uid={user.uid}>
        {/* Onboarding tour — full-screen, shown once on first launch */}
        {showOnboarding && <OnboardingTour onDone={dismissOnboarding} />}

        <div className="min-h-screen" style={{ background: COLORS.bg }}>
          <div className="max-w-md mx-auto" style={{ paddingBottom: '96px' }}>

            {tab === 'today' && (
              <TodayView uid={user.uid} dateKey={dateKey} prevDateKey={prevDateKey} onDateChange={navigateDate} />
            )}
            {tab === 'week' && (
              <Suspense fallback={<TabSpinner />}>
                <WeekView uid={user.uid} />
              </Suspense>
            )}
            {tab === 'trends' && (
              <Suspense fallback={<TabSpinner />}>
                <TrendsView uid={user.uid} />
              </Suspense>
            )}
            {tab === 'settings' && (
              <div className="pt-4">
                <div className="px-4 mb-4">
                  <h1 className="text-lg font-bold" style={{ color: COLORS.textPrimary }}>Settings</h1>
                </div>
                <Suspense fallback={<TabSpinner />}>
                  <SettingsView onLogout={logOut} />
                </Suspense>
              </div>
            )}
          </div>

          {/* PWA install banner */}
          {showInstall && (
            <InstallBanner onInstall={handleInstall} onDismiss={dismissInstall} />
          )}

          {/* Bottom tab bar */}
          <div
            className="fixed bottom-0 left-0 right-0 pb-safe"
            style={{ background: 'rgba(10,15,26,0.95)', backdropFilter: 'blur(12px)', borderTop: '1px solid #1e293b' }}
          >
            <div className="max-w-md mx-auto flex">
              {TABS.map(({ id, label, icon: Icon }) => {
                const active = tab === id;
                return (
                  <button
                    key={id} onClick={() => setTab(id)}
                    className="flex-1 flex flex-col items-center py-3 gap-0.5"
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
      </ProfileProvider>
    </ErrorBoundary>
  );
}
