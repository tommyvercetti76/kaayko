/**
 * KaleKutz calculation utilities
 */

/**
 * Mifflin-St Jeor BMR
 * @param {number} weight kg
 * @param {number} height cm
 * @param {number} age    years
 * @param {'female'|'male'} gender
 */
export function calcBMR(weight, height, age, gender = 'female') {
  if (!weight || !height || !age) return null;
  const base = 10 * weight + 6.25 * height - 5 * age;
  return Math.round(gender === 'male' ? base + 5 : base - 161);
}

/**
 * TDEE = BMR x activity multiplier
 * @param {number|null} bmr
 * @param {number} activityFactor  e.g. 1.375
 */
export function calcTDEE(bmr, activityFactor = 1.2) {
  if (!bmr) return null;
  return Math.round(bmr * activityFactor);
}

/**
 * Calories burned from steps (rough estimate)
 */
export function stepBurn(steps) {
  return Math.round((steps / 10000) * 400);
}

/**
 * Corrected Fitbit calories with step-based factor
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
 */
export function totalBurn(day) {
  const { bmr = 1450, steps = 0, fitbitCalories } = day;
  if (fitbitCalories) return correctedFitbit(fitbitCalories, steps);
  return (bmr || 1450) + stepBurn(steps);
}

/**
 * Aggregate totals from a foods array (includes carbs + fat)
 */
export function computeTotals(foods = []) {
  return foods.reduce(
    (acc, f) => ({
      calories: acc.calories + (Number(f.calories) || 0),
      protein:  acc.protein  + (Number(f.protein)  || 0),
      carbs:    acc.carbs    + (Number(f.carbs)     || 0),
      fat:      acc.fat      + (Number(f.fat)       || 0),
      fiber:    acc.fiber    + (Number(f.fiber)     || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );
}

/**
 * 7-day rolling average calories (input array oldest-first)
 */
export function rollingAvg7(days) {
  return days.map((d, i) => {
    const slice = days.slice(Math.max(0, i - 6), i + 1);
    const avg   = slice.reduce((s, x) => s + x.calories, 0) / slice.length;
    return { ...d, rollingAvg: Math.round(avg) };
  });
}

/**
 * Cumulative deficit over days (oldest first)
 * deficit = burn - intake (positive = deficit)
 */
export function cumulativeDeficit(days) {
  let cum = 0;
  return days.map(d => {
    cum += (d.burn || 0) - (d.calories || 0);
    return { ...d, cumDeficit: cum, lbs: +(cum / 3500).toFixed(2) };
  });
}
