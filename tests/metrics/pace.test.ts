import { describe, it, expect } from 'vitest';
import { comparePace, dailyOccupancy } from '../../src/metrics/pace';
import type { YearlyReport, ArrivalsReport } from '../../src/types';

function yearlyWith(juneOcc: number): YearlyReport {
  return {
    year: 2026,
    months: [{ month: 'June', monthIndex: 6, availableRooms: 120, nightSold: 1, occPct: juneOcc, adr: 1, revPar: 1, pax: 1, roomCharges: 1 }],
    grandTotal: { month: 'Grand Total', monthIndex: 0, availableRooms: 1, nightSold: 1, occPct: 1, adr: 1, revPar: 1, pax: 1, roomCharges: 1 },
  };
}

describe('comparePace', () => {
  it('returns occ delta in points between two snapshots', () => {
    const delta = comparePace(yearlyWith(28.57), yearlyWith(25), 6);
    expect(delta).toBeCloseTo(3.57, 2);
  });
  it('returns null if a month is missing', () => {
    expect(comparePace(yearlyWith(28.57), yearlyWith(25), 7)).toBeNull();
  });
});

describe('dailyOccupancy', () => {
  it('counts rooms occupied per night across a stay', () => {
    const arrivals: ArrivalsReport = {
      periodFrom: '2026-06-01', periodTo: '2026-06-30',
      rows: [
        { resNo: '1', guest: 'A', room: 'A1', rate: 1, arrival: '2026-06-01', departure: '2026-06-03', pax: 2, resType: '', channel: '', notes: '' },
        { resNo: '2', guest: 'B', room: 'A2', rate: 1, arrival: '2026-06-02', departure: '2026-06-03', pax: 2, resType: '', channel: '', notes: '' },
      ],
    };
    const days = dailyOccupancy(arrivals, 4, '2026-06-01', 3);
    // night 06-01: room1 only -> 1/4 = 25
    expect(days[0]).toEqual({ date: '2026-06-01', roomsSold: 1, occPct: 25 });
    // night 06-02: room1 + room2 -> 2/4 = 50
    expect(days[1]).toEqual({ date: '2026-06-02', roomsSold: 2, occPct: 50 });
    // night 06-03: departures, nobody staying -> 0
    expect(days[2]).toEqual({ date: '2026-06-03', roomsSold: 0, occPct: 0 });
  });
});
