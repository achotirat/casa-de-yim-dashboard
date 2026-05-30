import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildSnapshot } from '../../src/ui/buildSnapshot';

const fx = (n: string) => readFileSync(`tests/fixtures/${n}`, 'utf-8');

describe('buildSnapshot', () => {
  it('merges multiple report files into one snapshot', () => {
    const { snapshot, errors } = buildSnapshot([
      fx('yearly.html'), fx('channel.html'), fx('country.html'), fx('arrivals.html'),
    ]);
    expect(errors).toHaveLength(0);
    expect(snapshot.yearly?.year).toBe(2026);
    expect(snapshot.channels?.rows.length).toBeGreaterThan(0);
    expect(snapshot.countries?.rows.length).toBeGreaterThan(0);
    expect(snapshot.arrivals?.rows.length).toBeGreaterThan(0);
    expect(snapshot.dataAsOf).toBe('2026-05-29');
  });

  it('records an error for an unrecognized file', () => {
    const { errors } = buildSnapshot(['<html><body>nope</body></html>']);
    expect(errors.length).toBe(1);
  });
});
