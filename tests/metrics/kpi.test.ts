import { describe, it, expect } from 'vitest';
import { monthByIndex, pctDelta } from '../../src/metrics/kpi';
import type { YearlyReport } from '../../src/types';

const yearly: YearlyReport = {
  year: 2026,
  months: [
    { month: 'April', monthIndex: 4, availableRooms: 110, nightSold: 88, occPct: 80, adr: 7133.24, revPar: 5706.59, pax: 556, roomCharges: 627725.11 },
    { month: 'May', monthIndex: 5, availableRooms: 109, nightSold: 46, occPct: 42.2, adr: 7110.78, revPar: 3000.88, pax: 312, roomCharges: 327095.82 },
  ],
  grandTotal: { month: 'Grand Total', monthIndex: 0, availableRooms: 1430, nightSold: 823, occPct: 57.55, adr: 1, revPar: 1, pax: 1, roomCharges: 1 },
};

describe('monthByIndex', () => {
  it('returns the row for a month', () => {
    expect(monthByIndex(yearly, 5)?.occPct).toBe(42.2);
  });
  it('returns null when missing', () => {
    expect(monthByIndex(yearly, 12)).toBeNull();
  });
});

describe('pctDelta', () => {
  it('computes percent change', () => {
    expect(pctDelta(42.2, 80)).toBeCloseTo(-47.25, 1);
  });
  it('returns null when base is null/zero', () => {
    expect(pctDelta(42.2, null)).toBeNull();
    expect(pctDelta(42.2, 0)).toBeNull();
  });
});
