import { useEffect, useState } from 'react';
import PeriodToggle from './components/PeriodToggle';
import KpiCards from './components/KpiCards';
import TrendChart from './components/TrendChart';
import ForwardPace from './components/ForwardPace';
import { loadSnapshots, targetMonthForPeriod, type Period, type LoadedSnapshots } from './dashboardData';

export default function Dashboard() {
  const [data, setData] = useState<LoadedSnapshots | null>(null);
  const [period, setPeriod] = useState<Period>('lastMonth');

  useEffect(() => {
    loadSnapshots().then(setData);
  }, []);

  if (!data) return <div className="text-slate-500">กำลังโหลด…</div>;
  if (!data.latest) return <div className="text-slate-500">ยังไม่มีข้อมูล — ไปที่หน้า "อัปโหลด" ก่อน</div>;

  const dataAsOf = data.latest.dataAsOf ?? new Date().toISOString().slice(0, 10);
  const monthIndex = targetMonthForPeriod(period, dataAsOf);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PeriodToggle value={period} onChange={setPeriod} />
      <KpiCards yearly={data.latest.yearly} monthIndex={monthIndex} />
      <TrendChart yearly={data.latest.yearly} dataAsOf={dataAsOf} />
      <ForwardPace latest={data.latest} daysAhead={period === 'next2Weeks' ? 14 : 60} />
    </div>
  );
}
