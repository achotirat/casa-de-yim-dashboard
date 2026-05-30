import { describe, it, expect } from 'vitest';
import { recommend, type RecoInput } from '../../src/recommendations/rules';

const base: RecoInput = {
  monthLabel: 'June',
  occNow: 60,
  leadDays: 40,
  pacePerWeek: 6,
  occPrevYear: 55,
};

describe('recommend', () => {
  it('fires RED for last-minute very low occ', () => {
    const recos = recommend({ ...base, occNow: 30, leadDays: 10 });
    expect(recos.some((r) => r.level === 'red')).toBe(true);
  });
  it('fires ORANGE for slow pace under 50% within a month', () => {
    const recos = recommend({ ...base, occNow: 45, leadDays: 25, pacePerWeek: 2 });
    expect(recos.some((r) => r.level === 'orange')).toBe(true);
  });
  it('fires ORANGE when far behind last year', () => {
    const recos = recommend({ ...base, occNow: 30, occPrevYear: 60 });
    expect(recos.some((r) => r.message.includes('ปีก่อน'))).toBe(true);
  });
  it('fires GREEN to raise price on strong demand', () => {
    const recos = recommend({ ...base, occNow: 88, leadDays: 30 });
    expect(recos.some((r) => r.level === 'green')).toBe(true);
  });
  it('every reco carries the evidence numbers', () => {
    const recos = recommend({ ...base, occNow: 30, leadDays: 10 });
    expect(recos[0].evidence).toContain('occ');
  });
});
