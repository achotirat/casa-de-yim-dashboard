import { useState } from 'react';
import PeriodToggle from './components/PeriodToggle';
import KpiCards from './components/KpiCards';
import TrendChart from './components/TrendChart';
import ForwardPace from './components/ForwardPace';
import MixPanels from './components/MixPanels';
import Recommendations from './components/Recommendations';
import ForecastSection from './components/ForecastSection';
import { targetMonthForPeriod, type Period, type LoadedSnapshots } from './dashboardData';
import { villaCount } from '../metrics/capacity';
import { dailyOccupancy } from '../metrics/pace';
import { weeklyKpi, type WeeklyKpi } from '../metrics/weekly';

export default function Dashboard({ data }: { data: LoadedSnapshots }) {
  const [period, setPeriod] = useState<Period>('thisMonth');

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

  const MONTH_TH: Record<number, string> = {
    1:'มกราคม',2:'กุมภาพันธ์',3:'มีนาคม',4:'เมษายน',5:'พฤษภาคม',6:'มิถุนายน',
    7:'กรกฎาคม',8:'สิงหาคม',9:'กันยายน',10:'ตุลาคม',11:'พฤศจิกายน',12:'ธันวาคม',
  };
  const currentMonthNum = Number(dataAsOf.slice(5, 7));
  const monthLabel = MONTH_TH[currentMonthNum] ?? '';

  const PERIOD_DESC: Record<Period, string> = {
    thisMonth: 'เดือนนี้',
    next2Weeks: '2 สัปดาห์หน้า',
    nextMonth: 'เดือนหน้า',
    lastMonth: 'เดือนที่ผ่านมา',
    lastWeek: 'สัปดาห์ที่ผ่านมา',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page head */}
      <div className="cdy-page-head" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, padding: '2px 4px 4px' }}>
        <div>
          <div className="cdy-eyebrow" style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6, whiteSpace: 'nowrap' }}>
            {monthLabel} {dataAsOf.slice(0, 4)} · ข้อมูล ณ {dataAsOf}
          </div>
          <h1 className="cdy-h1" style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 36, lineHeight: 1.05, letterSpacing: '-.5px', color: 'var(--ink)', margin: 0 }}>
            ผลประกอบการ<i style={{ fontStyle: 'italic', color: 'var(--accent-2)' }}> {PERIOD_DESC[period]}</i>
          </h1>
          <div style={{ fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif", fontSize: 13, color: 'var(--muted)', fontWeight: 500, marginTop: 4 }}>
            ดู Occupancy, ADR และ RevPAR เทียบเดือนก่อน · เลือกช่วงเวลาเพื่อโฟกัส
          </div>
        </div>
        <PeriodToggle value={period} onChange={setPeriod} hasWeeklyData={hasWeeklyData} />
      </div>

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
      <Recommendations latest={data.latest} previous={data.previous} dataAsOf={dataAsOf} />
    </div>
  );
}
