import type { Snapshot } from '../types';
import type { RecoInput } from '../recommendations/rules';
import { comparePace } from '../metrics/pace';
import { monthByIndex } from '../metrics/kpi';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function daysUntilMonthStart(dataAsOf: string, monthIndex: number): number {
  const asOf = new Date(dataAsOf + 'T00:00:00Z');
  const year = asOf.getUTCFullYear();
  const start = new Date(Date.UTC(year, monthIndex - 1, 1));
  return Math.round((start.getTime() - asOf.getTime()) / 86400000);
}

// Build reco inputs for the next 3 upcoming months relative to dataAsOf.
export function buildRecoInputs(
  latest: Snapshot,
  previous: Snapshot | null,
  yearlyPrev: Snapshot['yearly'] | undefined
): RecoInput[] {
  const dataAsOf = latest.dataAsOf ?? new Date().toISOString().slice(0, 10);
  const curMonth = Number(dataAsOf.slice(5, 7));
  const out: RecoInput[] = [];

  for (let offset = 0; offset <= 2; offset++) {
    const mi = ((curMonth - 1 + offset) % 12) + 1;
    const row = monthByIndex(latest.yearly, mi);
    if (!row) continue;
    const pace = comparePace(latest.yearly, previous?.yearly, mi);
    out.push({
      monthLabel: MONTH_NAMES[mi - 1],
      occNow: row.occPct,
      leadDays: daysUntilMonthStart(dataAsOf, mi),
      pacePerWeek: pace,
      occPrevYear: monthByIndex(yearlyPrev, mi)?.occPct ?? null,
    });
  }
  return out;
}
