import { useState } from 'react';
import { Sparkles, Loader2, RefreshCw, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { COLORS, MEAL_COLORS } from '../lib/constants';
import { getSuggestions } from '../lib/claude';

/**
 * SuggestPanel — "What should I eat next?"
 *
 * Collapsible panel that calls /api/kutz/suggest and shows:
 *   - 2 data-backed insights about today's macros
 *   - 2-3 meal suggestions based on her eating history
 *
 * Props:
 *   onAddSuggestion(suggestion) — called when user taps a suggestion to log it
 */
export default function SuggestPanel({ onAddSuggestion }) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [data,    setData]    = useState(null);   // { insights, suggestions }
  const [error,   setError]   = useState('');

  async function load(force = false) {
    if (data && !force) { setOpen(o => !o); return; }
    setOpen(true);
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

  async function refresh() {
    setData(null);
    await load(true);
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid #1e293b' }}
    >
      {/* Header button */}
      <button
        onClick={() => load()}
        className="w-full flex items-center gap-2 px-4 py-3 active:opacity-70"
        style={{ background: '#0a0f1a' }}
      >
        <Sparkles size={14} style={{ color: COLORS.green }} />
        <span
          className="text-sm font-medium flex-1 text-left"
          style={{ color: COLORS.textPrimary }}
        >
          What should I eat next?
        </span>
        {loading
          ? <Loader2 size={14} className="animate-spin" style={{ color: COLORS.textMuted }} />
          : open
            ? <ChevronUp   size={14} style={{ color: COLORS.textMuted }} />
            : <ChevronDown size={14} style={{ color: COLORS.textMuted }} />
        }
      </button>

      {/* Expanded content */}
      {open && (
        <div
          className="px-4 pb-4 space-y-3"
          style={{ borderTop: '1px solid #1e293b', paddingTop: 12 }}
        >
          {/* Error */}
          {error && (
            <p className="text-xs" style={{ color: COLORS.red }}>{error}</p>
          )}

          {/* Loading state */}
          {loading && !data && (
            <div className="flex items-center gap-2 py-2">
              <Loader2 size={13} className="animate-spin" style={{ color: COLORS.green }} />
              <span className="text-xs" style={{ color: COLORS.textSecondary }}>
                Analyzing your history…
              </span>
            </div>
          )}

          {data && (
            <>
              {/* Insights */}
              {data.insights?.length > 0 && (
                <div className="space-y-1">
                  {data.insights.map((insight, i) => (
                    <p
                      key={i}
                      className="text-xs leading-relaxed"
                      style={{ color: COLORS.textSecondary }}
                    >
                      · {insight}
                    </p>
                  ))}
                </div>
              )}

              {/* Suggestion cards */}
              {data.suggestions?.length > 0 ? (
                <div className="space-y-2">
                  {data.suggestions.map((s, i) => (
                    <div
                      key={i}
                      className="rounded-xl px-3 py-2.5"
                      style={{ background: '#020617', border: '1px solid #1e293b' }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {/* Meal badge + label */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="text-xs px-1.5 py-0.5 rounded-full"
                              style={{
                                background: (MEAL_COLORS[s.meal] || '#64748b') + '22',
                                color:      MEAL_COLORS[s.meal] || '#64748b',
                              }}
                            >
                              {s.meal}
                            </span>
                            <span
                              className="text-sm font-medium"
                              style={{ color: COLORS.textPrimary }}
                            >
                              {s.label}
                            </span>
                          </div>

                          {/* Foods description */}
                          <p
                            className="text-xs mt-1 leading-snug"
                            style={{ color: COLORS.textSecondary }}
                          >
                            {s.foods}
                          </p>

                          {/* Macros row */}
                          <div
                            className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs tabular"
                          >
                            <span style={{ color: COLORS.amber }}>{s.calories} kcal</span>
                            <span style={{ color: COLORS.green }}>{s.protein}g prot</span>
                            {s.carbs > 0 && <span style={{ color: COLORS.blue }}>{s.carbs}g carbs</span>}
                            {s.fat   > 0 && <span style={{ color: COLORS.orange }}>{s.fat}g fat</span>}
                            {s.fiber > 0 && <span style={{ color: '#a78bfa' }}>{s.fiber}g fiber</span>}
                          </div>

                          {/* Reason */}
                          {s.reason && (
                            <p
                              className="text-xs mt-1 italic"
                              style={{ color: COLORS.textMuted }}
                            >
                              {s.reason}
                            </p>
                          )}
                        </div>

                        {/* Add button — passes to VoiceInput text field */}
                        {onAddSuggestion && (
                          <button
                            onClick={() => onAddSuggestion(s)}
                            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center active:opacity-60"
                            style={{ background: '#1e293b' }}
                            title="Use this suggestion"
                          >
                            <Plus size={14} style={{ color: COLORS.green }} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs" style={{ color: COLORS.textSecondary }}>
                  Log more foods to get personalised suggestions.
                </p>
              )}

              {/* Refresh */}
              <button
                onClick={refresh}
                className="flex items-center gap-1.5 text-xs active:opacity-60"
                style={{ color: COLORS.textMuted }}
              >
                <RefreshCw size={11} />
                Refresh
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
