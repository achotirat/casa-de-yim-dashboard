import type { YearlyReport } from '../types';

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function villaCount(yearly: YearlyReport | undefined, override?: number): number {
  if (override && override > 0) return override;
  if (!yearly) return 4; // sensible default for Casa de Yim
  let best = 0;
  for (const m of yearly.months) {
    if (m.availableRooms == null || m.monthIndex < 1) continue;
    const days = DAYS_IN_MONTH[m.monthIndex - 1];
    best = Math.max(best, Math.round(m.availableRooms / days));
  }
  return best || 4;
}
