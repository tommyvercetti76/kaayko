export const TARGETS = {
  calories: 1650,
  protein:  110,
  carbs:    200,
  fat:       55,
  fiber:     25,
};

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snacks'];

export const MEAL_COLORS = {
  breakfast: '#f59e0b',
  lunch:     '#34d399',
  dinner:    '#818cf8',
  snacks:    '#f472b6',
};

export const MEAL_LABELS = {
  breakfast: 'Breakfast',
  lunch:     'Lunch',
  dinner:    'Dinner',
  snacks:    'Snacks',
};

export const COLORS = {
  bg:            '#020617',
  card:          '#0a0f1a',
  border:        '#1e293b',
  green:         '#34d399',
  amber:         '#f59e0b',
  blue:          '#38bdf8',
  red:           '#f87171',
  purple:        '#818cf8',
  pink:          '#f472b6',
  orange:        '#fb923c',
  textPrimary:   '#e2e8f0',
  textSecondary: '#64748b',
  textMuted:     '#475569',
};

/** Diet type options */
export const DIET_TYPES = [
  {
    value:   'lacto-ovo-vegetarian',
    label:   'Vegetarian (eggs OK)',
    desc:    'No meat/fish/poultry. Dairy and eggs allowed.',
    emoji:   '🥚',
  },
  {
    value:   'lacto-vegetarian',
    label:   'Vegetarian (no eggs)',
    desc:    'No meat/fish/poultry/eggs. Dairy allowed.',
    emoji:   '🥛',
  },
  {
    value:   'vegan',
    label:   'Vegan',
    desc:    'No animal products of any kind.',
    emoji:   '🌱',
  },
  {
    value:   'non-vegetarian',
    label:   'Non-vegetarian',
    desc:    'All foods including meat, poultry, seafood.',
    emoji:   '🍗',
  },
];

/** Activity multipliers for TDEE = BMR x factor */
export const ACTIVITY_LEVELS = [
  { value: 1.2,   label: 'Sedentary',   desc: 'Desk job, little movement' },
  { value: 1.375, label: 'Light',       desc: 'Light exercise 1-3 days/wk' },
  { value: 1.55,  label: 'Moderate',    desc: 'Exercise 3-5 days/wk' },
  { value: 1.725, label: 'Active',      desc: 'Hard exercise 6-7 days/wk' },
  { value: 1.9,   label: 'Very Active', desc: 'Physical job + hard exercise' },
];

/** Default auto-entry added to every new day (overridable in Settings) */
export const DEFAULT_AUTO_ENTRIES = [
  { name: 'Fish Oil (4 caps)', calories: 70, protein: 0, carbs: 0, fat: 7, fiber: 0, quantity: '4 capsules', meal: 'snacks' },
];
