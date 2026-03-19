import { useState, useRef } from 'react';
import { Search, Loader2, Plus } from 'lucide-react';
import { searchFoods } from '../lib/claude';
import { COLORS, MEAL_COLORS } from '../lib/constants';

const MEAL_ORDER = ['breakfast', 'lunch', 'snacks', 'dinner'];

function inferMeal() {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 18) return 'snacks';
  return 'dinner';
}

export default function FoodSearch({ onAdd, disabled }) {
  const [query,      setQuery]      = useState('');
  const [results,    setResults]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [searched,   setSearched]   = useState(false);
  const [targetMeal, setTargetMeal] = useState(inferMeal);
  const debounceRef = useRef(null);

  async function doSearch(q) {
    if (!q || q.trim().length < 2) { setResults([]); setSearched(false); return; }
    setLoading(true);
    setError('');
    try {
      const foods = await searchFoods(q.trim());
      setResults(foods);
      setSearched(true);
    } catch {
      setError('Search unavailable — check connection');
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    const val = e.target.value;
    setQuery(val);
    setError('');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 600);
  }

  async function handleAdd(food) {
    if (disabled) return;
    await onAdd([{ ...food, meal: targetMeal, source: 'search' }]);
    // Fix #1 — dismiss results immediately after add
    setQuery('');
    setResults([]);
    setSearched(false);
  }

  // Fix #5 — tap to cycle meal so the user controls where the food lands
  function cycleMeal() {
    setTargetMeal(m => MEAL_ORDER[(MEAL_ORDER.indexOf(m) + 1) % MEAL_ORDER.length]);
  }

  return (
    <div className="space-y-2">
      {/* Meal target — one tap cycles through meals */}
      <button
        onClick={cycleMeal}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
        style={{
          background: MEAL_COLORS[targetMeal] + '22',
          border:     `1px solid ${MEAL_COLORS[targetMeal]}44`,
          color:      MEAL_COLORS[targetMeal],
        }}
      >
        Adding to {targetMeal} ↻
      </button>

      {/* Search input */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: COLORS.textMuted }} />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="Search 3M+ products…"
          disabled={disabled}
          autoFocus
          className="w-full pl-9 pr-4 py-3 rounded-xl text-sm outline-none"
          style={{ background: '#0a0f1a', border: '1px solid #1e293b', color: COLORS.textPrimary }}
        />
        {loading && (
          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin" style={{ color: COLORS.textMuted }} />
        )}
      </div>

      {error && <p className="text-xs" style={{ color: COLORS.red }}>{error}</p>}

      {results.length > 0 && (
        <div className="space-y-1.5">
          {results.map((food, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: '#0a0f1a', border: '1px solid #1e293b' }}>
              <div className="flex-1 min-w-0 mr-3">
                <p className="text-sm font-medium truncate" style={{ color: COLORS.textPrimary }}>{food.name}</p>
                <div className="flex gap-2 text-xs tabular mt-0.5" style={{ color: COLORS.textSecondary }}>
                  <span>{food.quantity}</span>
                  <span style={{ color: COLORS.amber }}>{food.calories} kcal</span>
                  <span style={{ color: COLORS.green }}>{food.protein}g P</span>
                  {food.carbs > 0 && <span>{food.carbs}g C</span>}
                  {food.fat   > 0 && <span>{food.fat}g F</span>}
                </div>
              </div>
              <button
                onClick={() => handleAdd(food)}
                disabled={disabled}
                className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: COLORS.green, opacity: disabled ? 0.4 : 1 }}
              >
                <Plus size={16} color="#020617" />
              </button>
            </div>
          ))}
          <p className="text-xs text-center pt-1" style={{ color: COLORS.textMuted }}>Open Food Facts · CC BY-SA 4.0</p>
        </div>
      )}

      {searched && results.length === 0 && !loading && (
        <p className="text-sm text-center py-2" style={{ color: COLORS.textSecondary }}>
          No results — try a shorter name or different spelling
        </p>
      )}
    </div>
  );
}
