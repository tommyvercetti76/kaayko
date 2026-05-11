import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  Clock3,
  CloudSun,
  Download,
  Droplets,
  Eye,
  ExternalLink,
  FileDown,
  Gauge,
  MapPin,
  Navigation,
  NotebookPen,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Thermometer,
  Trash2,
  Undo2,
  Waves as WavesIcon,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  predictWithPersonalModel,
  recordsToCsv,
  trainPersonalPaddleModel,
} from '../lib/paddleTrainerModel';

const API_ROOT = import.meta.env.DEV ? '/paddle-trainer/api' : '/api/paddle-trainer';

const QUICK_RATINGS = [
  { value: 1, label: 'No', detail: 'Bad or unsafe', bg: 'from-red-950/60 to-red-950/20', border: 'border-red-500/30', activeBg: 'bg-red-500', activeText: 'text-white' },
  { value: 2, label: 'Probably no', detail: 'Too rough', bg: 'from-orange-950/60 to-orange-950/20', border: 'border-orange-500/30', activeBg: 'bg-orange-500', activeText: 'text-white' },
  { value: 3, label: 'Maybe', detail: 'Borderline', bg: 'from-amber-950/60 to-amber-950/20', border: 'border-amber-500/30', activeBg: 'bg-amber-400', activeText: 'text-slate-950' },
  { value: 4, label: 'Yes', detail: 'Good paddle', bg: 'from-emerald-950/60 to-emerald-950/20', border: 'border-emerald-500/30', activeBg: 'bg-emerald-500', activeText: 'text-white' },
  { value: 5, label: 'Absolutely', detail: 'Great day', bg: 'from-cyan-950/60 to-cyan-950/20', border: 'border-cyan-500/30', activeBg: 'bg-cyan-400', activeText: 'text-slate-950' },
];

const OPTION_SETS = {
  skillLevel: [['intermediate', 'Intermediate'], ['advanced', 'Advanced'], ['expert', 'Expert'], ['beginner', 'Beginner']],
  boatType: [['kayak', 'Kayak'], ['sup', 'SUP'], ['canoe', 'Canoe'], ['rowing', 'Row'], ['other', 'Other']],
  sessionGoal: [['explore', 'Explore'], ['fitness', 'Fitness'], ['relax', 'Relax'], ['fishing', 'Fish'], ['training', 'Train']],
  groupType: [['solo', 'Solo'], ['partner', 'Partner'], ['group', 'Group']],
  windFelt: [['calm', 'Calm'], ['light', 'Light'], ['moderate', 'Moderate'], ['strong', 'Strong'], ['brutal', 'Brutal']],
  waveFelt: [['flat', 'Flat'], ['ripple', 'Ripple'], ['chop', 'Chop'], ['whitecaps', 'Whitecaps']],
  launchDifficulty: [['easy', 'Easy'], ['ok', 'OK'], ['hard', 'Hard']],
  crowding: [['quiet', 'Quiet'], ['normal', 'Normal'], ['busy', 'Busy']],
  fatigue: [['fresh', 'Fresh'], ['normal', 'Normal'], ['tired', 'Tired']],
};

const WEATHER_BUCKETS = ['calm', 'normal', 'cold', 'hot', 'rain', 'high-wind/wave'];

const REASON_TAGS = [
  ['wind', 'Wind mattered'], ['cold_water', 'Cold water'], ['visibility', 'Fog/visibility'],
  ['rain', 'Rain/storm'], ['big_water', 'Big water'], ['heat_sun', 'Heat/sun'],
  ['waves', 'Chop/waves'], ['solo_risk', 'Solo risk'], ['launch', 'Launch/crowds'],
];

const EXPERT_NOTE_SUGGESTIONS = [
  'Calm in morning, windy by noon', 'Expect summer storms midday',
  'Cold water year-round — wetsuit needed', 'Wind funnels through canyon walls',
  'Lake gets choppy fast when wind picks up', 'Shallow near launch — watch keel',
];

const SCENARIO_FILTERS = {
  lakeSource: [['all', 'All'], ['priority', 'Priority'], ['production', 'Prod']],
  season: [['any', 'Any'], ['winter', 'Win'], ['spring', 'Spr'], ['summer', 'Sum'], ['autumn', 'Aut']],
  timeOfDay: [['any', 'Any'], ['morning', 'Morn'], ['midday', 'Mid'], ['afternoon', 'Aft'], ['evening', 'Eve']],
  bucket: [['balanced', 'Mix'], ['calm', 'Calm'], ['normal', 'Norm'], ['cold', 'Cold'], ['hot', 'Hot'], ['rain', 'Rain'], ['high-wind/wave', 'Wind']],
  lakeSize: [['any', 'Any'], ['tiny', 'Tiny'], ['small', 'Sm'], ['medium', 'Med'], ['large', 'Lg'], ['very large', 'XL']],
};

const COVERAGE_AXES = {
  season: ['winter', 'spring', 'summer', 'autumn'],
  bucket: ['calm', 'normal', 'cold', 'hot', 'rain', 'high-wind/wave'],
  size: ['tiny', 'small', 'medium', 'large', 'very large'],
};

// ── Utility functions ──────────────────────────────────────────────────────

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nowHour() {
  return `${String(new Date().getHours()).padStart(2, '0')}:00`;
}

function createDraft() {
  return {
    labelSource: 'manual', scenarioId: null, scenarioBucket: null, scenarioSeason: null,
    scenarioTimeOfDay: null, sourceCsv: null, sourceRowNumber: null, sourceKind: null,
    lake: 'Lake_Tahoe', lakeDisplayName: 'Lake Tahoe', date: '2025-01-01', time: '10:00',
    durationMinutes: 90, rating: 3, safetyRating: 3, enjoymentRating: 3, wouldPaddleAgain: true,
    confidence: 3, skillLevel: 'advanced', boatType: 'kayak', sessionGoal: 'explore', groupType: 'solo',
    answers: { windFelt: 'light', waveFelt: 'ripple', launchDifficulty: 'easy', crowding: 'quiet', fatigue: 'normal', reasonTags: [] },
    notes: '', weatherSnapshot: null,
  };
}

function formatNumber(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return n.toFixed(digits).replace(/\.0+$/, '');
}

function scoreColor(score) {
  return heatmapColor(score);
}

function scenarioDateLabel(date, time) {
  const parsed = new Date(`${date || '1970-01-01'}T${time || '12:00'}`);
  if (Number.isNaN(parsed.getTime())) return `${date || '-'} ${time || ''}`.trim();
  return parsed.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function seasonFromDate(date) {
  const month = Number(String(date || '').slice(5, 7));
  if (!Number.isFinite(month)) return 'unknown';
  if (month === 12 || month <= 2) return 'winter';
  if (month <= 5) return 'spring';
  if (month <= 8) return 'summer';
  return 'autumn';
}

function timeOfDayFromTime(time) {
  const hour = Number(String(time || '').slice(0, 2));
  if (!Number.isFinite(hour)) return 'unknown';
  if (hour >= 5 && hour < 10) return 'morning';
  if (hour >= 10 && hour < 15) return 'midday';
  if (hour >= 15 && hour < 19) return 'afternoon';
  if (hour >= 19 && hour < 23) return 'evening';
  return 'night';
}

function toFinite(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function beaufortFromKph(kph) {
  const wind = toFinite(kph, 0);
  const scale = [
    [1, 0, 'Calm'], [6, 1, 'Light air'], [12, 2, 'Light breeze'], [20, 3, 'Gentle breeze'],
    [29, 4, 'Moderate breeze'], [39, 5, 'Fresh breeze'], [50, 6, 'Strong breeze'],
    [62, 7, 'Near gale'], [75, 8, 'Gale'], [89, 9, 'Strong gale'],
    [103, 10, 'Storm'], [118, 11, 'Violent storm'], [Infinity, 12, 'Hurricane force'],
  ];
  const [, value, label] = scale.find(([max]) => wind < max) || scale[0];
  return { value, label };
}

function sizeClassFromArea(areaKm2) {
  const area = toFinite(areaKm2);
  if (area === null) return 'unknown';
  if (area < 1) return 'tiny';
  if (area < 10) return 'small';
  if (area < 50) return 'medium';
  if (area < 200) return 'large';
  return 'very large';
}

function factorValue(value, suffix = '', digits = 1) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number') return `${formatNumber(value, digits)}${suffix}`;
  return String(value);
}

function getScienceProfile(weather = {}) {
  const wind = toFinite(weather.wind_kph, 0);
  const gust = toFinite(weather.gust_kph, 0);
  const air = toFinite(weather.temp_c, 0);
  const water = toFinite(weather.estimated_water_temp_c, 0);
  const feels = toFinite(weather.feelslike_c, air);
  const dew = toFinite(weather.dew_point_c);
  const humidity = toFinite(weather.humidity, 0);
  const visibility = toFinite(weather.vis_km, 10);
  const rain = toFinite(weather.precip_mm, 0);
  const wave = toFinite(weather.estimated_wave_height_m, 0);
  const area = toFinite(weather.lake_area_km2);
  const beaufort = beaufortFromKph(wind);
  const gustFactor = wind > 0 ? gust / wind : null;
  const airWaterDelta = air - water;
  const dewSpread = dew === null ? null : air - dew;
  const condition = String(weather.condition || '').toLowerCase();
  const fogSignal = /fog|mist|haze|smoke/.test(condition) || visibility <= 2;
  const daylight = Number(weather.is_day) === 1 ? 'daylight' : 'dark';
  const windWaveExposure = (wind + gust * 0.4) * (wave + 0.01) * (area ? Math.log10(area + 1) : 1);

  const irregularities = [
    fogSignal && { tone: 'warn', text: 'fog/visibility' },
    visibility < 5 && { tone: 'warn', text: 'low visibility' },
    gustFactor !== null && gustFactor >= 2.2 && { tone: 'warn', text: 'gust spike' },
    water <= 10 && { tone: 'bad', text: 'cold-water exposure' },
    rain > 2 && { tone: 'warn', text: 'heavy rain row' },
    Number(weather.will_it_snow) === 1 && { tone: 'bad', text: 'snow signal' },
    area !== null && area >= 50 && { tone: 'blue', text: 'large-lake fetch' },
    beaufort.value >= 5 && { tone: 'warn', text: `B${beaufort.value} ${beaufort.label}` },
    Number(weather.uv) >= 6 && { tone: 'warn', text: 'UV exposure' },
  ].filter(Boolean);

  const factors = [
    ['Air temp', factorValue(air, ' C')], ['Feels like', factorValue(feels, ' C')],
    ['Water temp', factorValue(water, ' C')], ['Air-water delta', factorValue(airWaterDelta, ' C')],
    ['Dew point', factorValue(dew, ' C')], ['Dew spread', factorValue(dewSpread, ' C')],
    ['Humidity', factorValue(humidity, '%', 0)], ['Cloud', factorValue(weather.cloud, '%', 0)],
    ['UV index', factorValue(weather.uv, '', 1)], ['Pressure', factorValue(weather.pressure_mb, ' mb', 0)],
    ['Visibility', factorValue(visibility, ' km')], ['Condition', weather.condition || '-'],
    ['Rain', factorValue(rain, ' mm', 2)], ['Rain flag', Number(weather.will_it_rain) === 1 ? 'yes' : 'no'],
    ['Snow flag', Number(weather.will_it_snow) === 1 ? 'yes' : 'no'],
    ['Wind', factorValue(wind, ' kph')], ['Wind dir', weather.wind_dir || '-'],
    ['Gust', factorValue(gust, ' kph')], ['Beaufort', `B${beaufort.value} ${beaufort.label}`],
    ['Gust factor', gustFactor === null ? '-' : formatNumber(gustFactor, 2)],
    ['Wave height', factorValue(wave, ' m', 2)], ['Wind-wave index', formatNumber(windWaveExposure, 2)],
    ['Daylight', daylight], ['Season intensity', weather.season_intensity || '-'],
    ['Climate zone', weather.climate_zone || '-'], ['Lake area', factorValue(area, ' km2', 2)],
    ['Lake size', weather.lake_size_class || sizeClassFromArea(area)],
    ['Waterbody', weather.waterbody_class || weather.lake_type || '-'],
    ['Base water', weather.base_lake_name || weather.matched_lake_name || '-'],
    ['Latitude', factorValue(weather.latitude, '', 4)], ['Longitude', factorValue(weather.longitude, '', 4)],
    ['Day of year', factorValue(weather.day_of_year, '', 0)],
  ];

  const derived = { gust_factor: gustFactor, wind_wave_exposure: windWaveExposure, air_water_delta: Math.abs(airWaterDelta), dew_spread: dewSpread === null ? 0 : Math.abs(dewSpread) };

  return { beaufort, fogSignal, irregularities, factors, factorCount: factors.length, derived };
}

function getScenarioInsights(weather = {}) {
  const chips = [];
  const wind = Number(weather.wind_kph || 0);
  const gust = Number(weather.gust_kph || 0);
  const water = Number(weather.estimated_water_temp_c || 0);
  const rain = Number(weather.precip_mm || 0);
  const uv = Number(weather.uv || 0);
  const visibility = Number(weather.vis_km || 0);

  if (gust >= 40 || wind >= 25) chips.push({ tone: 'bad', text: 'wind risk' });
  else if (gust >= 28 || wind >= 15) chips.push({ tone: 'warn', text: 'gusty' });
  else chips.push({ tone: 'good', text: 'manageable wind' });

  if (water <= 8) chips.push({ tone: 'bad', text: 'cold water' });
  else if (water <= 15) chips.push({ tone: 'warn', text: 'cool water' });
  else chips.push({ tone: 'good', text: 'warmer water' });

  if (rain > 2) chips.push({ tone: 'warn', text: 'rainy' });
  if (uv >= 6) chips.push({ tone: 'warn', text: 'high UV' });
  return chips.slice(0, 6);
}

function cn(...items) { return items.filter(Boolean).join(' '); }

function averageBy(records, getKey) {
  const groups = new Map();
  for (const record of records) {
    const rating = Number(record.rating);
    if (!Number.isFinite(rating)) continue;
    const key = getKey(record) || 'unknown';
    const current = groups.get(key) || { label: key, count: 0, total: 0 };
    current.count += 1;
    current.total += rating;
    groups.set(key, current);
  }
  return Array.from(groups.values()).map((g) => ({ ...g, average: g.total / g.count })).sort((a, b) => b.count - a.count);
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Visual Components ──────────────────────────────────────────────────────

const TONE_STYLES = {
  neutral: 'border-slate-700 text-slate-300',
  good: 'border-emerald-500/30 bg-emerald-950/40 text-emerald-200',
  warn: 'border-amber-500/30 bg-amber-950/40 text-amber-200',
  bad: 'border-red-500/30 bg-red-950/40 text-red-200',
  blue: 'border-cyan-500/30 bg-cyan-950/40 text-cyan-200',
};

function InsightChip({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'border-slate-700 bg-slate-900/80 text-slate-300',
    good: 'border-emerald-500/30 bg-emerald-950/40 text-emerald-200',
    warn: 'border-amber-500/30 bg-amber-950/40 text-amber-200',
    bad: 'border-red-500/30 bg-red-950/40 text-red-200',
    blue: 'border-cyan-500/30 bg-cyan-950/40 text-cyan-200',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', tones[tone])}>
      {children}
    </span>
  );
}

function Collapsible({ title, icon: Icon, defaultOpen = false, badge, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-900/40 transition">
        <div className="flex items-center gap-2">
          <Icon size={15} className="text-cyan-400" />
          <span className="text-sm font-semibold text-slate-200">{title}</span>
          {badge && <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300">{badge}</span>}
        </div>
        {open ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
      </button>
      {open && <div className="border-t border-slate-800 px-4 py-3">{children}</div>}
    </div>
  );
}

function FilterRow({ label, value, options, onChange }) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-[34px] shrink-0 text-[8px] font-bold uppercase tracking-wider text-slate-600 text-right">{label}</span>
      <div className="flex gap-px">
        {options.map(([id, text]) => (
          <button key={id} type="button" onClick={() => onChange(id)}
            className={cn('rounded px-1.5 py-[3px] text-[10px] font-semibold transition whitespace-nowrap',
              value === id ? 'bg-cyan-400 text-slate-950' : 'text-slate-500 hover:text-cyan-300'
            )}>{text}</button>
        ))}
      </div>
    </div>
  );
}

function DistributionBar({ label, count, total, tone = 'cyan' }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  const colors = { green: 'bg-emerald-400', amber: 'bg-amber-300', red: 'bg-red-400', cyan: 'bg-cyan-300' };
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-[11px]">
        <span className="text-slate-400">{label}</span>
        <span className="tabular text-slate-300">{count} · {pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800">
        <div className={cn('h-1.5 rounded-full', colors[tone] || colors.cyan)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Segment({ value, onChange, options }) {
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(([id, label]) => (
        <button key={id} type="button" onClick={() => onChange(id)}
          className={cn('min-h-9 rounded-md border px-2 text-xs font-medium transition',
            value === id ? 'border-cyan-300 bg-cyan-300 text-slate-950' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
          )}>{label}</button>
      ))}
    </div>
  );
}

function SliderQuestion({ label, value, onChange, left, right }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/60 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-300">{label}</span>
        <span className="tabular text-sm font-bold text-cyan-200">{Number(value).toFixed(1)}</span>
      </div>
      <input type="range" min="1" max="5" step="0.5" value={value}
        onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-cyan-300" />
      <div className="flex justify-between text-[10px] text-slate-600"><span>{left}</span><span>{right}</span></div>
    </div>
  );
}

const UNIT_CONV = {
  temp: { to: (v) => v * 9 / 5 + 32, unit: ['°C', '°F'] },
  speed: { to: (v) => v * 0.621371, unit: [' kph', ' mph'] },
  dist: { to: (v) => v * 0.621371, unit: [' km', ' mi'] },
  precip: { to: (v) => v * 0.0393701, unit: [' mm', ' in'] },
  height: { to: (v) => v * 3.28084, unit: [' m', ' ft'] },
  press: { to: (v) => v * 0.02953, unit: [' mb', ' inHg'] },
  area: { to: (v) => v * 0.386102, unit: [' km²', ' mi²'] },
};

function convVal(v, conv, sys) {
  if (!conv || sys === 'metric') return v;
  return UNIT_CONV[conv]?.to(v) ?? v;
}

function convUnit(conv, fixedUnit, sys) {
  if (!conv) return fixedUnit || '';
  return UNIT_CONV[conv]?.unit[sys === 'imperial' ? 1 : 0] ?? fixedUnit ?? '';
}

const ALL_FACTORS = [
  { key: 'wind_kph', label: 'Wind', max: 40, conv: 'speed', icon: Wind, digits: 0, group: 'Paddle' },
  { key: 'gust_kph', label: 'Gust', max: 50, conv: 'speed', icon: Wind, digits: 0, group: 'Paddle' },
  { key: 'estimated_wave_height_m', label: 'Waves', max: 1.5, conv: 'height', icon: WavesIcon, digits: 2, group: 'Paddle' },
  { key: 'estimated_water_temp_c', label: 'Water', max: 30, conv: 'temp', icon: Droplets, invert: true, digits: 0, group: 'Paddle' },
  { key: 'temp_c', label: 'Air', max: 40, conv: 'temp', icon: Thermometer, invert: true, digits: 0, group: 'Paddle' },
  { key: 'precip_mm', label: 'Rain', max: 10, conv: 'precip', icon: CloudSun, digits: 1, group: 'Paddle' },
  { key: 'uv', label: 'UV', max: 11, unit: '', icon: Eye, digits: 1, group: 'Paddle' },
  { key: 'vis_km', label: 'Vis', max: 10, conv: 'dist', icon: Eye, invert: true, digits: 0, group: 'Paddle' },
  { key: 'feelslike_c', label: 'Feels', max: 45, conv: 'temp', icon: Thermometer, invert: true, digits: 0, group: 'Body' },
  { key: 'humidity', label: 'Humid', max: 100, unit: '%', icon: Droplets, digits: 0, group: 'Body' },
  { key: 'gust_factor', label: 'Gust×', max: 3, unit: '×', icon: Zap, digits: 2, group: 'Body' },
];

const PADDLE_FACTORS = ALL_FACTORS.filter((f) => f.group === 'Paddle');
const FACTOR_GROUPS = ['Paddle', 'Body'];

// Heatmap color scale — matches Forecast page exactly
function heatmapColor(score) {
  const r = parseFloat(score);
  if (r >= 4.5) return '#255a3a';
  if (r >= 4.0) return '#316d43';
  if (r >= 3.5) return '#c59a61';
  if (r >= 3.0) return '#eb8127';
  if (r >= 2.5) return '#bd3b2b';
  if (r >= 2.0) return '#86170f';
  return '#4a0a08';
}
function heatmapBand(score) {
  const r = parseFloat(score);
  if (r >= 4) return { label: 'Worth it', color: '#316d43' };
  if (r >= 3) return { label: 'Careful', color: '#eb8127' };
  return { label: 'Hard pass', color: '#bd3b2b' };
}
function dangerToScore(danger) { return 5 - danger * 4; }

const TOURIST_FACTORS = [
  { key: 'wind_kph', label: 'Wind', max: 40, conv: 'speed', icon: Wind, digits: 0 },
  { key: 'estimated_wave_height_m', label: 'Waves', max: 1.5, conv: 'height', icon: WavesIcon, digits: 2 },
  { key: 'estimated_water_temp_c', label: 'Water', max: 30, conv: 'temp', icon: Droplets, invert: true, digits: 0 },
  { key: 'temp_c', label: 'Air', max: 40, conv: 'temp', icon: Thermometer, invert: true, digits: 0 },
  { key: 'precip_mm', label: 'Rain', max: 10, conv: 'precip', icon: CloudSun, digits: 1 },
  { key: 'uv', label: 'UV', max: 11, unit: '', icon: Eye, digits: 1 },
  { key: 'vis_km', label: 'Vis', max: 10, conv: 'dist', icon: Eye, invert: true, digits: 0 },
  { key: 'humidity', label: 'Humid', max: 100, unit: '%', icon: Droplets, digits: 0 },
  { key: 'cloud', label: 'Cloud', max: 100, unit: '%', icon: CloudSun, digits: 0 },
];

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function getScoreReason(score, weather = {}) {
  const s = parseFloat(score) || 0;
  const wind = toFinite(weather.wind_kph, 0);
  const gust = toFinite(weather.gust_kph, 0);
  const water = toFinite(weather.estimated_water_temp_c, null);
  const rain = toFinite(weather.precip_mm, 0);
  const waves = toFinite(weather.estimated_wave_height_m, 0);
  const vis = toFinite(weather.vis_km, 10);
  const temp = toFinite(weather.temp_c, 20);
  const uv = toFinite(weather.uv, 0);
  const cloud = toFinite(weather.cloud, 50);
  const concerns = [];
  if (wind > 25 || gust > 40) concerns.push('dangerous wind');
  else if (wind > 15) concerns.push('gusty wind');
  if (water !== null && water < 10) concerns.push('cold water — layer up');
  else if (water !== null && water < 15) concerns.push('cool water temps');
  if (waves > 0.8) concerns.push('rough chop');
  else if (waves > 0.4) concerns.push('moderate chop');
  if (rain > 2) concerns.push('heavy rain');
  else if (rain > 0.5) concerns.push('light rain');
  if (vis < 3) concerns.push('poor visibility');
  if (uv >= 8) concerns.push('very high UV');
  if (temp < 3) concerns.push('near-freezing air');
  if (temp > 35) concerns.push('extreme heat');
  const positives = [];
  if (wind <= 10) positives.push('light wind');
  if (vis >= 8 && rain <= 0.5) positives.push('clear conditions');
  if (waves <= 0.3) positives.push('calm water');
  if (water !== null && water >= 18) positives.push('warm water');
  if (rain <= 0.1 && cloud <= 30) positives.push('sunny skies');
  if (s >= 4) {
    const top = positives.slice(0, 2);
    const l1 = top.length >= 2 ? `${cap(top[0])} and ${top[1]}.` : top.length ? `${cap(top[0])}.` : 'Conditions look good overall.';
    const l2 = concerns.length ? `${cap(concerns[0])}.` : 'No major concerns flagged.';
    return [l1, l2];
  }
  if (s >= 3) {
    const l1 = concerns.length ? `${cap(concerns[0])}.` : 'Mixed conditions today.';
    const l2 = positives.length ? `Upside: ${positives[0]}.` : 'Experienced paddlers may manage.';
    return [l1, l2];
  }
  const l1 = concerns.length >= 2 ? `${cap(concerns[0])} and ${concerns[1]}.` : concerns.length ? `${cap(concerns[0])}.` : 'Tough conditions today.';
  return [l1, 'Consider postponing or choose sheltered water.'];
}

function getContextualChips(weather = {}) {
  const chips = [];
  const wind = toFinite(weather.wind_kph, 0);
  const gust = toFinite(weather.gust_kph, 0);
  const water = toFinite(weather.estimated_water_temp_c, null);
  const vis = toFinite(weather.vis_km, 10);
  const rain = toFinite(weather.precip_mm, 0);
  const waves = toFinite(weather.estimated_wave_height_m, 0);
  const uv = toFinite(weather.uv, 0);
  const temp = toFinite(weather.temp_c, 20);
  if (wind > 12 || gust > 20) chips.push(['wind', 'Wind was a factor']);
  if (water !== null && water < 15) chips.push(['cold_water', 'Cold water']);
  if (rain > 0.5) chips.push(['rain', 'Rain/storm']);
  if (waves > 0.3) chips.push(['chop', 'Choppy water']);
  if (uv > 5 || temp > 30) chips.push(['sun', 'Sun/heat exposure']);
  if (vis < 5) chips.push(['low_vis', 'Low visibility']);
  if (wind <= 10 && rain <= 0.5 && waves <= 0.3) chips.push(['calm', 'Calm & pleasant']);
  chips.push(['parking', 'Parking']);
  chips.push(['bathrooms', 'Bathrooms']);
  chips.push(['launch_fee', 'Launch fee']);
  chips.push(['crowded', 'Crowded']);
  return chips;
}

function FactorBar({ label, value, max, unit, conv, invert, icon: Icon, digits = 1, neutral, min = 0, units = 'metric', sub }) {
  const v = Math.max(0, toFinite(value, 0));
  const range = max - min;
  const pct = Math.min(100, Math.max(0, ((v - min) / range) * 100));
  const danger = neutral ? 0.35 : (invert ? Math.max(0, 1 - (v - min) / range) : Math.min(1, (v - min) / range));
  const hue = neutral ? 210 : Math.round(120 * (1 - danger));
  const sat = neutral ? 28 : 48;
  const barColor = `hsl(${hue}, ${sat}%, 38%)`;
  const textColor = `hsl(${hue}, ${neutral ? 22 : 42}%, 56%)`;
  const displayV = convVal(v, conv, units);
  const displayUnit = convUnit(conv, unit, units);

  return (
    <div className="flex items-center gap-2 py-[2px]">
      <div className="flex items-center gap-1 w-[66px] shrink-0">
        <Icon size={11} style={{ color: textColor, opacity: 0.5 }} />
        <span className="text-[10px] font-medium text-slate-500">{label}</span>
      </div>
      <div className="relative flex-1 h-[13px] rounded-[5px] bg-slate-800/40 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-[5px]"
          style={{
            width: `${Math.max(2, pct)}%`,
            background: `linear-gradient(90deg, hsl(${hue}, ${sat - 6}%, 26%), ${barColor})`,
            transition: 'width 0.7s ease-out',
          }}
        />
      </div>
      <div className="flex items-baseline gap-1.5 shrink-0">
        <span className="w-[52px] text-right text-[11px] font-semibold tabular" style={{ color: textColor }}>
          {formatNumber(displayV, digits)}{displayUnit}
        </span>
        <span className="w-[50px] text-[9px] text-slate-600 truncate">{sub || ''}</span>
      </div>
    </div>
  );
}

function TouristRow({ label, value, max, unit, conv, invert, icon: Icon, digits = 1, units = 'metric', min = 0 }) {
  const v = Math.max(0, toFinite(value, 0));
  const range = max - min;
  const pct = Math.min(100, Math.max(0, ((v - min) / range) * 100));
  const danger = invert ? Math.max(0, 1 - (v - min) / range) : Math.min(1, (v - min) / range);
  const score = dangerToScore(danger);
  const color = heatmapColor(score);
  const displayV = convVal(v, conv, units);
  const displayUnit = convUnit(conv, unit, units);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 70px', gap: '12px', alignItems: 'center' }}>
      <div className="flex items-center gap-2">
        <Icon size={14} style={{ color, opacity: 0.6 }} />
        <span className="text-[13px] font-medium text-[#a09080]" style={{ fontFamily: "'Josefin Sans', sans-serif" }}>{label}</span>
      </div>
      <div className="relative h-[6px] rounded-full bg-[#1a1714] overflow-hidden">
        <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700" style={{ width: `${Math.max(3, pct)}%`, background: color }} />
      </div>
      <span className="text-[13px] font-semibold text-right" style={{ color, fontVariantNumeric: 'tabular-nums' }}>
        {formatNumber(displayV, digits)}{displayUnit}
      </span>
    </div>
  );
}

function ScoreRing({ score, size = 120, label }) {
  const s = Math.min(5, Math.max(0, parseFloat(score) || 0));
  const r = 42, cx = 60, cy = 60;
  const circ = 2 * Math.PI * r;
  const fill = (s / 5) * circ;
  const band = heatmapBand(s);
  const hlLen = fill * 0.35;
  const spring = 'stroke-dasharray 0.8s cubic-bezier(0.34,1.56,0.64,1), stroke 0.3s ease';
  return (
    <div className="flex flex-col items-center">
      <div className="text-[9px] font-bold uppercase tracking-[0.15em] mb-2" style={{ fontFamily: "'Josefin Sans', sans-serif", color: 'rgba(106,90,74,0.7)' }}>{label}</div>
      <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 120 120">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={12} />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={band.color} strokeWidth={20}
            strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ opacity: 0.12, transition: spring }} />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={band.color} strokeWidth={8}
            strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: spring }} />
          {fill > 0 && (
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={2.5}
              strokeDasharray={`${hlLen} ${circ - hlLen}`} strokeLinecap="round"
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: spring }} />
          )}
          <circle cx={cx} cy={cy} r={r - 10} fill="white" fillOpacity="0.02" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color: band.color, fontFamily: "'Josefin Sans', sans-serif", textShadow: `0 0 20px ${band.color}25` }}>
            {s.toFixed(1)}
          </span>
          <span className="text-[9px]" style={{ color: 'rgba(106,90,74,0.5)' }}> </span>
        </div>
      </div>
      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1"
        style={{ background: `${band.color}10`, border: `1px solid ${band.color}20`, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: band.color, boxShadow: `0 0 6px ${band.color}50` }} />
        <span className="text-[10px] font-semibold" style={{ color: band.color, fontFamily: "'Josefin Sans', sans-serif" }}>
          {band.label}
        </span>
      </div>
    </div>
  );
}

function RatingDial({ value, onChange, size = 120, label }) {
  const svgRef = useRef(null);
  const dragging = useRef(false);
  const lastVib = useRef(null);
  const [active, setActive] = useState(false);
  const [touched, setTouched] = useState(false);

  const s = Math.min(5, Math.max(1, parseFloat(value) || 3));
  const r = 42, cx = 60, cy = 60;
  const circ = 2 * Math.PI * r;
  const fill = (s / 5) * circ;
  const band = heatmapBand(s);
  const thumbAngle = ((s / 5) * 360 - 90) * (Math.PI / 180);
  const tx = cx + r * Math.cos(thumbAngle);
  const ty = cy + r * Math.sin(thumbAngle);

  const scoreFromPointer = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return 3;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 120;
    const py = ((e.clientY - rect.top) / rect.height) * 120;
    let angle = Math.atan2(py - cy, px - cx) * (180 / Math.PI);
    angle = (angle + 90 + 360) % 360;
    const raw = (angle / 360) * 5;
    return Math.max(1, Math.min(5, Math.round(raw * 2) / 2));
  }, []);

  const update = useCallback((e) => {
    const v = scoreFromPointer(e);
    onChange(v);
    if (v !== lastVib.current) {
      lastVib.current = v;
      try { navigator.vibrate?.(10); } catch {}
    }
  }, [scoreFromPointer, onChange]);

  useEffect(() => {
    const move = (e) => { if (dragging.current) update(e); };
    const up = () => { dragging.current = false; setActive(false); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [update]);

  const ticks = [1, 2, 3, 4, 5].map((tick) => {
    const a = ((tick / 5) * 360 - 90) * (Math.PI / 180);
    return { tick, x: cx + (r + 14) * Math.cos(a), y: cy + (r + 14) * Math.sin(a), lit: s >= tick };
  });

  return (
    <div className="flex flex-col items-center">
      <div className="text-[9px] font-bold uppercase tracking-[0.15em] mb-2" style={{ fontFamily: "'Josefin Sans', sans-serif", color: 'rgba(106,90,74,0.7)' }}>{label}</div>
      <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <svg ref={svgRef} width={size} height={size} viewBox="0 0 120 120"
          style={{ touchAction: 'none', cursor: 'pointer', overflow: 'visible' }}
          onPointerDown={(e) => { dragging.current = true; setActive(true); if (!touched) setTouched(true); update(e); }}>
          <rect x="0" y="0" width="120" height="120" fill="transparent" pointerEvents="all" />

          {ticks.map(({ tick, x, y, lit }) => (
            <circle key={tick} cx={x} cy={y} r={2} fill={lit ? band.color : 'rgba(255,255,255,0.08)'}
              fillOpacity={lit ? 0.5 : 1} style={{ transition: 'fill 0.3s ease' }} />
          ))}

          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={band.color} strokeWidth={8}
            strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: 'stroke 0.2s ease' }} />
          <circle cx={tx} cy={ty} r={active ? 13 : 11} fill="white" fillOpacity={0.95}
            stroke={band.color} strokeWidth={2.5}
            style={{ transition: 'all 0.15s ease' }} />
          <circle cx={tx} cy={ty} r={3.5} fill={band.color} fillOpacity={0.7} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className={active ? 'text-4xl' : 'text-3xl'} style={{ fontWeight: 700, color: band.color, fontFamily: "'Josefin Sans', sans-serif", transition: 'all 0.15s ease' }}>
            {s.toFixed(1)}
          </span>
          {!touched && (
            <span className="text-[8px] mt-1 uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.2)', fontFamily: "'Josefin Sans', sans-serif" }}>
              drag to rate
            </span>
          )}
        </div>
      </div>
      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1"
        style={{ background: `${band.color}10`, border: `1px solid ${band.color}20`, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: band.color }} />
        <span className="text-[10px] font-semibold" style={{ color: band.color, fontFamily: "'Josefin Sans', sans-serif" }}>
          {band.label}
        </span>
      </div>
    </div>
  );
}

function ResetModal({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-red-500/40 bg-slate-950 p-6 shadow-2xl">
        <div className="flex items-center gap-3 text-red-400">
          <AlertTriangle size={24} />
          <h3 className="text-lg font-bold text-white">Reset All Training Data</h3>
        </div>
        <p className="mt-3 text-sm text-slate-400">
          This will clear all {' '}<strong className="text-white">ratings, labels, and model progress</strong>.
          A backup will be saved automatically. This cannot be undone from the UI.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800">Cancel</button>
          <button type="button" onClick={onConfirm} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500">Reset Everything</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function PaddleTrainer() {
  const didAutoGenerate = useRef(false);
  const [mode, setMode] = useState(import.meta.env.DEV ? 'admin' : 'tourist');
  const deepLinkedLake = useMemo(() => new URLSearchParams(window.location.search).get('lake'), []);
  const [showReset, setShowReset] = useState(false);
  const [status, setStatus] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [draft, setDraft] = useState(createDraft);
  const [lakeQuery, setLakeQuery] = useState('Lake Tahoe');
  const [lakeFocused, setLakeFocused] = useState(false);
  const [lakeOptions, setLakeOptions] = useState([]);
  const [weatherState, setWeatherState] = useState({ loading: false, error: '' });
  const [saveState, setSaveState] = useState({ loading: false, message: '' });
  const [scenarioState, setScenarioState] = useState({ loading: false, error: '', queue: [], index: -1 });
  const [scenarioFilters, setScenarioFilters] = useState({ lakeSource: 'priority', season: 'any', timeOfDay: 'any', bucket: 'balanced', lakeSize: 'any', count: 20 });
  const [adminPrefs, setAdminPrefs] = useState({ rejected: [], watchlist: [], visits: [] });
  const [modelOptions, setModelOptions] = useState({ includeHumanContext: true, includeNotes: true });
  const [modelResult, setModelResult] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [showFactors, setShowFactors] = useState(false);

  // Tourist mode state
  const [touristLakes, setTouristLakes] = useState([]);
  const [touristSelectedLake, setTouristSelectedLake] = useState(null);
  const [touristWeather, setTouristWeather] = useState(null);
  const [touristWeatherLoading, setTouristWeatherLoading] = useState(false);
  const [touristDate, setTouristDate] = useState('now');
  const [touristShowDatePicker, setTouristShowDatePicker] = useState(false);
  const [touristRated, setTouristRated] = useState(false);
  const [touristNotes, setTouristNotes] = useState('');
  const [touristTags, setTouristTags] = useState([]);
  const [gpsState, setGpsState] = useState({ loading: false, error: '', lat: null, lng: null });
  const [touristNotFound, setTouristNotFound] = useState(false);
  const [units, setUnits] = useState('metric');
  const [lastRating, setLastRating] = useState(null);
  const [spotDetail, setSpotDetail] = useState(null);
  const [sliderValue, setSliderValue] = useState(3);
  const [dialTouched, setDialTouched] = useState(false);
  const lastVibratedRef = useRef(null);

  const uniqueLakes = useMemo(() => new Set(ratings.map((r) => r.lake).filter(Boolean)).size, [ratings]);
  const interviewLabels = useMemo(() => ratings.filter((r) => r.labelSource === 'scenario_interview').length, [ratings]);
  const notesCount = useMemo(() => ratings.filter((r) => r.notes?.trim()).length, [ratings]);
  const ratingCounts = useMemo(() => {
    const c = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of ratings) { const k = Math.round(Number(r.rating)); if (c[k] !== undefined) c[k] += 1; }
    return c;
  }, [ratings]);
  const bucketCounts = useMemo(() => {
    const c = {};
    for (const r of ratings) { const b = r.scenarioBucket || 'unknown'; c[b] = (c[b] || 0) + 1; }
    return c;
  }, [ratings]);
  const patternRows = useMemo(() => ({
    bucket: averageBy(ratings, (r) => r.scenarioBucket || 'unknown').slice(0, 5),
    season: averageBy(ratings, (r) => r.weatherSnapshot?.season || seasonFromDate(r.date)).slice(0, 5),
    time: averageBy(ratings, (r) => timeOfDayFromTime(r.time)).slice(0, 5),
    size: averageBy(ratings, (r) => r.weatherSnapshot?.lake_size_class || sizeClassFromArea(r.weatherSnapshot?.lake_area_km2)).slice(0, 5),
  }), [ratings]);
  const coverage = useMemo(() => {
    const cells = {};
    const axisCounts = { season: {}, bucket: {}, size: {} };
    let unknownSize = 0;
    for (const ax of Object.keys(COVERAGE_AXES)) for (const v of COVERAGE_AXES[ax]) { axisCounts[ax][v] = 0; }
    for (const r of ratings) {
      const s = r.weatherSnapshot?.season || seasonFromDate(r.date);
      const b = r.scenarioBucket || 'unknown';
      const sz = r.weatherSnapshot?.lake_size_class || sizeClassFromArea(r.weatherSnapshot?.lake_area_km2);
      if (s) axisCounts.season[s] = (axisCounts.season[s] || 0) + 1;
      if (b) axisCounts.bucket[b] = (axisCounts.bucket[b] || 0) + 1;
      if (sz === 'unknown') { unknownSize += 1; continue; }
      if (sz) axisCounts.size[sz] = (axisCounts.size[sz] || 0) + 1;
      const key = `${s}|${b}|${sz}`;
      cells[key] = (cells[key] || 0) + 1;
    }
    const gaps = [];
    for (const s of COVERAGE_AXES.season) {
      for (const b of COVERAGE_AXES.bucket) {
        for (const sz of COVERAGE_AXES.size) {
          const key = `${s}|${b}|${sz}`;
          if (!cells[key]) gaps.push({ season: s, bucket: b, size: sz });
        }
      }
    }
    const total = COVERAGE_AXES.season.length * COVERAGE_AXES.bucket.length * COVERAGE_AXES.size.length;
    const filled = total - gaps.length;
    return { axisCounts, gaps, filled, total, unknownSize, pct: total ? Math.round((filled / total) * 100) : 0 };
  }, [ratings]);

  const focusTargets = useMemo(() => {
    const targets = WEATHER_BUCKETS.map((b) => ({ label: b, count: bucketCounts[b] || 0 }))
      .sort((a, b) => a.count - b.count).slice(0, 3).map((i) => i.label);
    const positive = (ratingCounts[4] || 0) + (ratingCounts[5] || 0);
    if (ratings.length > 20 && positive / ratings.length < 0.25) targets.push('more 4-5 days');
    return targets.slice(0, 4);
  }, [bucketCounts, ratingCounts, ratings.length]);

  useEffect(() => {
    let alive = true;
    async function loadInitial() {
      try {
        const [statusRes, ratingsRes, prefsRes] = await Promise.all([
          fetch(`${API_ROOT}/status`), fetch(`${API_ROOT}/ratings`),
          fetch(`${API_ROOT}/priority-lakes`).catch(() => null),
        ]);
        if (prefsRes?.ok) { const d = await prefsRes.json(); if (alive && d.prefs) setAdminPrefs(d.prefs); }
        if (statusRes.ok) { const d = await statusRes.json(); if (alive) setStatus(d); }
        if (ratingsRes.ok) {
          const d = await ratingsRes.json();
          if (alive) { setRatings(d.records || []); localStorage.setItem('paddleTrainerRatings', JSON.stringify(d.records || [])); }
        } else { throw new Error('unavailable'); }
      } catch {
        const cached = JSON.parse(localStorage.getItem('paddleTrainerRatings') || '[]');
        if (alive) { setRatings(cached); setStatus((c) => c || { apiAvailable: false }); }
      }
    }
    loadInitial();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (didAutoGenerate.current) return;
    didAutoGenerate.current = true;
    generateScenarios();
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_ROOT}/lakes?q=${encodeURIComponent(lakeQuery)}`);
        if (res.ok) { const d = await res.json(); setLakeOptions(d.lakes || []); }
      } catch { setLakeOptions([]); }
    }, 180);
    return () => clearTimeout(t);
  }, [lakeQuery]);

  useEffect(() => { setModelResult(trainPersonalPaddleModel(ratings, modelOptions)); }, [ratings, modelOptions]);
  useEffect(() => {
    if (modelResult?.ready) setPrediction(predictWithPersonalModel(modelResult.model, draft));
    else setPrediction(null);
  }, [draft, modelResult]);

  useEffect(() => {
    if (!saveState.message) return;
    const t = setTimeout(() => setSaveState((c) => ({ ...c, message: '' })), 2500);
    return () => clearTimeout(t);
  }, [saveState.message]);

  const filterKey = `${scenarioFilters.lakeSource}|${scenarioFilters.season}|${scenarioFilters.timeOfDay}|${scenarioFilters.bucket}|${scenarioFilters.lakeSize}`;
  const prevFilterKey = useRef(filterKey);
  useEffect(() => {
    if (prevFilterKey.current !== filterKey) {
      prevFilterKey.current = filterKey;
      generateScenarios(scenarioFilters.count, scenarioFilters);
    }
  }, [filterKey]);

  useEffect(() => {
    function handleKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (mode !== 'admin') return;
      const key = e.key;
      if (key >= '1' && key <= '5' && scenarioState.queue.length) {
        e.preventDefault();
        answerScenario(Number(key));
      } else if ((key === 'n' || key === 'N') && scenarioState.queue.length) {
        e.preventDefault();
        advanceScenario();
      } else if (key === 'z' && (e.metaKey || e.ctrlKey) && lastRating) {
        e.preventDefault();
        undoLastRating();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mode, scenarioState.queue.length, lastRating]);

  function undoLastRating() {
    if (!lastRating) return;
    deleteRating(lastRating.id);
    setLastRating(null);
    setSaveState({ loading: false, message: 'Undone' });
    if (scenarioState.index > 0) {
      const prev = scenarioState.index - 1;
      setScenarioState((c) => ({ ...c, index: prev }));
      applyScenario(scenarioState.queue[prev]);
    }
  }

  function updateDraft(key, value) { setDraft((c) => ({ ...c, [key]: value })); }
  function updateAnswer(key, value) { setDraft((c) => ({ ...c, answers: { ...c.answers, [key]: value } })); }
  function toggleReasonTag(tag) {
    setDraft((c) => {
      const tags = c.answers?.reasonTags || [];
      return { ...c, answers: { ...c.answers, reasonTags: tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag] } };
    });
  }
  function updateWeather(key, value) {
    setDraft((c) => ({ ...c, weatherSnapshot: { ...(c.weatherSnapshot || {}), [key]: value === '' ? '' : Number(value) } }));
  }

  async function loadWeather() {
    if (!draft.lake || !draft.date || !draft.time) return;
    setWeatherState({ loading: true, error: '' });
    try {
      const p = new URLSearchParams({ lake: draft.lake, date: draft.date, time: draft.time });
      const res = await fetch(`${API_ROOT}/weather?${p}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Not found');
      setDraft((c) => ({ ...c, weatherSnapshot: d.weather }));
      setWeatherState({ loading: false, error: '' });
    } catch (e) { setWeatherState({ loading: false, error: e.message }); }
  }

  function applyScenario(scenario) {
    setDraft((c) => ({
      ...c, labelSource: 'scenario_interview', scenarioId: scenario.id, scenarioBucket: scenario.bucket,
      scenarioSeason: scenario.season, scenarioTimeOfDay: scenario.timeOfDay,
      sourceCsv: scenario.sourceCsv, sourceRowNumber: scenario.sourceRowNumber, sourceKind: scenario.sourceKind,
      lake: scenario.lake, lakeDisplayName: scenario.lakeDisplayName, date: scenario.date, time: scenario.time,
      notes: '', weatherSnapshot: scenario.weather,
    }));
    setLakeQuery(scenario.lakeDisplayName);
    setWeatherState({ loading: false, error: '' });
  }

  async function generateScenarios(count = scenarioFilters.count, filters = scenarioFilters) {
    setScenarioState((c) => ({ ...c, loading: true, error: '' }));
    try {
      const p = new URLSearchParams({
        count: String(count), region: 'USA', season: filters.season,
        timeOfDay: filters.timeOfDay, bucket: filters.bucket, lakeSource: filters.lakeSource || 'all',
        lakeSize: filters.lakeSize || 'any',
      });
      if (coverage.gaps.length && filters.bucket === 'balanced' && filters.season === 'any' && filters.lakeSize === 'any') {
        const topGaps = coverage.gaps.slice(0, 20).map((g) => `${g.season}|${g.bucket}|${g.size}`);
        p.set('gaps', topGaps.join(','));
      }
      const res = await fetch(`${API_ROOT}/scenarios?${p}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      const queue = d.scenarios || [];
      setScenarioState({ loading: false, error: queue.length ? '' : 'No matching rows. Loosen filters or shuffle again.', queue, index: queue.length ? 0 : -1 });
      if (queue.length) applyScenario(queue[0]);
    } catch (e) { setScenarioState((c) => ({ ...c, loading: false, error: e.message })); }
  }

  function advanceScenario() {
    if (!scenarioState.queue.length) return;
    const next = scenarioState.index + 1;
    if (next >= scenarioState.queue.length) {
      generateScenarios();
      return;
    }
    setScenarioState((c) => ({ ...c, index: next }));
    applyScenario(scenarioState.queue[next]);
  }

  async function adminLakeAction(action, lakeId) {
    try {
      const res = await fetch(`${API_ROOT}/admin-prefs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, lakeId }),
      });
      if (res.ok) { const d = await res.json(); setAdminPrefs(d.prefs); }
    } catch {}
  }

  function openMap(lat, lng) { window.open(`https://www.google.com/maps/@${lat},${lng},14z`, '_blank'); }

  async function saveRating(overrides = {}) {
    setSaveState({ loading: true, message: '' });
    const next = { ...draft, ...overrides, answers: { ...draft.answers, ...(overrides.answers || {}) } };
    const record = {
      ...next, id: crypto.randomUUID(), rating: Number(next.rating), safetyRating: Number(next.safetyRating),
      enjoymentRating: Number(next.enjoymentRating), confidence: Number(next.confidence),
      durationMinutes: Number(next.durationMinutes), createdAt: new Date().toISOString(),
      ratingMode: mode, gpsLat: gpsState.lat, gpsLng: gpsState.lng,
    };
    try {
      const res = await fetch(`${API_ROOT}/ratings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      const saved = d.record || record;
      const all = [saved, ...ratings];
      setRatings(all);
      setLastRating(saved);
      localStorage.setItem('paddleTrainerRatings', JSON.stringify(all));
      setSaveState({ loading: false, message: `Saved ${record.rating}/5` });
      if (record.labelSource === 'scenario_interview') advanceScenario();
    } catch {
      const all = [record, ...ratings];
      setRatings(all);
      setLastRating(record);
      localStorage.setItem('paddleTrainerRatings', JSON.stringify(all));
      setSaveState({ loading: false, message: `Saved ${record.rating}/5 locally` });
      if (record.labelSource === 'scenario_interview') advanceScenario();
    }
  }

  function answerScenario(value) {
    saveRating({
      rating: value, safetyRating: value <= 2 ? value : Math.max(3, value),
      enjoymentRating: value, confidence: Math.max(Number(draft.confidence || 3), 3), wouldPaddleAgain: value >= 4,
    });
  }

  async function deleteRating(id) {
    const next = ratings.filter((r) => r.id !== id);
    setRatings(next);
    localStorage.setItem('paddleTrainerRatings', JSON.stringify(next));
    try { await fetch(`${API_ROOT}/ratings/${encodeURIComponent(id)}`, { method: 'DELETE' }); } catch {}
  }

  async function resetTraining() {
    try {
      const res = await fetch(`${API_ROOT}/reset-training`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'RESET' }),
      });
      if (res.ok) {
        setRatings([]);
        localStorage.removeItem('paddleTrainerRatings');
        setModelResult(null);
        setPrediction(null);
        setShowReset(false);
        setSaveState({ loading: false, message: 'Training data reset. Backup saved on server.' });
        generateScenarios();
      }
    } catch (e) { setSaveState({ loading: false, message: `Reset failed: ${e.message}` }); }
  }

  function selectLake(lake) {
    setDraft((c) => ({ ...c, lake: lake.id, lakeDisplayName: lake.name }));
    setLakeQuery(lake.name);
    setLakeFocused(false);
  }

  function requestGPS() {
    if (!navigator.geolocation) { setGpsState({ loading: false, error: 'GPS not available', lat: null, lng: null }); return; }
    setGpsState({ loading: true, error: '', lat: null, lng: null });
    navigator.geolocation.getCurrentPosition(
      (pos) => setGpsState({ loading: false, error: '', lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setGpsState({ loading: false, error: err.message, lat: null, lng: null }),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // Tourist: fetch production lakes, auto-select if ?lake= param present
  useEffect(() => {
    fetch(`${API_ROOT}/tourist-lakes`).then((r) => r.json()).then((d) => {
      const lakes = d.lakes || [];
      setTouristLakes(lakes);
      if (deepLinkedLake && !touristSelectedLake) {
        const match = lakes.find((l) => l.id === deepLinkedLake);
        if (match) setTouristSelectedLake(match);
        else setTouristNotFound(true);
      }
    }).catch(() => { if (deepLinkedLake) setTouristNotFound(true); });
  }, []);

  // Deep-link: fetch full spot detail (images, subtitle) from main paddlingOut API
  useEffect(() => {
    if (!deepLinkedLake) return;
    const base = import.meta.env.DEV ? '/api' : '/api';
    fetch(`${base}/paddlingOut/${encodeURIComponent(deepLinkedLake)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          setSpotDetail(d);
          const ps = d?.paddleScore?.rating;
          if (ps != null) setSliderValue(Math.round(parseFloat(ps) * 2) / 2 || 3);
        }
      })
      .catch(() => {});
  }, [deepLinkedLake]);

  // Tourist: fetch weather when lake or date changes
  useEffect(() => {
    if (!touristSelectedLake) return;
    setTouristWeatherLoading(true);
    setTouristRated(false);
    setDialTouched(false);
    const params = new URLSearchParams({ lake: touristSelectedLake.id, lat: touristSelectedLake.lat, lng: touristSelectedLake.lng });
    if (touristDate !== 'now') params.set('date', touristDate);
    fetch(`${API_ROOT}/tourist-weather?${params}`)
      .then((r) => r.json())
      .then((d) => { setTouristWeather(d.weather || null); setTouristWeatherLoading(false); })
      .catch(() => { setTouristWeather(null); setTouristWeatherLoading(false); });
  }, [touristSelectedLake, touristDate]);

  function touristToggleTag(tag) {
    setTouristTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  }

  async function touristRate(value) {
    if (!touristSelectedLake) return;
    setSaveState({ loading: true, message: '' });
    const record = {
      id: crypto.randomUUID(), labelSource: 'tourist_rating', ratingMode: 'tourist',
      lake: touristSelectedLake.id, lakeDisplayName: touristSelectedLake.name,
      date: touristDate === 'now' ? todayKey() : touristDate,
      time: touristDate === 'now' ? nowHour() : '12:00',
      rating: value, safetyRating: value <= 2 ? value : Math.max(3, value),
      enjoymentRating: value, confidence: 3, wouldPaddleAgain: value >= 4,
      notes: touristNotes, answers: { reasonTags: touristTags },
      weatherSnapshot: touristWeather, gpsLat: gpsState.lat, gpsLng: gpsState.lng,
      createdAt: new Date().toISOString(),
    };
    try {
      const res = await fetch(`${API_ROOT}/ratings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record) });
      const d = await res.json();
      const all = [d.record || record, ...ratings];
      setRatings(all);
      localStorage.setItem('paddleTrainerRatings', JSON.stringify(all));
    } catch {
      setRatings((prev) => { const all = [record, ...prev]; localStorage.setItem('paddleTrainerRatings', JSON.stringify(all)); return all; });
    }
    setTouristRated(true);
    setTouristNotes('');
    setTouristTags([]);
    setSaveState({ loading: false, message: '' });
  }

  const weather = draft.weatherSnapshot || {};
  const science = getScienceProfile(weather);
  const factorData = { ...weather, ...science.derived };
  const selectedReasonTags = draft.answers?.reasonTags || [];
  const insights = [...getScenarioInsights(weather), ...science.irregularities].slice(0, 8);
  const factorSubs = {
    wind_kph: [weather.wind_dir, `B${science.beaufort.value}`].filter(Boolean).join(' · '),
    gust_kph: science.derived.gust_factor !== null ? `${formatNumber(science.derived.gust_factor, 1)}×` : '',
    estimated_water_temp_c: `Feels ${formatNumber(convVal(toFinite(weather.feelslike_c, 0), 'temp', units), 0)}${convUnit('temp', '', units)}`,
    temp_c: weather.condition || '',
  };
  const contextChips = [
    Number(weather.is_day) === 1 ? 'Daylight' : 'Night',
    Number(weather.will_it_rain) === 1 && 'Rain expected',
    Number(weather.will_it_snow) === 1 && 'Snow expected',
    weather.season_intensity, weather.climate_zone,
    weather.lake_size_class || sizeClassFromArea(toFinite(weather.lake_area_km2)),
    weather.waterbody_class || weather.lake_type,
  ].filter(Boolean).filter((v) => v !== 'unknown' && v !== '-');
  const modelExport = modelResult?.ready ? JSON.stringify({ model: modelResult.model, metrics: modelResult.validation }, null, 2) : '';


  // ── RENDER ─────────────────────────────────────────────────────────────────

  const isAdmin = mode === 'admin';
  const tw = touristWeather || {};
  const touristHasWeather = tw.temp_c !== undefined;
  const showWeather = isAdmin
    ? scenarioState.queue.length > 0
    : (touristSelectedLake && touristHasWeather && !touristWeatherLoading);
  const showRate = isAdmin
    ? scenarioState.queue.length > 0
    : (touristSelectedLake && touristHasWeather && !touristWeatherLoading && !touristRated);

  const touristScience = !isAdmin && touristHasWeather ? getScienceProfile(tw) : null;
  const touristFactorData = touristScience ? { ...tw, ...touristScience.derived } : tw;
  const touristSubs = touristScience ? {
    wind_kph: [tw.wind_dir, `B${touristScience.beaufort.value}`].filter(Boolean).join(' · '),
    gust_kph: touristScience.derived.gust_factor !== null ? `${formatNumber(touristScience.derived.gust_factor, 1)}×` : '',
    estimated_water_temp_c: `Feels ${formatNumber(convVal(toFinite(tw.feelslike_c, 0), 'temp', units), 0)}${convUnit('temp', '', units)}`,
    temp_c: tw.condition || '',
  } : {};

  const heroImg = spotDetail?.imgSrc?.[0] || null;
  const spotSubtitle = spotDetail?.subtitle || touristSelectedLake?.region || '';
  const isDeepLinked = !!deepLinkedLake;
  const kaaykoScore = spotDetail?.paddleScore?.rating ?? null;

  const touristChips = !isAdmin && touristHasWeather ? getContextualChips(tw) : [];
  const roundedKaayko = kaaykoScore != null ? Math.round(parseFloat(kaaykoScore) * 2) / 2 || 3 : null;
  const ratingDiffers = roundedKaayko != null && Math.abs(sliderValue - roundedKaayko) > 0.01;
  const canSubmit = ratingDiffers || touristTags.length > 0 || (kaaykoScore == null && dialTouched);
  const scoreReason = kaaykoScore != null ? getScoreReason(kaaykoScore, tw) : ['', ''];

  return (
    <div className="min-h-screen bg-[#0c0f0f] text-slate-100 flex flex-col">
      {showReset && <ResetModal onConfirm={resetTraining} onCancel={() => setShowReset(false)} />}

      {/* ── Tourist deep-link: Hero image ──────────────────────────── */}
      {!isAdmin && isDeepLinked && heroImg && (
        <div className="relative w-full" style={{ height: 'clamp(180px, 28vh, 260px)' }}>
          <img src={heroImg} alt={touristSelectedLake?.name || ''} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c0f0f] via-[#0c0f0f]/40 to-transparent" />
          <button type="button" onClick={() => window.location.href = '/paddlingout'}
            className="absolute top-4 left-4 flex items-center justify-center w-9 h-9 rounded-full bg-black/40 backdrop-blur text-white/80 hover:text-white transition z-10">
            <ArrowLeft size={18} />
          </button>
          <div className="absolute bottom-4 left-5 right-5 z-10">
            <h1 className="text-2xl font-semibold tracking-wide text-white uppercase" style={{ fontFamily: "'Josefin Sans', sans-serif", letterSpacing: '0.06em' }}>
              {touristSelectedLake?.name || ''}
            </h1>
            {spotSubtitle && (
              <p className="text-sm text-white/60 italic mt-0.5" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{spotSubtitle}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Tourist deep-link without image: minimal header ────────── */}
      {!isAdmin && isDeepLinked && !heroImg && !touristNotFound && (
        <div className="relative bg-gradient-to-b from-[#181c1c] to-[#0c0f0f] px-5 pt-5 pb-4">
          <button type="button" onClick={() => window.location.href = '/paddlingout'}
            className="absolute top-4 left-4 flex items-center justify-center w-9 h-9 rounded-full bg-black/40 text-white/80 hover:text-white transition">
            <ArrowLeft size={18} />
          </button>
          <div className="text-center pt-6">
            <h1 className="text-xl font-semibold tracking-wide text-white uppercase" style={{ fontFamily: "'Josefin Sans', sans-serif" }}>
              {touristSelectedLake?.name || 'Loading...'}
            </h1>
            {spotSubtitle && <p className="text-sm text-white/50 italic mt-0.5" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{spotSubtitle}</p>}
          </div>
        </div>
      )}

      {/* ── Tourist deep-link: lake not found ───────────────────────── */}
      {!isAdmin && isDeepLinked && touristNotFound && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
          <div className="text-5xl mb-4 opacity-40">🏔</div>
          <h2 className="text-lg font-semibold tracking-wide uppercase mb-2"
            style={{ fontFamily: "'Josefin Sans', sans-serif", color: '#d9bd7b' }}>
            Spot Not Found
          </h2>
          <p className="text-sm max-w-xs mb-8"
            style={{ fontFamily: "'Cormorant Garamond', serif", color: 'rgba(255,255,255,0.5)' }}>
            We don't have data for "<span className="text-white/70">{deepLinkedLake}</span>." It may have been removed or the link is incorrect.
          </p>
          <a href="/paddlingout"
            className="rounded-full border py-3 px-8 text-sm font-bold uppercase tracking-wider transition hover:bg-[#d9bd7b]/10"
            style={{ fontFamily: "'Josefin Sans', sans-serif", borderColor: '#d9bd7b', borderWidth: '1.5px', color: '#d9bd7b', letterSpacing: '0.12em', textDecoration: 'none' }}>
            Browse All Spots
          </a>
        </div>
      )}

      {/* ── Admin / non-deep-linked header ─────────────────────────── */}
      {(isAdmin || !isDeepLinked) && (
        <div className="border-b border-slate-800/30 bg-[#071317]/80 backdrop-blur">
          <div className={cn('mx-auto flex items-center justify-between px-4 py-2.5', isAdmin ? 'max-w-lg' : 'max-w-md')}>
            <div className="flex items-center gap-2">
              <WavesIcon size={14} className={isAdmin ? 'text-cyan-300' : 'text-[#d9bd7b]'} />
              <span className={cn('text-[11px] font-bold uppercase tracking-[0.15em]', isAdmin ? 'text-cyan-300' : 'text-[#d9bd7b]')}>
                {isAdmin ? 'Paddle Trainer' : 'Paddling Out'}
              </span>
              {isAdmin && (
                <span className="text-[10px] text-slate-600 ml-1 hidden sm:inline">
                  {ratings.length} · {uniqueLakes} lakes · MAE {modelResult?.ready ? formatNumber(modelResult.validation.mae, 2) : '—'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {import.meta.env.DEV && (
                <div className="flex rounded-md border border-slate-700/50 overflow-hidden">
                  {[['tourist', 'Tourist'], ['admin', 'Admin']].map(([m, l]) => (
                    <button key={m} type="button" onClick={() => setMode(m)}
                      className={cn('px-2.5 py-1 text-[10px] font-bold transition',
                        mode === m ? 'bg-cyan-400 text-slate-950' : 'text-slate-500 hover:text-slate-300')}>
                      {l}
                    </button>
                  ))}
                </div>
              )}
              {isAdmin && (
                <button type="button" onClick={() => setShowReset(true)} title="Reset training data"
                  className="rounded-md border border-slate-700/40 p-1.5 text-slate-600 hover:border-red-500/50 hover:text-red-400 transition">
                  <RotateCcw size={12} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={cn('mx-auto px-4 space-y-4 flex-1', isAdmin ? 'max-w-lg py-6' : 'max-w-md md:max-w-[1100px]', !isAdmin && isDeepLinked ? 'py-4' : 'py-6')}>

        {/* Tourist non-deep-linked: Title */}
        {!isAdmin && !isDeepLinked && (
          <div className="text-center -mt-1">
            <h1 className="text-xl font-bold text-white">Rate Your Paddle</h1>
          </div>
        )}

        {/* Admin: Filter bar */}
        {isAdmin && (
          <div className="rounded-xl border border-slate-800/50 bg-slate-950/40 px-2 py-1.5">
            <div className="flex flex-wrap items-center gap-x-0.5 gap-y-0.5">
              {Object.entries(SCENARIO_FILTERS).map(([key, opts], i) => (
                <div key={key} className="flex items-center">
                  {i > 0 && <span className="text-slate-700 mx-0.5 text-[10px]">·</span>}
                  <div className="flex gap-px">
                    {opts.map(([id, text]) => (
                      <button key={id} type="button" onClick={() => setScenarioFilters((c) => ({ ...c, [key]: id }))}
                        className={cn('rounded px-1 py-[2px] text-[9px] font-semibold transition whitespace-nowrap',
                          scenarioFilters[key] === id ? 'bg-cyan-400 text-slate-950' : 'text-slate-500 hover:text-cyan-300'
                        )}>{text}</button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-[7px] text-slate-600 hidden sm:block">1-5 · N · {'⌘'}Z</span>
                <button type="button" onClick={() => generateScenarios()} disabled={scenarioState.loading}
                  className="shrink-0 inline-flex items-center gap-1 rounded-md bg-cyan-400 px-1.5 py-[2px] text-[9px] font-bold text-slate-950 disabled:opacity-50">
                  <Zap size={8} /> Shuffle
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tourist: Lake picker — hidden when deep-linked from spot card */}
        {!isAdmin && !touristRated && !deepLinkedLake && (
          <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Where are you paddling?</label>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
              {touristLakes.map((lake) => (
                <button key={lake.id} type="button"
                  onClick={() => { setTouristSelectedLake(lake); setTouristRated(false); }}
                  className={cn('rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition',
                    touristSelectedLake?.id === lake.id
                      ? 'border-cyan-400 bg-cyan-400/10 text-cyan-200'
                      : 'border-slate-700 text-slate-300 hover:border-cyan-500/50 hover:text-white')}>
                  {lake.name}
                </button>
              ))}
            </div>
            {!touristLakes.length && <div className="text-center text-sm text-slate-500 py-4">Loading lakes...</div>}
          </div>
        )}

        {/* Tourist: Date toggle — hidden in deep-link mode (QR users rate now) */}
        {!isAdmin && touristSelectedLake && !deepLinkedLake && (
          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm">
              <Clock3 size={14} className="text-cyan-400" />
              {touristDate === 'now' ? (
                <span className="text-slate-200">Right now · <span className="text-slate-500">{todayKey()}</span></span>
              ) : (
                <span className="text-slate-200">{touristDate}</span>
              )}
            </div>
            {!touristShowDatePicker ? (
              <button type="button" onClick={() => setTouristShowDatePicker(true)}
                className="text-[11px] font-medium text-cyan-400 hover:text-cyan-300">Past visit?</button>
            ) : (
              <div className="flex items-center gap-2">
                <input type="date" value={touristDate === 'now' ? '' : touristDate}
                  max={todayKey()} min={(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10); })()}
                  onChange={(e) => setTouristDate(e.target.value || 'now')}
                  className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 outline-none focus:border-cyan-400" />
                <button type="button" onClick={() => { setTouristDate('now'); setTouristShowDatePicker(false); }}
                  className="text-[11px] text-slate-500 hover:text-white">Now</button>
              </div>
            )}
          </div>
        )}

        {/* Loading — tourist only */}
        {!isAdmin && touristSelectedLake && touristWeatherLoading && (
          <div className="py-8 text-center text-sm text-[#8a7a5a]">Loading conditions...</div>
        )}

        {/* ── Tourist: Shared header (one source of truth for date + condition) */}
        {!isAdmin && showWeather && (
          <div className="text-center text-[14px] -mb-1" style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.02em' }}>
            {tw.datetime ? scenarioDateLabel(String(tw.datetime).slice(0, 10), String(tw.datetime).slice(11, 16)) : todayKey()}
            {tw.condition ? ` · ${tw.condition}` : ''}
          </div>
        )}

        {/* ── Tourist: Two-card grid ─────────────────────────────────── */}
        {!isAdmin && showWeather && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6" style={{ alignItems: 'stretch' }}>
            {/* Left card: Rating */}
            {!touristRated ? (
              <div className="rounded-2xl border border-[#2a2520] bg-gradient-to-b from-[#181410] to-[#0c0f0f] p-6 md:p-8 flex flex-col md:min-h-[560px]">
                <div className="flex items-start justify-end mb-2">
                  <button type="button" onClick={() => touristRate(sliderValue)} disabled={!canSubmit || saveState.loading}
                    className="rounded-full border px-5 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] transition-all disabled:opacity-25 active:scale-[0.97]"
                    style={{ borderColor: canSubmit ? '#d9bd7b' : '#2a2520', borderWidth: '1.5px', color: canSubmit ? '#d9bd7b' : '#3a3530', fontFamily: "'Josefin Sans', sans-serif" }}>
                    Submit
                  </button>
                </div>
                <div className="flex justify-center flex-1 items-center">
                  <RatingDial value={sliderValue} onChange={(v) => { setSliderValue(v); setDialTouched(true); }} size={200} label="Your Rating" />
                </div>
                <div className="mt-6">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#6a5a4a] mb-3" style={{ fontFamily: "'Josefin Sans', sans-serif" }}>What stood out?</div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {touristChips.map(([tag, label]) => (
                      <button key={tag} type="button" onClick={() => touristToggleTag(tag)}
                        className="rounded-full border px-3.5 py-1.5 text-[11px] font-medium transition"
                        style={touristTags.includes(tag)
                          ? { borderColor: '#d9bd7b', background: 'rgba(217,189,123,0.15)', color: '#d9bd7b', fontFamily: "'Josefin Sans', sans-serif" }
                          : { borderColor: '#2a2520', color: '#8a7a5a', fontFamily: "'Josefin Sans', sans-serif" }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (() => {
              const agreed = kaaykoScore != null && Math.abs(sliderValue - kaaykoScore) <= 1;
              return (
                <div className="rounded-2xl border border-[#2a2520] bg-gradient-to-b from-[#181410] to-[#0c0f0f] p-6 md:p-8 flex flex-col items-center justify-center text-center md:min-h-[560px]">
                  <div className="text-xl font-bold text-[#d9bd7b] mb-2" style={{ fontFamily: "'Josefin Sans', sans-serif" }}>
                    {agreed ? 'Thanks for confirming!' : 'Thanks for the correction!'}
                  </div>
                  <div className="text-sm text-[#8a7a5a] mb-6" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                    Your feedback fine-tunes our forecasts.
                  </div>
                  <button type="button" onClick={() => {
                      if (deepLinkedLake) { window.location.href = '/paddlingout'; return; }
                      setTouristRated(false); setTouristSelectedLake(null); setTouristWeather(null); setDialTouched(false); setTouristTags([]);
                    }}
                    className="w-full max-w-xs rounded-full border py-3.5 text-sm font-bold uppercase tracking-wider transition hover:bg-[#d9bd7b]/10"
                    style={{ fontFamily: "'Josefin Sans', sans-serif", borderColor: '#d9bd7b', borderWidth: '1.5px', color: '#d9bd7b', letterSpacing: '0.12em' }}>
                    {deepLinkedLake ? 'Back to Spots' : 'Rate Another Lake'}
                  </button>
                </div>
              );
            })()}

            {/* Right card: Conditions */}
            <div className="rounded-2xl border border-[#2a2520] bg-gradient-to-b from-[#141210] to-[#0c0f0f] p-6 md:p-8 flex flex-col md:min-h-[560px]">
              {kaaykoScore != null && (
                <div className="flex items-center gap-5 mb-5 pb-5 border-b border-[#2a2520]">
                  <ScoreRing score={kaaykoScore} size={90} label="ML Score" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-[#a09080] leading-relaxed" style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>
                      {scoreReason[0]}
                    </p>
                    <p className="text-[12px] text-[#6a5a4a] mt-1 leading-relaxed" style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>
                      {scoreReason[1]}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between mb-5">
                <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6a5a4a]" style={{ fontFamily: "'Josefin Sans', sans-serif" }}>Conditions</div>
                <div className="flex rounded-lg border border-[#2a2520] bg-[#1a1714]/60 p-0.5">
                  {[['metric', 'M'], ['imperial', 'I']].map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setUnits(k)}
                      className={cn('rounded-md px-2.5 py-0.5 text-[10px] font-semibold transition-colors',
                        units === k ? 'bg-[#2a2520] text-[#d9bd7b]' : 'text-slate-600 hover:text-slate-300')}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-[14px]">
                {TOURIST_FACTORS.map((f) => (
                  <TouristRow key={f.key} label={f.label} value={touristFactorData[f.key]} max={f.max} unit={f.unit}
                    conv={f.conv} invert={f.invert} icon={f.icon} digits={f.digits} units={units} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Admin: Weather Card ──────────────────────────────────────── */}
        {showWeather && isAdmin && (
          <div className="rounded-2xl border border-slate-700/80 bg-gradient-to-b from-[#0a1418] to-[#061014] p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Historical snapshot</div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={advanceScenario} disabled={!scenarioState.queue.length}
                  className="rounded-md border border-slate-700/50 px-2.5 py-1 text-[10px] font-semibold text-slate-400 disabled:opacity-30 hover:border-cyan-400 hover:text-cyan-300 transition">
                  Next →
                </button>
                <span className="rounded-full bg-slate-800/60 px-2 py-0.5 text-[10px] font-bold text-slate-500 tabular">
                  {scenarioState.queue.length ? `${scenarioState.index + 1}/${scenarioState.queue.length}` : '—'}
                </span>
              </div>
            </div>
            <div className="text-lg font-bold text-white">{draft.lakeDisplayName}</div>
            <div className="text-[11px] text-slate-500 mb-3">
              {scenarioDateLabel(draft.date, draft.time)}
              <span className="mx-1.5 text-slate-700">·</span>
              <span className="capitalize">{draft.scenarioSeason || weather.season || seasonFromDate(draft.date)}</span>
              <span className="mx-1.5 text-slate-700">·</span>
              <span className="capitalize">{draft.scenarioBucket || '—'}</span>
            </div>
            <div className="flex items-center justify-end mb-2">
              <div className="flex rounded-lg border border-slate-700 bg-slate-900/60 p-0.5">
                {[['metric', 'M'], ['imperial', 'I']].map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setUnits(k)}
                    className={cn('rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors',
                      units === k ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300')}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            {FACTOR_GROUPS.map((group) => {
              const gf = ALL_FACTORS.filter((f) => f.group === group);
              return (
                <div key={group} className="mt-1.5">
                  <div className="mb-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-600">{group}</div>
                  {gf.map((f) => (
                    <FactorBar key={f.key} label={f.label} value={factorData[f.key]} max={f.max} unit={f.unit}
                      conv={f.conv} invert={f.invert} icon={f.icon} digits={f.digits} units={units} sub={factorSubs[f.key]} />
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Rate Card ────────────────────────────────────────────────── */}
        {showRate && isAdmin && (
          <div className="rounded-2xl border-2 border-cyan-500/30 bg-gradient-to-b from-[#0a1d24] to-[#061014] p-5">
            <div className="text-center text-sm font-bold text-white mb-1">Would you paddle?</div>
            <div className="text-center text-[11px] text-slate-500 mb-3">
              {scenarioState.queue.length ? `Scenario ${scenarioState.index + 1} of ${scenarioState.queue.length}` : 'No scenarios loaded'}
              {' · '}{ratings.length} saved
            </div>
            <div className="grid grid-cols-5 gap-2">
              {QUICK_RATINGS.map((r) => (
                <button key={r.value} type="button"
                  onClick={() => answerScenario(r.value)}
                  disabled={saveState.loading || !scenarioState.queue.length}
                  className={cn('rounded-xl border py-4 text-center transition-all hover:scale-105 active:scale-95 disabled:opacity-40', r.border, 'bg-gradient-to-b', r.bg)}>
                  <div className="text-2xl font-bold">{r.value}</div>
                  <div className="mt-0.5 text-[9px] font-semibold text-slate-400">{r.label}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-1">
              {REASON_TAGS.map(([tag, label]) => (
                <button key={tag} type="button" onClick={() => toggleReasonTag(tag)}
                  className={cn('rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition',
                    selectedReasonTags.includes(tag) ? 'border-cyan-300 bg-cyan-300 text-slate-950' : 'border-slate-700 text-slate-500 hover:border-cyan-400')}>
                  {label}
                </button>
              ))}
            </div>
            <textarea value={draft.notes} onChange={(e) => updateDraft('notes', e.target.value)} rows={2}
              className="mt-2.5 w-full resize-none rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400"
              placeholder="Expert notes (optional)" />

            {/* Admin: expert note suggestions */}
            {isAdmin && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {EXPERT_NOTE_SUGGESTIONS.slice(0, 4).map((s) => (
                  <button key={s} type="button" onClick={() => updateDraft('notes', draft.notes ? `${draft.notes}. ${s}` : s)}
                    className="rounded-md border border-slate-800 px-1.5 py-0.5 text-[9px] text-slate-600 hover:text-cyan-300 hover:border-cyan-500 transition">
                    + {s.slice(0, 25)}…
                  </button>
                ))}
              </div>
            )}

            {/* Admin: save feedback + undo */}
            {isAdmin && (saveState.message || lastRating) && (
              <div className="mt-2 flex items-center justify-center gap-2">
                {saveState.message && <span className="text-[11px] font-semibold text-emerald-400">{saveState.message}</span>}
                {lastRating && (
                  <button type="button" onClick={undoLastRating}
                    className="inline-flex items-center gap-1 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-500 hover:text-amber-300 hover:border-amber-500 transition">
                    <Undo2 size={9} /> Undo
                  </button>
                )}
              </div>
            )}

            {isAdmin && scenarioState.error && (
              <div className="mt-2 text-center text-[11px] text-amber-400">{scenarioState.error}</div>
            )}

            {/* Admin: lake actions + context chips */}
            {isAdmin && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-800/30 pt-2.5 text-[10px]">
                {weather.latitude && weather.longitude && (
                  <button type="button" onClick={() => openMap(weather.latitude, weather.longitude)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-700/40 px-2 py-1 font-medium text-slate-500 hover:text-cyan-300 hover:border-cyan-500/40 transition">
                    <MapPin size={9} /> Map <ExternalLink size={8} />
                  </button>
                )}
                {draft.lake && (
                  <>
                    {adminPrefs.rejected?.includes(draft.lake) ? (
                      <button type="button" onClick={() => adminLakeAction('unreject', draft.lake)}
                        className="rounded-md bg-red-900/40 px-2 py-1 font-medium text-red-400 hover:bg-red-900/60 transition">Rejected</button>
                    ) : (
                      <button type="button" onClick={() => adminLakeAction('reject', draft.lake)}
                        className="rounded-md border border-slate-800/40 px-2 py-1 text-slate-600 hover:text-red-400 hover:border-red-500/30 transition">Reject</button>
                    )}
                    {adminPrefs.watchlist?.includes(draft.lake) ? (
                      <button type="button" onClick={() => adminLakeAction('unwatchlist', draft.lake)}
                        className="rounded-md bg-amber-900/40 px-2 py-1 font-medium text-amber-400 hover:bg-amber-900/60 transition">Watching</button>
                    ) : (
                      <button type="button" onClick={() => adminLakeAction('watchlist', draft.lake)}
                        className="rounded-md border border-slate-800/40 px-2 py-1 text-slate-600 hover:text-amber-400 hover:border-amber-500/30 transition">Watch</button>
                    )}
                  </>
                )}
                {contextChips.slice(0, 4).map((chip, i) => (
                  <span key={i} className="rounded-md bg-slate-800/25 border border-slate-700/20 px-1.5 py-0.5 text-[8px] text-slate-600">{chip}</span>
                ))}
              </div>
            )}
            {isAdmin && insights.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {insights.map((i, idx) => <InsightChip key={`${i.tone}-${i.text}-${idx}`} tone={i.tone}>{i.text}</InsightChip>)}
              </div>
            )}
          </div>
        )}

        {/* ── Admin: Dataset + Collapsibles ─────────────────────────── */}
        {isAdmin && (
          <>
            {/* Dataset summary */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <BarChart3 size={13} className="text-cyan-400" /> Dataset
                </div>
                <span className="text-[11px] font-bold tabular text-slate-300">{ratings.length}/200</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-slate-800">
                <div className="h-1.5 rounded-full bg-cyan-400 transition-all" style={{ width: `${Math.min(100, (ratings.length / 200) * 100)}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-5 gap-1">
                {[1, 2, 3, 4, 5].map((r) => {
                  const pct = ratings.length ? Math.round((ratingCounts[r] / ratings.length) * 100) : 0;
                  return (
                    <div key={r} className="text-center">
                      <div className="text-[10px] font-bold tabular" style={{ color: heatmapColor(r) }}>{ratingCounts[r]}</div>
                      <div className="mt-0.5 h-1 rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: heatmapColor(r) }} />
                      </div>
                      <div className="mt-0.5 text-[9px] text-slate-600">{r}</div>
                    </div>
                  );
                })}
              </div>
              {focusTargets.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1">
                  <span className="text-[9px] text-slate-600 mr-1">Needs:</span>
                  {focusTargets.map((t) => <InsightChip key={t} tone="blue">{t}</InsightChip>)}
                </div>
              )}
            </div>

            <Collapsible title="Optional Details" icon={SlidersHorizontal}>
              <div className="grid gap-3 grid-cols-2">
                <div>
                  <span className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Skill</span>
                  <Segment value={draft.skillLevel} onChange={(v) => updateDraft('skillLevel', v)} options={OPTION_SETS.skillLevel} />
                </div>
                <div>
                  <span className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Craft</span>
                  <Segment value={draft.boatType} onChange={(v) => updateDraft('boatType', v)} options={OPTION_SETS.boatType} />
                </div>
                <div>
                  <span className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Goal</span>
                  <Segment value={draft.sessionGoal} onChange={(v) => updateDraft('sessionGoal', v)} options={OPTION_SETS.sessionGoal} />
                </div>
                <div>
                  <span className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Group</span>
                  <Segment value={draft.groupType} onChange={(v) => updateDraft('groupType', v)} options={OPTION_SETS.groupType} />
                </div>
              </div>
              <div className="mt-3 grid gap-2 grid-cols-2">
                <SliderQuestion label="Overall" value={draft.rating} onChange={(v) => updateDraft('rating', v)} left="Never" right="Perfect" />
                <SliderQuestion label="Safety" value={draft.safetyRating} onChange={(v) => updateDraft('safetyRating', v)} left="Sketchy" right="Clean" />
                <SliderQuestion label="Enjoy" value={draft.enjoymentRating} onChange={(v) => updateDraft('enjoymentRating', v)} left="Bad" right="Loved" />
                <SliderQuestion label="Confidence" value={draft.confidence} onChange={(v) => updateDraft('confidence', v)} left="Guess" right="Certain" />
              </div>
              <div className="mt-3 grid gap-3 grid-cols-2">
                <div><span className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Wind felt</span><Segment value={draft.answers.windFelt} onChange={(v) => updateAnswer('windFelt', v)} options={OPTION_SETS.windFelt} /></div>
                <div><span className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Water felt</span><Segment value={draft.answers.waveFelt} onChange={(v) => updateAnswer('waveFelt', v)} options={OPTION_SETS.waveFelt} /></div>
                <div><span className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Launch</span><Segment value={draft.answers.launchDifficulty} onChange={(v) => updateAnswer('launchDifficulty', v)} options={OPTION_SETS.launchDifficulty} /></div>
                <div><span className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Crowding</span><Segment value={draft.answers.crowding} onChange={(v) => updateAnswer('crowding', v)} options={OPTION_SETS.crowding} /></div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button type="button" onClick={() => saveRating()} disabled={saveState.loading}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                  <Save size={13} /> Save Full Label
                </button>
                <span className="text-[11px] text-slate-500">{saveState.message}</span>
              </div>
            </Collapsible>

            <Collapsible title="Training Results" icon={BrainCircuit} badge={modelResult?.ready ? `MAE ${formatNumber(modelResult.validation.mae, 2)}` : ''}>
              {modelResult?.ready ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-2.5 text-center">
                      <div className="text-xl font-bold text-emerald-300 tabular">{formatNumber(modelResult.validation.mae, 2)}</div>
                      <div className="text-[10px] text-slate-500">MAE</div>
                    </div>
                    <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-2.5 text-center">
                      <div className="text-xl font-bold text-cyan-300 tabular">{formatNumber(modelResult.validation.r2, 2)}</div>
                      <div className="text-[10px] text-slate-500">R²</div>
                    </div>
                    <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-2.5 text-center">
                      <div className="text-xl font-bold text-slate-200 tabular">{prediction ? formatNumber(prediction, 1) : '—'}</div>
                      <div className="text-[10px] text-slate-500">Predicted</div>
                    </div>
                  </div>
                  <div className="h-40 rounded-lg border border-slate-800 bg-slate-900/50 p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={modelResult.featureWeights.slice(0, 8)} layout="vertical" margin={{ left: 10, right: 8, top: 2, bottom: 2 }}>
                        <CartesianGrid stroke="#1e293b" horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="label" width={80} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: '#020617', border: '1px solid #334155', color: '#e2e8f0' }} />
                        <Bar dataKey="weight" fill="#67e8f9" radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={!ratings.length} onClick={() => downloadFile('paddle-ratings.csv', recordsToCsv(ratings), 'text/csv')}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 disabled:opacity-30">
                      <FileDown size={12} /> CSV
                    </button>
                    <button type="button" disabled={!modelExport} onClick={() => downloadFile('paddle-model.json', modelExport, 'application/json')}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 disabled:opacity-30">
                      <Download size={12} /> Model
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-500/20 bg-amber-950/15 p-3 text-sm text-amber-200/80">
                  {modelResult?.reason || `Need ${Math.max(0, 40 - ratings.length)} more ratings to train first model.`}
                </div>
              )}
            </Collapsible>

            <Collapsible title="Coverage" icon={Gauge} badge={`${coverage.pct}%`}>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${coverage.pct}%`, background: coverage.pct < 30 ? '#ef4444' : coverage.pct < 60 ? '#f59e0b' : '#10b981' }} />
                  </div>
                  <span className="text-[11px] font-bold tabular" style={{ color: coverage.pct < 30 ? '#ef4444' : coverage.pct < 60 ? '#f59e0b' : '#10b981' }}>
                    {coverage.filled}/{coverage.total}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[['Season', 'season', COVERAGE_AXES.season], ['Condition', 'bucket', COVERAGE_AXES.bucket], ['Size', 'size', COVERAGE_AXES.size]].map(([label, axis, vals]) => (
                    <div key={axis}>
                      <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-600">{label}</div>
                      <div className="space-y-0.5">
                        {vals.map((v) => {
                          const n = coverage.axisCounts[axis][v] || 0;
                          return (
                            <div key={v} className="flex items-center justify-between rounded px-1.5 py-[2px]"
                              style={{ background: n === 0 ? 'rgba(239,68,68,0.08)' : 'transparent' }}>
                              <span className={cn('text-[10px] capitalize', n === 0 ? 'text-red-400/80' : 'text-slate-400')}>{v}</span>
                              <span className={cn('text-[10px] font-bold tabular', n === 0 ? 'text-red-400' : 'text-slate-500')}>{n}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {coverage.unknownSize > 0 && (
                  <div className="text-[9px] text-slate-600">{coverage.unknownSize} ratings with unknown lake size excluded from coverage</div>
                )}
                {coverage.gaps.length > 0 && (
                  <div className="rounded-lg border border-amber-500/15 bg-amber-950/10 px-3 py-2">
                    <div className="text-[10px] font-bold uppercase text-amber-400/70 mb-1">Top gaps — shuffle fills these first</div>
                    <div className="flex flex-wrap gap-1">
                      {coverage.gaps.slice(0, 8).map((g) => (
                        <span key={`${g.season}|${g.bucket}|${g.size}`}
                          className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[9px] text-amber-300/80 capitalize">
                          {g.season} · {g.bucket === 'high-wind/wave' ? 'windy' : g.bucket} · {g.size}
                        </span>
                      ))}
                      {coverage.gaps.length > 8 && <span className="text-[9px] text-slate-600">+{coverage.gaps.length - 8} more</span>}
                    </div>
                  </div>
                )}
                <div className="grid gap-3 grid-cols-2">
                  {[['Weather', patternRows.bucket], ['Season', patternRows.season], ['Time', patternRows.time], ['Lake size', patternRows.size]].map(([label, rows]) => (
                    <div key={label}>
                      <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-600">{label}</div>
                      <div className="space-y-0.5">
                        {rows.length ? rows.slice(0, 3).map((r) => (
                          <div key={`${label}-${r.label}`} className="flex items-center justify-between rounded px-1.5 py-[2px]">
                            <div>
                              <span className="text-[10px] font-semibold capitalize text-slate-300">{r.label}</span>
                              <span className="ml-1 text-[9px] text-slate-600">{r.count}</span>
                            </div>
                            <span className="text-[11px] font-bold tabular" style={{ color: scoreColor(r.average) }}>{formatNumber(r.average, 1)}</span>
                          </div>
                        )) : <div className="text-[10px] text-slate-600">No labels yet</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Collapsible>

            <Collapsible title="Recent Labels" icon={NotebookPen} badge={ratings.length ? String(Math.min(ratings.length, 10)) : ''}>
              <div className="max-h-[300px] space-y-1.5 overflow-auto pr-1">
                {ratings.length === 0 ? (
                  <div className="text-xs text-slate-500 p-2">No labels yet</div>
                ) : ratings.slice(0, 10).map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-800 bg-slate-900/40 px-2.5 py-1.5">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-slate-200">{r.lakeDisplayName || r.lake}</div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                        <span>{r.date}</span>
                        <span className="font-bold tabular" style={{ color: scoreColor(r.rating) }}>{r.rating}/5</span>
                      </div>
                    </div>
                    <button type="button" onClick={() => deleteRating(r.id)} className="shrink-0 rounded p-1 text-slate-600 hover:text-red-400">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </Collapsible>
          </>
        )}

        {/* GPS — admin only */}
        {isAdmin && (
          <div className="flex items-center justify-center pt-2">
            <button type="button" onClick={requestGPS} disabled={gpsState.loading}
              className={cn('inline-flex items-center gap-1.5 text-[11px] transition',
                gpsState.lat ? 'text-emerald-400' : 'text-slate-500 hover:text-cyan-400')}>
              <Navigation size={12} className={gpsState.loading ? 'animate-spin' : ''} />
              {gpsState.lat ? `${gpsState.lat.toFixed(2)}, ${gpsState.lng.toFixed(2)}` : 'Add GPS'}
            </button>
          </div>
        )}

      </div>

      {/* Footer */}
      {!isAdmin && (
        <footer className="border-t border-[#1a1714] py-4 text-center text-[11px] text-[#5a5040] mt-auto">
          &copy; {new Date().getFullYear()} Kaayko. All rights reserved.
        </footer>
      )}
    </div>
  );
}
