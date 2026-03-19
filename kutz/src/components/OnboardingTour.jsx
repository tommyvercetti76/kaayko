import { useState, useEffect, useRef } from 'react';
import {
  Mic, Search, ScanBarcode, Camera, Droplets,
  BarChart2, Settings, ChevronRight, X, Check,
} from 'lucide-react';
import { COLORS } from '../lib/constants';

// ─── Mini preview widgets (illustrate each feature) ───────────────────────────

function VoicePreview() {
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setDots(d => (d % 3) + 1), 500);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="w-full rounded-2xl p-5 space-y-4" style={{ background: '#0a0f1a', border: '1px solid #1e293b' }}>
      {/* Mock text field with pulse */}
      <div className="flex gap-3 items-center">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: COLORS.green }}>
          <Mic size={20} color="#020617" />
        </div>
        <div className="flex-1 rounded-xl px-3 py-2.5 text-sm" style={{ background: '#020617', border: `1px solid ${COLORS.green}55` }}>
          <span style={{ color: '#94a3b8' }}>Had two idlis and chai for breakfast</span>
          <span className="ml-1 animate-pulse" style={{ color: COLORS.green }}>●</span>
        </div>
      </div>
      {/* Mock preview card */}
      <div className="rounded-xl px-4 py-3 space-y-1" style={{ background: '#020617', border: '1px solid #1e293b' }}>
        <p className="text-xs font-semibold" style={{ color: COLORS.textPrimary }}>2× Idli + Sambar</p>
        <p className="text-xs tabular" style={{ color: COLORS.textMuted }}>
          <span style={{ color: COLORS.amber }}>240 kcal</span>
          {'  '}·{'  '}
          <span style={{ color: COLORS.green }}>8g P</span>
          {'  '}·{'  '}42g C{'  '}·{'  '}3g F
        </p>
      </div>
      <div className="rounded-xl px-4 py-3 space-y-1" style={{ background: '#020617', border: '1px solid #1e293b' }}>
        <p className="text-xs font-semibold" style={{ color: COLORS.textPrimary }}>Masala Chai (1 cup)</p>
        <p className="text-xs tabular" style={{ color: COLORS.textMuted }}>
          <span style={{ color: COLORS.amber }}>80 kcal</span>
          {'  '}·{'  '}
          <span style={{ color: COLORS.green }}>3g P</span>
          {'  '}·{'  '}12g C{'  '}·{'  '}2g F
        </p>
      </div>
    </div>
  );
}

function SearchPreview() {
  return (
    <div className="w-full rounded-2xl p-5 space-y-3" style={{ background: '#0a0f1a', border: '1px solid #1e293b' }}>
      <div className="flex gap-2 items-center rounded-xl px-3 py-2.5" style={{ background: '#020617', border: '1px solid #1e293b' }}>
        <Search size={14} style={{ color: COLORS.textMuted }} />
        <span className="text-sm" style={{ color: COLORS.textMuted }}>Search "Chobani Greek Yogurt"</span>
      </div>
      {/* Results */}
      {['Chobani Plain (0%)', 'Chobani Vanilla', 'Chobani Mango'].map((name, i) => (
        <div key={i} className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: '#020617', border: '1px solid #1e293b' }}>
          <div>
            <p className="text-xs font-medium" style={{ color: COLORS.textPrimary }}>{name}</p>
            <p className="text-xs tabular mt-0.5" style={{ color: COLORS.textMuted }}>170g · <span style={{ color: COLORS.amber }}>100 kcal</span></p>
          </div>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: COLORS.green + '22', border: `1px solid ${COLORS.green}44` }}>
            <span style={{ color: COLORS.green, fontSize: 16, lineHeight: 1 }}>+</span>
          </div>
        </div>
      ))}
      {/* Action buttons row */}
      <div className="flex gap-2 pt-1">
        <div className="flex-1 rounded-xl flex items-center justify-center gap-2 py-2.5" style={{ background: '#020617', border: '1px solid #334155' }}>
          <ScanBarcode size={14} style={{ color: COLORS.textSecondary }} />
          <span className="text-xs" style={{ color: COLORS.textSecondary }}>Scan</span>
        </div>
        <div className="flex-1 rounded-xl flex items-center justify-center gap-2 py-2.5" style={{ background: '#020617', border: '1px solid #334155' }}>
          <Camera size={14} style={{ color: COLORS.textSecondary }} />
          <span className="text-xs" style={{ color: COLORS.textSecondary }}>Photo</span>
        </div>
      </div>
    </div>
  );
}

function WaterPreview() {
  const FILLED = 5;
  return (
    <div className="w-full rounded-2xl p-5" style={{ background: '#0a0f1a', border: '1px solid #1e293b' }}>
      <div className="flex items-center gap-3">
        <Droplets size={20} style={{ color: '#38bdf8' }} />
        <div className="flex gap-1.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 14, height: 14, borderRadius: '50%',
                background: i < FILLED ? '#38bdf8' : '#1e293b',
                border: `1px solid ${i < FILLED ? '#38bdf8' : '#334155'}`,
                transition: 'background 0.15s',
              }}
            />
          ))}
        </div>
        <span className="text-xs tabular ml-1" style={{ color: '#38bdf8' }}>1.3 / 2.5 L</span>
      </div>
      <p className="text-xs mt-4" style={{ color: COLORS.textMuted }}>
        Each dot = ¼ litre. Tap <span style={{ color: '#38bdf8' }}>+</span> every time you finish a glass.
      </p>
    </div>
  );
}

function WeekPreview() {
  const bars = [60, 80, 45, 90, 75, 55, 100];
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <div className="w-full rounded-2xl p-5 space-y-3" style={{ background: '#0a0f1a', border: '1px solid #1e293b' }}>
      <div className="flex items-end gap-2 h-20">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t-md"
              style={{ height: `${h}%`, background: i === 6 ? COLORS.amber : COLORS.amber + '55' }}
            />
            <span className="text-xs" style={{ color: COLORS.textMuted }}>{labels[i]}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Avg Cal',  value: '1420', color: COLORS.amber },
          { label: 'Avg Prot', value: '88g',  color: COLORS.green },
          { label: 'Streak',   value: '7d',   color: '#818cf8'    },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl py-2 text-center" style={{ background: '#020617', border: '1px solid #1e293b' }}>
            <p className="text-sm font-bold tabular" style={{ color }}>{value}</p>
            <p className="text-xs mt-0.5" style={{ color: COLORS.textMuted }}>{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RingPreview() {
  const r = 44, stroke = 8;
  const circ = 2 * Math.PI * r;
  const filled = circ * 0.62;
  return (
    <div className="w-full rounded-2xl p-5 flex flex-col items-center gap-3" style={{ background: '#0a0f1a', border: '1px solid #1e293b' }}>
      <div className="relative">
        <svg width={110} height={110} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={55} cy={55} r={r} fill="none" stroke="#1e293b" strokeWidth={stroke} />
          <circle
            cx={55} cy={55} r={r} fill="none"
            stroke={COLORS.amber} strokeWidth={stroke}
            strokeDasharray={`${filled} ${circ}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-bold text-xl tabular" style={{ color: COLORS.textPrimary }}>980</span>
          <span className="text-xs" style={{ color: COLORS.textMuted }}>remaining</span>
        </div>
      </div>
      <div className="flex gap-3 text-xs tabular" style={{ color: COLORS.textMuted }}>
        <span><span style={{ color: COLORS.amber }}>670</span> kcal eaten</span>
        <span>·</span>
        <span><span style={{ color: COLORS.green }}>42g</span> P</span>
        <span>·</span>
        <span>88g C</span>
      </div>
    </div>
  );
}

// ─── Slide definitions ─────────────────────────────────────────────────────────

const SLIDES = [
  {
    id:      'welcome',
    emoji:   '🥗',
    title:   'Welcome to KaleKutz',
    body:    'Your personal nutrition companion — designed to make tracking feel effortless, not like homework.',
    preview: null,
  },
  {
    id:      'ring',
    emoji:   null,
    title:   'Your day at a glance',
    body:    'The calorie ring shows how much you have left for the day. Macros sit below — no clutter.',
    preview: <RingPreview />,
  },
  {
    id:      'voice',
    emoji:   null,
    title:   'Just speak what you ate',
    body:    'Tap the mic and describe your meal naturally. KaleKutz figures out the nutrition for you.',
    preview: <VoicePreview />,
  },
  {
    id:      'search',
    emoji:   null,
    title:   'Search, scan, or snap',
    body:    'Tap the search icon to find any food. Or scan a barcode at the store. Or photograph your plate.',
    preview: <SearchPreview />,
  },
  {
    id:      'water',
    emoji:   null,
    title:   'Stay hydrated',
    body:    'Tap + for every glass you drink. Each dot is a quarter litre toward your daily goal.',
    preview: <WaterPreview />,
  },
  {
    id:      'week',
    emoji:   null,
    title:   'See your week',
    body:    'The Week tab shows charts, averages, and an AI-written nutrition report — just tap "Generate".',
    preview: <WeekPreview />,
  },
  {
    id:      'done',
    emoji:   '✅',
    title:   "You're all set!",
    body:    "Start by telling KaleKutz what you had today. Tap the mic and speak naturally — it's that simple.",
    preview: null,
  },
];

// ─── OnboardingTour ────────────────────────────────────────────────────────────

const STORAGE_KEY = 'kutz_onboarding_v1';

export function useOnboarding() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      // Small delay so the app renders first
      const t = setTimeout(() => setShow(true), 400);
      return () => clearTimeout(t);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setShow(false);
  }

  return { show, dismiss };
}

export default function OnboardingTour({ onDone }) {
  const [step, setStep]       = useState(0);
  const [exiting, setExiting] = useState(false);
  const [dir, setDir]         = useState(1); // 1 = forward, -1 = back
  const [visible, setVisible] = useState(true);

  const current = SLIDES[step];
  const isLast  = step === SLIDES.length - 1;
  const isFirst = step === 0;

  function goTo(next) {
    if (next === step) return;
    setDir(next > step ? 1 : -1);
    setExiting(true);
    setTimeout(() => {
      setStep(next);
      setExiting(false);
    }, 180);
  }

  function advance() {
    if (isLast) {
      finish();
    } else {
      goTo(step + 1);
    }
  }

  function finish() {
    setVisible(false);
    setTimeout(onDone, 300);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        background: COLORS.bg,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 pt-12 pb-4">
        {/* Progress bar */}
        <div className="flex gap-1.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width:      i === step ? 24 : 6,
                height:     6,
                background: i === step ? COLORS.green : (i < step ? COLORS.green + '55' : '#1e293b'),
              }}
            />
          ))}
        </div>

        {/* Skip */}
        {!isLast && (
          <button
            onClick={finish}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ color: COLORS.textMuted, background: '#0a0f1a', border: '1px solid #1e293b' }}
          >
            Skip
          </button>
        )}
      </div>

      {/* ── Slide body ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center px-6 overflow-hidden">
        <div
          style={{
            transform:  exiting ? `translateX(${dir * -40}px)` : 'translateX(0)',
            opacity:    exiting ? 0 : 1,
            transition: 'transform 0.18s ease, opacity 0.18s ease',
          }}
        >
          {/* Big emoji or icon for first/last */}
          {current.emoji && (
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 mx-auto"
              style={{ background: '#0a0f1a', border: '1px solid #1e293b', fontSize: 40 }}
            >
              {current.emoji}
            </div>
          )}

          {/* Title */}
          <h1 className="text-2xl font-bold leading-tight mb-3" style={{ color: COLORS.textPrimary }}>
            {current.title}
          </h1>

          {/* Body */}
          <p className="text-base leading-relaxed mb-6" style={{ color: COLORS.textSecondary }}>
            {current.body}
          </p>

          {/* Feature preview widget */}
          {current.preview && (
            <div className="w-full">
              {current.preview}
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────────── */}
      <div className="px-6 pb-12 space-y-3">
        {/* Main CTA */}
        <button
          onClick={advance}
          className="w-full py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 active:scale-98 transition-transform"
          style={{ background: COLORS.green, color: '#020617' }}
        >
          {isLast
            ? <><Check size={18} /> Let&apos;s go</>
            : <>Next <ChevronRight size={18} /></>
          }
        </button>

        {/* Step counter */}
        <p className="text-center text-xs tabular" style={{ color: COLORS.textMuted }}>
          {step + 1} of {SLIDES.length}
        </p>
      </div>
    </div>
  );
}
