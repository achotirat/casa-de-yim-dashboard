import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseMonthly } from '../../src/parser/monthly';

const html = readFileSync('tests/fixtures/monthly.html', 'utf-8');

describe('parseMonthly', () => {
  it('parses month and year from header', () => {
    const r = parseMonthly(html);
    if (!r.ok) throw new Error(r.reason);
    expect(r.data.month).toBe(5);
    expect(r.data.year).toBe(2026);
  });

  it('parses all 31 days (multi-page)', () => {
    const r = parseMonthly(html);
    if (!r.ok) throw new Error(r.reason);
    expect(r.data.days).toHaveLength(31);
  });

  it('parses day 1 correctly (100% occ)', () => {
    const r = parseMonthly(html);
    if (!r.ok) throw new Error(r.reason);
    const day1 = r.data.days.find((d) => d.date === '2026-05-01')!;
    expect(day1.dayOfWeek).toBe('Fri');
    expect(day1.availableRooms).toBe(4);
    expect(day1.nightSold).toBe(4);
    expect(day1.occPct).toBe(100);
    expect(day1.adr).toBeCloseTo(6784.07, 2);
    expect(day1.roomCharges).toBeCloseTo(27136.26, 2);
  });

  it('parses day 4 (zero occ)', () => {
    const r = parseMonthly(html);
    if (!r.ok) throw new Error(r.reason);
    const day4 = r.data.days.find((d) => d.date === '2026-05-04')!;
    expect(day4.occPct).toBe(0);
    expect(day4.nightSold).toBe(0);
    expect(day4.adr).toBe(0);
  });

  it('returns error for non-monthly html', () => {
    const r = parseMonthly('<html><body>Yearly Statistics</body></html>');
    expect(r.ok).toBe(false);
  });
});
