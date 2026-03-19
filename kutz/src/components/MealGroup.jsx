import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Sparkles, Trash2, Pencil, Plus } from 'lucide-react';
import { MEAL_COLORS, COLORS } from '../lib/constants';

const STORAGE_KEY = 'kutz_meal_open';

function getStoredOpen() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}
function setStoredOpen(meal, value) {
  try {
    const all = getStoredOpen();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...all, [meal]: value }));
  } catch {}
}

function SourceBadge({ source }) {
  if (source === 'voice')      return <Sparkles size={11} style={{ color: COLORS.green, flexShrink: 0 }} />;
  if (source === 'barcode')    return <span className="text-xs px-1 rounded" style={{ background: '#1e293b', color: COLORS.textMuted, fontSize: 9 }}>scan</span>;
  if (source === 'photo')      return <span className="text-xs px-1 rounded" style={{ background: '#1e293b', color: COLORS.textMuted, fontSize: 9 }}>photo</span>;
  if (source === 'search')     return <span className="text-xs px-1 rounded" style={{ background: '#1e293b', color: COLORS.textMuted, fontSize: 9 }}>search</span>;
  if (source === 'suggestion') return <span className="text-xs px-1 rounded" style={{ background: '#1e293b', color: COLORS.textMuted, fontSize: 9 }}>AI</span>;
  return null;
}

export default function MealGroup({ meal, foods, onDelete, onEdit, onAddClick, locked }) {
  const [open,      setOpen]      = useState(() => getStoredOpen()[meal] ?? true);
  // Fix #6 — double-tap confirmation before delete
  const [confirmId, setConfirmId] = useState(null);
  const confirmTimer              = useRef(null);

  useEffect(() => { setStoredOpen(meal, open); }, [meal, open]);
  // Clear confirm state when meal group collapses
  useEffect(() => { if (!open) setConfirmId(null); }, [open]);

  function requestDelete(id) {
    if (confirmId === id) {
      clearTimeout(confirmTimer.current);
      setConfirmId(null);
      onDelete(id);
    } else {
      setConfirmId(id);
      clearTimeout(confirmTimer.current);
      // Auto-cancel after 2.5s so it doesn't linger
      confirmTimer.current = setTimeout(() => setConfirmId(null), 2500);
    }
  }

  const mealFoods = foods.filter(f => f.meal === meal);
  const subtotal  = mealFoods.reduce((s, f) => s + (Number(f.calories) || 0), 0);
  const color     = MEAL_COLORS[meal];
  const label     = meal.charAt(0).toUpperCase() + meal.slice(1);

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e293b' }}>
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3"
        style={{ background: '#0a0f1a' }}
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
          <span className="font-medium text-sm" style={{ color: COLORS.textPrimary }}>{label}</span>
          <span className="text-xs tabular" style={{ color: COLORS.textSecondary }}>
            {mealFoods.length} item{mealFoods.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="tabular text-sm font-semibold" style={{ color: COLORS.amber }}>{subtotal} kcal</span>
          {open ? <ChevronDown size={14} style={{ color: COLORS.textMuted }} /> : <ChevronRight size={14} style={{ color: COLORS.textMuted }} />}
        </div>
      </button>

      {open && (
        <div style={{ background: '#020617' }}>
          {mealFoods.length === 0 ? (
            <p className="px-4 py-3 text-sm" style={{ color: COLORS.textMuted }}>Nothing logged yet</p>
          ) : (
            <ul>
              {mealFoods.map(food => (
                <li key={food.id} className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: '#1e293b' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <SourceBadge source={food.source} />
                      <span className="text-sm truncate" style={{ color: COLORS.textPrimary }}>{food.name}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-2 gap-y-0 mt-0.5 text-xs tabular" style={{ color: COLORS.textSecondary }}>
                      <span>{food.quantity}</span>
                      <span style={{ color: COLORS.amber }}>{food.calories} kcal</span>
                      <span style={{ color: COLORS.green }}>{food.protein}g P</span>
                      {food.carbs > 0 && <span>{food.carbs}g C</span>}
                      {food.fat   > 0 && <span>{food.fat}g F</span>}
                      {food.fiber > 0 && <span>{food.fiber}g fb</span>}
                    </div>
                  </div>

                  {/* Fix #8 — always-visible, adequately-sized action buttons */}
                  {!locked && !food.auto && (
                    <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                      <button
                        onClick={() => onEdit && onEdit(food)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: '#1e293b' }}
                        title="Edit"
                      >
                        <Pencil size={13} style={{ color: COLORS.textSecondary }} />
                      </button>

                      {/* Fix #6 — first tap: show red confirm; second tap: delete */}
                      {confirmId === food.id ? (
                        <button
                          onClick={() => requestDelete(food.id)}
                          className="h-8 px-2 rounded-lg text-xs font-medium"
                          style={{ background: COLORS.red + '22', border: `1px solid ${COLORS.red}55`, color: COLORS.red }}
                        >
                          Delete?
                        </button>
                      ) : (
                        <button
                          onClick={() => requestDelete(food.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ background: '#1e293b' }}
                          title="Delete"
                        >
                          <Trash2 size={13} style={{ color: COLORS.textMuted }} />
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {!locked && (
            <button
              onClick={() => onAddClick(meal)}
              className="flex items-center gap-2 w-full px-4 py-3 text-sm border-t"
              style={{ color, borderColor: '#1e293b' }}
            >
              <Plus size={14} />
              Add to {label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
