import { describe, it, expect } from 'vitest';
import { arrivalsForDate, departuresForDate, stayoverArrivalsForDate, villaRoomLabels, villaStatusesForDate } from '../../src/metrics/housekeeping';
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
      { resNo: '1', room: 'A1', guest: 'A', adults: 2, children: 0, arrivalDate: '2026-06-01', departureDate: '2026-06-03', nights: 2, notes: 'note-a' },
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

describe('departuresForDate', () => {
  it('returns only rows departing on the given date', () => {
    const arrivals = report([
      { resNo: '1', guest: 'A', room: 'A1', rate: 1, arrival: '2026-06-01', departure: '2026-06-03', pax: 2, children: 0, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
      { resNo: '2', guest: 'B', room: 'A2', rate: 1, arrival: '2026-06-02', departure: '2026-06-04', pax: 3, children: 1, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
    ]);
    const result = departuresForDate(arrivals, '2026-06-03');
    expect(result).toEqual([
      { resNo: '1', room: 'A1', guest: 'A', departureDate: '2026-06-03', sameDayTurnover: false },
    ]);
  });

  it('excludes rows that are not Confirm Booking', () => {
    const arrivals = report([
      { resNo: '1', guest: 'A', room: 'A1', rate: 1, arrival: '2026-06-01', departure: '2026-06-03', pax: 2, children: 0, resType: 'Tentative', channel: 'OTA', notes: '' },
      { resNo: '2', guest: 'B', room: 'A2', rate: 1, arrival: '2026-06-01', departure: '2026-06-03', pax: 3, children: 1, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
    ]);
    const result = departuresForDate(arrivals, '2026-06-03');
    expect(result).toHaveLength(1);
    expect(result[0].guest).toBe('B');
  });

  it('flags sameDayTurnover when a new confirmed guest arrives in the same room that day', () => {
    const arrivals = report([
      { resNo: '1', guest: 'Outgoing', room: 'A1', rate: 1, arrival: '2026-06-01', departure: '2026-06-03', pax: 2, children: 0, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
      { resNo: '2', guest: 'Incoming', room: 'A1', rate: 1, arrival: '2026-06-03', departure: '2026-06-05', pax: 2, children: 0, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
    ]);
    const result = departuresForDate(arrivals, '2026-06-03');
    expect(result).toEqual([
      { resNo: '1', room: 'A1', guest: 'Outgoing', departureDate: '2026-06-03', sameDayTurnover: true },
    ]);
  });

  it('does not flag sameDayTurnover when the new arrival in that room is not Confirm Booking', () => {
    const arrivals = report([
      { resNo: '1', guest: 'Outgoing', room: 'A1', rate: 1, arrival: '2026-06-01', departure: '2026-06-03', pax: 2, children: 0, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
      { resNo: '2', guest: 'Tentative Guest', room: 'A1', rate: 1, arrival: '2026-06-03', departure: '2026-06-05', pax: 2, children: 0, resType: 'Tentative', channel: 'OTA', notes: '' },
    ]);
    const result = departuresForDate(arrivals, '2026-06-03');
    expect(result[0].sameDayTurnover).toBe(false);
  });

  it('sorts results by room', () => {
    const arrivals = report([
      { resNo: '1', guest: 'Z', room: 'A4 - Villa A4', rate: 1, arrival: '2026-06-01', departure: '2026-06-03', pax: 2, children: 0, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
      { resNo: '2', guest: 'Y', room: 'A1 - Villa A1', rate: 1, arrival: '2026-06-01', departure: '2026-06-03', pax: 3, children: 1, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
    ]);
    const result = departuresForDate(arrivals, '2026-06-03');
    expect(result.map((r) => r.room)).toEqual(['A1 - Villa A1', 'A4 - Villa A4']);
  });

  it('returns an empty array when arrivals is undefined', () => {
    expect(departuresForDate(undefined, '2026-06-01')).toEqual([]);
  });

  it('returns an empty array when no rows depart on the given date', () => {
    const arrivals = report([
      { resNo: '1', guest: 'A', room: 'A1', rate: 1, arrival: '2026-06-01', departure: '2026-06-07', pax: 2, children: 0, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
    ]);
    expect(departuresForDate(arrivals, '2026-06-03')).toEqual([]);
  });
});

describe('stayoverArrivalsForDate', () => {
  it('returns rows that span the given date (checked in before, checking out after)', () => {
    const arrivals = report([
      { resNo: '9', guest: 'Staying', room: 'A2', rate: 1, arrival: '2026-06-01', departure: '2026-06-10', pax: 2, children: 0, resType: 'Confirm Booking', channel: 'OTA', notes: 'n' },
    ]);
    const result = stayoverArrivalsForDate(arrivals, '2026-06-05');
    expect(result).toEqual([
      { resNo: '9', room: 'A2', guest: 'Staying', adults: 2, children: 0, arrivalDate: '2026-06-01', departureDate: '2026-06-10', nights: 9, notes: 'n' },
    ]);
  });

  it('excludes a row whose arrival is exactly the given date (that is "arriving", not stayover)', () => {
    const arrivals = report([
      { resNo: '1', guest: 'A', room: 'A1', rate: 1, arrival: '2026-06-05', departure: '2026-06-10', pax: 2, children: 0, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
    ]);
    expect(stayoverArrivalsForDate(arrivals, '2026-06-05')).toEqual([]);
  });

  it('excludes a row whose departure is exactly the given date (that is "departing", not stayover)', () => {
    const arrivals = report([
      { resNo: '1', guest: 'A', room: 'A1', rate: 1, arrival: '2026-06-01', departure: '2026-06-05', pax: 2, children: 0, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
    ]);
    expect(stayoverArrivalsForDate(arrivals, '2026-06-05')).toEqual([]);
  });

  it('excludes rows that are not Confirm Booking', () => {
    const arrivals = report([
      { resNo: '1', guest: 'A', room: 'A1', rate: 1, arrival: '2026-06-01', departure: '2026-06-10', pax: 2, children: 0, resType: 'Tentative', channel: 'OTA', notes: '' },
    ]);
    expect(stayoverArrivalsForDate(arrivals, '2026-06-05')).toEqual([]);
  });

  it('returns an empty array when arrivals is undefined', () => {
    expect(stayoverArrivalsForDate(undefined, '2026-06-05')).toEqual([]);
  });
});

describe('villaRoomLabels', () => {
  it('generates eZee-format room labels for the given count', () => {
    expect(villaRoomLabels(4)).toEqual([
      'A1 - Villa A1', 'A2 - Villa A2', 'A3 - Villa A3', 'A4 - Villa A4',
    ]);
  });

  it('defaults to 4 villas', () => {
    expect(villaRoomLabels()).toHaveLength(4);
  });
});

describe('villaStatusesForDate', () => {
  const villas = villaRoomLabels(4);

  it('reports vacant for a villa with no arrival or departure that day', () => {
    const result = villaStatusesForDate(report([]), '2026-06-03', villas);
    expect(result).toEqual([
      { room: 'A1 - Villa A1', status: { kind: 'vacant' } },
      { room: 'A2 - Villa A2', status: { kind: 'vacant' } },
      { room: 'A3 - Villa A3', status: { kind: 'vacant' } },
      { room: 'A4 - Villa A4', status: { kind: 'vacant' } },
    ]);
  });

  it('reports arriving for a villa with only a check-in that day', () => {
    const arrivals = report([
      { resNo: '1', guest: 'Somchai', room: 'A1 - Villa A1', rate: 1, arrival: '2026-06-03', departure: '2026-06-05', pax: 2, children: 0, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
    ]);
    const result = villaStatusesForDate(arrivals, '2026-06-03', villas);
    const a1 = result.find((r) => r.room === 'A1 - Villa A1')!;
    expect(a1.status.kind).toBe('arriving');
    if (a1.status.kind === 'arriving') expect(a1.status.arrival.guest).toBe('Somchai');
  });

  it('reports departing for a villa with only a check-out that day', () => {
    const arrivals = report([
      { resNo: '1', guest: 'Old Guest', room: 'A2 - Villa A2', rate: 1, arrival: '2026-06-01', departure: '2026-06-03', pax: 2, children: 0, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
    ]);
    const result = villaStatusesForDate(arrivals, '2026-06-03', villas);
    const a2 = result.find((r) => r.room === 'A2 - Villa A2')!;
    expect(a2.status.kind).toBe('departing');
    if (a2.status.kind === 'departing') expect(a2.status.departure.guest).toBe('Old Guest');
  });

  it('reports turnover for a villa with both a check-out and check-in that day', () => {
    const arrivals = report([
      { resNo: '1', guest: 'Outgoing', room: 'A3 - Villa A3', rate: 1, arrival: '2026-06-01', departure: '2026-06-03', pax: 2, children: 0, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
      { resNo: '2', guest: 'Incoming', room: 'A3 - Villa A3', rate: 1, arrival: '2026-06-03', departure: '2026-06-05', pax: 2, children: 0, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
    ]);
    const result = villaStatusesForDate(arrivals, '2026-06-03', villas);
    const a3 = result.find((r) => r.room === 'A3 - Villa A3')!;
    expect(a3.status.kind).toBe('turnover');
    if (a3.status.kind === 'turnover') {
      expect(a3.status.departure.guest).toBe('Outgoing');
      expect(a3.status.arrival.guest).toBe('Incoming');
    }
  });

  it('reports stayover for a villa with a guest checked in before and checking out after the given date', () => {
    const arrivals = report([
      { resNo: '5', guest: 'Long Stay', room: 'A4 - Villa A4', rate: 1, arrival: '2026-06-01', departure: '2026-06-10', pax: 2, children: 0, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
    ]);
    const result = villaStatusesForDate(arrivals, '2026-06-05', villas);
    const a4 = result.find((r) => r.room === 'A4 - Villa A4')!;
    expect(a4.status.kind).toBe('stayover');
    if (a4.status.kind === 'stayover') expect(a4.status.arrival.guest).toBe('Long Stay');
  });

  it('preserves villa roster order regardless of arrival row order', () => {
    const arrivals = report([
      { resNo: '1', guest: 'Z', room: 'A4 - Villa A4', rate: 1, arrival: '2026-06-03', departure: '2026-06-05', pax: 2, children: 0, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
      { resNo: '2', guest: 'Y', room: 'A1 - Villa A1', rate: 1, arrival: '2026-06-03', departure: '2026-06-05', pax: 2, children: 0, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
    ]);
    const result = villaStatusesForDate(arrivals, '2026-06-03', villas);
    expect(result.map((r) => r.room)).toEqual(['A1 - Villa A1', 'A2 - Villa A2', 'A3 - Villa A3', 'A4 - Villa A4']);
  });
});
