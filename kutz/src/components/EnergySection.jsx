import { COLORS } from '../lib/constants';
import { stepBurn, correctedFitbit } from '../lib/calculations';
import { Flame } from 'lucide-react';

export default function EnergySection({ day, onUpdate }) {
  const { steps = 0, fitbitCalories = '', bmr = 1450 } = day || {};

  const burn = fitbitCalories
    ? correctedFitbit(Number(fitbitCalories), Number(steps))
    : (bmr + stepBurn(Number(steps)));

  return (
    <div className="px-4 py-3 rounded-xl space-y-3" style={{ background: '#0a0f1a', border: '1px solid #1e293b' }}>
      <div className="flex items-center gap-2">
        <Flame size={14} style={{ color: COLORS.amber }} />
        <span className="text-sm font-medium" style={{ color: COLORS.textPrimary }}>Energy</span>
        <span className="ml-auto tabular text-sm font-semibold" style={{ color: COLORS.amber }}>
          {burn} kcal burned
        </span>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs block mb-1" style={{ color: COLORS.textMuted }}>Steps</label>
          <input
            type="number"
            value={steps || ''}
            onChange={e => onUpdate({ steps: Number(e.target.value) || 0 })}
            placeholder="0"
            className="w-full px-3 py-2 rounded-lg text-sm tabular outline-none"
            style={{ background: '#020617', border: '1px solid #1e293b', color: COLORS.textPrimary }}
          />
          <p className="text-xs mt-1 tabular" style={{ color: COLORS.textMuted }}>
            +{stepBurn(Number(steps) || 0)} kcal
          </p>
        </div>

        <div className="flex-1">
          <label className="text-xs block mb-1" style={{ color: COLORS.textMuted }}>Fitbit calories (optional)</label>
          <input
            type="number"
            value={fitbitCalories || ''}
            onChange={e => onUpdate({ fitbitCalories: e.target.value ? Number(e.target.value) : null })}
            placeholder="e.g. 2100"
            className="w-full px-3 py-2 rounded-lg text-sm tabular outline-none"
            style={{ background: '#020617', border: '1px solid #1e293b', color: COLORS.textPrimary }}
          />
          {fitbitCalories && (
            <p className="text-xs mt-1 tabular" style={{ color: COLORS.textMuted }}>
              ×{steps > 18000 ? '0.85' : steps > 12000 ? '0.90' : '0.95'} = {correctedFitbit(Number(fitbitCalories), Number(steps))} kcal
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
