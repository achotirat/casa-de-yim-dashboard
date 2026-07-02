import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseArrivals } from '../../src/parser/arrivals';

const html = readFileSync('tests/fixtures/arrivals.html', 'utf-8');

describe('parseArrivals', () => {
  it('parses period', () => {
    const r = parseArrivals(html);
    if (!r.ok) throw new Error(r.reason);
    expect(r.data.periodFrom).toBe('2026-05-29');
    expect(r.data.periodTo).toBe('2026-06-30');
  });

  it('parses the first booking', () => {
    const r = parseArrivals(html);
    if (!r.ok) throw new Error(r.reason);
    const first = r.data.rows.find((x) => x.resNo === '301')!;
    expect(first.guest).toBe('Kean Cheng Choo');
    expect(first.room).toContain('A4');
    expect(first.rate).toBe(9711.9);
    expect(first.arrival).toBe('2026-05-30');
    expect(first.departure).toBe('2026-06-01');
    expect(first.pax).toBe(10);
    expect(first.channel).toBe('OTA');
    expect(first.resType).toBe('Confirm Booking');
  });

  it('attaches note text to the preceding booking', () => {
    const r = parseArrivals(html);
    if (!r.ok) throw new Error(r.reason);
    const first = r.data.rows.find((x) => x.resNo === '301')!;
    expect(first.notes).toContain('Early check in');
  });

  it('parses multiple distinct bookings', () => {
    const r = parseArrivals(html);
    if (!r.ok) throw new Error(r.reason);
    expect(r.data.rows.some((x) => x.resNo === '68')).toBe(true);
    expect(r.data.rows.some((x) => x.resNo === '481')).toBe(true);
  });

  it('parses children count alongside adults', () => {
    const r = parseArrivals(html);
    if (!r.ok) throw new Error(r.reason);
    const withChild = r.data.rows.find((x) => x.resNo === '472')!;
    expect(withChild.pax).toBe(2);
    expect(withChild.children).toBe(2);
    const noChild = r.data.rows.find((x) => x.resNo === '301')!;
    expect(noChild.pax).toBe(10);
    expect(noChild.children).toBe(0);
  });
});
