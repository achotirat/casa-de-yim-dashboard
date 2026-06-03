import { describe, it, expect } from 'vitest';
import { weeklyKpi } from '../../src/metrics/weekly';
import type { MonthlyReport, DayRow } from '../../src/types';

function makeDay(date: string, dow: string, occ: number, adr: number, rooms = 4): DayRow {
  const nights = Math.round(rooms * occ / 100);
  return {
    date, dayOfWeek: dow,
    availableRooms: rooms,
    nightSold: nights,
    occPct: occ,
    adr: nights > 0 ? adr : 0,
    revPar: (occ / 100) * adr,
    pax: nights * 2,
    roomCharges: nights * adr,
  };
}

// 7 days: 2026-05-25 to 2026-05-31 (inclusive)
// asOf = '2026-06-01' → window = [2026-05-25, 2026-06-01)
const may: MonthlyReport = {
  month: 5, year: 2026,
  days: [
    makeDay('2026-05-25', 'Mon', 100, 8000), // 4 nights × 8000 = 32000
    makeDay('2026-05-26', 'Tue',  50, 6000), // 2 nights × 6000 = 12000
    makeDay('2026-05-27', 'Wed',   0,    0), // 0 nights
    makeDay('2026-05-28', 'Thu',  75, 7000), // 3 nights × 7000 = 21000
    makeDay('2026-05-29', 'Fri', 100, 9000), // 4 nights × 9000 = 36000
    makeDay('2026-05-30', 'Sat',  25, 5000), // 1 night  × 5000 =  5000
    makeDay('2026-05-31', 'Sun',  50, 6500), // 2 nights × 6500 = 13000
    // outside window:
    makeDay('2026-05-24', 'Sun', 100, 8000),
  ],
};
// totalRevenue = 32000+12000+0+21000+36000+5000+13000 = 119000
// totalNights  = 4+2+0+3+4+1+2 = 16
// totalRooms   = 4×7 = 28
// meanOcc      = (100+50+0+75+100+25+50)/7 = 400/7 ≈ 57.1
// ADR          = 119000/16 = 7437.50
// RevPAR       = 119000/28 ≈ 4250.00

describe('weeklyKpi', () => {
  it('returns null when no monthly data', () => {
    expect(weeklyKpi(undefined, '2026-06-01')).toBeNull();
    expect(weeklyKpi([], '2026-06-01')).toBeNull();
  });

  it('returns null when no days fall in range', () => {
    expect(weeklyKpi([may], '2026-05-01')).toBeNull();
  });

  it('computes mean occ% (simple average)', () => {
    const kpi = weeklyKpi([may], '2026-06-01')!;
    expect(kpi.occPct).toBeCloseTo(57.1, 1);
  });

  it('computes weighted ADR (totalRevenue / totalNights)', () => {
    const kpi = weeklyKpi([may], '2026-06-01')!;
    expect(kpi.adr).toBeCloseTo(7437.5, 1);
  });

  it('computes RevPAR (totalRevenue / totalAvailableRoomNights)', () => {
    const kpi = weeklyKpi([may], '2026-06-01')!;
    expect(kpi.revPar).toBeCloseTo(4250.0, 1);
  });

  it('reports correct night count', () => {
    const kpi = weeklyKpi([may], '2026-06-01')!;
    expect(kpi.nights).toBe(16);
    expect(kpi.daysWithData).toBe(6); // 6 days with nightSold > 0
  });

  it('spans two months (picks days from both)', () => {
    const jun: MonthlyReport = {
      month: 6, year: 2026,
      days: [makeDay('2026-06-01', 'Mon', 100, 9000)],
    };
    // asOf = '2026-06-02': window = [2026-05-26, 2026-06-02)
    const kpi = weeklyKpi([may, jun], '2026-06-02');
    expect(kpi).not.toBeNull();
    expect(kpi!.nights).toBeGreaterThan(0);
  });
});
