import { useState } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  BarChart,
} from 'recharts';
import { useAllDays } from '../hooks/useAllDays';
import { totalBurn } from '../lib/calculations';
import { TARGETS, COLORS } from '../lib/constants';
import { getWeeklyReport } from '../lib/claude';
import { Loader2 } from 'lucide-react';

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
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {Math.round(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function WeekView({ uid }) {
  const { days, loading } = useAllDays(uid, 7);
  const [report, setReport] = useState('');
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportErr, setReportErr] = useState('');

  const chartData = days.map(d => ({
    date: fmt(d.date),
    Intake: Math.round(d.calories || 0),
    Burn: Math.round(totalBurn(d)),
    Protein: Math.round(d.protein || 0),
  }));

  const avg = (key) => days.length
    ? Math.round(days.reduce((s, d) => s + (Number(d[key]) || 0), 0) / days.length)
    : 0;

  async function fetchReport() {
    setLoadingReport(true);
    setReportErr('');
    try {
      const { report: r } = await getWeeklyReport();
      setReport(r);
    } catch (e) {
      setReportErr(e.message);
    } finally {
      setLoadingReport(false);
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin" style={{ color: COLORS.textMuted }} /></div>;

  return (
    <div className="px-4 space-y-6 pb-8">
      {/* Averages */}
      <div className="grid grid-cols-3 gap-3 pt-4">
        {[
          { label: 'Avg Calories', value: avg('calories'), color: COLORS.amber, unit: 'kcal' },
          { label: 'Avg Protein', value: avg('protein'), color: COLORS.green, unit: 'g' },
          { label: 'Avg Fiber', value: avg('fiber'), color: COLORS.blue, unit: 'g' },
        ].map(({ label, value, color, unit }) => (
          <div key={label} className="rounded-xl px-3 py-3 text-center" style={{ background: '#0a0f1a', border: '1px solid #1e293b' }}>
            <p className="tabular text-xl font-bold" style={{ color }}>{value}<span className="text-xs ml-0.5">{unit}</span></p>
            <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Intake vs Burn chart */}
      <div>
        <p className="text-xs mb-3" style={{ color: COLORS.textMuted }}>Intake vs Burn</p>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="date" tick={{ fill: COLORS.textMuted, fontSize: 11 }} />
            <YAxis tick={{ fill: COLORS.textMuted, fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={TARGETS.calories} stroke={COLORS.amber} strokeDasharray="4 2" strokeOpacity={0.5} />
            <Bar dataKey="Intake" fill={COLORS.amber} fillOpacity={0.7} radius={[4, 4, 0, 0]} />
            <Line dataKey="Burn" stroke={COLORS.green} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Protein chart */}
      <div>
        <p className="text-xs mb-3" style={{ color: COLORS.textMuted }}>Protein (g)</p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="date" tick={{ fill: COLORS.textMuted, fontSize: 11 }} />
            <YAxis tick={{ fill: COLORS.textMuted, fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={TARGETS.protein} stroke={COLORS.green} strokeDasharray="4 2" strokeOpacity={0.5} />
            <Bar dataKey="Protein" fill={COLORS.green} fillOpacity={0.8} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Day-by-day table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e293b' }}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: '#0a0f1a' }}>
              {['Date', 'Cal', 'Prot', 'Fiber'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium" style={{ color: COLORS.textMuted }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...days].reverse().map(d => (
              <tr key={d.date} style={{ borderTop: '1px solid #1e293b' }}>
                <td className="px-3 py-2 tabular" style={{ color: COLORS.textSecondary }}>{fmt(d.date)}</td>
                <td className="px-3 py-2 tabular" style={{ color: COLORS.amber }}>{Math.round(d.calories || 0)}</td>
                <td className="px-3 py-2 tabular" style={{ color: COLORS.green }}>{Math.round(d.protein || 0)}g</td>
                <td className="px-3 py-2 tabular" style={{ color: COLORS.blue }}>{Math.round(d.fiber || 0)}g</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Weekly report */}
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
            <Loader2 size={14} className="animate-spin" />
            Analyzing your week…
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
