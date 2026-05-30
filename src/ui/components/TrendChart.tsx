import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import type { YearlyReport } from '../../types';

const MONTH_ABBR = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export default function TrendChart({ yearly, dataAsOf }: { yearly?: YearlyReport; dataAsOf: string }) {
  if (!yearly) return null;
  const currentMonth = Number(dataAsOf.slice(5, 7));
  const rows = yearly.months.map((m) => ({
    name: MONTH_ABBR[m.monthIndex - 1],
    occ: m.occPct,
    adr: m.adr,
    isActual: m.monthIndex <= currentMonth,
  }));

  return (
    <div className="bg-white rounded-xl p-5 shadow">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">แนวโน้มรายเดือน — สีเข้ม = actual, สีอ่อน = จองล่วงหน้า</h3>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={rows}>
          <XAxis dataKey="name" fontSize={11} />
          <YAxis yAxisId="left" fontSize={11} unit="%" />
          <YAxis yAxisId="right" orientation="right" fontSize={11} />
          <Tooltip />
          <Legend />
          <Bar yAxisId="left" dataKey="occ" name="Occ%">
            {rows.map((r, i) => (
              <Cell key={i} fill={r.isActual ? '#1e293b' : '#94a3b8'} />
            ))}
          </Bar>
          <Line yAxisId="right" dataKey="adr" name="ADR" stroke="#b45309" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
