import { describe, it, expect } from 'vitest';
import { parseNum, parsePax } from '../../src/parser/num';

describe('parseNum', () => {
  it('parses plain numbers', () => {
    expect(parseNum('42.20')).toBe(42.2);
    expect(parseNum('109')).toBe(109);
  });
  it('strips commas', () => {
    expect(parseNum('1,430')).toBe(1430);
    expect(parseNum('6,606,140.86')).toBe(6606140.86);
  });
  it('returns null for non-numeric', () => {
    expect(parseNum('Page 1 of 2')).toBeNull();
    expect(parseNum('')).toBeNull();
    expect(parseNum('-')).toBeNull();
    expect(parseNum(null)).toBeNull();
  });
});

describe('parsePax', () => {
  it('splits adults/children', () => {
    expect(parsePax('166/0')).toEqual({ adults: 166, children: 0 });
    expect(parsePax('303/9')).toEqual({ adults: 303, children: 9 });
  });
  it('handles single number', () => {
    expect(parsePax('312')).toEqual({ adults: 312, children: null });
  });
});
