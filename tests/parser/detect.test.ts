import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { detectReportType, extractDataAsOf } from '../../src/parser/detect';

const fx = (n: string) => readFileSync(`tests/fixtures/${n}`, 'utf-8');

describe('detectReportType', () => {
  it('detects each report type', () => {
    expect(detectReportType(fx('yearly.html'))).toBe('yearly');
    expect(detectReportType(fx('channel.html'))).toBe('channel');
    expect(detectReportType(fx('country.html'))).toBe('country');
    expect(detectReportType(fx('arrivals.html'))).toBe('arrivals');
  });
  it('returns unknown for junk', () => {
    expect(detectReportType('<html><body>hello</body></html>')).toBe('unknown');
  });
});

describe('extractDataAsOf', () => {
  it('reads printed-on date', () => {
    expect(extractDataAsOf(fx('channel.html'))).toBe('2026-05-29');
    expect(extractDataAsOf(fx('country.html'))).toBe('2026-05-29');
  });
});
