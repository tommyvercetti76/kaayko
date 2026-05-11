import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  BrainCircuit,
  CalendarDays,
  Clock3,
  CloudSun,
  Download,
  Droplets,
  FileDown,
  Gauge,
  NotebookPen,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  Thermometer,
  Trash2,
  Waves as WavesIcon,
  Wind,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
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

const API_ROOT = '/paddle-trainer/api';

const QUICK_RATINGS = [
  { value: 1, label: 'No', detail: 'Bad or unsafe' },
  { value: 2, label: 'Probably no', detail: 'Too rough' },
  { value: 3, label: 'Maybe', detail: 'Borderline' },
  { value: 4, label: 'Yes', detail: 'Good paddle' },
  { value: 5, label: 'Absolutely', detail: 'Great day' },
];

const OPTION_SETS = {
  skillLevel: [
    ['intermediate', 'Intermediate'],
    ['advanced', 'Advanced'],
    ['expert', 'Expert'],
    ['beginner', 'Beginner'],
  ],
  boatType: [
    ['kayak', 'Kayak'],
    ['sup', 'SUP'],
    ['canoe', 'Canoe'],
    ['rowing', 'Row'],
    ['other', 'Other'],
  ],
  sessionGoal: [
    ['explore', 'Explore'],
    ['fitness', 'Fitness'],
    ['relax', 'Relax'],
    ['fishing', 'Fish'],
    ['training', 'Train'],
  ],
  groupType: [
    ['solo', 'Solo'],
    ['partner', 'Partner'],
    ['group', 'Group'],
  ],
  windFelt: [
    ['calm', 'Calm'],
    ['light', 'Light'],
    ['moderate', 'Moderate'],
    ['strong', 'Strong'],
    ['brutal', 'Brutal'],
  ],
  waveFelt: [
    ['flat', 'Flat'],
    ['ripple', 'Ripple'],
    ['chop', 'Chop'],
    ['whitecaps', 'Whitecaps'],
  ],
  launchDifficulty: [
    ['easy', 'Easy'],
    ['ok', 'OK'],
    ['hard', 'Hard'],
  ],
  crowding: [
    ['quiet', 'Quiet'],
    ['normal', 'Normal'],
    ['busy', 'Busy'],
  ],
  fatigue: [
    ['fresh', 'Fresh'],
    ['normal', 'Normal'],
    ['tired', 'Tired'],
  ],
};

const WEATHER_BUCKETS = ['calm', 'normal', 'cold', 'hot', 'rain', 'high-wind/wave'];

const REASON_TAGS = [
  ['wind', 'Wind mattered'],
  ['cold_water', 'Cold water'],
  ['visibility', 'Fog/visibility'],
  ['rain', 'Rain/storm'],
  ['big_water', 'Big water'],
  ['heat_sun', 'Heat/sun'],
  ['waves', 'Chop/waves'],
  ['solo_risk', 'Solo risk'],
  ['launch', 'Launch/crowds'],
];

const SCENARIO_FILTERS = {
  season: [
    ['any', 'Any'],
    ['winter', 'Winter'],
    ['spring', 'Spring'],
    ['summer', 'Summer'],
    ['autumn', 'Autumn'],
  ],
  timeOfDay: [
    ['any', 'Any'],
    ['morning', 'Morning'],
    ['midday', 'Midday'],
    ['afternoon', 'Afternoon'],
    ['evening', 'Evening'],
    ['night', 'Night'],
  ],
  bucket: [
    ['balanced', 'Balanced'],
    ['calm', 'Calm'],
    ['normal', 'Normal'],
    ['cold', 'Cold'],
    ['hot', 'Hot'],
    ['rain', 'Rain'],
    ['high-wind/wave', 'Windy'],
  ],
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nowHour() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:00`;
}

function createDraft() {
  return {
    labelSource: 'manual',
    scenarioId: null,
    scenarioBucket: null,
    scenarioSeason: null,
    scenarioTimeOfDay: null,
    sourceCsv: null,
    sourceRowNumber: null,
    sourceKind: null,
    lake: 'Lake_Tahoe',
    lakeDisplayName: 'Lake Tahoe',
    date: '2025-01-01',
    time: '10:00',
    durationMinutes: 90,
    rating: 3,
    safetyRating: 3,
    enjoymentRating: 3,
    wouldPaddleAgain: true,
    confidence: 3,
    skillLevel: 'advanced',
    boatType: 'kayak',
    sessionGoal: 'explore',
    groupType: 'solo',
    answers: {
      windFelt: 'light',
      waveFelt: 'ripple',
      launchDifficulty: 'easy',
      crowding: 'quiet',
      fatigue: 'normal',
      reasonTags: [],
    },
    notes: '',
    weatherSnapshot: null,
  };
}

function formatNumber(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return n.toFixed(digits).replace(/\.0+$/, '');
}

function scoreColor(score) {
  const r = parseFloat(score);
  if (r >= 4.5) return '#255a3a';
  if (r >= 4.0) return '#316d43';
  if (r >= 3.5) return '#c59a61';
  if (r >= 3.0) return '#eb8127';
  if (r >= 2.5) return '#bd3b2b';
  if (r >= 2.0) return '#86170f';
  return '#4a0a08';
}

function scenarioDateLabel(date, time) {
  const parsed = new Date(`${date || '1970-01-01'}T${time || '12:00'}`);
  if (Number.isNaN(parsed.getTime())) return `${date || '-'} ${time || ''}`.trim();
  return parsed.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
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
    [1, 0, 'Calm'],
    [6, 1, 'Light air'],
    [12, 2, 'Light breeze'],
    [20, 3, 'Gentle breeze'],
    [29, 4, 'Moderate breeze'],
    [39, 5, 'Fresh breeze'],
    [50, 6, 'Strong breeze'],
    [62, 7, 'Near gale'],
    [75, 8, 'Gale'],
    [89, 9, 'Strong gale'],
    [103, 10, 'Storm'],
    [118, 11, 'Violent storm'],
    [Infinity, 12, 'Hurricane force'],
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
    ['Air temp', factorValue(air, ' C')],
    ['Feels like', factorValue(feels, ' C')],
    ['Water temp', factorValue(water, ' C')],
    ['Air-water delta', factorValue(airWaterDelta, ' C')],
    ['Dew point', factorValue(dew, ' C')],
    ['Dew spread', factorValue(dewSpread, ' C')],
    ['Humidity', factorValue(humidity, '%', 0)],
    ['Cloud', factorValue(weather.cloud, '%', 0)],
    ['UV index', factorValue(weather.uv, '', 1)],
    ['Pressure', factorValue(weather.pressure_mb, ' mb', 0)],
    ['Visibility', factorValue(visibility, ' km')],
    ['Condition', weather.condition || '-'],
    ['Rain', factorValue(rain, ' mm', 2)],
    ['Rain flag', Number(weather.will_it_rain) === 1 ? 'yes' : 'no'],
    ['Snow flag', Number(weather.will_it_snow) === 1 ? 'yes' : 'no'],
    ['Wind', factorValue(wind, ' kph')],
    ['Wind dir', weather.wind_dir || '-'],
    ['Gust', factorValue(gust, ' kph')],
    ['Beaufort', `B${beaufort.value} ${beaufort.label}`],
    ['Gust factor', gustFactor === null ? '-' : formatNumber(gustFactor, 2)],
    ['Wave height', factorValue(wave, ' m', 2)],
    ['Wind-wave index', formatNumber(windWaveExposure, 2)],
    ['Daylight', daylight],
    ['Season intensity', weather.season_intensity || '-'],
    ['Climate zone', weather.climate_zone || '-'],
    ['Lake area', factorValue(area, ' km2', 2)],
    ['Lake size', weather.lake_size_class || sizeClassFromArea(area)],
    ['Waterbody', weather.waterbody_class || weather.lake_type || '-'],
    ['Base water', weather.base_lake_name || weather.matched_lake_name || '-'],
    ['Latitude', factorValue(weather.latitude, '', 4)],
    ['Longitude', factorValue(weather.longitude, '', 4)],
    ['Day of year', factorValue(weather.day_of_year, '', 0)],
  ];

  return { beaufort, fogSignal, irregularities, factors, factorCount: factors.length };
}

function classNames(...items) {
  return items.filter(Boolean).join(' ');
}

function Section({ icon: Icon, title, action, children }) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/80">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon size={18} className="text-cyan-300" />
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className={classNames(
        'h-11 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none',
        'focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20',
        props.className
      )}
    />
  );
}

function Segment({ value, onChange, options }) {
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(([id, label]) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={classNames(
              'min-h-10 rounded-md border px-2 text-xs font-medium transition',
              active
                ? 'border-cyan-300 bg-cyan-300 text-slate-950'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function SliderQuestion({ label, value, onChange, left, right }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/70 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-200">{label}</span>
        <span className="tabular text-lg font-semibold text-cyan-200">{Number(value).toFixed(1)}</span>
      </div>
      <input
        type="range"
        min="1"
        max="5"
        step="0.5"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-cyan-300"
      />
      <div className="mt-1 flex justify-between text-[11px] text-slate-500">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={classNames(
        'flex min-h-10 items-center gap-2 rounded-md border px-3 text-xs font-medium',
        checked ? 'border-emerald-400 bg-emerald-400 text-slate-950' : 'border-slate-700 bg-slate-900 text-slate-300'
      )}
    >
      <span className={classNames('h-2.5 w-2.5 rounded-full', checked ? 'bg-slate-950' : 'bg-slate-500')} />
      {label}
    </button>
  );
}

function ReviewFact({ icon: Icon, label, value, suffix, tone = 'neutral' }) {
  const tones = {
    neutral: 'border-slate-700 bg-slate-950 text-slate-100',
    good: 'border-emerald-500/40 bg-emerald-950/30 text-emerald-100',
    warn: 'border-amber-500/40 bg-amber-950/30 text-amber-100',
    bad: 'border-red-500/40 bg-red-950/30 text-red-100',
  };
  return (
    <div className={classNames('rounded-lg border p-3', tones[tone])}>
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
        <Icon size={13} />
        <span>{label}</span>
      </div>
      <div className="mt-2 text-xl font-semibold tabular">
        {value} <span className="text-xs font-normal text-slate-500">{suffix}</span>
      </div>
    </div>
  );
}

function InsightChip({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'border-slate-700 bg-slate-950 text-slate-300',
    good: 'border-emerald-500/40 bg-emerald-950/30 text-emerald-100',
    warn: 'border-amber-500/40 bg-amber-950/30 text-amber-100',
    bad: 'border-red-500/40 bg-red-950/30 text-red-100',
    blue: 'border-cyan-500/40 bg-cyan-950/30 text-cyan-100',
  };
  return (
    <span className={classNames('inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-semibold', tones[tone])}>
      {children}
    </span>
  );
}

function MiniBar({ label, value, max, suffix = '', tone = 'cyan' }) {
  const colors = {
    cyan: 'bg-cyan-300',
    green: 'bg-emerald-400',
    amber: 'bg-amber-300',
    red: 'bg-red-400',
    slate: 'bg-slate-500',
  };
  const pct = Math.max(0, Math.min(100, (Number(value || 0) / max) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-semibold tabular text-slate-100">{formatNumber(value, 1)}{suffix}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-800">
        <div className={classNames('h-2 rounded-full', colors[tone])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function getScenarioInsights(weather = {}) {
  const chips = [];
  const wind = Number(weather.wind_kph || 0);
  const gust = Number(weather.gust_kph || 0);
  const water = Number(weather.estimated_water_temp_c || 0);
  const rain = Number(weather.precip_mm || 0);
  const uv = Number(weather.uv || 0);
  const visibility = Number(weather.vis_km || 0);
  const generated = Number(weather.paddle_score || 0);

  if (gust >= 40 || wind >= 25) chips.push({ tone: 'bad', text: 'wind risk' });
  else if (gust >= 28 || wind >= 15) chips.push({ tone: 'warn', text: 'gusty' });
  else chips.push({ tone: 'good', text: 'manageable wind' });

  if (water <= 8) chips.push({ tone: 'bad', text: 'cold water' });
  else if (water <= 15) chips.push({ tone: 'warn', text: 'cool water' });
  else chips.push({ tone: 'good', text: 'warmer water' });

  if (rain > 2) chips.push({ tone: 'warn', text: 'rainy' });
  if (uv >= 6) chips.push({ tone: 'warn', text: 'high UV' });
  if (visibility && visibility < 5) chips.push({ tone: 'warn', text: 'low visibility' });
  if (generated && generated <= 2) chips.push({ tone: 'blue', text: 'generated score is low' });
  if (generated >= 4) chips.push({ tone: 'blue', text: 'generated score is high' });

  return chips.slice(0, 6);
}

function DistributionBar({ label, count, total, tone = 'cyan' }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="tabular text-slate-200">{count} · {pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-800">
        <div
          className={classNames('h-2 rounded-full', tone === 'green' ? 'bg-emerald-400' : tone === 'amber' ? 'bg-amber-300' : tone === 'red' ? 'bg-red-400' : 'bg-cyan-300')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function CompactStat({ label, value, sub, tone = 'neutral' }) {
  const tones = {
    neutral: 'border-slate-800 bg-slate-950/70 text-slate-100',
    good: 'border-emerald-500/40 bg-emerald-950/25 text-emerald-100',
    warn: 'border-amber-500/40 bg-amber-950/25 text-amber-100',
    bad: 'border-red-500/40 bg-red-950/25 text-red-100',
    blue: 'border-cyan-500/40 bg-cyan-950/25 text-cyan-100',
  };
  return (
    <div className={classNames('rounded-md border px-3 py-2', tones[tone])}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

function FilterGroup({ label, value, options, onChange }) {
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([id, text]) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={classNames(
              'h-8 rounded-md border px-2.5 text-xs font-semibold transition',
              value === id
                ? 'border-cyan-300 bg-cyan-300 text-slate-950'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-300'
            )}
          >
            {text}
          </button>
        ))}
      </div>
    </Field>
  );
}

function PatternRow({ label, count, average }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2">
      <div>
        <div className="text-sm font-semibold capitalize text-slate-100">{label}</div>
        <div className="text-xs text-slate-500">{count} labels</div>
      </div>
      <div className="text-lg font-semibold tabular" style={{ color: scoreColor(average) }}>
        {formatNumber(average, 2)}
      </div>
    </div>
  );
}

function FactorCell({ label, value }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-slate-100" title={String(value)}>
        {value}
      </div>
    </div>
  );
}

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
  return Array.from(groups.values())
    .map((group) => ({ ...group, average: group.total / group.count }))
    .sort((a, b) => b.count - a.count);
}

function ProcessRow({ number, title, body }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/70 p-3">
      <div className="flex gap-3">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-cyan-400/40 text-xs font-bold text-cyan-200">
          {number}
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-100">{title}</div>
          <div className="mt-1 break-words text-xs leading-5 text-slate-400">{body}</div>
        </div>
      </div>
    </div>
  );
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function PaddleTrainer() {
  const didAutoGenerate = useRef(false);
  const [status, setStatus] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [draft, setDraft] = useState(createDraft);
  const [lakeQuery, setLakeQuery] = useState('Lake Tahoe');
  const [lakeFocused, setLakeFocused] = useState(false);
  const [lakeOptions, setLakeOptions] = useState([]);
  const [weatherState, setWeatherState] = useState({ loading: false, error: '' });
  const [saveState, setSaveState] = useState({ loading: false, message: '' });
  const [scenarioState, setScenarioState] = useState({ loading: false, error: '', queue: [], index: -1 });
  const [scenarioFilters, setScenarioFilters] = useState({ season: 'any', timeOfDay: 'any', bucket: 'balanced', count: 20 });
  const [modelOptions, setModelOptions] = useState({ includeHumanContext: true, includeNotes: true });
  const [modelResult, setModelResult] = useState(null);
  const [prediction, setPrediction] = useState(null);

  const uniqueLakes = useMemo(() => new Set(ratings.map((item) => item.lake).filter(Boolean)).size, [ratings]);
  const interviewLabels = useMemo(() => ratings.filter((item) => item.labelSource === 'scenario_interview').length, [ratings]);
  const notesCount = useMemo(() => ratings.filter((item) => item.notes?.trim()).length, [ratings]);
  const ratingCounts = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const record of ratings) {
      const key = Math.round(Number(record.rating));
      if (counts[key] !== undefined) counts[key] += 1;
    }
    return counts;
  }, [ratings]);
  const bucketCounts = useMemo(() => {
    const counts = {};
    for (const record of ratings) {
      const bucket = record.scenarioBucket || 'unknown';
      counts[bucket] = (counts[bucket] || 0) + 1;
    }
    return counts;
  }, [ratings]);
  const patternRows = useMemo(() => ({
    bucket: averageBy(ratings, (record) => record.scenarioBucket || 'unknown').slice(0, 5),
    season: averageBy(ratings, (record) => record.weatherSnapshot?.season || seasonFromDate(record.date)).slice(0, 5),
    time: averageBy(ratings, (record) => timeOfDayFromTime(record.time)).slice(0, 5),
    size: averageBy(ratings, (record) => record.weatherSnapshot?.lake_size_class || sizeClassFromArea(record.weatherSnapshot?.lake_area_km2)).slice(0, 5),
  }), [ratings]);
  const focusTargets = useMemo(() => {
    const targets = WEATHER_BUCKETS
      .map((bucket) => ({ label: bucket, count: bucketCounts[bucket] || 0 }))
      .sort((a, b) => a.count - b.count)
      .slice(0, 3)
      .map((item) => item.label);
    const positive = (ratingCounts[4] || 0) + (ratingCounts[5] || 0);
    if (ratings.length > 20 && positive / ratings.length < 0.25) targets.push('more 4-5 days');
    return targets.slice(0, 4);
  }, [bucketCounts, ratingCounts, ratings.length]);
  const skewWarning = ratings.length > 20 && Math.max(...Object.values(ratingCounts)) / ratings.length > 0.65;
  const readyTone = ratings.length >= 40 && uniqueLakes >= 5 ? 'good' : ratings.length >= 4 ? 'warn' : 'bad';

  useEffect(() => {
    let alive = true;
    async function loadInitial() {
      try {
        const [statusRes, ratingsRes] = await Promise.all([
          fetch(`${API_ROOT}/status`),
          fetch(`${API_ROOT}/ratings`),
        ]);
        if (statusRes.ok) {
          const data = await statusRes.json();
          if (alive) setStatus(data);
        }
        if (ratingsRes.ok) {
          const data = await ratingsRes.json();
          if (alive) {
            const serverRecords = data.records || [];
            setRatings(serverRecords);
            localStorage.setItem('paddleTrainerRatings', JSON.stringify(serverRecords));
          }
        } else {
          throw new Error('ratings endpoint unavailable');
        }
      } catch {
        const cached = JSON.parse(localStorage.getItem('paddleTrainerRatings') || '[]');
        if (alive) {
          setRatings(cached);
          setStatus((current) => current || { apiAvailable: false });
        }
      }
    }
    loadInitial();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (didAutoGenerate.current) return;
    didAutoGenerate.current = true;
    generateScenarios();
    // Create the first review queue automatically; the button remains for refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`${API_ROOT}/lakes?q=${encodeURIComponent(lakeQuery)}`);
        if (!res.ok) return;
        const data = await res.json();
        setLakeOptions(data.lakes || []);
      } catch {
        setLakeOptions([]);
      }
    }, 180);
    return () => clearTimeout(timeout);
  }, [lakeQuery]);

  useEffect(() => {
    setModelResult(trainPersonalPaddleModel(ratings, modelOptions));
  }, [ratings, modelOptions]);

  useEffect(() => {
    if (modelResult?.ready) {
      setPrediction(predictWithPersonalModel(modelResult.model, draft));
    } else {
      setPrediction(null);
    }
  }, [draft, modelResult]);

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateAnswer(key, value) {
    setDraft((current) => ({
      ...current,
      answers: { ...current.answers, [key]: value },
    }));
  }

  function toggleReasonTag(tag) {
    setDraft((current) => {
      const currentTags = current.answers?.reasonTags || [];
      const nextTags = currentTags.includes(tag)
        ? currentTags.filter((item) => item !== tag)
        : [...currentTags, tag];
      return {
        ...current,
        answers: { ...current.answers, reasonTags: nextTags },
      };
    });
  }

  function updateWeather(key, value) {
    setDraft((current) => ({
      ...current,
      weatherSnapshot: {
        ...(current.weatherSnapshot || {}),
        [key]: value === '' ? '' : Number(value),
      },
    }));
  }

  async function loadWeather() {
    if (!draft.lake || !draft.date || !draft.time) return;
    setWeatherState({ loading: true, error: '' });
    try {
      const params = new URLSearchParams({ lake: draft.lake, date: draft.date, time: draft.time });
      const res = await fetch(`${API_ROOT}/weather?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Weather row not found');
      setDraft((current) => ({
        ...current,
        weatherSnapshot: data.weather,
      }));
      setWeatherState({ loading: false, error: '' });
    } catch (error) {
      setWeatherState({ loading: false, error: error.message || 'Weather row not found' });
    }
  }

  function applyScenario(scenario) {
    setDraft((current) => ({
      ...current,
      labelSource: 'scenario_interview',
      scenarioId: scenario.id,
      scenarioBucket: scenario.bucket,
      scenarioSeason: scenario.season,
      scenarioTimeOfDay: scenario.timeOfDay,
      sourceCsv: scenario.sourceCsv,
      sourceRowNumber: scenario.sourceRowNumber,
      sourceKind: scenario.sourceKind,
      lake: scenario.lake,
      lakeDisplayName: scenario.lakeDisplayName,
      date: scenario.date,
      time: scenario.time,
      notes: '',
      weatherSnapshot: scenario.weather,
    }));
    setLakeQuery(scenario.lakeDisplayName);
    setWeatherState({ loading: false, error: '' });
  }

  function updateScenarioFilter(key, value) {
    setScenarioFilters((current) => ({ ...current, [key]: value }));
  }

  async function generateScenarios(count = scenarioFilters.count, filters = scenarioFilters) {
    setScenarioState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const params = new URLSearchParams({
        count: String(count),
        region: 'USA',
        season: filters.season,
        timeOfDay: filters.timeOfDay,
        bucket: filters.bucket,
      });
      const res = await fetch(`${API_ROOT}/scenarios?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not generate scenarios');
      const queue = data.scenarios || [];
      setScenarioState({
        loading: false,
        error: queue.length ? '' : 'No matching real rows found quickly. Loosen one filter or try Shuffle again.',
        queue,
        index: queue.length ? 0 : -1,
      });
      if (queue.length) {
        applyScenario(queue[0]);
        requestAnimationFrame(() => {
          document.getElementById('scenario-review')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    } catch (error) {
      setScenarioState((current) => ({
        ...current,
        loading: false,
        error: error.message || 'Could not generate scenarios',
      }));
    }
  }

  function advanceScenario() {
    if (!scenarioState.queue.length) return;
    const nextIndex = (scenarioState.index + 1) % scenarioState.queue.length;
    setScenarioState((current) => ({ ...current, index: nextIndex }));
    applyScenario(scenarioState.queue[nextIndex]);
  }

  async function saveRating(overrides = {}) {
    setSaveState({ loading: true, message: '' });
    const nextDraft = {
      ...draft,
      ...overrides,
      answers: {
        ...draft.answers,
        ...(overrides.answers || {}),
      },
    };
    const record = {
      ...nextDraft,
      id: crypto.randomUUID(),
      rating: Number(nextDraft.rating),
      safetyRating: Number(nextDraft.safetyRating),
      enjoymentRating: Number(nextDraft.enjoymentRating),
      confidence: Number(nextDraft.confidence),
      durationMinutes: Number(nextDraft.durationMinutes),
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await fetch(`${API_ROOT}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      const next = [data.record, ...ratings];
      setRatings(next);
      localStorage.setItem('paddleTrainerRatings', JSON.stringify(next));
      setSaveState({ loading: false, message: 'Saved to human-ratings/ratings.jsonl' });
      if (record.labelSource === 'scenario_interview') advanceScenario();
    } catch {
      const next = [record, ...ratings];
      setRatings(next);
      localStorage.setItem('paddleTrainerRatings', JSON.stringify(next));
      setSaveState({ loading: false, message: 'Saved in browser storage' });
      if (record.labelSource === 'scenario_interview') advanceScenario();
    }
  }

  function answerScenario(value) {
    saveRating({
      rating: value,
      safetyRating: value <= 2 ? value : Math.max(3, value),
      enjoymentRating: value,
      confidence: Math.max(Number(draft.confidence || 3), 3),
      wouldPaddleAgain: value >= 4,
    });
  }

  async function deleteRating(id) {
    const next = ratings.filter((record) => record.id !== id);
    setRatings(next);
    localStorage.setItem('paddleTrainerRatings', JSON.stringify(next));
    try {
      await fetch(`${API_ROOT}/ratings/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {
      // Browser copy is already updated.
    }
  }

  function trainModel() {
    const result = trainPersonalPaddleModel(ratings, modelOptions);
    setModelResult(result);
    if (result.ready) {
      setPrediction(predictWithPersonalModel(result.model, draft));
    } else {
      setPrediction(null);
    }
  }

  function selectLake(lake) {
    setDraft((current) => ({
      ...current,
      lake: lake.id,
      lakeDisplayName: lake.name,
    }));
    setLakeQuery(lake.name);
    setLakeFocused(false);
  }

  const weather = draft.weatherSnapshot || {};
  const science = getScienceProfile(weather);
  const selectedReasonTags = draft.answers?.reasonTags || [];
  const currentCsvPath = draft.sourceCsv || (draft.lake && draft.date
    ? `/Users/Rohan/data_lake_monthly/${draft.lake}/${String(draft.date).slice(0, 7)}.csv`
    : '/Users/Rohan/data_lake_monthly');
  const insights = [...getScenarioInsights(weather), ...science.irregularities].slice(0, 9);
  const windTone = Number(weather.wind_kph) >= 25 || Number(weather.gust_kph) >= 40 ? 'bad' : Number(weather.wind_kph) >= 15 ? 'warn' : 'good';
  const waterTone = Number(weather.estimated_water_temp_c) <= 8 ? 'bad' : Number(weather.estimated_water_temp_c) <= 15 ? 'warn' : 'good';
  const rainTone = Number(weather.precip_mm) > 1 ? 'warn' : 'good';
  const modelExport = modelResult?.ready
    ? JSON.stringify({ model: modelResult.model, metrics: modelResult.validation }, null, 2)
    : '';

  return (
    <div className="min-h-screen bg-[#061014] text-slate-100">
      <div className="border-b border-slate-800 bg-[#071317]/95">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
              <WavesIcon size={16} />
              Paddle LLM Trainer
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-white md:text-3xl">
              Human-rated paddling model
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                updateDraft('date', todayKey());
                updateDraft('time', nowHour());
              }}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm font-medium text-slate-200"
            >
              <Clock3 size={16} />
              Now
            </button>
            <button
              type="button"
              onClick={loadWeather}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-cyan-300 px-3 text-sm font-semibold text-slate-950"
            >
              <RefreshCw size={16} className={weatherState.loading ? 'animate-spin' : ''} />
              Load weather
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-4">
          <section className="rounded-lg border border-slate-800 bg-slate-950/80 p-4">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px]">
              <div className="grid gap-2 sm:grid-cols-5">
                <CompactStat label="Lake cache" value={status?.stats?.lakeDirectories ?? status?.lakeDirectories ?? '-'} sub="real CSV folders" tone="blue" />
                <CompactStat label="Answers" value={ratings.length} sub={`${interviewLabels} scenario labels`} tone={readyTone} />
                <CompactStat label="Lakes" value={uniqueLakes} sub="covered so far" tone={uniqueLakes >= 25 ? 'good' : uniqueLakes >= 5 ? 'warn' : 'neutral'} />
                <CompactStat label="Factors" value={`${science.factorCount}+`} sub="real/derived row fields" tone="blue" />
                <CompactStat
                  label="Model"
                  value={modelResult?.ready ? formatNumber(modelResult.validation.mae, 2) : `${Math.max(0, 40 - ratings.length)} left`}
                  sub={modelResult?.ready ? 'MAE, live trained' : 'to first draft'}
                  tone={modelResult?.ready ? 'good' : 'neutral'}
                />
              </div>

              <div className="rounded-md border border-slate-800 bg-[#071317] p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-cyan-300">Next data target</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {focusTargets.map((target) => (
                    <InsightChip key={target} tone="blue">{target}</InsightChip>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_1fr_1.2fr_120px_auto]">
              <FilterGroup
                label="Season"
                value={scenarioFilters.season}
                options={SCENARIO_FILTERS.season}
                onChange={(value) => updateScenarioFilter('season', value)}
              />
              <FilterGroup
                label="Time of day"
                value={scenarioFilters.timeOfDay}
                options={SCENARIO_FILTERS.timeOfDay}
                onChange={(value) => updateScenarioFilter('timeOfDay', value)}
              />
              <FilterGroup
                label="Weather mix"
                value={scenarioFilters.bucket}
                options={SCENARIO_FILTERS.bucket}
                onChange={(value) => updateScenarioFilter('bucket', value)}
              />
              <Field label="Batch">
                <select
                  value={scenarioFilters.count}
                  onChange={(event) => updateScenarioFilter('count', Number(event.target.value))}
                  className="h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-xs font-semibold text-slate-100 outline-none focus:border-cyan-400"
                >
                  {[10, 20, 40, 60, 100].map((count) => (
                    <option key={count} value={count}>{count}</option>
                  ))}
                </select>
              </Field>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => generateScenarios()}
                  disabled={scenarioState.loading}
                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-cyan-300 px-3 text-xs font-bold text-slate-950 disabled:opacity-60"
                >
                  <Zap size={14} />
                  Shuffle
                </button>
              </div>
            </div>
          </section>

          <Section
            icon={Sparkles}
            title="Weather Scenario Review"
            action={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={advanceScenario}
                  disabled={!scenarioState.queue.length}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-700 px-3 text-xs font-medium text-slate-300 disabled:opacity-40"
                >
                  <RefreshCw size={14} />
                  Next
                </button>
                <button
                  type="button"
                  onClick={() => generateScenarios()}
                  disabled={scenarioState.loading}
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-cyan-300 px-3 text-xs font-semibold text-slate-950 disabled:opacity-60"
                >
                  <Zap size={14} />
                  New batch
                </button>
              </div>
            }
          >
            <div id="scenario-review" className="rounded-xl border border-cyan-500/30 bg-slate-900/80 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-300">
                    This is a historical weather snapshot
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    {draft.lakeDisplayName}
                  </h2>
                  <div className="mt-1 text-sm text-slate-400">
                    {scenarioDateLabel(draft.date, draft.time)} · {draft.scenarioSeason || weather.season || seasonFromDate(draft.date)} · {draft.scenarioTimeOfDay || timeOfDayFromTime(draft.time)} · {draft.scenarioBucket || 'not bucketed yet'}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <div className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2">
                    <div className="text-[11px] text-slate-500">Question</div>
                    <div className="text-sm font-semibold text-white">Would you paddle?</div>
                  </div>
                  <div className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2">
                    <div className="text-[11px] text-slate-500">Queue</div>
                    <div className="text-sm font-semibold text-white">{scenarioState.queue.length ? `${scenarioState.index + 1}/${scenarioState.queue.length}` : '-'}</div>
                  </div>
                  <div className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2">
                    <div className="text-[11px] text-slate-500">Saved</div>
                    <div className="text-sm font-semibold text-white">{interviewLabels}</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <ReviewFact icon={Thermometer} label="Air" value={formatNumber(weather.temp_c, 1)} suffix="C" />
                <ReviewFact icon={Wind} label="Wind" value={formatNumber(weather.wind_kph, 1)} suffix="kph" tone={windTone} />
                <ReviewFact icon={Zap} label="Gusts" value={formatNumber(weather.gust_kph, 1)} suffix="kph" tone={windTone} />
                <ReviewFact icon={Droplets} label="Water" value={formatNumber(weather.estimated_water_temp_c, 1)} suffix="C" tone={waterTone} />
                <ReviewFact icon={WavesIcon} label="Wave" value={formatNumber(weather.estimated_wave_height_m, 2)} suffix="m" />
                <ReviewFact icon={Activity} label="Rain" value={formatNumber(weather.precip_mm, 2)} suffix="mm" tone={rainTone} />
                <ReviewFact icon={CloudSun} label="Cloud" value={formatNumber(weather.cloud, 0)} suffix="%" />
                <ReviewFact icon={Gauge} label="Generated score" value={formatNumber(weather.paddle_score, 1)} suffix="/5 context" />
                <ReviewFact icon={Wind} label="Beaufort" value={`B${science.beaufort.value}`} suffix={science.beaufort.label} tone={science.beaufort.value >= 5 ? 'warn' : 'neutral'} />
                <ReviewFact icon={WavesIcon} label="Lake size" value={formatNumber(weather.lake_area_km2, 1)} suffix="km2" tone={Number(weather.lake_area_km2) >= 50 ? 'warn' : 'neutral'} />
                <ReviewFact icon={Gauge} label="Visibility" value={formatNumber(weather.vis_km, 1)} suffix="km" tone={Number(weather.vis_km) < 5 ? 'warn' : 'good'} />
                <ReviewFact icon={CloudSun} label="Fog signal" value={science.fogSignal ? 'Yes' : 'No'} suffix="" tone={science.fogSignal ? 'warn' : 'good'} />
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                    What jumps out
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {insights.map((item) => (
                      <InsightChip key={`${item.tone}-${item.text}`} tone={item.tone}>{item.text}</InsightChip>
                    ))}
                    {weather.condition && <InsightChip tone="neutral">{weather.condition}</InsightChip>}
                    {weather.lake_region && <InsightChip tone="neutral">{weather.lake_region}</InsightChip>}
                    {weather.season && <InsightChip tone="neutral">{weather.season}</InsightChip>}
                    {weather.lake_size_class && <InsightChip tone="blue">{weather.lake_size_class} water</InsightChip>}
                    {weather.waterbody_class && <InsightChip tone="neutral">{weather.waterbody_class}</InsightChip>}
                  </div>
                  <div className="mt-3 text-xs leading-5 text-slate-400">
                    Location: {formatNumber(weather.latitude, 4)}, {formatNumber(weather.longitude, 4)}
                    {weather.matched_lake_name ? ` · HydroLAKES: ${weather.matched_lake_name}` : ''}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                    Extracted stats
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MiniBar label="Humidity" value={weather.humidity} max={100} suffix="%" tone="cyan" />
                    <MiniBar label="Cloud" value={weather.cloud} max={100} suffix="%" tone="slate" />
                    <MiniBar label="UV" value={weather.uv} max={11} tone={Number(weather.uv) >= 6 ? 'amber' : 'green'} />
                    <MiniBar label="Visibility" value={weather.vis_km} max={10} suffix=" km" tone="green" />
                    <MiniBar label="Pressure" value={weather.pressure_mb} max={1050} suffix=" mb" tone="cyan" />
                    <MiniBar label="Feels like" value={weather.feelslike_c} max={40} suffix=" C" tone="cyan" />
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950 p-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                    Scientific factor stack
                  </div>
                  <div className="text-xs text-cyan-200">
                    {science.factorCount} real/derived factors from this row and matched lake catalog
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {science.factors.map(([label, value]) => (
                    <FactorCell key={label} label={label} value={value} />
                  ))}
                </div>
              </div>

              <p className="mt-4 rounded-md border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300">
                Review the weather above and answer as yourself: would this have been a good paddling experience for your usual craft and skill level?
              </p>

              <div className="mt-3 rounded-md border border-slate-700 bg-slate-950 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                  Real data proof
                </div>
                <div className="mt-1 break-words text-xs text-slate-300">
                  {currentCsvPath}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Row time: {weather.datetime || `${draft.date} ${draft.time}`}
                  {draft.sourceRowNumber ? ` · CSV row ${draft.sourceRowNumber}` : ''}
                  {draft.sourceKind ? ` · ${draft.sourceKind}` : ''}
                  {weather.lake_context_source === 'hydrolakes' ? ` · lake area from HydroLAKES (${weather.matched_lake_name || 'matched'})` : ''}
                </div>
              </div>

              {scenarioState.error && (
                <p className="mt-3 text-sm text-amber-300">{scenarioState.error}</p>
              )}
            </div>

            <div className="mt-4 rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">Your answer</div>
                  <p className="mt-1 text-sm text-slate-400">
                    These buttons save the label and advance to the next scenario.
                  </p>
                </div>
                {!scenarioState.queue.length && (
                  <button
                    type="button"
                    onClick={() => generateScenarios()}
                    disabled={scenarioState.loading}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-bold text-slate-950 disabled:opacity-60"
                  >
                    <Zap size={16} />
                    Generate scenarios
                  </button>
                )}
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-5">
                {QUICK_RATINGS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => answerScenario(item.value)}
                    disabled={saveState.loading || !scenarioState.queue.length}
                    className={classNames(
                      'min-h-[74px] rounded-md border px-3 py-3 text-left transition disabled:opacity-45',
                      Number(draft.rating) === item.value
                        ? 'border-cyan-300 bg-cyan-300 text-slate-950'
                        : 'border-slate-700 bg-slate-950 text-slate-100 hover:border-cyan-300'
                    )}
                  >
                    <div className="text-lg font-bold tabular">{item.value}</div>
                    <div className="text-sm font-semibold">{item.label}</div>
                    <div className={classNames('mt-1 text-xs', Number(draft.rating) === item.value ? 'text-slate-800' : 'text-slate-500')}>
                      {item.detail}
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-4 rounded-md border border-slate-800 bg-slate-950/70 p-3">
                <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                    Optional reason tags
                  </div>
                  <div className="text-xs text-slate-500">These save with your answer and become model features.</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {REASON_TAGS.map(([tag, label]) => {
                    const active = selectedReasonTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleReasonTag(tag)}
                        className={classNames(
                          'min-h-8 rounded-full border px-3 text-xs font-semibold transition',
                          active
                            ? 'border-cyan-300 bg-cyan-300 text-slate-950'
                            : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-300'
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-500">
                {saveState.message || 'Tip: add notes only when your reason is not obvious from the weather.'}
              </div>
            </div>
          </Section>

          <Section
            icon={SlidersHorizontal}
            title="Optional Details"
            action={
              <button
                type="button"
                onClick={saveRating}
                disabled={saveState.loading}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-400 px-3 text-xs font-semibold text-slate-950 disabled:opacity-60"
              >
                <Save size={15} />
                Save full label
              </button>
            }
          >
            <details className="group">
              <summary className="cursor-pointer list-none rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm font-semibold text-slate-200 marker:hidden">
                Add notes, context, exact weather edits, or deeper ratings
              </summary>

              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_140px_140px_140px]">
                <div className="relative">
                  <Field label="Lake">
                    <div className="relative">
                      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <TextInput
                        value={lakeQuery}
                        onFocus={() => setLakeFocused(true)}
                        onBlur={() => setTimeout(() => setLakeFocused(false), 120)}
                        onChange={(event) => {
                          setLakeQuery(event.target.value);
                          updateDraft('lakeDisplayName', event.target.value);
                          setLakeFocused(true);
                        }}
                        className="pl-9"
                        placeholder="Search downloaded lakes"
                      />
                    </div>
                  </Field>
                  {lakeFocused && lakeOptions.length > 0 && (
                    <div className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-md border border-slate-700 bg-slate-950 shadow-xl">
                      {lakeOptions.slice(0, 10).map((lake) => (
                        <button
                          type="button"
                          key={lake.id}
                          onClick={() => selectLake(lake)}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                        >
                          <span>{lake.name}</span>
                          <span className="text-xs text-slate-500">{lake.files} months</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Field label="Date">
                  <TextInput type="date" value={draft.date} onChange={(event) => updateDraft('date', event.target.value)} />
                </Field>
                <Field label="Time">
                  <TextInput type="time" value={draft.time} onChange={(event) => updateDraft('time', event.target.value)} />
                </Field>
                <Field label="Minutes">
                  <TextInput type="number" min="10" value={draft.durationMinutes} onChange={(event) => updateDraft('durationMinutes', event.target.value)} />
                </Field>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Skill context">
                  <Segment value={draft.skillLevel} onChange={(value) => updateDraft('skillLevel', value)} options={OPTION_SETS.skillLevel} />
                </Field>
                <Field label="Craft">
                  <Segment value={draft.boatType} onChange={(value) => updateDraft('boatType', value)} options={OPTION_SETS.boatType} />
                </Field>
                <Field label="Goal">
                  <Segment value={draft.sessionGoal} onChange={(value) => updateDraft('sessionGoal', value)} options={OPTION_SETS.sessionGoal} />
                </Field>
                <Field label="Paddlers">
                  <Segment value={draft.groupType} onChange={(value) => updateDraft('groupType', value)} options={OPTION_SETS.groupType} />
                </Field>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <SliderQuestion label="Overall rating" value={draft.rating} onChange={(value) => updateDraft('rating', value)} left="Never again" right="Perfect" />
                <SliderQuestion label="Safety" value={draft.safetyRating} onChange={(value) => updateDraft('safetyRating', value)} left="Sketchy" right="Clean" />
                <SliderQuestion label="Enjoyment" value={draft.enjoymentRating} onChange={(value) => updateDraft('enjoymentRating', value)} left="Bad" right="Loved it" />
                <SliderQuestion label="Confidence" value={draft.confidence} onChange={(value) => updateDraft('confidence', value)} left="Guess" right="Certain" />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Felt wind">
                  <Segment value={draft.answers.windFelt} onChange={(value) => updateAnswer('windFelt', value)} options={OPTION_SETS.windFelt} />
                </Field>
                <Field label="Felt water">
                  <Segment value={draft.answers.waveFelt} onChange={(value) => updateAnswer('waveFelt', value)} options={OPTION_SETS.waveFelt} />
                </Field>
                <Field label="Launch">
                  <Segment value={draft.answers.launchDifficulty} onChange={(value) => updateAnswer('launchDifficulty', value)} options={OPTION_SETS.launchDifficulty} />
                </Field>
                <Field label="Crowding">
                  <Segment value={draft.answers.crowding} onChange={(value) => updateAnswer('crowding', value)} options={OPTION_SETS.crowding} />
                </Field>
                <Field label="Fatigue">
                  <Segment value={draft.answers.fatigue} onChange={(value) => updateAnswer('fatigue', value)} options={OPTION_SETS.fatigue} />
                </Field>
                <Field label="Would repeat">
                  <Toggle checked={draft.wouldPaddleAgain} onChange={(value) => updateDraft('wouldPaddleAgain', value)} label={draft.wouldPaddleAgain ? 'Yes' : 'No'} />
                </Field>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-5">
                {[
                  ['temp_c', 'Air C'],
                  ['wind_kph', 'Wind kph'],
                  ['gust_kph', 'Gust kph'],
                  ['estimated_wave_height_m', 'Wave m'],
                  ['estimated_water_temp_c', 'Water C'],
                ].map(([key, label]) => (
                  <Field key={key} label={label}>
                    <TextInput
                      type="number"
                      step="0.1"
                      value={weather[key] ?? ''}
                      onChange={(event) => updateWeather(key, event.target.value)}
                    />
                  </Field>
                ))}
              </div>

              <textarea
                value={draft.notes}
                onChange={(event) => updateDraft('notes', event.target.value)}
                rows={4}
                className="mt-4 w-full resize-y rounded-md border border-slate-700 bg-slate-900 p-3 text-sm text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                placeholder="Example: calm at launch, got choppy after 30 min, cold hands, still worth it."
              />

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-slate-500">
                  {saveState.message || weatherState.error || 'Quick answer is enough unless something important is missing.'}
                </div>
                <button
                  type="button"
                  onClick={() => setDraft(createDraft())}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-700 px-3 text-xs font-medium text-slate-300"
                >
                  <Sparkles size={14} />
                  Clear
                </button>
              </div>
            </details>
          </Section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Section icon={BarChart3} title="Dataset & Balance">
            <div className="space-y-4">
              <div className="rounded-md border border-slate-800 bg-slate-900/70 p-3">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Calibration</span>
                  <span className="font-semibold tabular text-slate-100">{ratings.length}/200</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-800">
                  <div className="h-2.5 rounded-full bg-cyan-300" style={{ width: `${Math.min(100, (ratings.length / 200) * 100)}%` }} />
                </div>
                <div className="mt-2 text-xs text-slate-500">Strong target: 500 labels across 25+ lakes.</div>
              </div>

              {skewWarning && (
                <div className="rounded-md border border-amber-500/40 bg-amber-950/30 p-3 text-xs leading-5 text-amber-100">
                  One rating bucket dominates. Use the filters to add borderline and good days.
                </div>
              )}

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Rating spread</div>
                {[1, 2, 3, 4, 5].map((rating) => (
                  <DistributionBar
                    key={rating}
                    label={`${rating} ${QUICK_RATINGS[rating - 1].label}`}
                    count={ratingCounts[rating]}
                    total={ratings.length}
                    tone={rating <= 2 ? 'red' : rating === 3 ? 'amber' : 'green'}
                  />
                ))}
              </div>

              <details className="rounded-md border border-slate-800 bg-slate-900/50 p-3">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">
                  Weather coverage and source proof
                </summary>
                <div className="mt-3 space-y-2">
                  {WEATHER_BUCKETS.map((bucket) => (
                    <DistributionBar
                      key={bucket}
                      label={bucket}
                      count={bucketCounts[bucket] || 0}
                      total={ratings.length}
                      tone={bucket === 'normal' ? 'cyan' : bucket === 'calm' ? 'green' : 'amber'}
                    />
                  ))}
                  <ProcessRow number="1" title="Real row" body={`Current scenario: ${currentCsvPath}`} />
                  <ProcessRow number="2" title="Saved target" body="Your 1-5 click is the label. Weather and source metadata are stored with it." />
                  <ProcessRow number="3" title="Validation" body={modelResult?.ready ? `${modelResult.splitStrategy}: ${modelResult.trainCount} train / ${modelResult.testCount} test.` : 'Auto-trains as labels arrive once enough examples exist.'} />
                </div>
              </details>
            </div>
          </Section>

          <Section
            icon={BrainCircuit}
            title="Training Results"
            action={
              <button
                type="button"
                onClick={trainModel}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-cyan-300 px-3 text-xs font-semibold text-slate-950"
              >
                <BrainCircuit size={15} />
                Train
              </button>
            }
          >
            <div className="grid grid-cols-2 gap-2">
              <Toggle
                checked={modelOptions.includeHumanContext}
                onChange={(value) => setModelOptions((current) => ({ ...current, includeHumanContext: value }))}
                label="Question answers"
              />
              <Toggle
                checked={modelOptions.includeNotes}
                onChange={(value) => setModelOptions((current) => ({ ...current, includeNotes: value }))}
                label="Note signals"
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <CompactStat label="Prediction" value={prediction ? formatNumber(prediction, 2) : '-'} sub="current scenario" tone={prediction ? 'warn' : 'neutral'} />
              <CompactStat label="Split" value={modelResult?.splitStrategy || '-'} sub={`${modelResult?.trainCount || 0} train / ${modelResult?.testCount || 0} test`} tone="blue" />
              <CompactStat label="MAE" value={modelResult?.ready ? formatNumber(modelResult.validation.mae, 2) : '-'} sub="lower is better" tone={modelResult?.ready ? 'good' : 'neutral'} />
              <CompactStat label="Vs avg" value={modelResult?.ready ? `${formatNumber((modelResult.validation.maeLift || 0) * 100, 0)}%` : '-'} sub="MAE lift vs baseline" tone={modelResult?.validation?.maeLift > 0 ? 'good' : 'warn'} />
              <CompactStat label="R2" value={modelResult?.ready ? formatNumber(modelResult.validation.r2, 2) : '-'} sub={`${notesCount} labels have notes`} tone={modelResult?.ready ? 'blue' : 'neutral'} />
              <CompactStat label="Features" value={modelResult?.featureNames?.length || 0} sub="science + context" tone="blue" />
            </div>

            {modelResult?.ready ? (
              <div className="mt-4 space-y-3">
                <div className="h-52 rounded-md border border-slate-800 bg-slate-900/60 p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={modelResult.featureWeights.slice(0, 8)} layout="vertical" margin={{ left: 12, right: 10, top: 4, bottom: 4 }}>
                      <CartesianGrid stroke="#1e293b" horizontal={false} />
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="label" width={88} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#020617', border: '1px solid #334155', color: '#e2e8f0' }} />
                      <Bar dataKey="weight" fill="#67e8f9" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-44 rounded-md border border-slate-800 bg-slate-900/60 p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={modelResult.testRows}>
                      <CartesianGrid stroke="#1e293b" />
                      <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis domain={[1, 5]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#020617', border: '1px solid #334155', color: '#e2e8f0' }} />
                      <Line type="monotone" dataKey="actual" stroke="#34d399" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="predicted" stroke="#67e8f9" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-950/20 p-3 text-sm text-amber-100">
                {modelResult?.reason || 'Train after saving a few real scenarios.'}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!ratings.length}
                onClick={() => downloadFile('paddle-human-ratings.csv', recordsToCsv(ratings), 'text/csv')}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-700 px-3 text-xs font-medium text-slate-300 disabled:opacity-40"
              >
                <FileDown size={14} />
                CSV
              </button>
              <button
                type="button"
                disabled={!ratings.length}
                onClick={() => downloadFile('paddle-human-ratings.json', JSON.stringify(ratings, null, 2), 'application/json')}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-700 px-3 text-xs font-medium text-slate-300 disabled:opacity-40"
              >
                <Download size={14} />
                Labels
              </button>
              <button
                type="button"
                disabled={!modelExport}
                onClick={() => downloadFile('personal-paddle-model.json', modelExport, 'application/json')}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-700 px-3 text-xs font-medium text-slate-300 disabled:opacity-40"
              >
                <BarChart3 size={14} />
                Model
              </button>
            </div>
          </Section>

          <Section icon={Gauge} title="Patterns">
            <div className="space-y-3">
              {[
                ['Weather', patternRows.bucket],
                ['Season', patternRows.season],
                ['Time', patternRows.time],
                ['Lake size', patternRows.size],
              ].map(([label, rows]) => (
                <div key={label}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</div>
                  <div className="space-y-2">
                    {rows.length ? rows.slice(0, 3).map((row) => (
                      <PatternRow key={`${label}-${row.label}`} label={row.label} count={row.count} average={row.average} />
                    )) : (
                      <div className="rounded-md border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-400">No labels yet.</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section icon={NotebookPen} title="Recent Labels">
            <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
              {ratings.length === 0 ? (
                <div className="rounded-md border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
                  No labels yet.
                </div>
              ) : (
                ratings.slice(0, 12).map((record) => (
                  <div key={record.id} className="rounded-md border border-slate-800 bg-slate-900/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-100">{record.lakeDisplayName || record.lake}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1"><CalendarDays size={12} />{record.date}</span>
                          <span className="inline-flex items-center gap-1"><Clock3 size={12} />{record.time}</span>
                          <span className="font-semibold" style={{ color: scoreColor(record.rating) }}>{record.rating}/5</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteRating(record.id)}
                        className="rounded-md border border-slate-700 p-2 text-slate-400 hover:border-red-400 hover:text-red-300"
                        aria-label="Delete label"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    {record.notes && <p className="mt-2 line-clamp-2 text-xs text-slate-400">{record.notes}</p>}
                  </div>
                ))
              )}
            </div>
          </Section>
        </aside>
      </main>
    </div>
  );
}
