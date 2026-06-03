import type { YearlyReport } from '../../types';
import type { WeeklyKpi } from '../../metrics/weekly';
import { monthByIndex, pctDelta } from '../../metrics/kpi';

function fmt(n: number | null, suffix = ''): string {
  return n == null ? '–' : `${n.toLocaleString('en-US', { maximumFractionDigits: suffix === '%' ? 1 : 0 })}${suffix}`;
}

function Delta({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-400 text-xs">—</span>;
  const up = value >= 0;
  return <span className={`text-xs ${up ? 'text-green-600' : 'text-red-600'}`}>{up ? '▲' : '▼'} {Math.abs(value).toFixed(1)}%</span>;
}

export default function KpiCards({
  yearly, yearlyPrev, monthIndex, occOverride, weeklyOverride,
}: {
  yearly?: YearlyReport;
  yearlyPrev?: YearlyReport;
  monthIndex: number;
  occOverride?: number | null;
  weeklyOverride?: WeeklyKpi | null;
}) {
  const cur = monthByIndex(yearly, monthIndex);
  const prevMonth = monthByIndex(yearly, monthIndex === 1 ? 12 : monthIndex - 1);
  const prevYear = monthByIndex(yearlyPrev, monthIndex);

  // weeklyOverride wins over occOverride wins over monthly aggregate
  const occ = weeklyOverride?.occPct ?? occOverride ?? cur?.occPct ?? null;
  const adr = weeklyOverride?.adr ?? cur?.adr ?? null;
  const revPar = weeklyOverride?.revPar ?? cur?.revPar ?? null;

  const cards = [
    { label: 'OCCUPANCY', value: fmt(occ, '%'), mom: pctDelta(occ, prevMonth?.occPct ?? null), yoy: pctDelta(occ, prevYear?.occPct ?? null) },
    { label: 'ADR',       value: '฿' + fmt(adr), mom: pctDelta(adr, prevMonth?.adr ?? null), yoy: pctDelta(adr, prevYear?.adr ?? null) },
    { label: 'REVPAR',    value: '฿' + fmt(revPar), mom: pctDelta(revPar, prevMonth?.revPar ?? null), yoy: pctDelta(revPar, prevYear?.revPar ?? null) },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-white rounded-xl p-5 shadow">
          <div className="text-xs text-slate-400">{c.label}</div>
          <div className="text-2xl font-bold text-slate-800">{c.value}</div>
          <div className="flex gap-3 mt-1">
            <span>MoM <Delta value={c.mom} /></span>
            <span>YoY <Delta value={c.yoy} /></span>
          </div>
        </div>
      ))}
    </div>
  );
}
