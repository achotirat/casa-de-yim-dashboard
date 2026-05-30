import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { Snapshot } from '../../types';
import { villaCount } from '../../metrics/capacity';
import { dailyOccupancy } from '../../metrics/pace';

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
    <div className="bg-white rounded-xl p-5 shadow">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">
        Occupancy ล่วงหน้า {daysAhead} วัน (จาก Arrival List · {capacity} villa)
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={daily}>
          <XAxis dataKey="name" fontSize={10} interval={Math.max(0, Math.floor(daily.length / 15))} />
          <YAxis fontSize={11} unit="%" domain={[0, 100]} />
          <Tooltip />
          <Bar dataKey="occ" name="Occ%" fill="#3a6ea5" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
