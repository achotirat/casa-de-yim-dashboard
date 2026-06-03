import { useEffect, useState } from 'react';
import PeriodToggle from './components/PeriodToggle';
import KpiCards from './components/KpiCards';
import TrendChart from './components/TrendChart';
import ForwardPace from './components/ForwardPace';
import MixPanels from './components/MixPanels';
import Recommendations from './components/Recommendations';
import ForecastSection from './components/ForecastSection';
import { loadSnapshots, targetMonthForPeriod, type Period, type LoadedSnapshots } from './dashboardData';
import { villaCount } from '../metrics/capacity';
import { dailyOccupancy } from '../metrics/pace';
import { weeklyKpi, type WeeklyKpi } from '../metrics/weekly';

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
  const hasWeeklyData = (data.latest.monthly?.length ?? 0) > 0;

  // For "2 สัปดาห์หน้า": average occ% from Arrival List for next 14 days
  let occOverride: number | null = null;
  if (period === 'next2Weeks') {
    const capacity = villaCount(data.latest.yearly);
    const today = new Date().toISOString().slice(0, 10);
    const days = dailyOccupancy(data.latest.arrivals, capacity, today, 14);
    occOverride = Math.round(days.reduce((s, d) => s + d.occPct, 0) / days.length * 10) / 10;
  }

  // For "สัปดาห์ที่ผ่านมา": real weekly KPI from Monthly Stats
  let weeklyOverride: WeeklyKpi | null = null;
  if (period === 'lastWeek') {
    weeklyOverride = weeklyKpi(data.latest.monthly, dataAsOf);
  }

  // Days ahead for ForwardPace
  function forwardDays(): number {
    if (period === 'next2Weeks') return 14;
    if (period === 'thisMonth') {
      const now = new Date();
      const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1;
      return Math.max(daysLeft, 1);
    }
    return 60;
  }

  const showForwardPace = period !== 'lastWeek';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PeriodToggle value={period} onChange={setPeriod} hasWeeklyData={hasWeeklyData} />
      <KpiCards
        yearly={data.latest.yearly}
        monthIndex={monthIndex}
        occOverride={occOverride}
        weeklyOverride={weeklyOverride}
      />
      <TrendChart yearly={data.latest.yearly} dataAsOf={dataAsOf} />
      <ForecastSection yearly={data.latest.yearly} dataAsOf={dataAsOf} />
      {showForwardPace && <ForwardPace latest={data.latest} daysAhead={forwardDays()} />}
      <MixPanels channels={data.latest.channels} countries={data.latest.countries} />
      <Recommendations latest={data.latest} previous={data.previous} />
    </div>
  );
}
