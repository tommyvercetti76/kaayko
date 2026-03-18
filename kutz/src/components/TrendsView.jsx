import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';
import { useAllDays } from '../hooks/useAllDays';
import { rollingAvg7, cumulativeDeficit, totalBurn } from '../lib/calculations';
import { COLORS } from '../lib/constants';
import { useProfile } from '../context/ProfileContext';
import { Loader2 } from 'lucide-react';

function fmt(dateStr) {
  if (!dateStr) return '';
  const [, m, d] = dateStr.split('-');
  return `${m}/${d}`;
}

export default function TrendsView({ uid }) {
  const { days, loading } = useAllDays(uid, 30);
  const { targets } = useProfile();

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 size={24} className="animate-spin" style={{ color: COLORS.textMuted }} />
    </div>
  );
  if (days.length === 0) return (
    <p className="text-center py-16 text-sm" style={{ color: COLORS.textMuted }}>No data yet</p>
  );

  const withRolling = rollingAvg7(days.map(d => ({ ...d, calories: Math.round(d.calories || 0) })));

  const withDeficit = cumulativeDeficit(
    days.map(d => ({
      ...d,
      calories: Math.round(d.calories || 0),
      burn:     totalBurn(d),
    }))
  );

  const totalCumDeficit = withDeficit[withDeficit.length - 1]?.cumDeficit || 0;
  const totalLbs        = withDeficit[withDeficit.length - 1]?.lbs        || 0;

  return (
    <div className="px-4 space-y-6 pb-8">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 pt-4">
        <div className="rounded-xl px-3 py-3 text-center" style={{ background: '#0a0f1a', border: '1px solid #1e293b' }}>
          <p className="tabular text-xl font-bold" style={{ color: totalCumDeficit >= 0 ? COLORS.green : COLORS.red }}>
            {Math.abs(Math.round(totalCumDeficit))}<span className="text-xs ml-0.5">kcal</span>
          </p>
          <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
            Cumulative {totalCumDeficit >= 0 ? 'deficit' : 'surplus'}
          </p>
        </div>
        <div className="rounded-xl px-3 py-3 text-center" style={{ background: '#0a0f1a', border: '1px solid #1e293b' }}>
          <p className="tabular text-xl font-bold" style={{ color: totalLbs >= 0 ? COLORS.green : COLORS.red }}>
            {Math.abs(totalLbs).toFixed(1)}<span className="text-xs ml-0.5">lbs</span>
          </p>
          <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
            Est. {totalLbs >= 0 ? 'lost' : 'gained'}
          </p>
        </div>
      </div>

      {/* 7-day rolling avg */}
      <div>
        <p className="text-xs mb-3" style={{ color: COLORS.textMuted }}>7-day rolling avg calories</p>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={withRolling.map(d => ({ ...d, date: fmt(d.date) }))} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="calGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={COLORS.amber} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS.amber} stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="date" tick={{ fill: COLORS.textMuted, fontSize: 10 }} />
            <YAxis tick={{ fill: COLORS.textMuted, fontSize: 10 }} />
            <Tooltip contentStyle={{ background: '#0a0f1a', border: '1px solid #1e293b', borderRadius: 12, fontSize: 11 }} />
            <ReferenceLine y={targets.calories} stroke={COLORS.amber} strokeDasharray="4 2" strokeOpacity={0.4} />
            <Area dataKey="rollingAvg" name="7d avg" stroke={COLORS.amber} fill="url(#calGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Cumulative deficit */}
      <div>
        <p className="text-xs mb-3" style={{ color: COLORS.textMuted }}>Cumulative deficit (kcal)</p>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={withDeficit.map(d => ({ ...d, date: fmt(d.date) }))} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="defGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={COLORS.green} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS.green} stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="date" tick={{ fill: COLORS.textMuted, fontSize: 10 }} />
            <YAxis tick={{ fill: COLORS.textMuted, fontSize: 10 }} />
            <Tooltip
              contentStyle={{ background: '#0a0f1a', border: '1px solid #1e293b', borderRadius: 12, fontSize: 11 }}
              formatter={(v, n) => [Math.round(v), n]}
            />
            <Area dataKey="cumDeficit" name="Deficit" stroke={COLORS.green} fill="url(#defGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Daily deficit bars (last 14 days) */}
      <div>
        <p className="text-xs mb-3" style={{ color: COLORS.textMuted }}>Daily deficit / surplus</p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart
            data={withDeficit.slice(-14).map(d => ({ date: fmt(d.date), deficit: d.burn - d.calories }))}
            margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="date" tick={{ fill: COLORS.textMuted, fontSize: 10 }} />
            <YAxis tick={{ fill: COLORS.textMuted, fontSize: 10 }} />
            <Tooltip contentStyle={{ background: '#0a0f1a', border: '1px solid #1e293b', borderRadius: 12, fontSize: 11 }} />
            <ReferenceLine y={0} stroke="#1e293b" />
            <Bar dataKey="deficit" name="Deficit" radius={[3, 3, 0, 0]}>
              {withDeficit.slice(-14).map((d, i) => (
                <Cell key={i} fill={(d.burn - d.calories) >= 0 ? COLORS.green : COLORS.red} fillOpacity={0.75} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
