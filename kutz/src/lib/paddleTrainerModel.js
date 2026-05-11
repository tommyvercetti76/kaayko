const NOTE_DICTIONARY = {
  noteCalm: ['calm', 'glass', 'smooth', 'easy', 'stable', 'peaceful'],
  noteWind: ['wind', 'gust', 'blown', 'headwind', 'crosswind', 'tailwind'],
  noteChop: ['chop', 'choppy', 'whitecap', 'whitecaps', 'rough', 'wave', 'waves', 'swell'],
  noteCold: ['cold', 'freezing', 'ice', 'numb', 'hypothermia'],
  noteHeat: ['hot', 'heat', 'sunburn', 'overheated', 'humid'],
  noteCrowd: ['crowd', 'busy', 'traffic', 'boats', 'wake', 'jet ski'],
  noteLaunch: ['launch', 'ramp', 'dock', 'parking', 'carry', 'portage'],
  noteUnsafe: ['unsafe', 'danger', 'scary', 'rescue', 'storm', 'lightning'],
};

const VALUE_MAPS = {
  skillLevel: { beginner: 0, intermediate: 1, advanced: 2, expert: 3 },
  boatType: { kayak: 0, sup: 1, canoe: 2, rowing: 3, other: 4 },
  sessionGoal: { relax: 0, explore: 1, fitness: 2, fishing: 3, training: 4 },
  groupType: { solo: 0, partner: 1, group: 2 },
  windFelt: { calm: 0, light: 1, moderate: 2, strong: 3, brutal: 4 },
  waveFelt: { flat: 0, ripple: 1, chop: 2, whitecaps: 3 },
  launchDifficulty: { easy: 0, ok: 1, hard: 2 },
  crowding: { quiet: 0, normal: 1, busy: 2 },
  fatigue: { fresh: 0, normal: 1, tired: 2 },
};

const BASE_FEATURES = [
  ['temp_c', 'Air temp'],
  ['wind_kph', 'Wind'],
  ['gust_kph', 'Gusts'],
  ['beaufort', 'Beaufort'],
  ['gustFactor', 'Gust factor'],
  ['humidity', 'Humidity'],
  ['cloud', 'Cloud'],
  ['uv', 'UV'],
  ['precip_mm', 'Rain'],
  ['rainFlag', 'Rain flag'],
  ['snowFlag', 'Snow flag'],
  ['pressure_mb', 'Pressure'],
  ['vis_km', 'Visibility'],
  ['fogSignal', 'Fog signal'],
  ['visibilityRisk', 'Visibility risk'],
  ['estimated_water_temp_c', 'Water temp'],
  ['estimated_wave_height_m', 'Wave height'],
  ['airWaterDelta', 'Air-water delta'],
  ['dewPointSpread', 'Dew spread'],
  ['windWaveExposure', 'Wind-wave exposure'],
  ['coldWaterRisk', 'Cold water risk'],
  ['heatHumidityRisk', 'Heat humidity risk'],
  ['lakeAreaLog', 'Lake area'],
  ['bigWater', 'Big water'],
  ['waterbodyClass', 'Waterbody class'],
  ['daylight', 'Daylight'],
  ['hour', 'Hour'],
  ['month', 'Month'],
  ['day_of_year', 'Season day'],
  ['is_weekend', 'Weekend'],
  ['durationMinutes', 'Duration'],
  ['skillLevel', 'Skill'],
  ['boatType', 'Craft'],
  ['sessionGoal', 'Goal'],
  ['groupType', 'Group'],
];

const HUMAN_CONTEXT_FEATURES = [
  ['windFelt', 'Felt wind'],
  ['waveFelt', 'Felt waves'],
  ['launchDifficulty', 'Launch'],
  ['crowding', 'Crowds'],
  ['fatigue', 'Fatigue'],
  ['reasonWind', 'Reason wind'],
  ['reasonColdWater', 'Reason cold'],
  ['reasonVisibility', 'Reason visibility'],
  ['reasonRain', 'Reason rain'],
  ['reasonBigWater', 'Reason big water'],
  ['reasonHeatSun', 'Reason heat'],
  ['reasonWaves', 'Reason waves'],
  ['reasonSoloRisk', 'Reason solo'],
  ['reasonLaunch', 'Reason launch'],
];

const NOTE_FEATURES = [
  ['noteCalm', 'Note calm'],
  ['noteWind', 'Note wind'],
  ['noteChop', 'Note chop'],
  ['noteCold', 'Note cold'],
  ['noteHeat', 'Note heat'],
  ['noteCrowd', 'Note crowd'],
  ['noteLaunch', 'Note launch'],
  ['noteUnsafe', 'Note unsafe'],
];

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function beaufortFromKph(kph) {
  const wind = toNumber(kph);
  if (wind < 1) return 0;
  if (wind < 6) return 1;
  if (wind < 12) return 2;
  if (wind < 20) return 3;
  if (wind < 29) return 4;
  if (wind < 39) return 5;
  if (wind < 50) return 6;
  if (wind < 62) return 7;
  if (wind < 75) return 8;
  if (wind < 89) return 9;
  if (wind < 103) return 10;
  if (wind < 118) return 11;
  return 12;
}

function waterbodyClassValue(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('river') || text.includes('stream')) return 1;
  if (text.includes('canal')) return 2;
  if (text.includes('bayou')) return 3;
  if (text.includes('lagoon')) return 4;
  if (text.includes('reservoir')) return 5;
  if (text.includes('pond')) return 6;
  return 0;
}

function hasReasonTag(answers, tag) {
  return Array.isArray(answers.reasonTags) && answers.reasonTags.includes(tag) ? 1 : 0;
}

function hourFromRecord(record) {
  if (record.time) {
    const [h] = String(record.time).split(':');
    return toNumber(h, 12);
  }
  const dt = record.weatherSnapshot?.datetime || record.date;
  const parsed = dt ? new Date(String(dt).replace(' ', 'T')) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.getHours() : 12;
}

function dateParts(record) {
  const date = record.date || record.weatherSnapshot?.datetime?.slice(0, 10);
  const parsed = date ? new Date(`${date}T12:00:00`) : new Date();
  return {
    month: parsed.getMonth() + 1,
    day_of_year: Math.floor((parsed - new Date(parsed.getFullYear(), 0, 0)) / 86400000),
    is_weekend: parsed.getDay() === 0 || parsed.getDay() === 6 ? 1 : 0,
  };
}

export function extractNoteSignals(notes = '') {
  const text = String(notes).toLowerCase();
  return Object.fromEntries(
    Object.entries(NOTE_DICTIONARY).map(([key, words]) => {
      const count = words.reduce((sum, word) => sum + (text.includes(word) ? 1 : 0), 0);
      return [key, count];
    })
  );
}

export function getFeatureCatalog(options = {}) {
  const includeHumanContext = options.includeHumanContext !== false;
  const includeNotes = options.includeNotes !== false;
  return [
    ...BASE_FEATURES,
    ...(includeHumanContext ? HUMAN_CONTEXT_FEATURES : []),
    ...(includeNotes ? NOTE_FEATURES : []),
  ];
}

export function recordToFeatureObject(record, options = {}) {
  const weather = record.weatherSnapshot || {};
  const answers = record.answers || {};
  const parts = dateParts(record);
  const noteSignals = extractNoteSignals(record.notes);
  const air = toNumber(weather.temp_c ?? weather.temperature);
  const wind = toNumber(weather.wind_kph ?? weather.windSpeed);
  const gust = toNumber(weather.gust_kph ?? weather.gustSpeed);
  const water = toNumber(weather.estimated_water_temp_c ?? weather.waterTemp);
  const wave = toNumber(weather.estimated_wave_height_m ?? weather.waveHeight);
  const rain = toNumber(weather.precip_mm ?? weather.precipMM);
  const humidity = toNumber(weather.humidity);
  const visibility = toNumber(weather.vis_km ?? weather.visibility, 10);
  const dewPoint = toNumber(weather.dew_point_c, air);
  const area = toNumber(weather.lake_area_km2);
  const condition = String(weather.condition || '').toLowerCase();
  const fogSignal = /fog|mist|haze|smoke/.test(condition) || visibility <= 2 ? 1 : 0;

  const features = {
    temp_c: air,
    wind_kph: wind,
    gust_kph: gust,
    beaufort: beaufortFromKph(wind),
    gustFactor: wind > 0 ? gust / wind : 0,
    humidity,
    cloud: toNumber(weather.cloud ?? weather.cloudCover),
    uv: toNumber(weather.uv ?? weather.uvIndex),
    precip_mm: rain,
    rainFlag: Number(weather.will_it_rain) === 1 || rain > 0 ? 1 : 0,
    snowFlag: Number(weather.will_it_snow) === 1 ? 1 : 0,
    pressure_mb: toNumber(weather.pressure_mb ?? weather.pressure),
    vis_km: visibility,
    fogSignal,
    visibilityRisk: Math.max(0, 10 - visibility),
    estimated_water_temp_c: water,
    estimated_wave_height_m: wave,
    airWaterDelta: air - water,
    dewPointSpread: air - dewPoint,
    windWaveExposure: (wind + gust * 0.4) * (wave + 0.01) * (area > 0 ? Math.log10(area + 1) : 1),
    coldWaterRisk: Math.max(0, 12 - water),
    heatHumidityRisk: Math.max(0, air - 26) * (humidity / 100),
    lakeAreaLog: area > 0 ? Math.log10(area + 1) : 0,
    bigWater: area >= 50 ? 1 : 0,
    waterbodyClass: waterbodyClassValue(weather.waterbody_class || weather.lake_type),
    daylight: Number(weather.is_day) === 1 ? 1 : 0,
    hour: hourFromRecord(record),
    month: parts.month,
    day_of_year: parts.day_of_year,
    is_weekend: parts.is_weekend,
    durationMinutes: toNumber(record.durationMinutes, 75),
    skillLevel: VALUE_MAPS.skillLevel[record.skillLevel] ?? 1,
    boatType: VALUE_MAPS.boatType[record.boatType] ?? 0,
    sessionGoal: VALUE_MAPS.sessionGoal[record.sessionGoal] ?? 1,
    groupType: VALUE_MAPS.groupType[record.groupType] ?? 0,
    windFelt: VALUE_MAPS.windFelt[answers.windFelt] ?? 1,
    waveFelt: VALUE_MAPS.waveFelt[answers.waveFelt] ?? 1,
    launchDifficulty: VALUE_MAPS.launchDifficulty[answers.launchDifficulty] ?? 0,
    crowding: VALUE_MAPS.crowding[answers.crowding] ?? 0,
    fatigue: VALUE_MAPS.fatigue[answers.fatigue] ?? 1,
    reasonWind: hasReasonTag(answers, 'wind'),
    reasonColdWater: hasReasonTag(answers, 'cold_water'),
    reasonVisibility: hasReasonTag(answers, 'visibility'),
    reasonRain: hasReasonTag(answers, 'rain'),
    reasonBigWater: hasReasonTag(answers, 'big_water'),
    reasonHeatSun: hasReasonTag(answers, 'heat_sun'),
    reasonWaves: hasReasonTag(answers, 'waves'),
    reasonSoloRisk: hasReasonTag(answers, 'solo_risk'),
    reasonLaunch: hasReasonTag(answers, 'launch'),
    ...noteSignals,
  };

  return Object.fromEntries(getFeatureCatalog(options).map(([key]) => [key, features[key] ?? 0]));
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function transpose(matrix) {
  return matrix[0].map((_, i) => matrix.map((row) => row[i]));
}

function multiply(a, b) {
  const result = Array.from({ length: a.length }, () => Array(b[0].length).fill(0));
  for (let i = 0; i < a.length; i += 1) {
    for (let k = 0; k < b.length; k += 1) {
      for (let j = 0; j < b[0].length; j += 1) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  return result;
}

function invert(matrix) {
  const n = matrix.length;
  const augmented = matrix.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);

  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[pivot][col])) pivot = row;
    }
    if (Math.abs(augmented[pivot][col]) < 1e-12) {
      throw new Error('Matrix inversion failed');
    }
    [augmented[col], augmented[pivot]] = [augmented[pivot], augmented[col]];
    const divisor = augmented[col][col];
    for (let j = 0; j < 2 * n; j += 1) augmented[col][j] /= divisor;

    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = augmented[row][col];
      for (let j = 0; j < 2 * n; j += 1) {
        augmented[row][j] -= factor * augmented[col][j];
      }
    }
  }

  return augmented.map((row) => row.slice(n));
}

function ridgeFit(xRows, y, lambda = 1.2) {
  const means = xRows[0].map((_, i) => mean(xRows.map((row) => row[i])));
  const stds = xRows[0].map((_, i) => {
    const variance = mean(xRows.map((row) => (row[i] - means[i]) ** 2));
    return Math.sqrt(variance) || 1;
  });

  const x = xRows.map((row) => [1, ...row.map((value, i) => (value - means[i]) / stds[i])]);
  const xt = transpose(x);
  const xtx = multiply(xt, x);
  for (let i = 1; i < xtx.length; i += 1) xtx[i][i] += lambda;
  const xty = multiply(xt, y.map((value) => [value]));
  const weights = multiply(invert(xtx), xty).map((row) => row[0]);

  return {
    weights,
    means,
    stds,
    predict(row) {
      const z = [1, ...row.map((value, i) => (value - means[i]) / stds[i])];
      return clamp(z.reduce((sum, value, i) => sum + value * weights[i], 0), 1, 5);
    },
  };
}

function metrics(actual, predicted) {
  const errors = actual.map((value, i) => predicted[i] - value);
  const mae = mean(errors.map((value) => Math.abs(value)));
  const rmse = Math.sqrt(mean(errors.map((value) => value ** 2)));
  const actualMean = mean(actual);
  const sse = errors.reduce((sum, value) => sum + value ** 2, 0);
  const sst = actual.reduce((sum, value) => sum + (value - actualMean) ** 2, 0);
  const r2 = sst > 0 ? 1 - sse / sst : 0;
  const bias = mean(errors);
  return { mae, rmse, r2, bias };
}

function splitRows(rows) {
  const lakes = [...new Set(rows.map((row) => row.record.lake).filter(Boolean))];
  if (lakes.length >= 4 && rows.length >= 12) {
    const lakeScores = lakes
      .map((lake) => ({
        lake,
        latest: Math.max(...rows.filter((row) => row.record.lake === lake).map((row) => row.sortTime)),
      }))
      .sort((a, b) => a.latest - b.latest);
    const holdoutCount = Math.max(1, Math.ceil(lakeScores.length * 0.25));
    const holdout = new Set(lakeScores.slice(-holdoutCount).map((item) => item.lake));
    return {
      strategy: 'lake holdout',
      train: rows.filter((row) => !holdout.has(row.record.lake)),
      test: rows.filter((row) => holdout.has(row.record.lake)),
    };
  }

  const sorted = [...rows].sort((a, b) => a.sortTime - b.sortTime);
  const testCount = Math.max(2, Math.ceil(sorted.length * 0.25));
  return {
    strategy: 'time holdout',
    train: sorted.slice(0, -testCount),
    test: sorted.slice(-testCount),
  };
}

export function trainPersonalPaddleModel(records, options = {}) {
  const validRecords = records
    .filter((record) => Number.isFinite(Number(record.rating)))
    .map((record) => ({
      record,
      y: clamp(Number(record.rating), 1, 5),
      features: recordToFeatureObject(record, options),
      sortTime: new Date(`${record.date || '1970-01-01'}T${record.time || '12:00'}`).getTime(),
    }));

  if (validRecords.length < 4) {
    return {
      ready: false,
      reason: 'Add at least 4 rated sessions to train a first pass.',
      sampleCount: validRecords.length,
    };
  }

  const featureCatalog = getFeatureCatalog(options);
  const featureNames = featureCatalog.map(([key]) => key);
  const split = splitRows(validRecords);
  if (split.train.length < 2 || split.test.length < 1) {
    return {
      ready: false,
      reason: 'Need more dated labels for a validation split.',
      sampleCount: validRecords.length,
    };
  }

  const xTrain = split.train.map((row) => featureNames.map((name) => row.features[name]));
  const yTrain = split.train.map((row) => row.y);
  const xTest = split.test.map((row) => featureNames.map((name) => row.features[name]));
  const yTest = split.test.map((row) => row.y);
  const model = ridgeFit(xTrain, yTrain, options.lambda ?? 1.2);
  const predictions = xTest.map((row) => model.predict(row));
  const trainPredictions = xTrain.map((row) => model.predict(row));
  const meanBaseline = yTest.map(() => mean(yTrain));
  const baseline = metrics(yTest, meanBaseline);
  const validationMetrics = metrics(yTest, predictions);
  const validation = {
    ...validationMetrics,
    baselineMae: baseline.mae,
    maeLift: baseline.mae > 0 ? 1 - (validationMetrics.mae / baseline.mae) : 0,
  };
  const training = metrics(yTrain, trainPredictions);
  const featureWeights = featureCatalog
    .map(([key, label], i) => ({
      key,
      label,
      weight: model.weights[i + 1],
      magnitude: Math.abs(model.weights[i + 1]),
    }))
    .sort((a, b) => b.magnitude - a.magnitude);

  return {
    ready: true,
    sampleCount: validRecords.length,
    featureNames,
    featureCatalog,
    splitStrategy: split.strategy,
    trainCount: split.train.length,
    testCount: split.test.length,
    validation,
    training,
    featureWeights,
    model: {
      weights: model.weights,
      means: model.means,
      stds: model.stds,
      featureNames,
      options,
      trainedAt: new Date().toISOString(),
      sampleCount: validRecords.length,
    },
    testRows: split.test.map((row, i) => ({
      id: row.record.id,
      lake: row.record.lake,
      date: row.record.date,
      actual: row.y,
      predicted: predictions[i],
      error: predictions[i] - row.y,
    })),
  };
}

export function predictWithPersonalModel(model, record) {
  if (!model?.featureNames) return null;
  const featureObj = recordToFeatureObject(record, model.options || {});
  const z = [
    1,
    ...model.featureNames.map((name, i) => {
      const std = model.stds[i] || 1;
      return (featureObj[name] - model.means[i]) / std;
    }),
  ];
  return clamp(z.reduce((sum, value, i) => sum + value * model.weights[i], 0), 1, 5);
}

export function recordsToCsv(records) {
  const headers = [
    'id',
    'labelSource',
    'scenarioId',
    'lake',
    'date',
    'time',
    'rating',
    'safetyRating',
    'enjoymentRating',
    'wouldPaddleAgain',
    'confidence',
    'skillLevel',
    'boatType',
    'sessionGoal',
    'groupType',
    'durationMinutes',
    'notes',
    'weather_datetime',
    'temp_c',
    'feelslike_c',
    'dew_point_c',
    'wind_kph',
    'gust_kph',
    'wind_dir',
    'beaufort',
    'gust_factor',
    'humidity',
    'cloud',
    'uv',
    'pressure_mb',
    'vis_km',
    'precip_mm',
    'will_it_rain',
    'will_it_snow',
    'condition',
    'estimated_water_temp_c',
    'estimated_wave_height_m',
    'lake_area_km2',
    'lake_size_class',
    'waterbody_class',
    'base_lake_name',
    'matched_lake_name',
    'lake_context_source',
    'reason_tags',
    'generated_paddle_score_context',
  ];
  const rows = records.map((record) => {
    const w = record.weatherSnapshot || {};
    const features = recordToFeatureObject(record);
    return [
      record.id,
      record.labelSource,
      record.scenarioId,
      record.lake,
      record.date,
      record.time,
      record.rating,
      record.safetyRating,
      record.enjoymentRating,
      record.wouldPaddleAgain,
      record.confidence,
      record.skillLevel,
      record.boatType,
      record.sessionGoal,
      record.groupType,
      record.durationMinutes,
      record.notes,
      w.datetime,
      w.temp_c,
      w.feelslike_c,
      w.dew_point_c,
      w.wind_kph,
      w.gust_kph,
      w.wind_dir,
      features.beaufort,
      features.gustFactor,
      w.humidity,
      w.cloud,
      w.uv,
      w.pressure_mb,
      w.vis_km,
      w.precip_mm,
      w.will_it_rain,
      w.will_it_snow,
      w.condition,
      w.estimated_water_temp_c,
      w.estimated_wave_height_m,
      w.lake_area_km2,
      w.lake_size_class,
      w.waterbody_class,
      w.base_lake_name,
      w.matched_lake_name,
      w.lake_context_source,
      (record.answers?.reasonTags || []).join('|'),
      w.paddle_score,
    ];
  });
  return [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n');
}
