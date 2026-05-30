import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseCountry } from '../../src/parser/country';

const html = readFileSync('tests/fixtures/country.html', 'utf-8');

describe('parseCountry', () => {
  it('parses period', () => {
    const r = parseCountry(html);
    if (!r.ok) throw new Error(r.reason);
    expect(r.data.periodFrom).toBe('2026-01-01');
    expect(r.data.periodTo).toBe('2026-05-29');
  });

  it('parses France row', () => {
    const r = parseCountry(html);
    if (!r.ok) throw new Error(r.reason);
    const france = r.data.rows.find((x) => x.country === 'France')!;
    expect(france.revenue).toBe(392719.78);
    expect(france.reservations).toBe(13);
    expect(france.guests).toBe(85);
    expect(france.nights).toBe(44);
    expect(france.avgPerNight).toBe(8925.45);
  });

  it('handles pagination (collects rows from both pages)', () => {
    const r = parseCountry(html);
    if (!r.ok) throw new Error(r.reason);
    // includes Hong Kong / Austria / Korea from page 2
    expect(r.data.rows.some((x) => x.country === 'Hong Kong')).toBe(true);
    // does not include the repeated header row
    expect(r.data.rows.some((x) => x.country === 'Country')).toBe(false);
  });
});
