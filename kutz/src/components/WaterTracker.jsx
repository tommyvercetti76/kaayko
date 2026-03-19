import { useState } from 'react';
import { logWater } from '../lib/firestore';
import { useProfile } from '../context/ProfileContext';

const WATER_COLOR = '#38bdf8';
const DOTS = 10;

/**
 * Compact water tracker: 10 glass dots, tap + / - to fill.
 * Each dot = waterTarget / 10 ml.
 */
export default function WaterTracker({ uid, dateKey, water = 0 }) {
  const { waterTarget } = useProfile();
  const [pending, setPending] = useState(false);

  const mlPerDot  = Math.round(waterTarget / DOTS);
  const filled    = Math.min(DOTS, Math.max(0, Math.round(water / mlPerDot)));
  const waterL    = (water / 1000).toFixed(1);
  const targetL   = (waterTarget / 1000).toFixed(1);

  async function adjust(delta) {
    if (pending || !uid) return;
    const ml = delta * mlPerDot;
    // Clamp: don't go below 0
    if (delta < 0 && water <= 0) return;
    setPending(true);
    try {
      await logWater(uid, dateKey, ml);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-3 px-4">
      <span style={{ fontSize: 16 }}>💧</span>

      {/* Dots */}
      <div className="flex gap-1">
        {Array.from({ length: DOTS }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: i < filled ? WATER_COLOR : '#1e293b',
              border: `1px solid ${i < filled ? WATER_COLOR : '#334155'}`,
              transition: 'background 0.15s',
            }}
          />
        ))}
      </div>

      {/* Label */}
      <span className="text-xs tabular" style={{ color: WATER_COLOR, minWidth: 56 }}>
        {waterL} / {targetL} L
      </span>

      {/* Controls */}
      <div className="flex gap-1 ml-auto">
        <button
          onClick={() => adjust(-1)}
          disabled={pending || water <= 0}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
          style={{ background: '#1e293b', color: water > 0 ? WATER_COLOR : '#334155' }}
        >
          −
        </button>
        <button
          onClick={() => adjust(+1)}
          disabled={pending}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
          style={{ background: WATER_COLOR + '22', border: `1px solid ${WATER_COLOR}44`, color: WATER_COLOR }}
        >
          +
        </button>
      </div>
    </div>
  );
}
