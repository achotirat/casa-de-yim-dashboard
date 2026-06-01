import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import type { YearlyReport } from '../../types';

const MONTH_ABBR = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function fmt(n: number | null, suffix = '') {
  if (n == null) return '–';
  return n.toLocaleString('en-US', { maximumFractionDigits: suffix === '%' ? 1 : 0 }) + suffix;
}

export default function ForecastSection({
  yearly, dataAsOf,
}: { yearly?: YearlyReport; dataAsOf: string }) {
  if (!yearly) return null;

  const currentMonth = Number(dataAsOf.slice(5, 7));

  const rows = yearly.months.map((m) => ({
    name: MONTH_ABBR[m.monthIndex - 1],
    occ: m.occPct ?? 0,
    status: m.monthIndex < currentMonth ? 'actual' : m.monthIndex === currentMonth ? 'current' : 'booked',
  }));

  // Full-year expected: sum actuals + on-the-books
  const totalNights = yearly.months.reduce((s, m) => s + (m.nightSold ?? 0), 0);
  const totalRooms = yearly.months.reduce((s, m) => s + (m.availableRooms ?? 0), 0);
  const totalRevenue = yearly.months.reduce((s, m) => s + (m.roomCharges ?? 0), 0);
  const expectedOcc = totalRooms > 0 ? (totalNights / totalRooms) * 100 : null;
  const expectedADR = totalNights > 0 ? totalRevenue / totalNights : null;

  const FILL: Record<string, string> = { actual: '#1e293b', current: '#3a6ea5', booked: '#94a3b8' };

  return (
    <div className="bg-white rounded-xl p-5 shadow space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-700">คาดการณ์ทั้งปี {yearly.year}</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          actual (ม.ค.–เดือนก่อน) + on-the-books (เดือนนี้–ธ.ค.) จาก eZee · ข้อมูล ณ {dataAsOf}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Occ% คาด (ทั้งปี)', value: fmt(expectedOcc, '%') },
          { label: 'ADR คาด (ทั้งปี)', value: '฿' + fmt(expectedADR) },
          { label: 'Revenue คาด (ทั้งปี)', value: '฿' + fmt(totalRevenue > 0 ? totalRevenue : null) },
        ].map((c) => (
          <div key={c.label} className="bg-slate-50 rounded-lg p-3">
            <div className="text-xs text-slate-400">{c.label}</div>
            <div className="text-xl font-bold text-slate-800">{c.value}</div>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={rows} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <XAxis dataKey="name" fontSize={10} />
          <YAxis fontSize={10} unit="%" domain={[0, 100]} width={36} />
          <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'Occ%']} />
          <Bar dataKey="occ" name="Occ%">
            {rows.map((r, i) => <Cell key={i} fill={FILL[r.status]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex gap-4 text-xs text-slate-500">
        <span><span className="inline-block w-2.5 h-2.5 bg-slate-800 rounded-sm mr-1" />Actual</span>
        <span><span className="inline-block w-2.5 h-2.5 bg-blue-500 rounded-sm mr-1" />เดือนปัจจุบัน</span>
        <span><span className="inline-block w-2.5 h-2.5 bg-slate-300 rounded-sm mr-1" />On-the-books (จะเพิ่มขึ้นเรื่อยๆ)</span>
      </div>
    </div>
  );
}
