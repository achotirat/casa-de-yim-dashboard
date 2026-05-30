import type { YearlyReport, MonthRow } from '../types';

export function monthByIndex(yearly: YearlyReport | undefined, monthIndex: number): MonthRow | null {
  if (!yearly) return null;
  return yearly.months.find((m) => m.monthIndex === monthIndex) ?? null;
}

export function pctDelta(current: number | null, base: number | null): number | null {
  if (current == null || base == null || base === 0) return null;
  return ((current - base) / base) * 100;
}
