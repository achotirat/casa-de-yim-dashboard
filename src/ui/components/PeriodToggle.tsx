import { PERIOD_LABELS, type Period } from '../dashboardData';

const ORDER: Period[] = ['lastMonth', 'lastWeek', 'nextMonth', 'next2Weeks'];

export default function PeriodToggle({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {ORDER.map((p) => (
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
