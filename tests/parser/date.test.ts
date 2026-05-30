import { describe, it, expect } from 'vitest';
import { parseDate } from '../../src/parser/date';

describe('parseDate', () => {
  it('converts dd/mm/yyyy to ISO', () => {
    expect(parseDate('29/05/2026')).toBe('2026-05-29');
    expect(parseDate('01/01/2026')).toBe('2026-01-01');
  });
  it('handles dd/mm/yyyy with trailing time', () => {
    expect(parseDate('30/05/2026 07:41:36 PM')).toBe('2026-05-30');
  });
  it('handles surrounding whitespace', () => {
    expect(parseDate('   29/05/2026    ')).toBe('2026-05-29');
  });
  it('returns null for invalid', () => {
    expect(parseDate('not a date')).toBeNull();
    expect(parseDate(null)).toBeNull();
  });
});
