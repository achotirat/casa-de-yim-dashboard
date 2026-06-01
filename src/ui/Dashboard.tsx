import { useEffect, useState } from 'react';
import PeriodToggle from './components/PeriodToggle';
import KpiCards from './components/KpiCards';
import TrendChart from './components/TrendChart';
import ForwardPace from './components/ForwardPace';
import MixPanels from './components/MixPanels';
import Recommendations from './components/Recommendations';
import { loadSnapshots, targetMonthForPeriod, type Period, type LoadedSnapshots } from './dashboardData';
import { villaCount } from '../metrics/capacity';
import { dailyOccupancy } from '../metrics/pace';

export default function Dashboard() {
  const [data, setData] = useState<LoadedSnapshots | null>(null);
  const [period, setPeriod] = useState<Period>('thisMonth');

  useEffect(() => {
    loadSnapshots().then(setData);
  }, []);

  if (!data) return <div className="text-slate-500">กำลังโหลด…</div>;
  if (!data.latest) return <div className="text-slate-500">ยังไม่มีข้อมูล — ไปที่หน้า "อัปโหลด" ก่อน</div>;

  const dataAsOf = data.latest.dataAsOf ?? new Date().toISOString().slice(0, 10);
  const monthIndex = targetMonthForPeriod(period, dataAsOf);

  // For "2 สัปดาห์หน้า": compute average occ% from arrivals for next 14 days
  let occOverride: number | null = null;
  if (period === 'next2Weeks') {
    const capacity = villaCount(data.latest.yearly);
    const today = new Date().toISOString().slice(0, 10);
    const days = dailyOccupancy(data.latest.arrivals, capacity, today, 14);
    occOverride = Math.round(days.reduce((s, d) => s + d.occPct, 0) / days.length * 10) / 10;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PeriodToggle value={period} onChange={setPeriod} />
      <KpiCards yearly={data.latest.yearly} monthIndex={monthIndex} occOverride={occOverride} />
      <TrendChart yearly={data.latest.yearly} dataAsOf={dataAsOf} />
      <ForwardPace latest={data.latest} daysAhead={period === 'next2Weeks' ? 14 : 60} />
      <MixPanels channels={data.latest.channels} countries={data.latest.countries} />
      <Recommendations latest={data.latest} previous={data.previous} />
    </div>
  );
}
