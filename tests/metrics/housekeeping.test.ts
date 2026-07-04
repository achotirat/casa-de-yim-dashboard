import { describe, it, expect } from 'vitest';
import { arrivalsForDate } from '../../src/metrics/housekeeping';
import type { ArrivalsReport } from '../../src/types';

function report(rows: ArrivalsReport['rows']): ArrivalsReport {
  return { periodFrom: '2026-06-01', periodTo: '2026-06-30', rows };
}

describe('arrivalsForDate', () => {
  it('returns only rows arriving on the given date', () => {
    const arrivals = report([
      { resNo: '1', guest: 'A', room: 'A1', rate: 1, arrival: '2026-06-01', departure: '2026-06-03', pax: 2, children: 0, resType: 'Confirm Booking', channel: 'OTA', notes: 'note-a' },
      { resNo: '2', guest: 'B', room: 'A2', rate: 1, arrival: '2026-06-02', departure: '2026-06-04', pax: 3, children: 1, resType: 'Confirm Booking', channel: 'OTA', notes: 'note-b' },
    ]);
    const result = arrivalsForDate(arrivals, '2026-06-01');
    expect(result).toEqual([
      { room: 'A1', guest: 'A', adults: 2, children: 0, arrivalDate: '2026-06-01', departureDate: '2026-06-03', nights: 2, notes: 'note-a' },
    ]);
  });

  it('computes nights from arrival/departure dates', () => {
    const arrivals = report([
      { resNo: '1', guest: 'A', room: 'A1', rate: 1, arrival: '2026-06-01', departure: '2026-06-05', pax: 2, children: 0, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
    ]);
    const result = arrivalsForDate(arrivals, '2026-06-01');
    expect(result[0].nights).toBe(4);
    expect(result[0].departureDate).toBe('2026-06-05');
  });

  it('returns null nights when departure is missing or not after arrival', () => {
    const arrivals = report([
      { resNo: '1', guest: 'A', room: 'A1', rate: 1, arrival: '2026-06-01', departure: null, pax: 2, children: 0, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
      { resNo: '2', guest: 'B', room: 'A2', rate: 1, arrival: '2026-06-01', departure: '2026-06-01', pax: 2, children: 0, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
    ]);
    const result = arrivalsForDate(arrivals, '2026-06-01');
    expect(result[0].nights).toBeNull();
    expect(result[0].departureDate).toBeNull();
    expect(result[1].nights).toBeNull();
  });

  it('excludes rows that are not Confirm Booking', () => {
    const arrivals = report([
      { resNo: '1', guest: 'A', room: 'A1', rate: 1, arrival: '2026-06-01', departure: '2026-06-03', pax: 2, children: 0, resType: 'Tentative', channel: 'OTA', notes: '' },
      { resNo: '2', guest: 'B', room: 'A2', rate: 1, arrival: '2026-06-01', departure: '2026-06-04', pax: 3, children: 1, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
    ]);
    const result = arrivalsForDate(arrivals, '2026-06-01');
    expect(result).toHaveLength(1);
    expect(result[0].guest).toBe('B');
  });

  it('sorts results by room', () => {
    const arrivals = report([
      { resNo: '1', guest: 'Z', room: 'A4 - Villa A4', rate: 1, arrival: '2026-06-01', departure: '2026-06-03', pax: 2, children: 0, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
      { resNo: '2', guest: 'Y', room: 'A1 - Villa A1', rate: 1, arrival: '2026-06-01', departure: '2026-06-04', pax: 3, children: 1, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
    ]);
    const result = arrivalsForDate(arrivals, '2026-06-01');
    expect(result.map((r) => r.room)).toEqual(['A1 - Villa A1', 'A4 - Villa A4']);
  });

  it('returns an empty array when arrivals is undefined', () => {
    expect(arrivalsForDate(undefined, '2026-06-01')).toEqual([]);
  });

  it('returns an empty array when no rows match the date', () => {
    const arrivals = report([
      { resNo: '1', guest: 'A', room: 'A1', rate: 1, arrival: '2026-06-05', departure: '2026-06-07', pax: 2, children: 0, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
    ]);
    expect(arrivalsForDate(arrivals, '2026-06-01')).toEqual([]);
  });
});
