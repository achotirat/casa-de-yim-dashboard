# Phase 2: Monthly Statistics Parser + Playwright Auto-Export — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่ม parser รายวัน (Monthly Statistics) + Playwright script ที่ login eZee ทุกอาทิตย์ 05:00 น. แล้ว export 8 reports อัตโนมัติและ upload ไปที่ Netlify dashboard โดยไม่ต้องแตะ dashboard เลย

**Architecture:** Part A (Tasks 1–6) เพิ่ม Monthly parser → weekly KPI metric → "สัปดาห์ที่ผ่านมา" tab ที่มีตัวเลขจริง แล้ว deploy. Part B (Tasks 7–11) Playwright script บน Mac + cron job วันอาทิตย์ 05:00 น. — script login live.ipms247.com, export HTML, parse ด้วย parser เดิม+ใหม่, POST ไปที่ Netlify API. Navigator selectors ต้องยืนยันบน first `--headed` run.

**Tech Stack:** Vitest · DOMParser (existing) · Playwright (Chromium) · tsx · macOS cron + osascript notification

---

## File Structure

```
New:
  tests/fixtures/monthly.html          # fixture: Report(13).html — May 2026 2-page
  src/parser/monthly.ts                # parseMonthly(html) → ParseResult<MonthlyReport>
  tests/parser/monthly.test.ts
  src/metrics/weekly.ts                # weeklyKpi(monthly[], asOf) → WeeklyKpi | null
  tests/metrics/weekly.test.ts
  scripts/ezee-export-config.ts        # date-range helpers + 8-report config
  scripts/ezee-export.ts               # Playwright: login → export → upload
  scripts/setup-cron.sh                # install crontab + create log dir

Modified:
  src/types.ts                         # + DayRow, MonthlyReport, Snapshot.monthly?
  src/parser/detect.ts                 # + 'monthly' in ReportType + detectReportType
  src/parser/index.ts                  # + case 'monthly'
  src/ui/buildSnapshot.ts              # monthly: push-to-array instead of assign
  tests/ui/buildSnapshot.test.ts       # + monthly merge tests
  src/ui/dashboardData.ts              # + 'lastWeek' in Period
  src/ui/components/PeriodToggle.tsx   # conditional lastWeek tab
  src/ui/components/KpiCards.tsx       # + weeklyOverride prop
  src/ui/Dashboard.tsx                 # compute weeklyKpi, pass hasWeeklyData
  package.json                         # + playwright, tsx devDeps
```

---

## Task 1: Monthly fixture + extended types

**Files:**
- Create: `tests/fixtures/monthly.html`
- Modify: `src/types.ts`
- Modify: `src/parser/detect.ts` (ReportType only — full detection in Task 3)

- [ ] **Step 1: Copy fixture**

```bash
cp "/Users/temtem/Downloads/Report (13).html" /Users/temtem/projects/casa-de-yim-dashboard/tests/fixtures/monthly.html
```

Verify: `wc -l tests/fixtures/monthly.html` — expect > 40 lines

- [ ] **Step 2: Add DayRow, MonthlyReport, extend Snapshot in src/types.ts**

Add after the `ArrivalsReport` interface:

```ts
export interface DayRow {
  date: string;          // ISO "2026-05-01"
  dayOfWeek: string;     // "Fri"
  availableRooms: number | null;
  nightSold: number | null;
  occPct: number | null;
  adr: number | null;
  revPar: number | null;
  pax: number | null;
  roomCharges: number | null;
}

export interface MonthlyReport {
  month: number;   // 1-12
  year: number;
  days: DayRow[];
}
```

Change `Snapshot`:
```ts
export interface Snapshot {
  uploadedAt: string;
  dataAsOf: string | null;
  yearly?: YearlyReport;
  channels?: ChannelReport;
  countries?: CountryReport;
  arrivals?: ArrivalsReport;
  monthly?: MonthlyReport[];   // up to 2 months, sorted oldest-first
}
```

Change `ReportType` (first line of types.ts):
```ts
export type ReportType = 'yearly' | 'channel' | 'country' | 'arrivals' | 'monthly' | 'unknown';
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/temtem/projects/casa-de-yim-dashboard && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/monthly.html src/types.ts
git commit -m "feat: add DayRow/MonthlyReport types and monthly fixture"
```

---

## Task 2: Monthly Statistics parser (TDD)

**Files:**
- Create: `src/parser/monthly.ts`
- Create: `tests/parser/monthly.test.ts`

- [ ] **Step 1: Write the failing test**

Write `tests/parser/monthly.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `cd /Users/temtem/projects/casa-de-yim-dashboard && npx vitest run tests/parser/monthly.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Inspect fixture to verify column layout**

Run:
```bash
node -e "
const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('tests/fixtures/monthly.html', 'utf-8');
const dom = new JSDOM(html);
const rows = [...dom.window.document.querySelectorAll('tr')].map(tr =>
  [...tr.querySelectorAll('td')].map(td => td.textContent.replace(/\xA0/g,' ').replace(/\s+/g,' ').trim())
).filter(r => r.some(c => c !== ''));
rows.slice(0, 8).forEach((r,i) => console.log(i, JSON.stringify(r.filter(c=>c))));
"
```

Expected output (confirm column order):
```
0 ["Casa de Yim","Monthly Statistics"]
1 ["Month May,2026 Show Unposted Inclusions Charges No"]
2 ["Date","Available Rooms","Night Sold","Complimentary","Occ","ADR","Rev Par","Pax","Room Charges",...]
3 ["1 Fri","4","4","0","100.00","6784.07","6784.07","27","27136.26",...]
4 ["2 Sat","4","4","0","100.00","6784.07","6784.07","27","27136.26",...]
5 ["3 Sun","4","2","0","50.00","6808.88","3404.44","16","13617.75",...]
6 ["4 Mon","4","0","0","0.00","0.00","0.00","0","0.00",...]
```

- [ ] **Step 4: Write the implementation**

Write `src/parser/monthly.ts`:
```ts
import { extractRows } from './rows';
import { parseNum } from './num';
import type { MonthlyReport, DayRow, ParseResult } from '../types';

const MONTH_NAMES: Record<string, number> = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
};

// Column order after date label (same as Yearly Stats):
// slice(1): [0]=availRooms [1]=nightSold [2]=complimentary [3]=occ% [4]=adr [5]=revPar [6]=pax [7]=roomCharges
function toDayRow(cells: string[], month: number, year: number): DayRow {
  const m = cells[0].match(/^(\d{1,2})\s+(\w{3})$/);
  const day = m ? Number(m[1]) : 0;
  const dayOfWeek = m ? m[2] : '';
  const date = day > 0
    ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    : '';
  const nums = cells.slice(1).map(parseNum);
  return {
    date,
    dayOfWeek,
    availableRooms: nums[0] ?? null,
    nightSold: nums[1] ?? null,
    occPct: nums[3] ?? null,
    adr: nums[4] ?? null,
    revPar: nums[5] ?? null,
    pax: nums[6] ?? null,
    roomCharges: nums[7] ?? null,
  };
}

export function parseMonthly(html: string): ParseResult<MonthlyReport> {
  const rows = extractRows(html);

  let month = 0;
  let year = 0;

  for (const r of rows) {
    for (const cell of r) {
      // "Month May,2026 Show Unposted..."
      const m = cell.match(/Month\s+(\w+),(\d{4})/i);
      if (m) {
        month = MONTH_NAMES[m[1]] ?? 0;
        year = Number(m[2]);
        break;
      }
    }
    if (month) break;
  }

  if (!month || !year) {
    return { ok: false, reason: 'ไม่พบหัว Month/Year ใน Monthly Statistics' };
  }

  const days: DayRow[] = [];
  for (const r of rows) {
    const cells = r.filter((c) => c !== '');
    if (cells.length === 0) continue;
    // Data row: "1 Fri", "15 Mon", "31 Sun" etc.
    if (/^\d{1,2}\s+\w{3}$/.test(cells[0])) {
      days.push(toDayRow(cells, month, year));
    }
  }

  if (days.length === 0) {
    return { ok: false, reason: 'ไม่พบข้อมูลรายวันใน Monthly Statistics' };
  }

  return { ok: true, data: { month, year, days } };
}
```

- [ ] **Step 5: Run test to confirm it passes**

Run: `cd /Users/temtem/projects/casa-de-yim-dashboard && npx vitest run tests/parser/monthly.test.ts`
Expected: PASS (5 tests)

If 31-day test fails, inspect rows more: `node -e "...rows.forEach((r,i) => console.log(i, r[0]))"` and confirm all 31 day rows are detected.

- [ ] **Step 6: Commit**

```bash
git add src/parser/monthly.ts tests/parser/monthly.test.ts
git commit -m "feat: add Monthly Statistics parser (daily granularity)"
```

---

## Task 3: Wire monthly parser into detect → index → buildSnapshot

**Files:**
- Modify: `src/parser/detect.ts`
- Modify: `src/parser/index.ts`
- Modify: `src/ui/buildSnapshot.ts`
- Modify: `tests/ui/buildSnapshot.test.ts`

- [ ] **Step 1: Update detect.ts — add 'monthly' detection**

In `detectReportType`, add before the `return 'unknown'` line:

```ts
export function detectReportType(html: string): ReportType {
  const t = plainText(html);
  if (t.includes('Yearly Statistics')) return 'yearly';
  if (t.includes('Contribution Analysis Report')) return 'channel';
  if (t.includes('Country Wise Reservation Statistics')) return 'country';
  if (t.includes('Arrival List')) return 'arrivals';
  if (t.includes('Monthly Statistics')) return 'monthly';
  return 'unknown';
}
```

Note: 'Monthly Statistics' must come AFTER 'Yearly Statistics' check since yearly does NOT contain 'Monthly Statistics'.

- [ ] **Step 2: Update index.ts — add monthly case**

Full replacement of `src/parser/index.ts`:
```ts
import { detectReportType, extractDataAsOf } from './detect';
import { parseYearly } from './yearly';
import { parseChannel } from './channel';
import { parseCountry } from './country';
import { parseArrivals } from './arrivals';
import { parseMonthly } from './monthly';
import type { ReportType, ParseResult } from '../types';

export { extractDataAsOf };

export interface ParsedFile {
  type: ReportType;
  result: ParseResult<unknown>;
}

export function parseFile(html: string): ParsedFile {
  const type = detectReportType(html);
  switch (type) {
    case 'yearly':   return { type, result: parseYearly(html) };
    case 'channel':  return { type, result: parseChannel(html) };
    case 'country':  return { type, result: parseCountry(html) };
    case 'arrivals': return { type, result: parseArrivals(html) };
    case 'monthly':  return { type, result: parseMonthly(html) };
    default:
      return { type: 'unknown', result: { ok: false, reason: 'ไม่รู้จักชนิดรายงานนี้ (หาหัวตารางที่รองรับไม่เจอ)' } };
  }
}
```

- [ ] **Step 3: Update buildSnapshot.ts — multi-monthly merge**

Full replacement of `src/ui/buildSnapshot.ts`:
```ts
import { parseFile, extractDataAsOf } from '../parser';
import type {
  Snapshot, YearlyReport, ChannelReport, CountryReport, ArrivalsReport, MonthlyReport,
} from '../types';

export interface BuildResult {
  snapshot: Snapshot;
  errors: string[];
}

export function buildSnapshot(htmls: string[]): BuildResult {
  const snapshot: Snapshot = { uploadedAt: new Date().toISOString(), dataAsOf: null };
  const errors: string[] = [];

  for (const html of htmls) {
    const { type, result } = parseFile(html);
    if (!result.ok) {
      errors.push(result.reason);
      continue;
    }
    if (!snapshot.dataAsOf) {
      const d = extractDataAsOf(html);
      if (d) snapshot.dataAsOf = d;
    }
    switch (type) {
      case 'yearly':   snapshot.yearly = result.data as YearlyReport; break;
      case 'channel':  snapshot.channels = result.data as ChannelReport; break;
      case 'country':  snapshot.countries = result.data as CountryReport; break;
      case 'arrivals': snapshot.arrivals = result.data as ArrivalsReport; break;
      case 'monthly': {
        const rep = result.data as MonthlyReport;
        const arr = snapshot.monthly ?? [];
        const idx = arr.findIndex((m) => m.month === rep.month && m.year === rep.year);
        if (idx >= 0) arr[idx] = rep; else arr.push(rep);
        snapshot.monthly = arr.sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month));
        break;
      }
    }
  }

  return { snapshot, errors };
}
```

- [ ] **Step 4: Add monthly merge tests to buildSnapshot.test.ts**

Add two new `it` blocks after the existing ones:
```ts
import { readFileSync } from 'node:fs';
// ... existing imports ...

describe('buildSnapshot', () => {
  // ... existing tests ...

  it('adds monthly report to monthly array', () => {
    const { snapshot, errors } = buildSnapshot([fx('monthly.html')]);
    expect(errors).toHaveLength(0);
    expect(snapshot.monthly).toHaveLength(1);
    expect(snapshot.monthly![0].month).toBe(5);
    expect(snapshot.monthly![0].year).toBe(2026);
    expect(snapshot.monthly![0].days).toHaveLength(31);
  });

  it('replaces same month and keeps sorted order', () => {
    // Upload same monthly file twice → should still be 1 entry (replace, not duplicate)
    const { snapshot } = buildSnapshot([fx('monthly.html'), fx('monthly.html')]);
    expect(snapshot.monthly).toHaveLength(1);
  });
});
```

- [ ] **Step 5: Run all tests**

Run: `cd /Users/temtem/projects/casa-de-yim-dashboard && npx vitest run`
Expected: all tests pass (including new monthly ones)

- [ ] **Step 6: Commit**

```bash
git add src/parser/detect.ts src/parser/index.ts src/ui/buildSnapshot.ts tests/ui/buildSnapshot.test.ts
git commit -m "feat: wire Monthly Statistics into parser dispatcher and buildSnapshot"
```

---

## Task 4: Weekly KPI metric (TDD)

**Files:**
- Create: `src/metrics/weekly.ts`
- Create: `tests/metrics/weekly.test.ts`

- [ ] **Step 1: Write the failing test**

Write `tests/metrics/weekly.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { weeklyKpi } from '../../src/metrics/weekly';
import type { MonthlyReport, DayRow } from '../../src/types';

function makeDay(date: string, dow: string, occ: number, adr: number, rooms = 4): DayRow {
  const nights = Math.round(rooms * occ / 100);
  return {
    date, dayOfWeek: dow,
    availableRooms: rooms,
    nightSold: nights,
    occPct: occ,
    adr: nights > 0 ? adr : 0,
    revPar: (occ / 100) * adr,
    pax: nights * 2,
    roomCharges: nights * adr,
  };
}

// 7 days: 2026-05-25 to 2026-05-31 (inclusive)
// asOf = '2026-06-01' → window = [2026-05-25, 2026-06-01)
const may: MonthlyReport = {
  month: 5, year: 2026,
  days: [
    makeDay('2026-05-25', 'Mon', 100, 8000), // 4 nights × 8000 = 32000
    makeDay('2026-05-26', 'Tue',  50, 6000), // 2 nights × 6000 = 12000
    makeDay('2026-05-27', 'Wed',   0,    0), // 0 nights
    makeDay('2026-05-28', 'Thu',  75, 7000), // 3 nights × 7000 = 21000
    makeDay('2026-05-29', 'Fri', 100, 9000), // 4 nights × 9000 = 36000
    makeDay('2026-05-30', 'Sat',  25, 5000), // 1 night  × 5000 =  5000
    makeDay('2026-05-31', 'Sun',  50, 6500), // 2 nights × 6500 = 13000
    // outside window:
    makeDay('2026-05-24', 'Sun', 100, 8000),
  ],
};
// totalRevenue = 32000+12000+0+21000+36000+5000+13000 = 119000
// totalNights  = 4+2+0+3+4+1+2 = 16
// totalRooms   = 4×7 = 28
// meanOcc      = (100+50+0+75+100+25+50)/7 = 400/7 ≈ 57.1
// ADR          = 119000/16 = 7437.50
// RevPAR       = 119000/28 ≈ 4250.00

describe('weeklyKpi', () => {
  it('returns null when no monthly data', () => {
    expect(weeklyKpi(undefined, '2026-06-01')).toBeNull();
    expect(weeklyKpi([], '2026-06-01')).toBeNull();
  });

  it('returns null when no days fall in range', () => {
    expect(weeklyKpi([may], '2026-05-01')).toBeNull();
  });

  it('computes mean occ% (simple average)', () => {
    const kpi = weeklyKpi([may], '2026-06-01')!;
    expect(kpi.occPct).toBeCloseTo(57.1, 1);
  });

  it('computes weighted ADR (totalRevenue / totalNights)', () => {
    const kpi = weeklyKpi([may], '2026-06-01')!;
    expect(kpi.adr).toBeCloseTo(7437.5, 1);
  });

  it('computes RevPAR (totalRevenue / totalAvailableRoomNights)', () => {
    const kpi = weeklyKpi([may], '2026-06-01')!;
    expect(kpi.revPar).toBeCloseTo(4250.0, 1);
  });

  it('reports correct night count', () => {
    const kpi = weeklyKpi([may], '2026-06-01')!;
    expect(kpi.nights).toBe(16);
    expect(kpi.daysWithData).toBe(6); // 6 days with nightSold > 0
  });

  it('spans two months (picks days from both)', () => {
    const jun: MonthlyReport = {
      month: 6, year: 2026,
      days: [makeDay('2026-06-01', 'Mon', 100, 9000)],
    };
    // asOf = '2026-06-02': window = [2026-05-26, 2026-06-02)
    // Includes 2026-05-26 … 2026-05-31 (6 days) + 2026-06-01 (1 day)
    const kpi = weeklyKpi([may, jun], '2026-06-02');
    expect(kpi).not.toBeNull();
    expect(kpi!.nights).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `cd /Users/temtem/projects/casa-de-yim-dashboard && npx vitest run tests/metrics/weekly.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Write the implementation**

Write `src/metrics/weekly.ts`:
```ts
import type { MonthlyReport, DayRow } from '../types';

export interface WeeklyKpi {
  occPct: number | null;    // simple mean of daily occ%
  adr: number | null;       // totalRevenue / totalNights
  revPar: number | null;    // totalRevenue / totalAvailableRoomNights
  revenue: number | null;
  nights: number;
  daysWithData: number;
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function weeklyKpi(
  monthly: MonthlyReport[] | undefined,
  asOf: string,
  lookbackDays = 7
): WeeklyKpi | null {
  if (!monthly || monthly.length === 0) return null;

  const start = addDays(asOf, -lookbackDays);
  const days: DayRow[] = monthly
    .flatMap((m) => m.days)
    .filter((d) => d.date >= start && d.date < asOf);

  if (days.length === 0) return null;

  const totalNights = days.reduce((s, d) => s + (d.nightSold ?? 0), 0);
  const totalRevenue = days.reduce((s, d) => s + (d.roomCharges ?? 0), 0);
  const totalAvailRooms = days.reduce((s, d) => s + (d.availableRooms ?? 0), 0);
  const daysWithData = days.filter((d) => (d.nightSold ?? 0) > 0).length;

  const occSum = days.reduce((s, d) => s + (d.occPct ?? 0), 0);
  const occPct = Math.round((occSum / days.length) * 10) / 10;
  const adr = totalNights > 0 ? Math.round((totalRevenue / totalNights) * 100) / 100 : null;
  const revPar = totalAvailRooms > 0 ? Math.round((totalRevenue / totalAvailRooms) * 100) / 100 : null;

  return {
    occPct,
    adr,
    revPar,
    revenue: totalRevenue > 0 ? totalRevenue : null,
    nights: totalNights,
    daysWithData,
  };
}
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `cd /Users/temtem/projects/casa-de-yim-dashboard && npx vitest run tests/metrics/weekly.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Run full test suite**

Run: `cd /Users/temtem/projects/casa-de-yim-dashboard && npx vitest run`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/metrics/weekly.ts tests/metrics/weekly.test.ts
git commit -m "feat: add weekly KPI metric (mean occ%, weighted ADR/RevPAR from DayRow[])"
```

---

## Task 5: UI — "สัปดาห์ที่ผ่านมา" tab + KpiCards weekly override

**Files:**
- Modify: `src/ui/dashboardData.ts`
- Modify: `src/ui/components/PeriodToggle.tsx`
- Modify: `src/ui/components/KpiCards.tsx`
- Modify: `src/ui/Dashboard.tsx`

- [ ] **Step 1: Update dashboardData.ts — add lastWeek**

Full replacement of `src/ui/dashboardData.ts`:
```ts
import type { Snapshot } from '../types';
import { getSnapshot, listSnapshotKeys } from '../lib/api';

export type Period = 'thisMonth' | 'next2Weeks' | 'nextMonth' | 'lastMonth' | 'lastWeek';

export const PERIOD_LABELS: Record<Period, string> = {
  thisMonth: 'เดือนนี้',
  next2Weeks: '2 สัปดาห์หน้า',
  nextMonth: 'เดือนหน้า',
  lastMonth: 'เดือนที่ผ่านมา',
  lastWeek: 'สัปดาห์ที่ผ่านมา',
};

export function targetMonthForPeriod(period: Period, dataAsOf: string): number {
  const month = Number(dataAsOf.slice(5, 7)); // 1-12
  switch (period) {
    case 'thisMonth': return month;
    case 'lastMonth': return month === 1 ? 12 : month - 1;
    case 'nextMonth': return month === 12 ? 1 : month + 1;
    case 'next2Weeks': return month;
    case 'lastWeek': return month === 1 ? 12 : month - 1; // monthly fallback for YoY delta
  }
}

export interface LoadedSnapshots {
  latest: Snapshot | null;
  previous: Snapshot | null;
  all: Snapshot[];
}

export async function loadSnapshots(): Promise<LoadedSnapshots> {
  const keys = (await listSnapshotKeys()).filter((k) => k.startsWith('snapshot/')).sort();
  const all = await Promise.all(keys.map((k) => getSnapshot(k)));
  return {
    latest: all[all.length - 1] ?? null,
    previous: all[all.length - 2] ?? null,
    all,
  };
}
```

- [ ] **Step 2: Update PeriodToggle.tsx — conditional lastWeek**

Full replacement of `src/ui/components/PeriodToggle.tsx`:
```tsx
import { PERIOD_LABELS, type Period } from '../dashboardData';

const BASE_ORDER: Period[] = ['thisMonth', 'next2Weeks', 'nextMonth', 'lastMonth'];

export default function PeriodToggle({
  value, onChange, hasWeeklyData,
}: { value: Period; onChange: (p: Period) => void; hasWeeklyData: boolean }) {
  const order: Period[] = hasWeeklyData ? [...BASE_ORDER, 'lastWeek'] : BASE_ORDER;
  return (
    <div className="flex gap-2 flex-wrap">
      {order.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-3 py-1.5 rounded-full text-sm ${value === p ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border'}`}
        >
          {PERIOD_LABELS[p]}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Update KpiCards.tsx — add weeklyOverride prop**

Full replacement of `src/ui/components/KpiCards.tsx`:
```tsx
import type { YearlyReport } from '../../types';
import type { WeeklyKpi } from '../../metrics/weekly';
import { monthByIndex, pctDelta } from '../../metrics/kpi';

function fmt(n: number | null, suffix = ''): string {
  return n == null ? '–' : `${n.toLocaleString('en-US', { maximumFractionDigits: suffix === '%' ? 1 : 0 })}${suffix}`;
}

function Delta({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-400 text-xs">—</span>;
  const up = value >= 0;
  return <span className={`text-xs ${up ? 'text-green-600' : 'text-red-600'}`}>{up ? '▲' : '▼'} {Math.abs(value).toFixed(1)}%</span>;
}

export default function KpiCards({
  yearly, yearlyPrev, monthIndex, occOverride, weeklyOverride,
}: {
  yearly?: YearlyReport;
  yearlyPrev?: YearlyReport;
  monthIndex: number;
  occOverride?: number | null;
  weeklyOverride?: WeeklyKpi | null;
}) {
  const cur = monthByIndex(yearly, monthIndex);
  const prevMonth = monthByIndex(yearly, monthIndex === 1 ? 12 : monthIndex - 1);
  const prevYear = monthByIndex(yearlyPrev, monthIndex);

  // weeklyOverride wins over occOverride wins over monthly aggregate
  const occ = weeklyOverride?.occPct ?? occOverride ?? cur?.occPct ?? null;
  const adr = weeklyOverride?.adr ?? cur?.adr ?? null;
  const revPar = weeklyOverride?.revPar ?? cur?.revPar ?? null;

  const cards = [
    { label: 'OCCUPANCY', value: fmt(occ, '%'), mom: pctDelta(occ, prevMonth?.occPct ?? null), yoy: pctDelta(occ, prevYear?.occPct ?? null) },
    { label: 'ADR',       value: '฿' + fmt(adr), mom: pctDelta(adr, prevMonth?.adr ?? null), yoy: pctDelta(adr, prevYear?.adr ?? null) },
    { label: 'REVPAR',    value: '฿' + fmt(revPar), mom: pctDelta(revPar, prevMonth?.revPar ?? null), yoy: pctDelta(revPar, prevYear?.revPar ?? null) },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-white rounded-xl p-5 shadow">
          <div className="text-xs text-slate-400">{c.label}</div>
          <div className="text-2xl font-bold text-slate-800">{c.value}</div>
          <div className="flex gap-3 mt-1">
            <span>MoM <Delta value={c.mom} /></span>
            <span>YoY <Delta value={c.yoy} /></span>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Update Dashboard.tsx — weekly logic**

Full replacement of `src/ui/Dashboard.tsx`:
```tsx
import { useEffect, useState } from 'react';
import PeriodToggle from './components/PeriodToggle';
import KpiCards from './components/KpiCards';
import TrendChart from './components/TrendChart';
import ForwardPace from './components/ForwardPace';
import MixPanels from './components/MixPanels';
import Recommendations from './components/Recommendations';
import ForecastSection from './components/ForecastSection';
import { loadSnapshots, targetMonthForPeriod, type Period, type LoadedSnapshots } from './dashboardData';
import { villaCount } from '../metrics/capacity';
import { dailyOccupancy } from '../metrics/pace';
import { weeklyKpi, type WeeklyKpi } from '../metrics/weekly';

export default function Dashboard() {
  const [data, setData] = useState<LoadedSnapshots | null>(null);
  const [period, setPeriod] = useState<Period>('thisMonth');

  useEffect(() => {
    loadSnapshots().then(setData);
  }, []);

  if (!data) return <div className="text-slate-500">กำลังโหลด…</div>;
  if (!data.latest) return <div className="text-slate-500">ยังไม่มีข้อมูล — ไปที่หน้า "อัปโหลด" ก่อน</div>;

  const dataAsOf = data.latest.dataAsOf ?? new Date().toISOString().slice(0, 10);
  const monthIndex = targetMonthForPeriod(period, dataAsOf);
  const hasWeeklyData = (data.latest.monthly?.length ?? 0) > 0;

  // For "2 สัปดาห์หน้า": average occ% from Arrival List for next 14 days
  let occOverride: number | null = null;
  if (period === 'next2Weeks') {
    const capacity = villaCount(data.latest.yearly);
    const today = new Date().toISOString().slice(0, 10);
    const days = dailyOccupancy(data.latest.arrivals, capacity, today, 14);
    occOverride = Math.round(days.reduce((s, d) => s + d.occPct, 0) / days.length * 10) / 10;
  }

  // For "สัปดาห์ที่ผ่านมา": real weekly KPI from Monthly Stats
  let weeklyOverride: WeeklyKpi | null = null;
  if (period === 'lastWeek') {
    weeklyOverride = weeklyKpi(data.latest.monthly, dataAsOf);
  }

  // Days ahead for ForwardPace
  function forwardDays(): number {
    if (period === 'next2Weeks') return 14;
    if (period === 'thisMonth') {
      const now = new Date();
      const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1;
      return Math.max(daysLeft, 1);
    }
    return 60;
  }

  const showForwardPace = period !== 'lastWeek';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PeriodToggle value={period} onChange={setPeriod} hasWeeklyData={hasWeeklyData} />
      <KpiCards
        yearly={data.latest.yearly}
        monthIndex={monthIndex}
        occOverride={occOverride}
        weeklyOverride={weeklyOverride}
      />
      <TrendChart yearly={data.latest.yearly} dataAsOf={dataAsOf} />
      <ForecastSection yearly={data.latest.yearly} dataAsOf={dataAsOf} />
      {showForwardPace && <ForwardPace latest={data.latest} daysAhead={forwardDays()} />}
      <MixPanels channels={data.latest.channels} countries={data.latest.countries} />
      <Recommendations latest={data.latest} previous={data.previous} />
    </div>
  );
}
```

- [ ] **Step 5: Verify TypeScript + full test suite**

Run: `cd /Users/temtem/projects/casa-de-yim-dashboard && npx tsc --noEmit && npx vitest run`
Expected: no type errors, all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/ui/dashboardData.ts src/ui/components/PeriodToggle.tsx src/ui/components/KpiCards.tsx src/ui/Dashboard.tsx
git commit -m "feat: restore lastWeek tab with real weekly KPI from Monthly Stats"
```

---

## Task 6: Deploy Part A

**Files:** none (deploy only)

- [ ] **Step 1: Build and deploy**

Run: `cd /Users/temtem/projects/casa-de-yim-dashboard && npx netlify deploy --build --prod 2>&1 | tail -5`
Expected: `Deploy is live!` with production URL

- [ ] **Step 2: Verify dashboard**

- เปิด https://casa-de-yim-dashboard.netlify.app
- หน้า "อัปโหลด" → ลากไฟล์ Report (13).html → เห็น ✓ Monthly Statistics (พ.ค.) → บันทึก
- กลับ Dashboard → เห็น tab "สัปดาห์ที่ผ่านมา" ปรากฏขึ้น → กดดู KPI ต่างจาก "เดือนที่ผ่านมา"

---

## Task 7: Install Playwright + tsx

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install dependencies**

Run:
```bash
cd /Users/temtem/projects/casa-de-yim-dashboard
npm install --save-dev playwright tsx
npx playwright install chromium
```

Expected: `chromium` browser installed (ใช้เวลาสักครู่)

- [ ] **Step 2: Create scripts directory**

```bash
mkdir -p /Users/temtem/projects/casa-de-yim-dashboard/scripts
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add playwright and tsx for auto-export script"
```

---

## Task 8: Date helpers + report config

**Files:**
- Create: `scripts/ezee-export-config.ts`

- [ ] **Step 1: Write ezee-export-config.ts**

Write `scripts/ezee-export-config.ts`:
```ts
/** Date range helpers and 8-report configuration for eZee auto-export */

/** Format Date as dd/mm/yyyy (eZee date input format) */
export function fmtDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Last day of given month (month is 1-based) */
function lastDay(year: number, month: number): Date {
  return new Date(year, month, 0); // day=0 → last day of previous month
}

/** Add months to a date (handles year rollover) */
function addMonths(d: Date, n: number): Date {
  const result = new Date(d);
  result.setMonth(result.getMonth() + n);
  return result;
}

export interface ReportDateConfig {
  id: string;
  description: string;
  type: 'yearly' | 'channel-ytd' | 'channel-monthly' | 'country-ytd' | 'country-monthly' | 'arrivals' | 'monthly-current' | 'monthly-prev';
  year?: number;           // for Yearly Statistics
  dateFrom?: string;       // dd/mm/yyyy
  dateTo?: string;         // dd/mm/yyyy
  orderBy?: string;        // for reports that need Order By
}

export function buildReportConfig(today: Date): ReportDateConfig[] {
  const y = today.getFullYear();
  const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevY = prevMonthDate.getFullYear();
  const prevM = prevMonthDate.getMonth() + 1; // 1-based

  return [
    {
      id: 'yearly-2026',
      description: 'Yearly Statistics (ปีปัจจุบัน)',
      type: 'yearly',
      year: y,
    },
    {
      id: 'channel-ytd',
      description: `Contribution Analysis YTD (01/01/${y} → วันนี้)`,
      type: 'channel-ytd',
      dateFrom: `01/01/${y}`,
      dateTo: fmtDate(today),
      orderBy: 'Business Source',
    },
    {
      id: 'channel-monthly',
      description: `Contribution Analysis เดือนก่อน`,
      type: 'channel-monthly',
      dateFrom: fmtDate(new Date(prevY, prevM - 1, 1)),
      dateTo: fmtDate(lastDay(prevY, prevM)),
      orderBy: 'Business Source',
    },
    {
      id: 'country-ytd',
      description: `Country Wise YTD (01/01/${y} → วันนี้)`,
      type: 'country-ytd',
      dateFrom: `01/01/${y}`,
      dateTo: fmtDate(today),
      orderBy: 'Arrival date',
    },
    {
      id: 'country-monthly',
      description: `Country Wise เดือนก่อน`,
      type: 'country-monthly',
      dateFrom: fmtDate(new Date(prevY, prevM - 1, 1)),
      dateTo: fmtDate(lastDay(prevY, prevM)),
      orderBy: 'Arrival date',
    },
    {
      id: 'arrivals',
      description: `Arrival List (วันนี้ → +2 เดือน)`,
      type: 'arrivals',
      dateFrom: fmtDate(today),
      dateTo: fmtDate(addMonths(today, 2)),
      orderBy: 'Room',
    },
    {
      id: 'monthly-current',
      description: `Monthly Statistics เดือนนี้`,
      type: 'monthly-current',
      dateFrom: `01/${String(today.getMonth() + 1).padStart(2, '0')}/${y}`,
      dateTo: fmtDate(today),
    },
    {
      id: 'monthly-prev',
      description: `Monthly Statistics เดือนก่อน`,
      type: 'monthly-prev',
      dateFrom: fmtDate(new Date(prevY, prevM - 1, 1)),
      dateTo: fmtDate(lastDay(prevY, prevM)),
    },
  ];
}
```

- [ ] **Step 2: Quick sanity check**

Run:
```bash
cd /Users/temtem/projects/casa-de-yim-dashboard && node -e "
const { buildReportConfig, fmtDate } = require('./scripts/ezee-export-config.ts');
" 2>&1 | head -5
```

Expected: no errors (or "Cannot use import" — ok, tsx handles this at runtime)

- [ ] **Step 3: Commit**

```bash
git add scripts/ezee-export-config.ts
git commit -m "feat: add eZee report date config helpers"
```

---

## Task 9: Playwright auto-export script

**Files:**
- Create: `scripts/ezee-export.ts`

- [ ] **Step 1: Check .env has eZee vars**

Ensure `.env` contains (add if missing — never commit this file):
```
EZEE_PROPERTY_CODE=<your property code>
EZEE_USERNAME=<your username>
EZEE_PASSWORD=<your password>
DASHBOARD_URL=https://casa-de-yim-dashboard.netlify.app
DASHBOARD_PASSWORD=CasaDeYim683279d0!!
```

- [ ] **Step 2: Write the main script**

Write `scripts/ezee-export.ts`:
```ts
/**
 * eZee Auto-Export Script
 * Usage:
 *   npx tsx scripts/ezee-export.ts            # headless (cron)
 *   npx tsx scripts/ezee-export.ts --headed   # headed browser (debug)
 *   npx tsx scripts/ezee-export.ts --dry-run  # parse only, no upload
 *
 * ⚠️  On first run, use --headed to verify eZee navigation selectors.
 *    eZee UI selectors are marked with "VERIFY:" comments.
 */

import { chromium, type Page, type Browser } from 'playwright';
import { buildSnapshot } from '../src/ui/buildSnapshot.js';
import { buildReportConfig, type ReportDateConfig } from './ezee-export-config.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const HEADED = process.argv.includes('--headed');
const DRY_RUN = process.argv.includes('--dry-run');
const EZEE_URL = 'https://live.ipms247.com/login/';
const PROPERTY_CODE = process.env.EZEE_PROPERTY_CODE ?? '';
const USERNAME = process.env.EZEE_USERNAME ?? '';
const PASSWORD = process.env.EZEE_PASSWORD ?? '';
const DASHBOARD_URL = (process.env.DASHBOARD_URL ?? '').replace(/\/$/, '');
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD ?? '';
const TIMEOUT = 60_000; // 60 s per action

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------
function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}
function warn(msg: string) {
  console.warn(`[${new Date().toISOString()}] ⚠️  ${msg}`);
}
function notify(title: string, msg: string) {
  // macOS notification (safe to call on non-Mac — will just fail silently)
  import('node:child_process').then(({ execSync }) => {
    try {
      execSync(`osascript -e 'display notification "${msg}" with title "${title}"'`);
    } catch { /* non-Mac */ }
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// eZee Login
// ---------------------------------------------------------------------------
async function loginEzee(page: Page): Promise<void> {
  log('Navigating to eZee login...');
  await page.goto(EZEE_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });

  // VERIFY: these selectors on first --headed run
  // Common eZee IPMS login form field names/placeholders
  await page.fill('input[name="PropertyCode"], input[placeholder*="Property"], input[id*="property" i]', PROPERTY_CODE);
  await page.fill('input[name="UserName"], input[placeholder*="User"], input[id*="user" i]', USERNAME);
  await page.fill('input[name="Password"], input[type="password"]', PASSWORD);

  log('Submitting login form...');
  await page.click('button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
  await page.waitForLoadState('networkidle', { timeout: TIMEOUT });
  log('Login successful (or check --headed mode if stuck here)');
}

// ---------------------------------------------------------------------------
// Navigate to a specific report + set dates + export HTML
// ---------------------------------------------------------------------------
async function exportReport(page: Page, config: ReportDateConfig): Promise<string | null> {
  log(`Exporting: ${config.description}`);

  try {
    // VERIFY on first --headed run:
    // The exact navigation path in eZee to reach each report type.
    // Common pattern: Reports menu → select report → set date → Generate → Export HTML

    // Navigate to reports section
    // VERIFY: adjust selector to match actual eZee Reports menu item
    await page.click('a:has-text("Reports"), [href*="report" i], #reportMenu', { timeout: TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: TIMEOUT });

    // Select the specific report
    // VERIFY: these text labels match eZee report names exactly
    const reportLabel = getReportLabel(config);
    await page.click(`text="${reportLabel}"`, { timeout: TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: TIMEOUT });

    // Set date parameters
    await setDates(page, config);

    // Click Generate/View
    // VERIFY: button label
    await page.click('button:has-text("Generate"), button:has-text("View"), button:has-text("Search"), input[value="Generate"]', { timeout: TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: TIMEOUT });

    // Get the HTML of the report
    // VERIFY: eZee may open report in new tab or iframe
    const html = await page.content();
    log(`  ✓ ${config.id} — ${html.length} bytes`);
    return html;

  } catch (err) {
    warn(`  Failed to export ${config.id}: ${(err as Error).message}`);
    // Save screenshot for debugging
    try {
      await page.screenshot({ path: `~/logs/ezee-error-${config.id}.png` });
    } catch { /* ignore */ }
    return null;
  }
}

function getReportLabel(config: ReportDateConfig): string {
  // VERIFY: these are the exact names in eZee's report list
  switch (config.type) {
    case 'yearly':           return 'Yearly Statistics';
    case 'channel-ytd':
    case 'channel-monthly':  return 'Contribution Analysis';
    case 'country-ytd':
    case 'country-monthly':  return 'Country Wise Reservation Statistics';
    case 'arrivals':         return 'Arrival List';
    case 'monthly-current':
    case 'monthly-prev':     return 'Monthly Statistics';
  }
}

async function setDates(page: Page, config: ReportDateConfig): Promise<void> {
  // VERIFY: these selectors match eZee's date input fields
  if (config.year) {
    // Yearly Statistics: usually a Year dropdown
    await page.selectOption('select[name="Year"], select[id*="year" i]', String(config.year))
      .catch(() => page.fill('input[name="Year"], input[id*="year" i]', String(config.year)));
    return;
  }
  if (config.dateFrom) {
    await page.fill('input[name="DateFrom"], input[id*="from" i], input[placeholder*="From"]', config.dateFrom)
      .catch(() => warn(`  Could not fill DateFrom for ${config.id}`));
  }
  if (config.dateTo) {
    await page.fill('input[name="DateTo"], input[id*="to" i], input[placeholder*="To"]', config.dateTo)
      .catch(() => warn(`  Could not fill DateTo for ${config.id}`));
  }
  if (config.orderBy) {
    // Order By dropdown — may not exist for all reports
    await page.selectOption('select[name="OrderBy"], select[id*="order" i]', config.orderBy)
      .catch(() => { /* optional field — ignore */ });
  }
}

// ---------------------------------------------------------------------------
// Upload snapshot to dashboard
// ---------------------------------------------------------------------------
async function uploadToDashboard(htmls: string[]): Promise<void> {
  log('Building snapshot from parsed reports...');
  const { snapshot, errors } = buildSnapshot(htmls);

  if (errors.length > 0) {
    warn(`Parse errors (non-fatal): ${errors.join(', ')}`);
  }

  if (!snapshot.dataAsOf) {
    warn('No dataAsOf found — using today');
    snapshot.dataAsOf = new Date().toISOString().slice(0, 10);
  }

  const key = `snapshot/${snapshot.dataAsOf}`;
  log(`Uploading snapshot key="${key}" to ${DASHBOARD_URL}...`);

  // Step 1: Login to dashboard
  const authRes = await fetch(`${DASHBOARD_URL}/api/auth`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: DASHBOARD_PASSWORD }),
  });
  if (!authRes.ok) throw new Error(`Dashboard auth failed: ${authRes.status}`);

  const setCookie = authRes.headers.get('set-cookie') ?? '';
  const cookieMatch = setCookie.match(/cdy_auth=[^;]+/);
  if (!cookieMatch) throw new Error('No auth cookie in dashboard response');
  const cookie = cookieMatch[0];

  // Step 2: Upload snapshot
  const uploadRes = await fetch(`${DASHBOARD_URL}/api/snapshots`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ key, snapshot }),
  });
  if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);

  log(`✅ Snapshot uploaded: ${key}`);
  log(`   Reports: yearly=${!!snapshot.yearly} channels=${!!snapshot.channels} countries=${!!snapshot.countries} arrivals=${!!snapshot.arrivals} monthly=${snapshot.monthly?.length ?? 0} months`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  if (!PROPERTY_CODE || !USERNAME || !PASSWORD) {
    console.error('Missing EZEE_PROPERTY_CODE, EZEE_USERNAME, or EZEE_PASSWORD in .env');
    process.exit(1);
  }
  if (!DRY_RUN && (!DASHBOARD_URL || !DASHBOARD_PASSWORD)) {
    console.error('Missing DASHBOARD_URL or DASHBOARD_PASSWORD in .env');
    process.exit(1);
  }

  log(`Starting eZee export (headed=${HEADED}, dry-run=${DRY_RUN})`);

  const browser: Browser = await chromium.launch({ headless: !HEADED });
  const page = await browser.newPage();

  try {
    await loginEzee(page);

    const configs = buildReportConfig(new Date());
    const htmls: string[] = [];

    for (const config of configs) {
      const html = await exportReport(page, config);
      if (html) htmls.push(html);
    }

    log(`Exported ${htmls.length}/${configs.length} reports`);

    if (htmls.length === 0) {
      throw new Error('No reports exported — aborting upload');
    }

    if (!DRY_RUN) {
      await uploadToDashboard(htmls);
      notify('Casa de Yim Export ✅', `อัปโหลด ${htmls.length} reports สำเร็จ`);
    } else {
      log('DRY RUN: skipping upload');
      const { snapshot, errors } = buildSnapshot(htmls);
      log(`Parsed snapshot: dataAsOf=${snapshot.dataAsOf} yearly=${!!snapshot.yearly} monthly=${snapshot.monthly?.length ?? 0}`);
      if (errors.length) log(`Errors: ${errors.join(', ')}`);
    }

  } catch (err) {
    const msg = (err as Error).message;
    warn(`Export failed: ${msg}`);
    notify('Casa de Yim Export ❌', `มีปัญหา: ${msg.slice(0, 60)}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Verify TypeScript compiles (script only)**

Run: `cd /Users/temtem/projects/casa-de-yim-dashboard && npx tsc --noEmit --skipLibCheck 2>&1 | head -20`

If there are errors about `import ... from '../src/ui/buildSnapshot.js'` — that's expected for tsx runtime (it handles .ts imports). The script runs with `npx tsx`, not `tsc`.

Actually verify tsx can parse it:
```bash
npx tsx --eval "import './scripts/ezee-export-config.ts'; console.log('ok')"
```
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add scripts/ezee-export.ts
git commit -m "feat: add Playwright auto-export script (eZee → dashboard)"
```

---

## Task 10: Setup cron script

**Files:**
- Create: `scripts/setup-cron.sh`

- [ ] **Step 1: Write setup-cron.sh**

Write `scripts/setup-cron.sh`:
```bash
#!/bin/bash
# Installs crontab entry for eZee auto-export every Sunday at 05:00 AM
# Run once: bash scripts/setup-cron.sh

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$HOME/logs"
CRON_CMD="0 5 * * 0 cd \"$PROJECT_DIR\" && /usr/local/bin/node node_modules/.bin/tsx scripts/ezee-export.ts >> \"$LOG_DIR/ezee-export.log\" 2>&1"

echo "Project dir: $PROJECT_DIR"
echo "Log dir:     $LOG_DIR"
echo "Cron entry:  $CRON_CMD"
echo ""

# Create log directory
mkdir -p "$LOG_DIR"
echo "✓ Created $LOG_DIR"

# Add cron entry (skip if already present)
if crontab -l 2>/dev/null | grep -q "ezee-export"; then
  echo "⚠️  Cron entry already exists — skipping"
else
  (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
  echo "✓ Cron entry installed"
fi

echo ""
echo "Verify with: crontab -l"
echo "Test run:    cd \"$PROJECT_DIR\" && npx tsx scripts/ezee-export.ts --headed"
```

Make it executable:
```bash
chmod +x scripts/setup-cron.sh
```

- [ ] **Step 2: Commit**

```bash
git add scripts/setup-cron.sh
git commit -m "feat: add cron setup script (Sunday 05:00 auto-export)"
```

---

## Task 11: First headed run + cron install

**Files:** none (manual steps + .env config)

- [ ] **Step 1: Fill .env with real eZee credentials**

Edit `.env` (never commit — already gitignored):
```
EZEE_PROPERTY_CODE=<actual property code from eZee login page>
EZEE_USERNAME=<actual username>
EZEE_PASSWORD=<actual password>
DASHBOARD_URL=https://casa-de-yim-dashboard.netlify.app
DASHBOARD_PASSWORD=CasaDeYim683279d0!!
```

- [ ] **Step 2: Run headed dry-run first to map eZee navigation**

Run: `cd /Users/temtem/projects/casa-de-yim-dashboard && npx tsx scripts/ezee-export.ts --headed --dry-run`

Watch the browser open. Observe:
- Does the login form fill correctly?
- Does the Reports navigation work?
- Where do date fields appear in the UI?

Fix selectors in `scripts/ezee-export.ts` where marked `VERIFY:`. Common adjustments:
- If reports are in a dropdown: change click target to `select` + `selectOption`
- If in a sidebar: use `page.click('nav a:has-text("Reports")')` then sub-menu
- If dates are date-pickers: may need `page.click` + keyboard instead of `fill`

Re-run `--headed --dry-run` after each selector fix until all 8 reports are captured.

- [ ] **Step 3: Verify parse output from dry-run**

A successful dry-run should log:
```
[...] Exported 8/8 reports
[...] Parsed snapshot: dataAsOf=2026-06-01 yearly=true monthly=2
[...] DRY RUN: skipping upload
```

- [ ] **Step 4: Full run (headed, with upload)**

Run: `cd /Users/temtem/projects/casa-de-yim-dashboard && npx tsx scripts/ezee-export.ts --headed`

Verify:
- macOS notification: "อัปโหลด 8 reports สำเร็จ"
- Dashboard shows updated data + "สัปดาห์ที่ผ่านมา" tab

- [ ] **Step 5: Headless run (simulates cron)**

Run: `cd /Users/temtem/projects/casa-de-yim-dashboard && npx tsx scripts/ezee-export.ts`
Expected: completes silently, notification appears, log written to `~/logs/ezee-export.log`

- [ ] **Step 6: Install cron**

Run: `bash scripts/setup-cron.sh`

Verify: `crontab -l` shows the new Sunday 05:00 entry

- [ ] **Step 7: Final commit**

```bash
git add scripts/
git commit -m "docs: setup-cron.sh ready; selectors verified on first --headed run"
```

---

## Self-Review Notes

**Spec coverage:**
- §3 Data Model: Tasks 1 ✅
- §4 Parser + multi-monthly buildSnapshot: Tasks 2–3 ✅
- §5 Weekly KPI metric: Task 4 ✅
- §6 UI lastWeek tab + KpiCards: Task 5 ✅
- §7 Playwright script + 8 reports: Tasks 8–9 ✅
- §8 Cron Sunday 05:00 + macOS notification: Task 10 ✅
- §9 Testing strategy: TDD Tasks 2,4; manual Task 11 ✅
- Deploy: Task 6 ✅

**Type consistency:**
- `DayRow` defined Task 1 → used in `monthly.ts` Task 2, `weekly.ts` Task 4, `KpiCards` Task 5 ✅
- `MonthlyReport` defined Task 1 → used throughout ✅
- `WeeklyKpi` defined in `weekly.ts` Task 4 → imported in `KpiCards.tsx` and `Dashboard.tsx` Task 5 ✅
- `ReportType` extended with `'monthly'` Task 1 → picked up by `detect.ts` Task 3 ✅
- `buildSnapshot` import in `ezee-export.ts` uses `.js` extension for tsx compatibility ✅

**Placeholder check:** All code blocks complete, no TBD/TODO except clearly labelled `VERIFY:` in Playwright selectors (intentional — cannot know eZee UI without first run).
