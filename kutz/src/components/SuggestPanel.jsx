import { useState } from 'react';
import { Sparkles, Loader2, RefreshCw, ChevronDown, ChevronUp, Plus, Check } from 'lucide-react';
import { COLORS, MEAL_COLORS } from '../lib/constants';
import { getSuggestions } from '../lib/claude';

/**
 * SuggestPanel — "What should I eat next?"
 * Fix #17 — correct toggle logic (data cached → just toggle open, no re-fetch)
 * Fix #18 — visual checkmark feedback after adding a suggestion
 * Fix #4  — onAddSuggestion now receives the full suggestion object with macros;
 *            caller dispatches food data directly (no re-parse via Claude)
 */
export default function SuggestPanel({ onAddSuggestion }) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [data,    setData]    = useState(null);
  const [error,   setError]   = useState('');
  const [added,   setAdded]   = useState(new Set()); // Fix #18 — track which were added

  async function fetchData() {
    setLoading(true);
    setError('');
    try {
      const result = await getSuggestions();
      setData(result);
    } catch (e) {
      setError(e.message || 'Could not load suggestions');
    } finally {
      setLoading(false);
    }
  }

  // Fix #17 — clean toggle: if data loaded, just toggle open; else fetch then open
  function handleHeaderTap() {
    if (loading) return;
    if (data) {
      setOpen(o => !o);
    } else {
      setOpen(true);
      fetchData();
    }
  }

  async function refresh() {
    setData(null);
    setAdded(new Set());
    setOpen(true);
    fetchData();
  }

  function handleAdd(s, i) {
    // Fix #18 — mark as added immediately
    setAdded(prev => new Set([...prev, i]));
    onAddSuggestion?.(s);
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e293b' }}>
      <button
        onClick={handleHeaderTap}
        className="w-full flex items-center gap-2 px-4 py-3 active:opacity-70"
        style={{ background: '#0a0f1a' }}
      >
        <Sparkles size={14} style={{ color: COLORS.green }} />
        <span className="text-sm font-medium flex-1 text-left" style={{ color: COLORS.textPrimary }}>
          What should I eat next?
        </span>
        {loading
          ? <Loader2 size={14} className="animate-spin" style={{ color: COLORS.textMuted }} />
          : open
            ? <ChevronUp   size={14} style={{ color: COLORS.textMuted }} />
            : <ChevronDown size={14} style={{ color: COLORS.textMuted }} />
        }
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid #1e293b', paddingTop: 12 }}>
          {error && <p className="text-xs" style={{ color: COLORS.red }}>{error}</p>}

          {loading && !data && (
            <div className="flex items-center gap-2 py-2">
              <Loader2 size={13} className="animate-spin" style={{ color: COLORS.green }} />
              <span className="text-xs" style={{ color: COLORS.textSecondary }}>Analyzing your history…</span>
            </div>
          )}

          {data && (
            <>
              {data.insights?.length > 0 && (
                <div className="space-y-1">
                  {data.insights.map((insight, i) => (
                    <p key={i} className="text-xs leading-relaxed" style={{ color: COLORS.textSecondary }}>· {insight}</p>
                  ))}
                </div>
              )}

              {data.suggestions?.length > 0 ? (
                <div className="space-y-2">
                  {data.suggestions.map((s, i) => (
                    <div key={i} className="rounded-xl px-3 py-2.5" style={{ background: '#020617', border: '1px solid #1e293b' }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="text-xs px-1.5 py-0.5 rounded-full"
                              style={{ background: (MEAL_COLORS[s.meal] || '#64748b') + '22', color: MEAL_COLORS[s.meal] || '#64748b' }}
                            >
                              {s.meal}
                            </span>
                            <span className="text-sm font-medium" style={{ color: COLORS.textPrimary }}>{s.label}</span>
                          </div>
                          <p className="text-xs mt-1 leading-snug" style={{ color: COLORS.textSecondary }}>{s.foods}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs tabular">
                            <span style={{ color: COLORS.amber }}>{s.calories} kcal</span>
                            <span style={{ color: COLORS.green }}>{s.protein}g P</span>
                            {s.carbs > 0 && <span style={{ color: COLORS.textSecondary }}>{s.carbs}g C</span>}
                            {s.fat   > 0 && <span style={{ color: COLORS.textSecondary }}>{s.fat}g F</span>}
                          </div>
                          {s.reason && (
                            <p className="text-xs mt-1 italic" style={{ color: COLORS.textMuted }}>{s.reason}</p>
                          )}
                        </div>

                        {/* Fix #18 — checkmark after add, + before */}
                        <button
                          onClick={() => handleAdd(s, i)}
                          disabled={added.has(i)}
                          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center active:opacity-60"
                          style={{
                            background: added.has(i) ? COLORS.green + '22' : '#1e293b',
                            border: added.has(i) ? `1px solid ${COLORS.green}44` : 'none',
                          }}
                          title={added.has(i) ? 'Added' : 'Add this meal'}
                        >
                          {added.has(i)
                            ? <Check size={14} style={{ color: COLORS.green }} />
                            : <Plus  size={14} style={{ color: COLORS.green }} />
                          }
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs" style={{ color: COLORS.textSecondary }}>
                  Log more foods to get personalised suggestions.
                </p>
              )}

              <button onClick={refresh} className="flex items-center gap-1.5 text-xs active:opacity-60" style={{ color: COLORS.textMuted }}>
                <RefreshCw size={11} /> Refresh
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
