import Ring from './ui/Ring';
import { COLORS } from '../lib/constants';
import { useProfile } from '../context/ProfileContext';

export default function Cockpit({ totals }) {
  const { targets } = useProfile();
  const { calories = 0, protein = 0, carbs = 0, fat = 0, fiber = 0 } = totals;
  const remaining = targets.calories - calories;
  const isOver    = remaining < 0;

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      {/* Center ring — remaining calories */}
      <Ring
        value={Math.abs(remaining)}
        max={targets.calories}
        size={160}
        strokeWidth={14}
        color={isOver ? COLORS.red : COLORS.amber}
      >
        <span
          className="tabular font-bold text-3xl leading-none"
          style={{ color: isOver ? COLORS.red : COLORS.textPrimary }}
        >
          {Math.abs(remaining)}
        </span>
        <span className="text-xs mt-1" style={{ color: COLORS.textSecondary }}>
          {isOver ? 'over' : 'remaining'}
        </span>
      </Ring>

      {/* Three macro rings */}
      <div className="flex gap-8 justify-center">
        <Ring value={calories} max={targets.calories} size={80} strokeWidth={7} color={COLORS.amber} label="eaten">
          <span className="tabular font-semibold text-sm" style={{ color: COLORS.textPrimary }}>{calories}</span>
          <span className="text-xs" style={{ color: COLORS.textSecondary }}>kcal</span>
        </Ring>

        <Ring value={protein} max={targets.protein} size={80} strokeWidth={7} color={COLORS.green} label="protein">
          <span className="tabular font-semibold text-sm" style={{ color: COLORS.textPrimary }}>{protein}g</span>
        </Ring>

        <Ring value={fiber} max={targets.fiber} size={80} strokeWidth={7} color={COLORS.purple} label="fiber">
          <span className="tabular font-semibold text-sm" style={{ color: COLORS.textPrimary }}>{fiber}g</span>
        </Ring>
      </div>

      {/* Carbs + Fat compact row */}
      <div className="flex items-center gap-4 text-xs tabular">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: '#0a0f1a', border: '1px solid #1e293b' }}>
          <span style={{ color: COLORS.textMuted }}>Carbs</span>
          <span style={{ color: COLORS.blue }}>{carbs}g</span>
          <span style={{ color: COLORS.textMuted }}>/ {targets.carbs}g</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: '#0a0f1a', border: '1px solid #1e293b' }}>
          <span style={{ color: COLORS.textMuted }}>Fat</span>
          <span style={{ color: COLORS.orange }}>{fat}g</span>
          <span style={{ color: COLORS.textMuted }}>/ {targets.fat}g</span>
        </div>
      </div>

      {/* Target hint */}
      <div className="flex gap-4 text-xs" style={{ color: COLORS.textMuted }}>
        <span>{targets.calories} kcal</span>
        <span>·</span>
        <span>{targets.protein}g protein</span>
        <span>·</span>
        <span>{targets.fiber}g fiber</span>
      </div>
    </div>
  );
}
