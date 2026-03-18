import Ring from './ui/Ring';
import { COLORS } from '../lib/constants';
import { useProfile } from '../context/ProfileContext';

/**
 * Daily dashboard — center ring shows remaining calories, three smaller rings for eaten, protein, fiber.
 * Uses dynamic targets from ProfileContext so user changes in Settings reflect immediately.
 */
export default function Cockpit({ totals }) {
  const { targets } = useProfile();
  const { calories = 0, protein = 0, fiber = 0 } = totals;
  const remaining = targets.calories - calories;
  const isOver = remaining < 0;

  return (
    <div className="flex flex-col items-center gap-6 py-6">
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

      {/* Three smaller rings */}
      <div className="flex gap-8 justify-center">
        <Ring value={calories} max={targets.calories} size={80} strokeWidth={7} color={COLORS.amber} label="eaten">
          <span className="tabular font-semibold text-sm" style={{ color: COLORS.textPrimary }}>
            {calories}
          </span>
          <span className="text-xs" style={{ color: COLORS.textSecondary }}>
            kcal
          </span>
        </Ring>

        <Ring value={protein} max={targets.protein} size={80} strokeWidth={7} color={COLORS.green} label="protein">
          <span className="tabular font-semibold text-sm" style={{ color: COLORS.textPrimary }}>
            {protein}g
          </span>
        </Ring>

        <Ring value={fiber} max={targets.fiber} size={80} strokeWidth={7} color={COLORS.blue} label="fiber">
          <span className="tabular font-semibold text-sm" style={{ color: COLORS.textPrimary }}>
            {fiber}g
          </span>
        </Ring>
      </div>

      {/* Target hint */}
      <div className="flex gap-4 text-xs" style={{ color: COLORS.textMuted }}>
        <span>{targets.calories} kcal target</span>
        <span>·</span>
        <span>{targets.protein}g protein</span>
        <span>·</span>
        <span>{targets.fiber}g fiber</span>
      </div>
    </div>
  );
}
