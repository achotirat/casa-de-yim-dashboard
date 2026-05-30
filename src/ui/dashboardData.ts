import type { Snapshot } from '../types';
import { getSnapshot, listSnapshotKeys } from '../lib/api';

export type Period = 'lastMonth' | 'lastWeek' | 'nextMonth' | 'next2Weeks';

export const PERIOD_LABELS: Record<Period, string> = {
  lastMonth: 'เดือนที่ผ่านมา',
  lastWeek: 'สัปดาห์ที่ผ่านมา',
  nextMonth: 'เดือนหน้า',
  next2Weeks: '2 สัปดาห์หน้า',
};

export function targetMonthForPeriod(period: Period, dataAsOf: string): number {
  const month = Number(dataAsOf.slice(5, 7)); // 1-12
  switch (period) {
    case 'lastMonth': return month === 1 ? 12 : month - 1;
    case 'nextMonth': return month === 12 ? 1 : month + 1;
    case 'lastWeek':
    case 'next2Weeks': return month;
  }
}

export interface LoadedSnapshots {
  latest: Snapshot | null;
  previous: Snapshot | null; // the snapshot before latest (for pace)
  all: Snapshot[];
}

export async function loadSnapshots(): Promise<LoadedSnapshots> {
  const keys = (await listSnapshotKeys()).filter((k) => k.startsWith('snapshot/')).sort();
  const all = await Promise.all(keys.map((k) => getSnapshot(k)));
  return {
    latest: all[all.length - 1] ?? null,
    previous: all[all.length - 2] ?? null,
    all,
  };
}
