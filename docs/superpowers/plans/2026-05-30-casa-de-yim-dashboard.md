# Casa de Yim Revenue Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เว็บแอปที่อัปโหลดรายงาน eZee (HTML) รายสัปดาห์ แล้วแสดง Occupancy/ADR/RevPAR, booking pace, และคำแนะนำการปรับราคา (กฎ + AI) โดย deploy บน Netlify

**Architecture:** React SPA (Vite) parse ไฟล์ eZee ฝั่ง client เป็น typed `Snapshot` → เก็บใน Netlify Blobs ผ่าน Netlify Function → dashboard อ่านประวัติทั้งหมดมาคำนวณ trend/pace/คำแนะนำ. โมดูล `parser`/`metrics`/`recommendations` เป็น pure functions ทดสอบแยกได้ ด้วย Vitest. Auth เป็นรหัสผ่านเดียวผ่าน signed cookie. AI insight เรียก Claude API ฝั่ง Function

**Tech Stack:** Vite · React · TypeScript · Tailwind · Recharts · Vitest + @testing-library/react · @netlify/functions · @netlify/blobs · @anthropic-ai/sdk

---

## File Structure

```
src/
  types.ts                      # shared data model
  parser/
    num.ts                      # parseNum, parsePax
    date.ts                     # parseDate (dd/mm/yyyy -> ISO)
    rows.ts                     # extractRows, plainText (DOMParser)
    detect.ts                   # detectReportType, extractDataAsOf, MONTHS
    yearly.ts                   # parseYearly
    channel.ts                  # parseChannel
    country.ts                  # parseCountry
    arrivals.ts                 # parseArrivals
    index.ts                    # parseFile dispatcher
  metrics/
    capacity.ts                 # villa capacity helpers
    kpi.ts                      # monthKpis, deltas
    pace.ts                     # comparePace, dailyOccupancy
  recommendations/
    rules.ts                    # recommend(input) -> Reco[]
  lib/
    api.ts                      # client fetch wrappers
  ui/
    App.tsx
    AuthGate.tsx
    LoginPage.tsx
    UploadPage.tsx
    Dashboard.tsx
    components/
      PeriodToggle.tsx
      KpiCards.tsx
      TrendChart.tsx
      ForwardPace.tsx
      MixPanels.tsx
      Recommendations.tsx
  main.tsx
  index.css
netlify/
  functions/
    _auth.ts                    # verifyAuth, signCookie (shared)
    auth.ts                     # POST password -> cookie
    snapshots.ts                # GET/POST snapshots (Blobs)
    ai-insight.ts               # POST -> Claude
tests/
  fixtures/                     # 4 real eZee HTML files
  parser/ metrics/ recommendations/ functions/
netlify.toml
vite.config.ts
```

---

## Task 1: Project scaffolding

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `netlify.toml`, `tailwind.config.js`, `postcss.config.js`, `src/main.tsx`, `src/ui/App.tsx`, `src/index.css`, `index.html`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "casa-de-yim-dashboard",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "recharts": "^2.12.7"
  },
  "devDependencies": {
    "@anthropic-ai/sdk": "^0.32.1",
    "@netlify/blobs": "^8.1.0",
    "@netlify/functions": "^2.8.2",
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "autoprefixer": "^10.4.20",
    "jsdom": "^25.0.1",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Create config files**

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
});
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "tests", "netlify"]
}
```

`netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[functions]
  node_bundler = "esbuild"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

`tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

`postcss.config.js`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

- [ ] **Step 3: Create entry files**

`index.html`:
```html
<!doctype html>
<html lang="th">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Casa de Yim Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

`src/ui/App.tsx`:
```tsx
export default function App() {
  return <div className="p-8 text-slate-800">Casa de Yim Dashboard</div>;
}
```

`tests/setup.ts`:
```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 4: Install and verify build**

Run: `npm install && npm run build`
Expected: build succeeds, `dist/` created

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS + Tailwind + Vitest + Netlify"
```

---

## Task 2: Copy real eZee fixtures

**Files:**
- Create: `tests/fixtures/yearly.html`, `channel.html`, `country.html`, `arrivals.html`

- [ ] **Step 1: Copy the 4 sample files into fixtures**

```bash
mkdir -p tests/fixtures
cp "/Users/temtem/Downloads/Report (3).html" tests/fixtures/yearly.html
cp "/Users/temtem/Downloads/Report (2).html" tests/fixtures/channel.html
cp "/Users/temtem/Downloads/Report (1).html" tests/fixtures/country.html
cp "/Users/temtem/Downloads/Report.html"     tests/fixtures/arrivals.html
```

- [ ] **Step 2: Verify files exist and are non-empty**

Run: `wc -l tests/fixtures/*.html`
Expected: 4 files, each with >80 lines

- [ ] **Step 3: Commit**

```bash
git add tests/fixtures
git commit -m "test: add real eZee report fixtures"
```

---

## Task 3: Shared types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write the types**

```ts
export type ReportType = 'yearly' | 'channel' | 'country' | 'arrivals' | 'unknown';

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string };

export interface MonthRow {
  month: string;        // "January" | "Grand Total"
  monthIndex: number;   // 1-12, 0 for grand total
  availableRooms: number | null;
  nightSold: number | null;
  occPct: number | null;
  adr: number | null;
  revPar: number | null;
  pax: number | null;
  roomCharges: number | null;
}

export interface YearlyReport {
  year: number;
  months: MonthRow[];
  grandTotal: MonthRow;
}

export interface ChannelRow {
  source: string;
  roomSold: number | null;
  occPct: number | null;
  pax: number | null;
  paxChild: number | null;
  revenue: number | null;
  revPct: number | null;
  adr: number | null;
}

export interface ChannelReport {
  periodFrom: string | null;
  periodTo: string | null;
  scope: 'ytd' | 'month';
  rows: ChannelRow[];
  total: ChannelRow;
}

export interface CountryRow {
  country: string;
  revenue: number | null;
  reservations: number | null;
  guests: number | null;
  nights: number | null;
  avgPerNight: number | null;
}

export interface CountryReport {
  periodFrom: string | null;
  periodTo: string | null;
  scope: 'ytd' | 'month';
  rows: CountryRow[];
}

export interface ArrivalRow {
  resNo: string;
  guest: string;
  room: string;
  rate: number | null;
  arrival: string | null;   // ISO date (check-in)
  departure: string | null; // ISO date
  pax: number | null;
  resType: string;
  channel: string;          // Company column (e.g. "OTA")
  notes: string;
}

export interface ArrivalsReport {
  periodFrom: string | null;
  periodTo: string | null;
  rows: ArrivalRow[];
}

export interface Snapshot {
  uploadedAt: string;        // ISO datetime
  dataAsOf: string | null;   // ISO date from "Printed By ... on dd/mm/yyyy"
  yearly?: YearlyReport;
  channels?: ChannelReport;
  countries?: CountryReport;
  arrivals?: ArrivalsReport;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared data model types"
```

---

## Task 4: Number & pax parsing helpers

**Files:**
- Create: `src/parser/num.ts`, `tests/parser/num.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/parser/num.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```ts
export function parseNum(s: string | null | undefined): number | null {
  if (s == null) return null;
  const cleaned = s.replace(/,/g, '').replace(/\s+/g, '').trim();
  if (cleaned === '' || cleaned === '-') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parsePax(s: string | null | undefined): { adults: number | null; children: number | null } {
  if (!s) return { adults: null, children: null };
  const m = s.match(/(\d+)\s*\/\s*(\d+)/);
  if (m) return { adults: Number(m[1]), children: Number(m[2]) };
  return { adults: parseNum(s), children: null };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/parser/num.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/parser/num.ts tests/parser/num.test.ts
git commit -m "feat: add number and pax parsing helpers"
```

---

## Task 5: Date parsing helper

**Files:**
- Create: `src/parser/date.ts`, `tests/parser/date.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/parser/date.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```ts
export function parseDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/parser/date.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/parser/date.ts tests/parser/date.test.ts
git commit -m "feat: add date parsing helper"
```

---

## Task 6: Row extraction & report-type detection

**Files:**
- Create: `src/parser/rows.ts`, `src/parser/detect.ts`, `tests/parser/detect.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/parser/detect.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write rows.ts**

```ts
export function extractRows(html: string): string[][] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return Array.from(doc.querySelectorAll('tr')).map((tr) =>
    Array.from(tr.querySelectorAll('td')).map((td) =>
      (td.textContent || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
    )
  );
}

export function plainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
}
```

- [ ] **Step 4: Write detect.ts**

```ts
import { plainText } from './rows';
import { parseDate } from './date';
import type { ReportType } from '../types';

export const MONTHS: Record<string, number> = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
};

export function detectReportType(html: string): ReportType {
  const t = plainText(html);
  if (t.includes('Yearly Statistics')) return 'yearly';
  if (t.includes('Contribution Analysis Report')) return 'channel';
  if (t.includes('Country Wise Reservation Statistics')) return 'country';
  if (t.includes('Arrival List')) return 'arrivals';
  return 'unknown';
}

export function extractDataAsOf(html: string): string | null {
  const t = plainText(html);
  const m = t.match(/Printed By\s*:?\s*\S+\s+on\s+(\d{2}\/\d{2}\/\d{4})/i);
  return m ? parseDate(m[1]) : null;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/parser/detect.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/parser/rows.ts src/parser/detect.ts tests/parser/detect.test.ts
git commit -m "feat: add row extraction and report-type detection"
```

---

## Task 7: Yearly Statistics parser

**Files:**
- Create: `src/parser/yearly.ts`, `tests/parser/yearly.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/parser/yearly.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
import { extractRows } from './rows';
import { parseNum } from './num';
import { MONTHS } from './detect';
import type { YearlyReport, MonthRow, ParseResult } from '../types';

// Column order after the label: availableRooms, nightSold, complimentary,
// occ%, adr, revPar, pax, roomCharges, extraCharges, tax, receipt, expense
function toMonthRow(label: string, nums: (number | null)[], monthIndex: number): MonthRow {
  return {
    month: label,
    monthIndex,
    availableRooms: nums[0] ?? null,
    nightSold: nums[1] ?? null,
    occPct: nums[3] ?? null,
    adr: nums[4] ?? null,
    revPar: nums[5] ?? null,
    pax: nums[6] ?? null,
    roomCharges: nums[7] ?? null,
  };
}

export function parseYearly(html: string): ParseResult<YearlyReport> {
  const rows = extractRows(html);

  let year = 0;
  for (const r of rows) {
    const cells = r.filter((c) => c !== '');
    const i = cells.findIndex((c) => /^Year$/i.test(c));
    if (i >= 0 && cells[i + 1]) {
      year = parseNum(cells[i + 1]) ?? 0;
      break;
    }
  }

  const months: MonthRow[] = [];
  let grandTotal: MonthRow | null = null;
  for (const r of rows) {
    const cells = r.filter((c) => c !== '');
    if (cells.length === 0) continue;
    const label = cells[0];
    if (MONTHS[label] !== undefined) {
      months.push(toMonthRow(label, cells.slice(1).map(parseNum), MONTHS[label]));
    } else if (/grand total/i.test(label)) {
      grandTotal = toMonthRow('Grand Total', cells.slice(1).map(parseNum), 0);
    }
  }

  if (months.length === 0) {
    return { ok: false, reason: 'ไม่พบข้อมูลรายเดือนใน Yearly Statistics' };
  }
  if (!grandTotal) grandTotal = toMonthRow('Grand Total', [], 0);
  return { ok: true, data: { year, months, grandTotal } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/parser/yearly.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/parser/yearly.ts tests/parser/yearly.test.ts
git commit -m "feat: add Yearly Statistics parser"
```

---

## Task 8: Contribution Analysis (channel) parser

**Files:**
- Create: `src/parser/channel.ts`, `tests/parser/channel.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseChannel } from '../../src/parser/channel';

const html = readFileSync('tests/fixtures/channel.html', 'utf-8');

describe('parseChannel', () => {
  it('parses period and scope', () => {
    const r = parseChannel(html);
    if (!r.ok) throw new Error(r.reason);
    expect(r.data.periodFrom).toBe('2026-05-01');
    expect(r.data.periodTo).toBe('2026-05-31');
    expect(r.data.scope).toBe('month');
  });

  it('parses Airbnb and Booking rows', () => {
    const r = parseChannel(html);
    if (!r.ok) throw new Error(r.reason);
    const airbnb = r.data.rows.find((x) => x.source === 'Airbnb')!;
    expect(airbnb.roomSold).toBe(27);
    expect(airbnb.occPct).toBe(21.77);
    expect(airbnb.pax).toBe(166);
    expect(airbnb.revenue).toBe(201661.2);
    expect(airbnb.revPct).toBe(57.62);
    expect(airbnb.adr).toBe(6980.31);
    const booking = r.data.rows.find((x) => x.source === 'Booking.com')!;
    expect(booking.roomSold).toBe(19);
    expect(booking.paxChild).toBe(9);
  });

  it('parses grand total', () => {
    const r = parseChannel(html);
    if (!r.ok) throw new Error(r.reason);
    expect(r.data.total.roomSold).toBe(46);
    expect(r.data.total.adr).toBe(7110.78);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/parser/channel.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
import { extractRows } from './rows';
import { parseNum, parsePax } from './num';
import { parseDate } from './date';
import type { ChannelReport, ChannelRow, ParseResult } from '../types';

// Columns: source, roomSold, occ%, pax, revenue, rev%, adr
function toChannelRow(cells: string[]): ChannelRow {
  const pax = parsePax(cells[3] ?? '');
  return {
    source: cells[0],
    roomSold: parseNum(cells[1]),
    occPct: parseNum(cells[2]),
    pax: pax.adults,
    paxChild: pax.children,
    revenue: parseNum(cells[4]),
    revPct: parseNum(cells[5]),
    adr: parseNum(cells[6]),
  };
}

export function parseChannel(html: string): ParseResult<ChannelReport> {
  const rows = extractRows(html);

  let periodFrom: string | null = null;
  let periodTo: string | null = null;
  for (const r of rows) {
    const cells = r.filter((c) => c !== '');
    const i = cells.findIndex((c) => /Date From/i.test(c));
    if (i >= 0) {
      periodFrom = parseDate(cells[i + 1]);
      const j = cells.findIndex((c) => /^To$/i.test(c));
      if (j >= 0) periodTo = parseDate(cells[j + 1]);
      break;
    }
  }

  const dataRows: ChannelRow[] = [];
  let total: ChannelRow | null = null;
  let seenHeader = false;
  for (const r of rows) {
    const cells = r.filter((c) => c !== '');
    if (cells.length === 0) continue;
    if (/Business Source/i.test(cells[0])) {
      seenHeader = true;
      continue;
    }
    if (!seenHeader) continue;
    if (/Grand Total/i.test(cells[0])) {
      total = toChannelRow(cells);
      continue;
    }
    if (cells.length >= 7) dataRows.push(toChannelRow(cells));
  }

  if (!seenHeader) return { ok: false, reason: 'ไม่พบหัวตาราง Business Source' };
  if (!total) total = toChannelRow(['Grand Total', '', '', '', '', '', '']);
  const scope: 'ytd' | 'month' = periodFrom?.endsWith('-01-01') ? 'ytd' : 'month';
  return { ok: true, data: { periodFrom, periodTo, scope, rows: dataRows, total } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/parser/channel.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/parser/channel.ts tests/parser/channel.test.ts
git commit -m "feat: add Contribution Analysis (channel) parser"
```

---

## Task 9: Country Wise parser

**Files:**
- Create: `src/parser/country.ts`, `tests/parser/country.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/parser/country.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
import { extractRows } from './rows';
import { parseNum } from './num';
import { parseDate } from './date';
import type { CountryReport, CountryRow, ParseResult } from '../types';

// Columns: country, revenue, reservations, guests, nights, avgPerNight
function toCountryRow(cells: string[]): CountryRow {
  return {
    country: cells[0],
    revenue: parseNum(cells[1]),
    reservations: parseNum(cells[2]),
    guests: parseNum(cells[3]),
    nights: parseNum(cells[4]),
    avgPerNight: parseNum(cells[5]),
  };
}

export function parseCountry(html: string): ParseResult<CountryReport> {
  const rows = extractRows(html);

  let periodFrom: string | null = null;
  let periodTo: string | null = null;
  for (const r of rows) {
    const cells = r.filter((c) => c !== '');
    const i = cells.findIndex((c) => /Arrival Date From/i.test(c));
    if (i >= 0) {
      periodFrom = parseDate(cells[i + 1]);
      const j = cells.findIndex((c) => /^To$/i.test(c));
      if (j >= 0) periodTo = parseDate(cells[j + 1]);
      break;
    }
  }

  // A data row is any row whose 2nd cell parses as a number (revenue).
  // This naturally skips headers, the "Printed By / Page X of Y" rows,
  // date rows, and titles — robust against multi-page repeats.
  const dataRows: CountryRow[] = [];
  for (const r of rows) {
    const cells = r.filter((c) => c !== '');
    if (cells.length < 6) continue;
    if (parseNum(cells[1]) === null) continue;
    dataRows.push(toCountryRow(cells));
  }

  if (dataRows.length === 0) return { ok: false, reason: 'ไม่พบข้อมูลรายประเทศ' };
  const scope: 'ytd' | 'month' = periodFrom?.endsWith('-01-01') ? 'ytd' : 'month';
  return { ok: true, data: { periodFrom, periodTo, scope, rows: dataRows } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/parser/country.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/parser/country.ts tests/parser/country.test.ts
git commit -m "feat: add Country Wise parser"
```

---

## Task 10: Arrival List parser

**Files:**
- Create: `src/parser/arrivals.ts`, `tests/parser/arrivals.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseArrivals } from '../../src/parser/arrivals';

const html = readFileSync('tests/fixtures/arrivals.html', 'utf-8');

describe('parseArrivals', () => {
  it('parses period', () => {
    const r = parseArrivals(html);
    if (!r.ok) throw new Error(r.reason);
    expect(r.data.periodFrom).toBe('2026-05-29');
    expect(r.data.periodTo).toBe('2026-06-30');
  });

  it('parses the first booking', () => {
    const r = parseArrivals(html);
    if (!r.ok) throw new Error(r.reason);
    const first = r.data.rows.find((x) => x.resNo === '301')!;
    expect(first.guest).toBe('Kean Cheng Choo');
    expect(first.room).toContain('A4');
    expect(first.rate).toBe(9711.9);
    expect(first.arrival).toBe('2026-05-30');
    expect(first.departure).toBe('2026-06-01');
    expect(first.pax).toBe(10);
    expect(first.channel).toBe('OTA');
    expect(first.resType).toBe('Confirm Booking');
  });

  it('attaches note text to the preceding booking', () => {
    const r = parseArrivals(html);
    if (!r.ok) throw new Error(r.reason);
    const first = r.data.rows.find((x) => x.resNo === '301')!;
    expect(first.notes).toContain('Early check in');
  });

  it('parses multiple distinct bookings', () => {
    const r = parseArrivals(html);
    if (!r.ok) throw new Error(r.reason);
    expect(r.data.rows.some((x) => x.resNo === '68')).toBe(true);
    expect(r.data.rows.some((x) => x.resNo === '481')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/parser/arrivals.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
import { extractRows } from './rows';
import { parseNum, parsePax } from './num';
import { parseDate } from './date';
import type { ArrivalsReport, ArrivalRow, ParseResult } from '../types';

// Booking row, relative to the Res.No cell:
// [0]resNo [1]guest [2]room [3]rate [4]arrival [5]departure [6]pax
// [7]pickUp [8]dropOff [9]resType [10]company(channel)
function toArrivalRow(c: string[]): ArrivalRow {
  return {
    resNo: c[0],
    guest: c[1] ?? '',
    room: c[2] ?? '',
    rate: parseNum(c[3]),
    arrival: parseDate(c[4]),
    departure: parseDate(c[5]),
    pax: parsePax(c[6] ?? '').adults,
    resType: c[9] ?? '',
    channel: c[10] ?? '',
    notes: '',
  };
}

export function parseArrivals(html: string): ParseResult<ArrivalsReport> {
  const rows = extractRows(html);

  let periodFrom: string | null = null;
  let periodTo: string | null = null;
  for (const r of rows) {
    const cells = r.filter((c) => c !== '');
    const i = cells.findIndex((c) => /Date From/i.test(c));
    if (i >= 0) {
      periodFrom = parseDate(cells[i + 1]);
      const j = cells.findIndex((c) => /^To$/i.test(c));
      if (j >= 0) periodTo = parseDate(cells[j + 1]);
      break;
    }
  }

  const out: ArrivalRow[] = [];
  let last: ArrivalRow | null = null;
  for (const r of rows) {
    // Keep empty cells for booking rows (PickUp/DropOff are blank) but
    // locate the Res.No (first pure-digit cell) and slice from there.
    const start = r.findIndex((c) => /^\d+$/.test(c));
    const sliced = start >= 0 ? r.slice(start) : [];
    const isBooking = start >= 0 && parseNum(sliced[3]) !== null && /\//.test(sliced[5] ?? '');

    if (isBooking) {
      last = toArrivalRow(sliced);
      out.push(last);
      continue;
    }

    // Otherwise treat as a note/continuation row: append its text to last booking.
    const text = r.filter((c) => c !== '').join(' ').trim();
    if (last && text) {
      last.notes = (last.notes ? last.notes + ' ' : '') + text;
    }
  }

  if (out.length === 0) return { ok: false, reason: 'ไม่พบรายการจองใน Arrival List' };
  return { ok: true, data: { periodFrom, periodTo, rows: out } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/parser/arrivals.test.ts`
Expected: PASS

Note: if `isBooking` mis-detects, inspect with `console.log(extractRows(html).slice(0,12))` and adjust the slice offsets to match the actual cell layout — the fixture is the source of truth.

- [ ] **Step 5: Commit**

```bash
git add src/parser/arrivals.ts tests/parser/arrivals.test.ts
git commit -m "feat: add Arrival List parser"
```

---

## Task 11: Parser dispatcher

**Files:**
- Create: `src/parser/index.ts`, `tests/parser/index.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
  it('routes unknown file', () => {
    const r = parseFile('<html><body>nope</body></html>');
    expect(r.type).toBe('unknown');
    expect(r.result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/parser/index.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
import { detectReportType, extractDataAsOf } from './detect';
import { parseYearly } from './yearly';
import { parseChannel } from './channel';
import { parseCountry } from './country';
import { parseArrivals } from './arrivals';
import type { ReportType, ParseResult } from '../types';

export { extractDataAsOf };

export interface ParsedFile {
  type: ReportType;
  result: ParseResult<unknown>;
}

export function parseFile(html: string): ParsedFile {
  const type = detectReportType(html);
  switch (type) {
    case 'yearly':
      return { type, result: parseYearly(html) };
    case 'channel':
      return { type, result: parseChannel(html) };
    case 'country':
      return { type, result: parseCountry(html) };
    case 'arrivals':
      return { type, result: parseArrivals(html) };
    default:
      return { type: 'unknown', result: { ok: false, reason: 'ไม่รู้จักชนิดรายงานนี้ (หาหัวตารางที่รองรับไม่เจอ)' } };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/parser/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/parser/index.ts tests/parser/index.test.ts
git commit -m "feat: add parser dispatcher"
```

---

## Task 12: Villa capacity helper

**Files:**
- Create: `src/metrics/capacity.ts`, `tests/metrics/capacity.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { villaCount } from '../../src/metrics/capacity';
import type { YearlyReport } from '../../src/types';

const yearly: YearlyReport = {
  year: 2026,
  months: [
    { month: 'January', monthIndex: 1, availableRooms: 124, nightSold: 113, occPct: 92.62, adr: 1, revPar: 1, pax: 1, roomCharges: 1 },
  ],
  grandTotal: { month: 'Grand Total', monthIndex: 0, availableRooms: 1430, nightSold: 823, occPct: 57.55, adr: 1, revPar: 1, pax: 1, roomCharges: 1 },
};

describe('villaCount', () => {
  it('derives villas from max monthly available rooms / days', () => {
    // January 124 available / 31 days = 4.0 -> 4 villas
    expect(villaCount(yearly)).toBe(4);
  });
  it('honors override', () => {
    expect(villaCount(yearly, 5)).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/metrics/capacity.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
import type { YearlyReport } from '../types';

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function villaCount(yearly: YearlyReport | undefined, override?: number): number {
  if (override && override > 0) return override;
  if (!yearly) return 4; // sensible default for Casa de Yim
  let best = 0;
  for (const m of yearly.months) {
    if (m.availableRooms == null || m.monthIndex < 1) continue;
    const days = DAYS_IN_MONTH[m.monthIndex - 1];
    best = Math.max(best, Math.round(m.availableRooms / days));
  }
  return best || 4;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/metrics/capacity.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/metrics/capacity.ts tests/metrics/capacity.test.ts
git commit -m "feat: add villa capacity helper"
```

---

## Task 13: KPI metrics (month lookup + deltas)

**Files:**
- Create: `src/metrics/kpi.ts`, `tests/metrics/kpi.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { monthByIndex, pctDelta } from '../../src/metrics/kpi';
import type { YearlyReport } from '../../src/types';

const yearly: YearlyReport = {
  year: 2026,
  months: [
    { month: 'April', monthIndex: 4, availableRooms: 110, nightSold: 88, occPct: 80, adr: 7133.24, revPar: 5706.59, pax: 556, roomCharges: 627725.11 },
    { month: 'May', monthIndex: 5, availableRooms: 109, nightSold: 46, occPct: 42.2, adr: 7110.78, revPar: 3000.88, pax: 312, roomCharges: 327095.82 },
  ],
  grandTotal: { month: 'Grand Total', monthIndex: 0, availableRooms: 1430, nightSold: 823, occPct: 57.55, adr: 1, revPar: 1, pax: 1, roomCharges: 1 },
};

describe('monthByIndex', () => {
  it('returns the row for a month', () => {
    expect(monthByIndex(yearly, 5)?.occPct).toBe(42.2);
  });
  it('returns null when missing', () => {
    expect(monthByIndex(yearly, 12)).toBeNull();
  });
});

describe('pctDelta', () => {
  it('computes percent change', () => {
    expect(pctDelta(42.2, 80)).toBeCloseTo(-47.25, 1);
  });
  it('returns null when base is null/zero', () => {
    expect(pctDelta(42.2, null)).toBeNull();
    expect(pctDelta(42.2, 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/metrics/kpi.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
import type { YearlyReport, MonthRow } from '../types';

export function monthByIndex(yearly: YearlyReport | undefined, monthIndex: number): MonthRow | null {
  if (!yearly) return null;
  return yearly.months.find((m) => m.monthIndex === monthIndex) ?? null;
}

export function pctDelta(current: number | null, base: number | null): number | null {
  if (current == null || base == null || base === 0) return null;
  return ((current - base) / base) * 100;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/metrics/kpi.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/metrics/kpi.ts tests/metrics/kpi.test.ts
git commit -m "feat: add KPI month lookup and delta helpers"
```

---

## Task 14: Pace metrics (week-over-week + daily occupancy)

**Files:**
- Create: `src/metrics/pace.ts`, `tests/metrics/pace.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { comparePace, dailyOccupancy } from '../../src/metrics/pace';
import type { YearlyReport, ArrivalsReport } from '../../src/types';

function yearlyWith(juneOcc: number): YearlyReport {
  return {
    year: 2026,
    months: [{ month: 'June', monthIndex: 6, availableRooms: 120, nightSold: 1, occPct: juneOcc, adr: 1, revPar: 1, pax: 1, roomCharges: 1 }],
    grandTotal: { month: 'Grand Total', monthIndex: 0, availableRooms: 1, nightSold: 1, occPct: 1, adr: 1, revPar: 1, pax: 1, roomCharges: 1 },
  };
}

describe('comparePace', () => {
  it('returns occ delta in points between two snapshots', () => {
    const delta = comparePace(yearlyWith(28.57), yearlyWith(25), 6);
    expect(delta).toBeCloseTo(3.57, 2);
  });
  it('returns null if a month is missing', () => {
    expect(comparePace(yearlyWith(28.57), yearlyWith(25), 7)).toBeNull();
  });
});

describe('dailyOccupancy', () => {
  it('counts rooms occupied per night across a stay', () => {
    const arrivals: ArrivalsReport = {
      periodFrom: '2026-06-01', periodTo: '2026-06-30',
      rows: [
        { resNo: '1', guest: 'A', room: 'A1', rate: 1, arrival: '2026-06-01', departure: '2026-06-03', pax: 2, resType: '', channel: '', notes: '' },
        { resNo: '2', guest: 'B', room: 'A2', rate: 1, arrival: '2026-06-02', departure: '2026-06-03', pax: 2, resType: '', channel: '', notes: '' },
      ],
    };
    const days = dailyOccupancy(arrivals, 4, '2026-06-01', 3);
    // night 06-01: room1 only -> 1/4 = 25
    expect(days[0]).toEqual({ date: '2026-06-01', roomsSold: 1, occPct: 25 });
    // night 06-02: room1 + room2 -> 2/4 = 50
    expect(days[1]).toEqual({ date: '2026-06-02', roomsSold: 2, occPct: 50 });
    // night 06-03: departures, nobody staying -> 0
    expect(days[2]).toEqual({ date: '2026-06-03', roomsSold: 0, occPct: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/metrics/pace.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
import type { YearlyReport, ArrivalsReport } from '../types';
import { monthByIndex } from './kpi';

export function comparePace(
  current: YearlyReport | undefined,
  previous: YearlyReport | undefined,
  monthIndex: number
): number | null {
  const cur = monthByIndex(current, monthIndex)?.occPct ?? null;
  const prev = monthByIndex(previous, monthIndex)?.occPct ?? null;
  if (cur == null || prev == null) return null;
  return cur - prev;
}

export interface DayOcc {
  date: string;
  roomsSold: number;
  occPct: number;
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// A guest occupies nights [arrival, departure) — departure night is free.
export function dailyOccupancy(
  arrivals: ArrivalsReport | undefined,
  capacity: number,
  startISO: string,
  days: number
): DayOcc[] {
  const out: DayOcc[] = [];
  const rows = arrivals?.rows ?? [];
  for (let i = 0; i < days; i++) {
    const date = addDays(startISO, i);
    let roomsSold = 0;
    for (const r of rows) {
      if (r.arrival && r.departure && r.arrival <= date && date < r.departure) {
        roomsSold++;
      }
    }
    const occPct = capacity > 0 ? (roomsSold / capacity) * 100 : 0;
    out.push({ date, roomsSold, occPct });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/metrics/pace.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/metrics/pace.ts tests/metrics/pace.test.ts
git commit -m "feat: add pace comparison and daily occupancy metrics"
```

---

## Task 15: Recommendation rules engine

**Files:**
- Create: `src/recommendations/rules.ts`, `tests/recommendations/rules.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/recommendations/rules.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
export interface RecoInput {
  monthLabel: string;
  occNow: number | null;
  leadDays: number | null;
  pacePerWeek: number | null;
  occPrevYear: number | null;
}

export interface Reco {
  level: 'red' | 'orange' | 'green';
  message: string;
  evidence: string;
}

export function recommend(input: RecoInput): Reco[] {
  const { monthLabel, occNow, leadDays, pacePerWeek, occPrevYear } = input;
  const out: Reco[] = [];
  if (occNow == null) return out;
  const ev = `occ ${occNow.toFixed(1)}%` +
    (leadDays != null ? `, เหลือ ${leadDays} วัน` : '') +
    (pacePerWeek != null ? `, pace ${pacePerWeek >= 0 ? '+' : ''}${pacePerWeek.toFixed(1)} จุด/สัปดาห์` : '') +
    (occPrevYear != null ? `, ปีก่อน ${occPrevYear.toFixed(1)}%` : '');

  if (leadDays != null && leadDays <= 14 && occNow < 40) {
    out.push({ level: 'red', message: `${monthLabel}: เหลือเวลาน้อยและ occ ต่ำมาก — ลดราคาแรง / flash deal บน OTA`, evidence: ev });
  } else if (leadDays != null && leadDays <= 30 && occNow < 50 && pacePerWeek != null && pacePerWeek < 5) {
    out.push({ level: 'orange', message: `${monthLabel}: occ ต่ำและ pace ช้า — ลดราคา 10–15% หรือออกโปรนาทีสุดท้าย`, evidence: ev });
  }

  if (occPrevYear != null && occNow < occPrevYear - 15) {
    out.push({ level: 'orange', message: `${monthLabel}: ตามหลังปีก่อนมาก (${(occPrevYear - occNow).toFixed(1)} จุด) — พิจารณาโปร/เพิ่มโฆษณา`, evidence: ev });
  }

  if (occNow >= 85 && leadDays != null && leadDays > 14) {
    out.push({ level: 'green', message: `${monthLabel}: ดีมานด์แรงและยังมีเวลา — ขึ้นราคาได้ 5–10%`, evidence: ev });
  } else if (occPrevYear != null && occNow >= occPrevYear && pacePerWeek != null && pacePerWeek >= 5) {
    out.push({ level: 'green', message: `${monthLabel}: เกาะ/นำปีก่อนและ pace ดี — คงราคา หรือทดลองขึ้นเล็กน้อย`, evidence: ev });
  }

  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/recommendations/rules.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/recommendations/rules.ts tests/recommendations/rules.test.ts
git commit -m "feat: add recommendation rules engine"
```

---

## Task 16: Auth function + signed cookie

**Files:**
- Create: `netlify/functions/_auth.ts`, `netlify/functions/auth.ts`, `tests/functions/auth.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from '../../netlify/functions/_auth';

describe('signed token', () => {
  it('verifies a token it signed', () => {
    const t = signToken('ok', 'secret123');
    expect(verifyToken(t, 'secret123')).toBe(true);
  });
  it('rejects tampered token', () => {
    const t = signToken('ok', 'secret123');
    expect(verifyToken(t + 'x', 'secret123')).toBe(false);
  });
  it('rejects wrong secret', () => {
    const t = signToken('ok', 'secret123');
    expect(verifyToken(t, 'other')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/functions/auth.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write _auth.ts (shared helpers)**

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export function signToken(payload: string, secret: string): string {
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifyToken(token: string | undefined, secret: string): boolean {
  if (!token) return false;
  const idx = token.lastIndexOf('.');
  if (idx < 0) return false;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const COOKIE = 'cdy_auth';

export function cookieFromToken(token: string): string {
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  return `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export function tokenFromCookieHeader(header: string | undefined): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return v.join('=');
  }
  return undefined;
}

export function isAuthed(req: Request, secret: string): boolean {
  return verifyToken(tokenFromCookieHeader(req.headers.get('cookie') || undefined), secret);
}
```

- [ ] **Step 4: Write auth.ts (the endpoint)**

```ts
import type { Config } from '@netlify/functions';
import { signToken, cookieFromToken } from './_auth';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const secret = process.env.AUTH_SECRET || '';
  const expected = process.env.DASHBOARD_PASSWORD || '';
  if (!secret || !expected) return new Response('Server not configured', { status: 500 });

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  if (!body.password || body.password !== expected) {
    return new Response(JSON.stringify({ ok: false }), { status: 401, headers: { 'content-type': 'application/json' } });
  }

  const token = signToken('ok', secret);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'set-cookie': cookieFromToken(token) },
  });
}

export const config: Config = { path: '/api/auth' };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/functions/auth.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/_auth.ts netlify/functions/auth.ts tests/functions/auth.test.ts
git commit -m "feat: add auth function with signed cookie"
```

---

## Task 17: Snapshots function (Netlify Blobs)

**Files:**
- Create: `netlify/functions/snapshots.ts`

- [ ] **Step 1: Write the implementation**

```ts
import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { isAuthed } from './_auth';

function store() {
  return getStore({ name: 'snapshots', consistency: 'strong' });
}

export default async function handler(req: Request): Promise<Response> {
  const secret = process.env.AUTH_SECRET || '';
  if (!isAuthed(req, secret)) {
    return new Response(JSON.stringify({ ok: false, reason: 'unauthorized' }), {
      status: 401, headers: { 'content-type': 'application/json' },
    });
  }

  const s = store();
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const key = url.searchParams.get('key');
    if (key) {
      const data = await s.get(key, { type: 'json' });
      return Response.json({ ok: true, data });
    }
    const list = await s.list();
    const keys = list.blobs.map((b) => b.key).sort();
    return Response.json({ ok: true, keys });
  }

  if (req.method === 'POST') {
    const body = (await req.json()) as { key: string; snapshot: unknown };
    if (!body.key || !body.snapshot) return new Response('Bad request', { status: 400 });
    await s.setJSON(body.key, body.snapshot);
    return Response.json({ ok: true });
  }

  return new Response('Method Not Allowed', { status: 405 });
}

export const config: Config = { path: '/api/snapshots' };
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add netlify/functions/snapshots.ts
git commit -m "feat: add snapshots function backed by Netlify Blobs"
```

---

## Task 18: AI insight function (Claude + prompt caching)

**Files:**
- Create: `netlify/functions/ai-insight.ts`

- [ ] **Step 1: Write the implementation**

```ts
import type { Config } from '@netlify/functions';
import Anthropic from '@anthropic-ai/sdk';
import { isAuthed } from './_auth';

const SYSTEM = `คุณเป็นที่ปรึกษา revenue management ของโรงแรมพูลวิลล่าเล็ก ๆ ในกระบี่ (Casa de Yim).
หน้าที่: อ่านตัวเลขสรุป (occupancy, ADR, RevPAR, pace, สัดส่วนช่องทาง, ตลาดตามสัญชาติ) แล้วให้คำแนะนำการปรับราคา/โปรโมชั่นเป็นภาษาไทย กระชับ เป็นข้อ ๆ.
หลักการ: จัดลำดับความเร่งด่วน, อ้างอิงตัวเลขจริง, เสนอไอเดียโปรที่อิงตลาดหลัก, เตือน seasonality.
ข้อจำกัด: เป็นคำแนะนำประกอบการตัดสินใจเท่านั้น ห้ามสั่งปรับราคาเอง และอย่ากุตัวเลขที่ไม่ได้ให้มา.`;

export default async function handler(req: Request): Promise<Response> {
  const secret = process.env.AUTH_SECRET || '';
  if (!isAuthed(req, secret)) {
    return new Response(JSON.stringify({ ok: false, reason: 'unauthorized' }), {
      status: 401, headers: { 'content-type': 'application/json' },
    });
  }
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return new Response('Missing ANTHROPIC_API_KEY', { status: 500 });

  const body = (await req.json()) as { context: string };
  const client = new Anthropic({ apiKey });

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: [
      { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
    ],
    messages: [
      { role: 'user', content: `นี่คือสรุปตัวเลขล่าสุด:\n\n${body.context}\n\nช่วยให้คำแนะนำการปรับราคา/โปรโมชั่นเป็นข้อ ๆ` },
    ],
  });

  const text = msg.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('\n');
  return Response.json({ ok: true, text });
}

export const config: Config = { path: '/api/ai-insight' };
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add netlify/functions/ai-insight.ts
git commit -m "feat: add AI insight function (Claude with prompt caching)"
```

---

## Task 19: Client API wrappers

**Files:**
- Create: `src/lib/api.ts`

- [ ] **Step 1: Write the implementation**

```ts
import type { Snapshot } from '../types';

export async function login(password: string): Promise<boolean> {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return res.ok;
}

export async function listSnapshotKeys(): Promise<string[]> {
  const res = await fetch('/api/snapshots');
  if (!res.ok) throw new Error('unauthorized');
  const json = await res.json();
  return json.keys as string[];
}

export async function getSnapshot(key: string): Promise<Snapshot> {
  const res = await fetch(`/api/snapshots?key=${encodeURIComponent(key)}`);
  const json = await res.json();
  return json.data as Snapshot;
}

export async function saveSnapshot(key: string, snapshot: Snapshot): Promise<void> {
  const res = await fetch('/api/snapshots', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key, snapshot }),
  });
  if (!res.ok) throw new Error('save failed');
}

export async function aiInsight(context: string): Promise<string> {
  const res = await fetch('/api/ai-insight', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ context }),
  });
  const json = await res.json();
  return json.text as string;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: add client API wrappers"
```

---

## Task 20: Auth gate + login page

**Files:**
- Create: `src/ui/AuthGate.tsx`, `src/ui/LoginPage.tsx`
- Modify: `src/ui/App.tsx`

- [ ] **Step 1: Write LoginPage.tsx**

```tsx
import { useState } from 'react';
import { login } from '../lib/api';

export default function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    const ok = await login(pw);
    setBusy(false);
    if (ok) onSuccess();
    else setError(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <form onSubmit={submit} className="bg-white p-8 rounded-xl shadow w-80 space-y-4">
        <h1 className="text-xl font-bold text-slate-800">Casa de Yim</h1>
        <p className="text-sm text-slate-500">ใส่รหัสผ่านเพื่อเข้าใช้งาน</p>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="w-full border rounded px-3 py-2"
          placeholder="รหัสผ่าน"
          autoFocus
        />
        {error && <p className="text-sm text-red-600">รหัสผ่านไม่ถูกต้อง</p>}
        <button disabled={busy} className="w-full bg-slate-800 text-white rounded py-2 disabled:opacity-50">
          {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Write AuthGate.tsx**

```tsx
import { useEffect, useState } from 'react';
import { listSnapshotKeys } from '../lib/api';
import LoginPage from './LoginPage';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'checking' | 'in' | 'out'>('checking');

  async function check() {
    try {
      await listSnapshotKeys();
      setState('in');
    } catch {
      setState('out');
    }
  }

  useEffect(() => {
    check();
  }, []);

  if (state === 'checking') return <div className="p-8 text-slate-500">กำลังโหลด…</div>;
  if (state === 'out') return <LoginPage onSuccess={() => setState('in')} />;
  return <>{children}</>;
}
```

- [ ] **Step 3: Update App.tsx**

```tsx
import { useState } from 'react';
import AuthGate from './AuthGate';
import UploadPage from './UploadPage';
import Dashboard from './Dashboard';

export default function App() {
  const [tab, setTab] = useState<'dashboard' | 'upload'>('dashboard');
  return (
    <AuthGate>
      <div className="min-h-screen bg-slate-100">
        <header className="bg-white border-b px-6 py-3 flex items-center gap-4">
          <h1 className="font-bold text-slate-800">Casa de Yim</h1>
          <nav className="flex gap-2 text-sm">
            <button onClick={() => setTab('dashboard')} className={tab === 'dashboard' ? 'font-semibold text-slate-900' : 'text-slate-500'}>Dashboard</button>
            <button onClick={() => setTab('upload')} className={tab === 'upload' ? 'font-semibold text-slate-900' : 'text-slate-500'}>อัปโหลด</button>
          </nav>
        </header>
        <main className="p-6">
          {tab === 'dashboard' ? <Dashboard /> : <UploadPage onSaved={() => setTab('dashboard')} />}
        </main>
      </div>
    </AuthGate>
  );
}
```

- [ ] **Step 4: Verify build (will fail until UploadPage/Dashboard exist — create stubs)**

Create `src/ui/UploadPage.tsx`:
```tsx
export default function UploadPage({ onSaved }: { onSaved: () => void }) {
  void onSaved;
  return <div>upload</div>;
}
```
Create `src/ui/Dashboard.tsx`:
```tsx
export default function Dashboard() {
  return <div>dashboard</div>;
}
```

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/ui/AuthGate.tsx src/ui/LoginPage.tsx src/ui/App.tsx src/ui/UploadPage.tsx src/ui/Dashboard.tsx
git commit -m "feat: add auth gate, login page, app shell"
```

---

## Task 21: Upload page (parse + preview + save)

**Files:**
- Create: `src/ui/buildSnapshot.ts`, `tests/ui/buildSnapshot.test.ts`
- Modify: `src/ui/UploadPage.tsx`

- [ ] **Step 1: Write the failing test for buildSnapshot**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/buildSnapshot.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write buildSnapshot.ts**

```ts
import { parseFile, extractDataAsOf } from '../parser';
import type {
  Snapshot, YearlyReport, ChannelReport, CountryReport, ArrivalsReport,
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
      case 'yearly': snapshot.yearly = result.data as YearlyReport; break;
      case 'channel': snapshot.channels = result.data as ChannelReport; break;
      case 'country': snapshot.countries = result.data as CountryReport; break;
      case 'arrivals': snapshot.arrivals = result.data as ArrivalsReport; break;
    }
  }

  return { snapshot, errors };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/buildSnapshot.test.ts`
Expected: PASS

- [ ] **Step 5: Write UploadPage.tsx**

```tsx
import { useState } from 'react';
import { buildSnapshot } from './buildSnapshot';
import { saveSnapshot, listSnapshotKeys } from '../lib/api';
import type { Snapshot } from '../types';

export default function UploadPage({ onSaved }: { onSaved: () => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const htmls = await Promise.all(Array.from(files).map((f) => f.text()));
    const { snapshot, errors } = buildSnapshot(htmls);
    setSnapshot(snapshot);
    setErrors(errors);
  }

  async function save() {
    if (!snapshot?.dataAsOf) {
      setErrors((e) => [...e, 'ไม่พบวันที่ของข้อมูล (Printed on …) — ตรวจไฟล์อีกครั้ง']);
      return;
    }
    const key = `snapshot/${snapshot.dataAsOf}`;
    const existing = await listSnapshotKeys();
    if (existing.includes(key) && !confirm(`มี snapshot วันที่ ${snapshot.dataAsOf} อยู่แล้ว — เขียนทับ?`)) return;
    setBusy(true);
    await saveSnapshot(key, snapshot);
    setBusy(false);
    onSaved();
  }

  const present = (label: string, ok: boolean) => (
    <li className={ok ? 'text-green-700' : 'text-slate-400'}>{ok ? '✓' : '—'} {label}</li>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="bg-white rounded-xl p-6 shadow">
        <h2 className="font-semibold mb-2">อัปโหลดรายงาน eZee (ลากได้หลายไฟล์)</h2>
        <input type="file" multiple accept=".html,.htm" onChange={(e) => onFiles(e.target.files)} />
      </div>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {errors.map((e, i) => <div key={i}>⚠ {e}</div>)}
        </div>
      )}

      {snapshot && (
        <div className="bg-white rounded-xl p-6 shadow space-y-3">
          <p className="text-sm text-slate-600">วันที่ข้อมูล: <b>{snapshot.dataAsOf ?? '—'}</b></p>
          <ul className="text-sm space-y-1">
            {present('Yearly Statistics', !!snapshot.yearly)}
            {present('Contribution Analysis (ช่องทาง)', !!snapshot.channels)}
            {present('Country Wise (สัญชาติ)', !!snapshot.countries)}
            {present('Arrival List (จองล่วงหน้า)', !!snapshot.arrivals)}
          </ul>
          <button onClick={save} disabled={busy} className="bg-slate-800 text-white rounded px-4 py-2 disabled:opacity-50">
            {busy ? 'กำลังบันทึก…' : 'บันทึก snapshot'}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Verify build**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all tests pass, no type errors

- [ ] **Step 7: Commit**

```bash
git add src/ui/buildSnapshot.ts tests/ui/buildSnapshot.test.ts src/ui/UploadPage.tsx
git commit -m "feat: add upload page with parse, preview, save"
```

---

## Task 22: Dashboard — data loading + period toggle + KPI cards

**Files:**
- Create: `src/ui/components/PeriodToggle.tsx`, `src/ui/components/KpiCards.tsx`, `src/ui/dashboardData.ts`, `tests/ui/dashboardData.test.ts`
- Modify: `src/ui/Dashboard.tsx`

- [ ] **Step 1: Write the failing test for dashboardData**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/dashboardData.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write dashboardData.ts**

```ts
import type { Snapshot } from '../types';
import { getSnapshot, listSnapshotKeys } from '../lib/api';

export type Period = 'lastMonth' | 'lastWeek' | 'nextMonth' | 'next2Weeks';

export const PERIOD_LABELS: Record<Period, string> = {
  lastMonth: 'เดือนที่ผ่านมา',
  lastWeek: 'สัปดาห์ที่ผ่านมา',
  nextMonth: 'เดือนหน้า',
  next2Weeks: '2 สัปดาห์หน้า',
};

export function targetMonthForPeriod(period: Period, dataAsOf: string): number {
  const month = Number(dataAsOf.slice(5, 7)); // 1-12
  switch (period) {
    case 'lastMonth': return month === 1 ? 12 : month - 1;
    case 'nextMonth': return month === 12 ? 1 : month + 1;
    case 'lastWeek':
    case 'next2Weeks': return month;
  }
}

export interface LoadedSnapshots {
  latest: Snapshot | null;
  previous: Snapshot | null; // the snapshot before latest (for pace)
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/dashboardData.test.ts`
Expected: PASS

- [ ] **Step 5: Write PeriodToggle.tsx**

```tsx
import { PERIOD_LABELS, type Period } from '../dashboardData';

const ORDER: Period[] = ['lastMonth', 'lastWeek', 'nextMonth', 'next2Weeks'];

export default function PeriodToggle({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {ORDER.map((p) => (
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

- [ ] **Step 6: Write KpiCards.tsx**

```tsx
import type { YearlyReport } from '../../types';
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
  yearly, yearlyPrev, monthIndex,
}: { yearly?: YearlyReport; yearlyPrev?: YearlyReport; monthIndex: number }) {
  const cur = monthByIndex(yearly, monthIndex);
  const prevMonth = monthByIndex(yearly, monthIndex === 1 ? 12 : monthIndex - 1);
  const prevYear = monthByIndex(yearlyPrev, monthIndex);

  const cards = [
    { label: 'OCCUPANCY', value: fmt(cur?.occPct ?? null, '%'), mom: pctDelta(cur?.occPct ?? null, prevMonth?.occPct ?? null), yoy: pctDelta(cur?.occPct ?? null, prevYear?.occPct ?? null) },
    { label: 'ADR', value: '฿' + fmt(cur?.adr ?? null), mom: pctDelta(cur?.adr ?? null, prevMonth?.adr ?? null), yoy: pctDelta(cur?.adr ?? null, prevYear?.adr ?? null) },
    { label: 'REVPAR', value: '฿' + fmt(cur?.revPar ?? null), mom: pctDelta(cur?.revPar ?? null, prevMonth?.revPar ?? null), yoy: pctDelta(cur?.revPar ?? null, prevYear?.revPar ?? null) },
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

- [ ] **Step 7: Wire Dashboard.tsx (KPI section only for now)**

```tsx
import { useEffect, useState } from 'react';
import PeriodToggle from './components/PeriodToggle';
import KpiCards from './components/KpiCards';
import { loadSnapshots, targetMonthForPeriod, type Period, type LoadedSnapshots } from './dashboardData';

export default function Dashboard() {
  const [data, setData] = useState<LoadedSnapshots | null>(null);
  const [period, setPeriod] = useState<Period>('lastMonth');

  useEffect(() => {
    loadSnapshots().then(setData);
  }, []);

  if (!data) return <div className="text-slate-500">กำลังโหลด…</div>;
  if (!data.latest) return <div className="text-slate-500">ยังไม่มีข้อมูล — ไปที่หน้า “อัปโหลด” ก่อน</div>;

  const dataAsOf = data.latest.dataAsOf ?? new Date().toISOString().slice(0, 10);
  const monthIndex = targetMonthForPeriod(period, dataAsOf);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PeriodToggle value={period} onChange={setPeriod} />
      <KpiCards yearly={data.latest.yearly} monthIndex={monthIndex} />
    </div>
  );
}
```

- [ ] **Step 8: Verify build + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all pass

- [ ] **Step 9: Commit**

```bash
git add src/ui/dashboardData.ts tests/ui/dashboardData.test.ts src/ui/components/PeriodToggle.tsx src/ui/components/KpiCards.tsx src/ui/Dashboard.tsx
git commit -m "feat: add dashboard data loading, period toggle, KPI cards"
```

---

## Task 23: Trend chart (monthly Occ/ADR/RevPAR, actual vs on-the-books)

**Files:**
- Create: `src/ui/components/TrendChart.tsx`
- Modify: `src/ui/Dashboard.tsx`

- [ ] **Step 1: Write TrendChart.tsx**

```tsx
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import type { YearlyReport } from '../../types';

const MONTH_ABBR = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export default function TrendChart({ yearly, dataAsOf }: { yearly?: YearlyReport; dataAsOf: string }) {
  if (!yearly) return null;
  const currentMonth = Number(dataAsOf.slice(5, 7));
  const rows = yearly.months.map((m) => ({
    name: MONTH_ABBR[m.monthIndex - 1],
    occ: m.occPct,
    adr: m.adr,
    isActual: m.monthIndex <= currentMonth,
  }));

  return (
    <div className="bg-white rounded-xl p-5 shadow">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">แนวโน้มรายเดือน — สีเข้ม = actual, สีอ่อน = จองล่วงหน้า</h3>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={rows}>
          <XAxis dataKey="name" fontSize={11} />
          <YAxis yAxisId="left" fontSize={11} unit="%" />
          <YAxis yAxisId="right" orientation="right" fontSize={11} />
          <Tooltip />
          <Legend />
          <Bar yAxisId="left" dataKey="occ" name="Occ%">
            {rows.map((r, i) => (
              <Cell key={i} fill={r.isActual ? '#1e293b' : '#94a3b8'} />
            ))}
          </Bar>
          <Line yAxisId="right" dataKey="adr" name="ADR" stroke="#b45309" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Add TrendChart to Dashboard.tsx**

Add the import at the top of `src/ui/Dashboard.tsx`:
```tsx
import TrendChart from './components/TrendChart';
```
Add below `<KpiCards .../>`:
```tsx
      <TrendChart yearly={data.latest.yearly} dataAsOf={dataAsOf} />
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/TrendChart.tsx src/ui/Dashboard.tsx
git commit -m "feat: add monthly trend chart"
```

---

## Task 24: Forward pace section (pickup curve + daily occupancy)

**Files:**
- Create: `src/ui/components/ForwardPace.tsx`
- Modify: `src/ui/Dashboard.tsx`

- [ ] **Step 1: Write ForwardPace.tsx**

```tsx
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { Snapshot } from '../../types';
import { villaCount } from '../../metrics/capacity';
import { dailyOccupancy } from '../../metrics/pace';

export default function ForwardPace({
  latest, daysAhead, villaOverride,
}: { latest: Snapshot; daysAhead: number; villaOverride?: number }) {
  const dataAsOf = latest.dataAsOf ?? new Date().toISOString().slice(0, 10);
  const capacity = villaCount(latest.yearly, villaOverride);
  const daily = dailyOccupancy(latest.arrivals, capacity, dataAsOf, daysAhead).map((d) => ({
    name: d.date.slice(5),
    occ: Math.round(d.occPct),
  }));

  return (
    <div className="bg-white rounded-xl p-5 shadow">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">
        Occupancy ล่วงหน้า {daysAhead} วัน (จาก Arrival List · {capacity} villa)
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={daily}>
          <XAxis dataKey="name" fontSize={10} interval={Math.max(0, Math.floor(daily.length / 15))} />
          <YAxis fontSize={11} unit="%" domain={[0, 100]} />
          <Tooltip />
          <Bar dataKey="occ" name="Occ%" fill="#3a6ea5" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

Note: the unused `LineChart`/`Line` imports above should be removed — keep only `BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer`.

- [ ] **Step 2: Add ForwardPace to Dashboard.tsx**

Add import:
```tsx
import ForwardPace from './components/ForwardPace';
```
Add below `<TrendChart .../>`:
```tsx
      <ForwardPace latest={data.latest} daysAhead={period === 'next2Weeks' ? 14 : 60} />
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: build succeeds (fix any unused-import errors flagged by tsc)

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/ForwardPace.tsx src/ui/Dashboard.tsx
git commit -m "feat: add forward pace daily occupancy chart"
```

---

## Task 25: Channel & Country mix panels

**Files:**
- Create: `src/ui/components/MixPanels.tsx`
- Modify: `src/ui/Dashboard.tsx`

- [ ] **Step 1: Write MixPanels.tsx**

```tsx
import type { ChannelReport, CountryReport } from '../../types';

function bar(value: number, max: number): string {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return `${pct}%`;
}

export default function MixPanels({
  channels, countries,
}: { channels?: ChannelReport; countries?: CountryReport }) {
  const chanRows = (channels?.rows ?? []).filter((r) => (r.roomSold ?? 0) > 0);
  const maxChan = Math.max(1, ...chanRows.map((r) => r.revenue ?? 0));
  const countryRows = (countries?.rows ?? [])
    .filter((r) => r.country !== '-- N/A --')
    .slice(0, 8);
  const maxCountry = Math.max(1, ...countryRows.map((r) => r.revenue ?? 0));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-white rounded-xl p-5 shadow">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">สัดส่วนช่องทาง</h3>
        {chanRows.length === 0 ? <p className="text-slate-400 text-sm">— ไม่มีข้อมูล</p> : chanRows.map((r) => (
          <div key={r.source} className="mb-2">
            <div className="flex justify-between text-sm">
              <span>{r.source}</span>
              <span className="text-slate-500">{r.revPct?.toFixed(0) ?? '–'}% · ADR ฿{r.adr?.toLocaleString('en-US', { maximumFractionDigits: 0 }) ?? '–'}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded"><div className="h-2 bg-slate-700 rounded" style={{ width: bar(r.revenue ?? 0, maxChan) }} /></div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-5 shadow">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">ตลาดตามสัญชาติ (Top 8)</h3>
        {countryRows.length === 0 ? <p className="text-slate-400 text-sm">— ไม่มีข้อมูล</p> : countryRows.map((r) => (
          <div key={r.country} className="mb-2">
            <div className="flex justify-between text-sm">
              <span>{r.country}</span>
              <span className="text-slate-500">฿{r.revenue?.toLocaleString('en-US', { maximumFractionDigits: 0 }) ?? '–'}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded"><div className="h-2 bg-blue-500 rounded" style={{ width: bar(r.revenue ?? 0, maxCountry) }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add MixPanels to Dashboard.tsx**

Add import:
```tsx
import MixPanels from './components/MixPanels';
```
Add below `<ForwardPace .../>`:
```tsx
      <MixPanels channels={data.latest.channels} countries={data.latest.countries} />
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/MixPanels.tsx src/ui/Dashboard.tsx
git commit -m "feat: add channel and country mix panels"
```

---

## Task 26: Recommendations panel + AI button

**Files:**
- Create: `src/ui/components/Recommendations.tsx`, `src/ui/buildRecoInputs.ts`, `tests/ui/buildRecoInputs.test.ts`
- Modify: `src/ui/Dashboard.tsx`

- [ ] **Step 1: Write the failing test for buildRecoInputs**

```ts
import { describe, it, expect } from 'vitest';
import { buildRecoInputs } from '../../src/ui/buildRecoInputs';
import type { Snapshot } from '../../src/types';

const latest: Snapshot = {
  uploadedAt: '', dataAsOf: '2026-05-29',
  yearly: {
    year: 2026,
    months: [{ month: 'June', monthIndex: 6, availableRooms: 120, nightSold: 34, occPct: 28.57, adr: 1, revPar: 1, pax: 1, roomCharges: 1 }],
    grandTotal: { month: 'Grand Total', monthIndex: 0, availableRooms: 1, nightSold: 1, occPct: 1, adr: 1, revPar: 1, pax: 1, roomCharges: 1 },
  },
};

describe('buildRecoInputs', () => {
  it('computes lead days and pulls occ for upcoming months', () => {
    const inputs = buildRecoInputs(latest, null, undefined);
    const june = inputs.find((i) => i.monthLabel === 'June')!;
    expect(june.occNow).toBe(28.57);
    expect(june.leadDays).toBeGreaterThan(0); // June is after 2026-05-29
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/buildRecoInputs.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write buildRecoInputs.ts**

```ts
import type { Snapshot } from '../types';
import type { RecoInput } from '../recommendations/rules';
import { comparePace } from '../metrics/pace';
import { monthByIndex } from '../metrics/kpi';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function daysUntilMonthStart(dataAsOf: string, monthIndex: number): number {
  const asOf = new Date(dataAsOf + 'T00:00:00Z');
  const year = asOf.getUTCFullYear();
  const start = new Date(Date.UTC(year, monthIndex - 1, 1));
  return Math.round((start.getTime() - asOf.getTime()) / 86400000);
}

// Build reco inputs for the next 3 upcoming months relative to dataAsOf.
export function buildRecoInputs(
  latest: Snapshot,
  previous: Snapshot | null,
  yearlyPrev: Snapshot['yearly'] | undefined
): RecoInput[] {
  const dataAsOf = latest.dataAsOf ?? new Date().toISOString().slice(0, 10);
  const curMonth = Number(dataAsOf.slice(5, 7));
  const out: RecoInput[] = [];

  for (let offset = 0; offset <= 2; offset++) {
    const mi = ((curMonth - 1 + offset) % 12) + 1;
    const row = monthByIndex(latest.yearly, mi);
    if (!row) continue;
    const pace = comparePace(latest.yearly, previous?.yearly, mi);
    out.push({
      monthLabel: MONTH_NAMES[mi - 1],
      occNow: row.occPct,
      leadDays: daysUntilMonthStart(dataAsOf, mi),
      pacePerWeek: pace,
      occPrevYear: monthByIndex(yearlyPrev, mi)?.occPct ?? null,
    });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/buildRecoInputs.test.ts`
Expected: PASS

- [ ] **Step 5: Write Recommendations.tsx**

```tsx
import { useState } from 'react';
import type { Snapshot } from '../../types';
import { recommend } from '../../recommendations/rules';
import { buildRecoInputs } from '../buildRecoInputs';
import { aiInsight } from '../../lib/api';

const LEVEL_STYLE = {
  red: 'bg-red-50 border-red-200 text-red-800',
  orange: 'bg-amber-50 border-amber-200 text-amber-800',
  green: 'bg-green-50 border-green-200 text-green-800',
};

export default function Recommendations({
  latest, previous,
}: { latest: Snapshot; previous: Snapshot | null }) {
  const [aiText, setAiText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inputs = buildRecoInputs(latest, previous, undefined);
  const recos = inputs.flatMap((i) => recommend(i));

  async function askAi() {
    setBusy(true);
    const context = JSON.stringify({ recoInputs: inputs, rules: recos }, null, 2);
    try {
      setAiText(await aiInsight(context));
    } catch {
      setAiText('เรียก AI ไม่สำเร็จ — ตรวจการตั้งค่า API key');
    }
    setBusy(false);
  }

  return (
    <div className="bg-white rounded-xl p-5 shadow space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">คำแนะนำการปรับราคา</h3>
        <button onClick={askAi} disabled={busy} className="text-sm bg-slate-800 text-white rounded px-3 py-1.5 disabled:opacity-50">
          {busy ? 'กำลังถาม AI…' : '✨ ถาม AI'}
        </button>
      </div>

      {recos.length === 0 ? (
        <p className="text-slate-400 text-sm">— ยังไม่มีสัญญาณที่ต้องดำเนินการ</p>
      ) : recos.map((r, i) => (
        <div key={i} className={`border rounded-lg p-3 text-sm ${LEVEL_STYLE[r.level]}`}>
          <div className="font-medium">{r.message}</div>
          <div className="text-xs opacity-70 mt-1">{r.evidence}</div>
        </div>
      ))}

      {aiText && (
        <div className="border-t pt-3 mt-3">
          <div className="text-xs text-slate-400 mb-1">สรุปโดย AI</div>
          <div className="text-sm whitespace-pre-wrap text-slate-700">{aiText}</div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Add Recommendations to Dashboard.tsx**

Add import:
```tsx
import Recommendations from './components/Recommendations';
```
Add below `<MixPanels .../>`:
```tsx
      <Recommendations latest={data.latest} previous={data.previous} />
```

- [ ] **Step 7: Verify build + full test run**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all pass, build succeeds

- [ ] **Step 8: Commit**

```bash
git add src/ui/buildRecoInputs.ts tests/ui/buildRecoInputs.test.ts src/ui/components/Recommendations.tsx src/ui/Dashboard.tsx
git commit -m "feat: add recommendations panel with AI button"
```

---

## Task 27: Local end-to-end smoke test with Netlify Dev

**Files:** none (manual verification)

- [ ] **Step 1: Install Netlify CLI (if absent) and create local env**

```bash
npm install -g netlify-cli
```

Create `.env` (gitignored):
```
DASHBOARD_PASSWORD=casa2026
AUTH_SECRET=local-dev-secret-change-me
ANTHROPIC_API_KEY=sk-ant-...   # optional for AI button
```

- [ ] **Step 2: Run Netlify Dev**

Run: `netlify dev`
Expected: serves app at `http://localhost:8888` with functions on `/api/*` and Blobs emulated

- [ ] **Step 3: Manual checks**

- เปิด `http://localhost:8888` → ใส่รหัส `casa2026` → เข้าได้
- ไปหน้า "อัปโหลด" → ลากไฟล์จาก `tests/fixtures/` ทั้ง 4 → เห็น ✓ ครบ 4 → กดบันทึก
- กลับหน้า Dashboard → เห็น KPI (พ.ค. occ 42.2%), กราฟแนวโน้ม, forward pace, channel/country, การ์ดคำแนะนำ
- กดปุ่ม "ถาม AI" (ถ้าตั้ง API key) → เห็นข้อความสรุปภาษาไทย

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during local smoke test"
```

---

## Task 28: Deploy to Netlify

**Files:** none (deployment)

- [ ] **Step 1: Create site and link**

```bash
netlify init
```
(เลือก create & configure a new site; build command `npm run build`; publish dir `dist`; functions dir `netlify/functions`)

- [ ] **Step 2: Set environment variables**

```bash
netlify env:set DASHBOARD_PASSWORD "<a-strong-password>"
netlify env:set AUTH_SECRET "$(openssl rand -hex 32)"
netlify env:set ANTHROPIC_API_KEY "<sk-ant-...>"
```

- [ ] **Step 3: Deploy**

```bash
netlify deploy --build --prod
```
Expected: a live URL is printed

- [ ] **Step 4: Verify production**

- เปิด URL → login ด้วยรหัสที่ตั้ง
- อัปโหลด fixtures → บันทึก → Dashboard แสดงผล → ปุ่ม AI ทำงาน
- เปิด URL แบบ incognito โดยไม่ login → ยิง `/api/snapshots` ตรง → ต้องได้ 401

- [ ] **Step 5: Commit deploy notes**

Create `README.md` with: SOP การ export eZee (อ้างอิงจาก spec §3.1), วิธี deploy, รายการ env vars, และโครงสร้างโมดูล. Then:
```bash
git add README.md
git commit -m "docs: add README with eZee export SOP and deploy notes"
```

---

## Self-Review Notes

- **Spec coverage:** §3 parsers (Tasks 7–11) · §3.1 SOP (README Task 28) · §4 data model (Task 3) · §5 functions (Tasks 16–18) · §6 layout A (Tasks 22–26) · §7 pace (Task 14, 24) · §8 recommendations + AI (Tasks 15, 26, 18) · §9 auth (Task 16, 20) · §10 error handling (Task 21 preview/missing-file, parser `ParseResult`) · §11 config (villa override Task 12/24) · §12 testing (every parser/metric/reco task is TDD).
- **Threshold defaults** in Task 15 match spec §8.1 (≤14d & <40%; ≤30d & <50% & pace<5; behind prev-year >15pts; ≥85% & >14d).
- **Type consistency:** `MonthRow`, `ChannelRow`, `CountryRow`, `ArrivalRow`, `Snapshot`, `ParseResult` defined once in Task 3 and reused verbatim; `recommend`/`RecoInput`/`Reco` defined in Task 15 and consumed in Tasks 26; `villaCount`/`dailyOccupancy`/`comparePace`/`monthByIndex`/`pctDelta` signatures consistent across metric and UI tasks.
- **Known follow-ups (Phase 2, not in this plan):** baseline prev-year upload UI wiring (parser handles it; `yearlyPrev` is threaded as `undefined` for now), per-month channel/country scope switching, competitor analysis, auto-export.
```
