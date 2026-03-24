import { useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, BarChart,
} from 'recharts';
import { useAllDays } from '../hooks/useAllDays';
import { totalBurn } from '../lib/calculations';
import { COLORS } from '../lib/constants';
import { useProfile } from '../context/ProfileContext';
import { getWeeklyReport } from '../lib/claude';
import { Loader2 } from 'lucide-react';
import SuggestPanel from './SuggestPanel';

function fmt(dateStr) {
  if (!dateStr) return '';
  const [, , d] = dateStr.split('-');
  return d;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs" style={{ background: '#0a0f1a', border: '1px solid #1e293b' }}>
      <p className="font-medium mb-1" style={{ color: COLORS.textPrimary }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {Math.round(p.value)}</p>
      ))}
    </div>
  );
}

export default function WeekView({ uid }) {
  const { targets, profileStartDate } = useProfile();
  const { days, loading }             = useAllDays(uid, 7, profileStartDate);

  const [report,        setReport]        = useState('');
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportErr,     setReportErr]     = useState('');

  const chartData = days.map(d => ({
    date:    fmt(d.date),
    Intake:  Math.round(d.calories || 0),
    Burn:    Math.round(totalBurn(d)),
    Protein: Math.round(d.protein  || 0),
    Carbs:   Math.round(d.carbs    || 0),
  }));

  const avg = key => days.length
    ? Math.round(days.reduce((s, d) => s + (Number(d[key]) || 0), 0) / days.length)
    : 0;

  async function fetchReport() {
    setLoadingReport(true); setReportErr('');
    try { const { report: r } = await getWeeklyReport(); setReport(r); }
    catch (e) { setReportErr(e.message); }
    finally { setLoadingReport(false); }
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 size={24} className="animate-spin" style={{ color: COLORS.textMuted }} />
    </div>
  );

  return (
    <div className="px-4 space-y-6 pb-8">
      {/* AI Suggestions */}
      <div className="pt-4">
        <SuggestPanel
          onAddSuggestion={(s) => {
            // Fix #4 — dispatch food objects directly; no re-parse via Claude
            const food = {
              name:     s.label,
              quantity: s.foods || '1 serving',
              calories: Number(s.calories) || 0,
              protein:  Number(s.protein)  || 0,
              carbs:    Number(s.carbs)    || 0,
              fat:      Number(s.fat)      || 0,
              fiber:    Number(s.fiber)    || 0,
              iron: 0, calcium: 0, b12: 0, zinc: 0,
              meal:   s.meal || 'snacks',
              source: 'suggestion',
            };
            window.dispatchEvent(new CustomEvent('kutz:addFoods', { detail: [food] }));
          }}
        />
      </div>

      {/* Averages */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Calories', value: avg('calories'), color: COLORS.amber,  unit: 'kcal' },
          { label: 'Protein',  value: avg('protein'),  color: COLORS.green,  unit: 'g'    },
          { label: 'Carbs',    value: avg('carbs'),    color: COLORS.textSecondary, unit: 'g' },
          { label: 'Fat',      value: avg('fat'),      color: COLORS.textSecondary, unit: 'g' },
        ].map(({ label, value, color, unit }) => (
          <div key={label} className="rounded-xl px-2 py-3 text-center" style={{ background: '#0a0f1a', border: '1px solid #1e293b' }}>
            <p className="tabular text-lg font-bold" style={{ color }}>
              {value}<span className="text-xs ml-0.5">{unit}</span>
            </p>
            <p className="text-xs mt-0.5" style={{ color: COLORS.textMuted }}>Avg {label}</p>
          </div>
        ))}
      </div>

      {/* Intake vs Burn */}
      <div>
        <p className="text-xs mb-3" style={{ color: COLORS.textMuted }}>Intake vs Burn</p>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="date" tick={{ fill: COLORS.textMuted, fontSize: 11 }} />
            <YAxis tick={{ fill: COLORS.textMuted, fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={targets.calories} stroke={COLORS.amber} strokeDasharray="4 2" strokeOpacity={0.5} />
            <Bar dataKey="Intake" fill={COLORS.amber} fillOpacity={0.7} radius={[4, 4, 0, 0]} />
            <Line dataKey="Burn" stroke={COLORS.green} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Protein + Carbs side by side */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs mb-2" style={{ color: COLORS.textMuted }}>Protein (g)</p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={chartData} margin={{ top: 4, right: 2, bottom: 0, left: -24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fill: COLORS.textMuted, fontSize: 9 }} />
              <YAxis tick={{ fill: COLORS.textMuted, fontSize: 9 }} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={targets.protein} stroke={COLORS.green} strokeDasharray="4 2" strokeOpacity={0.5} />
              <Bar dataKey="Protein" fill={COLORS.green} fillOpacity={0.8} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <p className="text-xs mb-2" style={{ color: COLORS.textMuted }}>Carbs (g)</p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={chartData} margin={{ top: 4, right: 2, bottom: 0, left: -24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fill: COLORS.textMuted, fontSize: 9 }} />
              <YAxis tick={{ fill: COLORS.textMuted, fontSize: 9 }} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={targets.carbs} stroke={COLORS.textSecondary} strokeDasharray="4 2" strokeOpacity={0.4} />
              <Bar dataKey="Carbs" fill={COLORS.textSecondary} fillOpacity={0.5} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Day-by-day table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e293b' }}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: '#0a0f1a' }}>
              {['Date', 'Cal', 'Prot', 'Carbs', 'Fat', 'Fiber'].map(h => (
                <th key={h} className="px-2 py-2 text-left font-medium" style={{ color: COLORS.textMuted }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...days].reverse().map(d => (
              <tr key={d.date} style={{ borderTop: '1px solid #1e293b' }}>
                <td className="px-2 py-2 tabular" style={{ color: COLORS.textSecondary }}>{fmt(d.date)}</td>
                <td className="px-2 py-2 tabular" style={{ color: COLORS.amber }}>{Math.round(d.calories || 0)}</td>
                <td className="px-2 py-2 tabular" style={{ color: COLORS.green }}>{Math.round(d.protein  || 0)}g</td>
                <td className="px-2 py-2 tabular" style={{ color: COLORS.textSecondary }}>{Math.round(d.carbs || 0)}g</td>
                <td className="px-2 py-2 tabular" style={{ color: COLORS.textSecondary }}>{Math.round(d.fat  || 0)}g</td>
                <td className="px-2 py-2 tabular" style={{ color: COLORS.textSecondary }}>{Math.round(d.fiber || 0)}g</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Weekly Report */}
      <div>
        {!report && !loadingReport && (
          <button
            onClick={fetchReport}
            className="w-full py-3 rounded-xl text-sm font-medium"
            style={{ background: '#0a0f1a', border: '1px solid #1e293b', color: COLORS.green }}
          >
            Generate Weekly Report
          </button>
        )}
        {loadingReport && (
          <div className="flex items-center gap-2 justify-center text-sm" style={{ color: COLORS.textSecondary }}>
            <Loader2 size={14} className="animate-spin" /> Analyzing your week…
          </div>
        )}
        {reportErr && <p className="text-sm" style={{ color: COLORS.red }}>{reportErr}</p>}
        {report && (
          <div className="rounded-xl px-4 py-4" style={{ background: '#0a0f1a', border: '1px solid #1e293b' }}>
            <p className="text-xs mb-2 font-medium" style={{ color: COLORS.textSecondary }}>Weekly Analysis</p>
            <pre className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: COLORS.textPrimary, fontFamily: 'inherit' }}>
              {report}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
