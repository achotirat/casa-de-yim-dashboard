import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import type { Snapshot } from '../../types';
import { villaCount } from '../../metrics/capacity';
import { dailyOccupancy } from '../../metrics/pace';
import SectionCard, { SectionHead } from './SectionCard';

export default function ForwardPace({
  latest, daysAhead, villaOverride,
}: { latest: Snapshot; daysAhead: number; villaOverride?: number }) {
  const dataAsOf = latest.dataAsOf ?? new Date().toISOString().slice(0, 10);
  const capacity = villaCount(latest.yearly, villaOverride);
  const daily = dailyOccupancy(latest.arrivals, capacity, dataAsOf, daysAhead).map((d) => ({
    name: d.date.slice(5),
    occ: Math.round(d.occPct),
  }));

  return (
    <SectionCard>
      <SectionHead
        title="Occupancy "
        italic={`ล่วงหน้า ${daysAhead} วัน`}
        meta={`จาก Arrival List · ${capacity} villa`}
      />
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={daily}>
          <XAxis dataKey="name" fontSize={11} fontFamily="'Manrope', sans-serif" tick={{ fill: 'var(--muted)' }}
            interval={Math.max(0, Math.floor(daily.length / 15))} />
          <YAxis fontSize={11} fontFamily="'Manrope', sans-serif" tick={{ fill: 'var(--muted)' }} unit="%" domain={[0, 100]} />
          <Tooltip />
          <Bar dataKey="occ" name="Occ%">
            {daily.map((d, i) => <Cell key={i} fill={d.occ === 0 ? '#E3E7E9' : '#5481A6'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </SectionCard>
  );
}
