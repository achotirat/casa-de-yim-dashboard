import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { YearlyReport } from '../../types';
import SectionCard, { SectionHead } from './SectionCard';

const MONTH_ABBR = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

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
    <SectionCard>
      <SectionHead
        title="แนวโน้ม"
        italic="รายเดือน"
        meta="สีเข้ม = actual · สีอ่อน = จองล่วงหน้า"
      />
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={rows}>
          <XAxis dataKey="name" fontSize={11} fontFamily="'Manrope', sans-serif" tick={{ fill: 'var(--muted)' }} />
          <YAxis yAxisId="occ" fontSize={11} fontFamily="'Manrope', sans-serif" tick={{ fill: 'var(--muted)' }} unit="%" domain={[0, 100]} width={38} />
          <YAxis yAxisId="adr" orientation="right" fontSize={11} fontFamily="'Manrope', sans-serif" tick={{ fill: 'var(--muted)' }} width={52} />
          <Tooltip />
          <Bar yAxisId="occ" dataKey="occ" name="Occ%">
            {rows.map((r, i) => <Cell key={i} fill={r.isActual ? '#103A34' : '#B6C2C6'} />)}
          </Bar>
          <Line yAxisId="adr" type="monotone" dataKey="adr" name="ADR ฿"
            stroke="#C56A45" strokeWidth={2.2}
            dot={{ fill: '#fff', stroke: '#C56A45', strokeWidth: 2, r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </SectionCard>
  );
}
