/**
 * KaleKutz calculation utilities
 * All formulas from SKILL.md — do not modify without testing.
 */

/**
 * Mifflin-St Jeor BMR for female
 * @param {number} weight kg
 * @param {number} height cm
 * @param {number} age years
 */
export function calcBMR(weight, height, age) {
  if (!weight || !height || !age) return null;
  return Math.round(10 * weight + 6.25 * height - 5 * age - 161);
}

/**
 * Calories burned from steps (rough estimate)
 * @param {number} steps
 */
export function stepBurn(steps) {
  return Math.round((steps / 10000) * 400);
}

/**
 * Corrected Fitbit calories with step-based factor
 * @param {number} fitbitCalories
 * @param {number} steps
 */
export function correctedFitbit(fitbitCalories, steps) {
  if (!fitbitCalories) return null;
  let factor = 0.95;
  if (steps > 18000) factor = 0.85;
  else if (steps > 12000) factor = 0.90;
  return Math.round(fitbitCalories * factor);
}

/**
 * Total estimated burn for the day
 * @param {{ bmr: number, steps: number, fitbitCalories: number|null }} day
 */
export function totalBurn(day) {
  const { bmr = 1450, steps = 0, fitbitCalories } = day;
  if (fitbitCalories) {
    return correctedFitbit(fitbitCalories, steps);
  }
  return (bmr || 1450) + stepBurn(steps);
}

/**
 * Aggregate totals from a foods array
 * @param {Array} foods
 */
export function computeTotals(foods = []) {
  return foods.reduce(
    (acc, f) => ({
      calories: acc.calories + (Number(f.calories) || 0),
      protein: acc.protein + (Number(f.protein) || 0),
      fiber: acc.fiber + (Number(f.fiber) || 0),
    }),
    { calories: 0, protein: 0, fiber: 0 }
  );
}

/**
 * 7-day rolling average calories from an array of day objects (newest first)
 * @param {Array<{ calories: number }>} days
 */
export function rollingAvg7(days) {
  const result = [];
  for (let i = 0; i < days.length; i++) {
    const slice = days.slice(Math.max(0, i - 6), i + 1);
    const avg = slice.reduce((s, d) => s + d.calories, 0) / slice.length;
    result.push({ ...days[i], rollingAvg: Math.round(avg) });
  }
  return result;
}

/**
 * Cumulative deficit over days (oldest first)
 * deficit = burn - intake (positive = deficit)
 * @param {Array<{ calories: number, burn: number }>} days
 */
export function cumulativeDeficit(days) {
  let cum = 0;
  return days.map(d => {
    cum += (d.burn || 0) - (d.calories || 0);
    return { ...d, cumDeficit: cum, lbs: +(cum / 3500).toFixed(2) };
  });
}
