import type { YearlyReport, ArrivalsReport } from '../types';
import { monthByIndex } from './kpi';

export function comparePace(
  current: YearlyReport | undefined,
  previous: YearlyReport | undefined,
  monthIndex: number
): number | null {
  const cur = monthByIndex(current, monthIndex)?.occPct ?? null;
  const prev = monthByIndex(previous, monthIndex)?.occPct ?? null;
  if (cur == null || prev == null) return null;
  return cur - prev;
}

export interface DayOcc {
  date: string;
  roomsSold: number;
  occPct: number;
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// A guest occupies nights [arrival, departure) — departure night is free.
export function dailyOccupancy(
  arrivals: ArrivalsReport | undefined,
  capacity: number,
  startISO: string,
  days: number
): DayOcc[] {
  const out: DayOcc[] = [];
  const rows = arrivals?.rows ?? [];
  for (let i = 0; i < days; i++) {
    const date = addDays(startISO, i);
    let roomsSold = 0;
    for (const r of rows) {
      if (r.arrival && r.departure && r.arrival <= date && date < r.departure) {
        roomsSold++;
      }
    }
    const occPct = capacity > 0 ? (roomsSold / capacity) * 100 : 0;
    out.push({ date, roomsSold, occPct });
  }
  return out;
}
