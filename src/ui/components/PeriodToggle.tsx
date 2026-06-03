import { PERIOD_LABELS, type Period } from '../dashboardData';

const BASE_ORDER: Period[] = ['thisMonth', 'next2Weeks', 'nextMonth', 'lastMonth'];

export default function PeriodToggle({
  value, onChange, hasWeeklyData,
}: { value: Period; onChange: (p: Period) => void; hasWeeklyData: boolean }) {
  const order: Period[] = hasWeeklyData ? [...BASE_ORDER, 'lastWeek'] : BASE_ORDER;
  return (
    <div className="flex gap-2 flex-wrap">
      {order.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-3 py-1.5 rounded-full text-sm ${value === p ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border'}`}
        >
          {PERIOD_LABELS[p]}
        </button>
      ))}
    </div>
  );
}
