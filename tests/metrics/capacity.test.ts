import { describe, it, expect } from 'vitest';
import { villaCount } from '../../src/metrics/capacity';
import type { YearlyReport } from '../../src/types';

const yearly: YearlyReport = {
  year: 2026,
  months: [
    { month: 'January', monthIndex: 1, availableRooms: 124, nightSold: 113, occPct: 92.62, adr: 1, revPar: 1, pax: 1, roomCharges: 1 },
  ],
  grandTotal: { month: 'Grand Total', monthIndex: 0, availableRooms: 1430, nightSold: 823, occPct: 57.55, adr: 1, revPar: 1, pax: 1, roomCharges: 1 },
};

describe('villaCount', () => {
  it('derives villas from max monthly available rooms / days', () => {
    // January 124 available / 31 days = 4.0 -> 4 villas
    expect(villaCount(yearly)).toBe(4);
  });
  it('honors override', () => {
    expect(villaCount(yearly, 5)).toBe(5);
  });
});
