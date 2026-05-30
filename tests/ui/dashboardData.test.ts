import { describe, it, expect } from 'vitest';
import { targetMonthForPeriod } from '../../src/ui/dashboardData';

describe('targetMonthForPeriod', () => {
  // dataAsOf 2026-05-29
  it('last month -> April (4)', () => {
    expect(targetMonthForPeriod('lastMonth', '2026-05-29')).toBe(4);
  });
  it('next month -> June (6)', () => {
    expect(targetMonthForPeriod('nextMonth', '2026-05-29')).toBe(6);
  });
  it('this/last week falls in current month (5)', () => {
    expect(targetMonthForPeriod('lastWeek', '2026-05-29')).toBe(5);
  });
});
