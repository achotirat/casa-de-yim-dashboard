import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseFile } from '../../src/parser';

const fx = (n: string) => readFileSync(`tests/fixtures/${n}`, 'utf-8');

describe('parseFile', () => {
  it('routes yearly file', () => {
    const r = parseFile(fx('yearly.html'));
    expect(r.type).toBe('yearly');
    expect(r.result.ok).toBe(true);
  });
  it('routes channel file', () => {
    const r = parseFile(fx('channel.html'));
    expect(r.type).toBe('channel');
    expect(r.result.ok).toBe(true);
  });
  it('routes country file', () => {
    const r = parseFile(fx('country.html'));
    expect(r.type).toBe('country');
    expect(r.result.ok).toBe(true);
  });
  it('routes arrivals file', () => {
    const r = parseFile(fx('arrivals.html'));
    expect(r.type).toBe('arrivals');
    expect(r.result.ok).toBe(true);
  });
  it('routes unknown file', () => {
    const r = parseFile('<html><body>nope</body></html>');
    expect(r.type).toBe('unknown');
    expect(r.result.ok).toBe(false);
  });
});
