import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseYearly } from '../../src/parser/yearly';

const html = readFileSync('tests/fixtures/yearly.html', 'utf-8');

describe('parseYearly', () => {
  it('parses year and all 12 months', () => {
    const r = parseYearly(html);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.year).toBe(2026);
    expect(r.data.months).toHaveLength(12);
  });

  it('parses May row correctly', () => {
    const r = parseYearly(html);
    if (!r.ok) throw new Error(r.reason);
    const may = r.data.months.find((m) => m.month === 'May')!;
    expect(may.monthIndex).toBe(5);
    expect(may.availableRooms).toBe(109);
    expect(may.nightSold).toBe(46);
    expect(may.occPct).toBe(42.2);
    expect(may.adr).toBe(7110.78);
    expect(may.revPar).toBe(3000.88);
    expect(may.pax).toBe(312);
    expect(may.roomCharges).toBe(327095.82);
  });

  it('parses grand total with commas', () => {
    const r = parseYearly(html);
    if (!r.ok) throw new Error(r.reason);
    expect(r.data.grandTotal.availableRooms).toBe(1430);
    expect(r.data.grandTotal.occPct).toBe(57.55);
  });
});
