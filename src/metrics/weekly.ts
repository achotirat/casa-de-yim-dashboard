import type { MonthlyReport, DayRow } from '../types';

export interface WeeklyKpi {
  occPct: number | null;    // simple mean of daily occ%
  adr: number | null;       // totalRevenue / totalNights
  revPar: number | null;    // totalRevenue / totalAvailableRoomNights
  revenue: number | null;
  nights: number;
  daysWithData: number;
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function weeklyKpi(
  monthly: MonthlyReport[] | undefined,
  asOf: string,
  lookbackDays = 7
): WeeklyKpi | null {
  if (!monthly || monthly.length === 0) return null;

  const start = addDays(asOf, -lookbackDays);
  const days: DayRow[] = monthly
    .flatMap((m) => m.days)
    .filter((d) => d.date >= start && d.date < asOf);

  if (days.length === 0) return null;

  const totalNights = days.reduce((s, d) => s + (d.nightSold ?? 0), 0);
  const totalRevenue = days.reduce((s, d) => s + (d.roomCharges ?? 0), 0);
  const totalAvailRooms = days.reduce((s, d) => s + (d.availableRooms ?? 0), 0);
  const daysWithData = days.filter((d) => (d.nightSold ?? 0) > 0).length;

  const occSum = days.reduce((s, d) => s + (d.occPct ?? 0), 0);
  const occPct = Math.round((occSum / days.length) * 10) / 10;
  const adr = totalNights > 0 ? Math.round((totalRevenue / totalNights) * 100) / 100 : null;
  const revPar = totalAvailRooms > 0 ? Math.round((totalRevenue / totalAvailRooms) * 100) / 100 : null;

  return {
    occPct,
    adr,
    revPar,
    revenue: totalRevenue > 0 ? totalRevenue : null,
    nights: totalNights,
    daysWithData,
  };
}
