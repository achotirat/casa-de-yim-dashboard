import { describe, it, expect } from 'vitest';
import { buildRecoInputs } from '../../src/ui/buildRecoInputs';
import type { Snapshot } from '../../src/types';

const latest: Snapshot = {
  uploadedAt: '', dataAsOf: '2026-05-29',
  yearly: {
    year: 2026,
    months: [{ month: 'June', monthIndex: 6, availableRooms: 120, nightSold: 34, occPct: 28.57, adr: 1, revPar: 1, pax: 1, roomCharges: 1 }],
    grandTotal: { month: 'Grand Total', monthIndex: 0, availableRooms: 1, nightSold: 1, occPct: 1, adr: 1, revPar: 1, pax: 1, roomCharges: 1 },
  },
};

describe('buildRecoInputs', () => {
  it('computes lead days and pulls occ for upcoming months', () => {
    const inputs = buildRecoInputs(latest, null, undefined);
    const june = inputs.find((i) => i.monthLabel === 'June')!;
    expect(june.occNow).toBe(28.57);
    expect(june.leadDays).toBeGreaterThan(0); // June is after 2026-05-29
  });
});
