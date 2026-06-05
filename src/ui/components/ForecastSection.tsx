import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import type { YearlyReport } from '../../types';
import SectionCard, { SectionHead } from './SectionCard';

const MONTH_ABBR = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

function fmt(n: number | null, suffix = '') {
  if (n == null) return '–';
  return n.toLocaleString('en-US', { maximumFractionDigits: suffix === '%' ? 1 : 0 }) + suffix;
}

const FILL: Record<string, string> = { actual: '#103A34', current: '#C56A45', booked: '#B6C2C6' };
const LEGEND: [string, string][] = [['#103A34','Actual'],['#C56A45','เดือนปัจจุบัน'],['#B6C2C6','On-the-books']];

export default function ForecastSection({ yearly, dataAsOf }: { yearly?: YearlyReport; dataAsOf: string }) {
  if (!yearly) return null;

  const currentMonth = Number(dataAsOf.slice(5, 7));
  const rows = yearly.months.map((m) => ({
    name: MONTH_ABBR[m.monthIndex - 1],
    occ: m.occPct ?? 0,
    status: m.monthIndex < currentMonth ? 'actual' : m.monthIndex === currentMonth ? 'current' : 'booked',
  }));

  const totalNights  = yearly.months.reduce((s, m) => s + (m.nightSold ?? 0), 0);
  const totalRooms   = yearly.months.reduce((s, m) => s + (m.availableRooms ?? 0), 0);
  const totalRevenue = yearly.months.reduce((s, m) => s + (m.roomCharges ?? 0), 0);
  const expectedOcc  = totalRooms > 0 ? (totalNights / totalRooms) * 100 : null;
  const expectedADR  = totalNights > 0 ? totalRevenue / totalNights : null;

  const stats = [
    { label: 'Occ% คาด (ทั้งปี)', value: fmt(expectedOcc, '%') },
    { label: 'ADR คาด (ทั้งปี)',   value: '฿' + fmt(expectedADR) },
    { label: 'Revenue คาด (ทั้งปี)', value: '฿' + fmt(totalRevenue > 0 ? totalRevenue : null) },
  ];

  return (
    <SectionCard alt>
      <SectionHead
        title="คาดการณ์"
        italic={` ทั้งปี ${yearly.year}`}
        meta={`actual + on-the-books · จาก eZee · ข้อมูล ณ ${dataAsOf}`}
      />

      {/* Stat strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ background: 'var(--card)', borderRadius: 16, padding: '14px 16px', border: '1px solid var(--line)' }}>
            <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1.4px' }}>{s.label}</div>
            <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 30, lineHeight: 1, letterSpacing: '-1px', color: 'var(--ink)', marginTop: 6 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={rows} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <XAxis dataKey="name" fontSize={11} fontFamily="'Manrope', sans-serif" tick={{ fill: 'var(--muted)' }} />
          <YAxis fontSize={11} fontFamily="'Manrope', sans-serif" tick={{ fill: 'var(--muted)' }} unit="%" domain={[0, 100]} width={36} />
          <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'Occ%']} />
          <Bar dataKey="occ" name="Occ%">
            {rows.map((r, i) => <Cell key={i} fill={FILL[r.status]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
        {LEGEND.map(([col, label]) => (
          <span key={label} style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11.5, color: 'var(--muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: col }} />
            {label}
          </span>
        ))}
      </div>
    </SectionCard>
  );
}
