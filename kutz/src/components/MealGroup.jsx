import { useState } from 'react';
import { ChevronDown, ChevronRight, Sparkles, Trash2, Pencil, Plus } from 'lucide-react';
import { MEAL_COLORS, COLORS } from '../lib/constants';

export default function MealGroup({ meal, foods, onDelete, onEdit, onAddClick, locked }) {
  const [open, setOpen] = useState(true);

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
          <span className="tabular text-sm font-semibold" style={{ color: COLORS.amber }}>
            {subtotal} kcal
          </span>
          {open
            ? <ChevronDown  size={14} style={{ color: COLORS.textMuted }} />
            : <ChevronRight size={14} style={{ color: COLORS.textMuted }} />
          }
        </div>
      </button>

      {open && (
        <div style={{ background: '#020617' }}>
          {mealFoods.length === 0 ? (
            <p className="px-4 py-3 text-sm" style={{ color: COLORS.textMuted }}>Nothing logged yet</p>
          ) : (
            <ul>
              {mealFoods.map(food => (
                <li
                  key={food.id}
                  className="flex items-start justify-between px-4 py-2.5 border-t"
                  style={{ borderColor: '#1e293b' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {food.source === 'voice' && (
                        <Sparkles size={11} style={{ color: COLORS.green, flexShrink: 0 }} />
                      )}
                      {food.source === 'barcode' && (
                        <span className="text-xs px-1 rounded" style={{ background: COLORS.purple + '22', color: COLORS.purple, fontSize: 9 }}>
                          scan
                        </span>
                      )}
                      <span className="text-sm truncate" style={{ color: COLORS.textPrimary }}>
                        {food.name}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-0.5 text-xs tabular" style={{ color: COLORS.textSecondary }}>
                      <span>{food.quantity}</span>
                      <span>·</span>
                      <span style={{ color: COLORS.amber }}>{food.calories} kcal</span>
                      <span>·</span>
                      <span style={{ color: COLORS.green }}>{food.protein}g</span>
                      <span>·</span>
                      <span style={{ color: COLORS.blue }}>{food.fiber}g</span>
                    </div>
                  </div>

                  {/* Edit + Delete (hidden for auto entries and locked days) */}
                  {!locked && !food.auto && (
                    <div className="flex items-center gap-0.5 ml-2 flex-shrink-0">
                      <button
                        onClick={() => onEdit && onEdit(food)}
                        className="p-1.5 rounded opacity-40 hover:opacity-100 transition-opacity"
                        title="Edit"
                      >
                        <Pencil size={12} style={{ color: COLORS.textSecondary }} />
                      </button>
                      <button
                        onClick={() => onDelete(food.id)}
                        className="p-1.5 rounded opacity-40 hover:opacity-100 transition-opacity"
                        title="Delete"
                      >
                        <Trash2 size={12} style={{ color: COLORS.red }} />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {!locked && (
            <button
              onClick={() => onAddClick(meal)}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm border-t transition-opacity hover:opacity-80"
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
