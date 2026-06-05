import { PERIOD_LABELS, type Period } from '../dashboardData';

const BASE_ORDER: Period[] = ['thisMonth', 'next2Weeks', 'nextMonth', 'lastMonth'];

export default function PeriodToggle({
  value, onChange, hasWeeklyData,
}: { value: Period; onChange: (p: Period) => void; hasWeeklyData: boolean }) {
  const order: Period[] = hasWeeklyData ? [...BASE_ORDER, 'lastWeek'] : BASE_ORDER;

  return (
    <div className="cdy-chips" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {order.map((p) => {
        const active = p === value;
        return (
          <button
            key={p}
            onClick={() => onChange(p)}
            style={{
              border: active ? 'none' : '1px solid var(--line)',
              background: active ? 'var(--shell-1)' : 'var(--card)',
              color: active ? '#fff' : 'var(--ink)',
              fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif",
              fontSize: 12.5, fontWeight: 600,
              padding: '9px 16px', borderRadius: 999,
              cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'background .15s, color .15s',
            }}
            onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--card-2)'; }}
            onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--card)'; }}
          >
            {PERIOD_LABELS[p]}
          </button>
        );
      })}
    </div>
  );
}
