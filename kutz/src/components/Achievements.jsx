import { useMemo } from 'react';
import { COLORS } from '../lib/constants';
import { useProfile } from '../context/ProfileContext';

/**
 * Achievements — real-time badges and macro warnings for today's data.
 *
 * Badges (positive):
 *   💧 Water quota completed
 *   💪 Protein target hit
 *   🥦 Fiber target hit
 *   🔥 Calorie target within ±50 kcal (precision badge)
 *   ⚖️ All macros within ±15% of targets (balanced day)
 *
 * Warnings (macro flags):
 *   ⚠️ Calories over target by >15%
 *   ⚠️ Fat over target by >30%
 *   ⚠️ Carbs over target by >20%
 *   ⚠️ Sugar/fiber imbalance: very high carbs but low fiber
 */

// Threshold config — keep readable & tunable
const THRESHOLDS = {
  caloriePrecision:   50,   // ±kcal for "precision" badge
  calorieOverPct:     0.15, // flag if over by >15%
  fatOverPct:         0.30, // flag if fat over by >30%
  carbOverPct:        0.20, // flag if carbs over by >20%
  macroBalancePct:    0.15, // ±15% for "balanced day" badge
  lowFiberHighCarbs:  0.80, // if carbs >80% of target but fiber <50%
};

function evaluate(totals, targets, water, waterTarget) {
  const badges   = [];
  const warnings = [];

  const { calories = 0, protein = 0, carbs = 0, fat = 0, fiber = 0 } = totals;
  const t = targets;

  // ── Badges ──────────────────────────────────────────────────────────────────

  // Water completed
  if (water >= waterTarget && waterTarget > 0) {
    badges.push({ emoji: '💧', label: 'Water quota done', color: '#38bdf8' });
  }

  // Protein target hit
  if (protein >= t.protein && t.protein > 0) {
    badges.push({ emoji: '💪', label: `${protein}g protein — target hit!`, color: COLORS.green });
  }

  // Fiber target hit
  if (fiber >= t.fiber && t.fiber > 0) {
    badges.push({ emoji: '🥦', label: `${fiber}g fiber — nailed it`, color: COLORS.green });
  }

  // Calorie precision (within ±50 kcal of target, only meaningful if eaten enough)
  if (calories >= t.calories - THRESHOLDS.caloriePrecision &&
      calories <= t.calories + THRESHOLDS.caloriePrecision &&
      calories > 0) {
    badges.push({ emoji: '🎯', label: `${calories} kcal — precision!`, color: COLORS.amber });
  }

  // Balanced day — all 5 macros within ±15% of targets
  const withinRange = (actual, target) => {
    if (!target) return true;
    return Math.abs(actual - target) / target <= THRESHOLDS.macroBalancePct;
  };
  if (calories > 0 &&
      withinRange(calories, t.calories) &&
      withinRange(protein, t.protein) &&
      withinRange(carbs, t.carbs) &&
      withinRange(fat, t.fat) &&
      withinRange(fiber, t.fiber)) {
    badges.push({ emoji: '⚖️', label: 'Balanced day', color: COLORS.purple });
  }

  // ── Warnings ────────────────────────────────────────────────────────────────

  // Calories over by >15%
  if (t.calories > 0 && calories > t.calories * (1 + THRESHOLDS.calorieOverPct)) {
    const over = calories - t.calories;
    warnings.push({ emoji: '🔴', label: `${over} kcal over target`, color: COLORS.red });
  }

  // Fat over by >30%
  if (t.fat > 0 && fat > t.fat * (1 + THRESHOLDS.fatOverPct)) {
    warnings.push({ emoji: '🟠', label: `Fat at ${fat}g (target ${t.fat}g)`, color: COLORS.orange });
  }

  // Carbs over by >20%
  if (t.carbs > 0 && carbs > t.carbs * (1 + THRESHOLDS.carbOverPct)) {
    warnings.push({ emoji: '🟡', label: `Carbs at ${carbs}g (target ${t.carbs}g)`, color: COLORS.amber });
  }

  // High carbs + low fiber imbalance
  if (t.carbs > 0 && t.fiber > 0 &&
      carbs > t.carbs * THRESHOLDS.lowFiberHighCarbs &&
      fiber < t.fiber * 0.5) {
    warnings.push({ emoji: '⚠️', label: `Low fiber (${fiber}g) for ${carbs}g carbs`, color: COLORS.amber });
  }

  // Protein very low (eaten >50% of calories but <50% of protein target)
  if (t.calories > 0 && t.protein > 0 &&
      calories > t.calories * 0.5 &&
      protein < t.protein * 0.5) {
    warnings.push({ emoji: '⚠️', label: `Only ${protein}g protein — eat more`, color: COLORS.red });
  }

  return { badges, warnings };
}

export default function Achievements({ totals, water = 0 }) {
  const { targets, waterTarget } = useProfile();

  const { badges, warnings } = useMemo(
    () => evaluate(totals, targets, water, waterTarget),
    [totals, targets, water, waterTarget]
  );

  if (badges.length === 0 && warnings.length === 0) return null;

  return (
    <div className="px-4 space-y-2">
      {/* Badges */}
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {badges.map((b, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium"
              style={{ background: b.color + '18', border: `1px solid ${b.color}44`, color: b.color }}
            >
              {b.emoji} {b.label}
            </span>
          ))}
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {warnings.map((w, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium"
              style={{ background: w.color + '12', border: `1px solid ${w.color}33`, color: w.color }}
            >
              {w.emoji} {w.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
