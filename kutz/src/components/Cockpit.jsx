import Ring from './ui/Ring';
import { COLORS } from '../lib/constants';
import { useProfile } from '../context/ProfileContext';

/**
 * Cockpit — calorie ring + macro summary.
 *
 * 60-30-10 palette:
 *   60% — #020617 background (dominant)
 *   30% — #0a0f1a / #1e293b surfaces and borders
 *   10% — #34d399 green accent on interactive elements only
 *
 * Data colours (amber for calories, green for protein) are functional
 * semantic labels — not UI chrome — so they're intentional and controlled.
 */
export default function Cockpit({ totals, water = 0 }) {
  const { targets } = useProfile();
  const {
    calories = 0, protein = 0, carbs = 0, fat = 0, fiber = 0,
    iron = 0, calcium = 0, b12 = 0, zinc = 0,
  } = totals;

  const remaining = targets.calories - calories;
  const isOver    = remaining < 0;
  const hasMicros = iron > 0 || calcium > 0 || b12 > 0 || zinc > 0;

  return (
    <div className="flex flex-col items-center gap-3 py-3">
      {/* Calorie ring — amber = energy (semantic), red = over-budget (semantic) */}
      <Ring
        value={Math.abs(remaining)}
        max={targets.calories}
        size={140}
        strokeWidth={12}
        color={isOver ? COLORS.red : COLORS.amber}
      >
        <span
          className="tabular font-bold text-2xl leading-none"
          style={{ color: isOver ? COLORS.red : COLORS.textPrimary }}
        >
          {Math.abs(remaining)}
        </span>
        <span className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
          {isOver ? 'over' : 'remaining'}
        </span>
      </Ring>

      {/* Macro summary — textPrimary values, textMuted labels (30% role) */}
      <div className="flex items-center gap-2 text-xs tabular flex-wrap justify-center">
        <span style={{ color: COLORS.amber }}>{calories}</span>
        <span style={{ color: COLORS.textMuted }}>kcal eaten ·</span>
        <span style={{ color: COLORS.textPrimary }}>{protein}g</span>
        <span style={{ color: COLORS.textMuted }}>P ·</span>
        <span style={{ color: COLORS.textPrimary }}>{carbs}g</span>
        <span style={{ color: COLORS.textMuted }}>C ·</span>
        <span style={{ color: COLORS.textPrimary }}>{fat}g</span>
        <span style={{ color: COLORS.textMuted }}>F ·</span>
        <span style={{ color: COLORS.textPrimary }}>{fiber}g</span>
        <span style={{ color: COLORS.textMuted }}>fiber</span>
      </div>

      {/* Target badges — surface (30%) with restrained label / value split */}
      <div className="flex items-center gap-2 text-xs tabular flex-wrap justify-center">
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
          style={{ background: '#0a0f1a', border: '1px solid #1e293b' }}
        >
          <span style={{ color: COLORS.textMuted }}>Carbs</span>
          <span style={{ color: COLORS.textPrimary }}>{carbs}g</span>
          <span style={{ color: COLORS.textMuted }}>/ {targets.carbs}g</span>
        </div>
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
          style={{ background: '#0a0f1a', border: '1px solid #1e293b' }}
        >
          <span style={{ color: COLORS.textMuted }}>Fat</span>
          <span style={{ color: COLORS.textPrimary }}>{fat}g</span>
          <span style={{ color: COLORS.textMuted }}>/ {targets.fat}g</span>
        </div>
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
          style={{ background: '#0a0f1a', border: '1px solid #1e293b' }}
        >
          <span style={{ color: COLORS.textMuted }}>Protein</span>
          <span style={{ color: COLORS.green }}>{protein}g</span>
          <span style={{ color: COLORS.textMuted }}>/ {targets.protein}g</span>
        </div>
      </div>

      {/* Micros — shown only when logged, muted (30% role, no accent) */}
      {hasMicros && (
        <div className="flex gap-3 text-xs tabular" style={{ color: COLORS.textMuted }}>
          {iron    > 0 && <span>Fe {iron}mg</span>}
          {calcium > 0 && <span>Ca {calcium}mg</span>}
          {b12     > 0 && <span>B12 {b12}mcg</span>}
          {zinc    > 0 && <span>Zn {zinc}mg</span>}
        </div>
      )}
    </div>
  );
}
