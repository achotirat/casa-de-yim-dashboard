# Design System Reskin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the "Lagoon & Terracotta" design language (Cormorant Garamond + Manrope + Noto Sans Thai, forest-green/terracotta palette) to every visual surface of the dashboard without touching routing, data, or business logic.

**Architecture:** Add CSS custom properties + font imports as the token layer, extend Tailwind config to reference them, then rewrite each component file top-to-bottom in the new style. A new `SectionCard` shared wrapper is created first so chart components can depend on it. No new routes, no new data fetching.

**Tech Stack:** React · Tailwind CSS · Recharts · Vite · sharp + png-to-ico (favicon generation only)

---

## File Map

```
Modified:
  index.html                              ← Google Fonts links
  src/index.css                           ← CSS vars, html/body base
  tailwind.config.js                      ← extend theme with tokens

  src/ui/App.tsx                          ← dark header, sand bg, panel wrapper
  src/ui/Dashboard.tsx                    ← page head, remove max-w-5xl

  src/ui/components/PeriodToggle.tsx      ← chip style
  src/ui/components/KpiCards.tsx          ← full card redesign
  src/ui/components/TrendChart.tsx        ← colours + SectionCard
  src/ui/components/ForecastSection.tsx   ← alt card, stat strip, colours
  src/ui/components/ForwardPace.tsx       ← colours + SectionCard
  src/ui/components/MixPanels.tsx         ← channel/country reskin
  src/ui/components/Recommendations.tsx   ← two-column gradient card

New:
  src/ui/components/SectionCard.tsx       ← shared section wrapper + SectionHead
  scripts/gen-favicon.mjs                 ← branded favicon generator
```

---

## Task 1: Design tokens — fonts, CSS vars, Tailwind config

**Files:**
- Modify: `index.html`
- Modify: `src/index.css`
- Modify: `tailwind.config.js`

- [ ] **Step 1: Add Google Fonts to index.html**

Replace the `<title>` block in `index.html` so the head reads:

```html
<!doctype html>
<html lang="th">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Casa de Yim Dashboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;1,600&family=Manrope:wght@400;600;700;800&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="manifest" href="/site.webmanifest">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Replace src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --shell-1: #103A34;
  --shell-2: #0B2A26;
  --primary: #1E6E62;
  --accent:  #C56A45;
  --accent-2:#A8542F;
  --gold:    #E2A95B;
  --sand:    #E7DFD2;
  --panel:   #FBF8F2;
  --card:    #FFFFFF;
  --card-2:  #F3EEE5;
  --ink:     #241D18;
  --muted:   #8C8377;
  --line:    rgba(36,29,24,.10);
}

html { background: var(--sand); }

body {
  font-family: 'Noto Sans Thai', 'Manrope', system-ui, sans-serif;
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 3: Replace tailwind.config.js**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        shell:     'var(--shell-1)',
        primary:   'var(--primary)',
        accent:    'var(--accent)',
        'accent-2':'var(--accent-2)',
        gold:      'var(--gold)',
        sand:      'var(--sand)',
        panel:     'var(--panel)',
        card:      'var(--card)',
        'card-2':  'var(--card-2)',
        ink:       'var(--ink)',
        muted:     'var(--muted)',
      },
      fontFamily: {
        display: ["'Cormorant Garamond'", 'serif'],
        sans:    ["'Noto Sans Thai'", "'Manrope'", 'system-ui', 'sans-serif'],
        num:     ["'Manrope'", 'sans-serif'],
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 4: Verify build**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: no type errors, all 67 tests pass.

- [ ] **Step 5: Commit**

```bash
git add index.html src/index.css tailwind.config.js
git commit -m "feat: add Lagoon & Terracotta design tokens (CSS vars, fonts, Tailwind)"
```

---

## Task 2: SectionCard shared component

**Files:**
- Create: `src/ui/components/SectionCard.tsx`

- [ ] **Step 1: Create SectionCard.tsx**

```tsx
interface SectionHeadProps {
  title: string;
  italic?: string;
  meta?: string;
  right?: React.ReactNode;
}

export function SectionHead({ title, italic, meta, right }: SectionHeadProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14, gap: 18 }}>
      <div>
        <h3 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontWeight: 600, fontSize: 22, lineHeight: 1.1,
          color: 'var(--ink)', letterSpacing: '-.2px', margin: 0,
        }}>
          {title}
          {italic && <i style={{ fontStyle: 'italic', color: 'var(--accent-2)' }}>{italic}</i>}
        </h3>
        {meta && (
          <span style={{
            fontFamily: "'Manrope', sans-serif",
            fontSize: 11.5, color: 'var(--muted)', fontWeight: 500, display: 'block', marginTop: 2,
          }}>{meta}</span>
        )}
      </div>
      {right}
    </div>
  );
}

interface SectionCardProps {
  alt?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export default function SectionCard({ alt, children, style }: SectionCardProps) {
  return (
    <div style={{
      background: alt ? 'var(--card-2)' : 'var(--card)',
      borderRadius: 22,
      padding: '22px 24px',
      border: alt ? 'none' : '1px solid var(--line)',
      boxShadow: '0 10px 24px -18px rgba(11,42,38,.28)',
      ...style,
    }}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/SectionCard.tsx
git commit -m "feat: add SectionCard + SectionHead shared wrapper"
```

---

## Task 3: App shell + Dashboard page head

**Files:**
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/Dashboard.tsx`

- [ ] **Step 1: Replace App.tsx**

```tsx
import { useState } from 'react';
import AuthGate from './AuthGate';
import UploadPage from './UploadPage';
import Dashboard from './Dashboard';

export default function App() {
  const [tab, setTab] = useState<'dashboard' | 'upload'>('dashboard');

  return (
    <AuthGate>
      <div style={{ minHeight: '100vh', background: 'var(--sand)' }}>
        {/* Dark header bar */}
        <header style={{
          background: 'linear-gradient(150deg, var(--shell-1), var(--shell-2))',
          padding: '0 24px',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
        }}>
          {/* Brandmark */}
          <div style={{
            width: 38, height: 38, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(140deg, var(--accent), var(--accent-2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 22,
            fontFamily: "'Cormorant Garamond', serif", fontWeight: 700,
            boxShadow: '0 6px 16px -8px rgba(0,0,0,.5)',
          }}>Y</div>
          {/* Wordmark */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 20, color: '#fff', lineHeight: 1 }}>
              Casa de Yim
            </span>
            <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)' }}>
              Krabi · Dashboard
            </span>
          </div>
          {/* Tab nav */}
          <nav style={{ display: 'flex', gap: 20, marginLeft: 20 }}>
            {(['dashboard', 'upload'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '4px 0',
                  fontFamily: "'Manrope', sans-serif", fontSize: 11, fontWeight: 700,
                  letterSpacing: '1.2px', textTransform: 'uppercase',
                  color: tab === t ? '#fff' : 'rgba(255,255,255,.45)',
                  borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                  transition: 'color .15s',
                }}
              >
                {t === 'dashboard' ? 'Dashboard' : 'อัปโหลด'}
              </button>
            ))}
          </nav>
        </header>

        {/* Content panel */}
        <main style={{ padding: 16, maxWidth: 1200, margin: '0 auto' }}>
          <div style={{
            background: 'var(--panel)',
            borderRadius: 28,
            padding: '24px 28px 32px',
            minHeight: 'calc(100vh - 92px)',
          }}>
            {tab === 'dashboard'
              ? <Dashboard />
              : <UploadPage onSaved={() => setTab('dashboard')} />}
          </div>
        </main>
      </div>
    </AuthGate>
  );
}
```

- [ ] **Step 2: Update Dashboard.tsx — remove max-w-5xl, add page head**

Replace only the `return` block in `src/ui/Dashboard.tsx` (keep all imports and logic above it unchanged):

```tsx
  const MONTH_TH: Record<number, string> = {
    1:'มกราคม',2:'กุมภาพันธ์',3:'มีนาคม',4:'เมษายน',5:'พฤษภาคม',6:'มิถุนายน',
    7:'กรกฎาคม',8:'สิงหาคม',9:'กันยายน',10:'ตุลาคม',11:'พฤศจิกายน',12:'ธันวาคม',
  };
  const currentMonthNum = Number(dataAsOf.slice(5, 7));
  const monthLabel = MONTH_TH[currentMonthNum] ?? '';

  const PERIOD_DESC: Record<Period, string> = {
    thisMonth: 'เดือนนี้',
    next2Weeks: '2 สัปดาห์หน้า',
    nextMonth: 'เดือนหน้า',
    lastMonth: 'เดือนที่ผ่านมา',
    lastWeek: 'สัปดาห์ที่ผ่านมา',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page head */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, padding: '2px 4px 4px' }}>
        <div>
          <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
            {monthLabel} {dataAsOf.slice(0, 4)} · ข้อมูล ณ {dataAsOf}
          </div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 36, lineHeight: 1.05, letterSpacing: '-.5px', color: 'var(--ink)', margin: 0 }}>
            ผลประกอบการ<i style={{ fontStyle: 'italic', color: 'var(--accent-2)' }}> {PERIOD_DESC[period]}</i>
          </h1>
          <div style={{ fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif", fontSize: 13, color: 'var(--muted)', fontWeight: 500, marginTop: 4 }}>
            ดู Occupancy, ADR และ RevPAR เทียบเดือนก่อน · เลือกช่วงเวลาเพื่อโฟกัส
          </div>
        </div>
        <PeriodToggle value={period} onChange={setPeriod} hasWeeklyData={hasWeeklyData} />
      </div>

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
```

- [ ] **Step 3: Verify build + tests**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: no errors, 67 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/ui/App.tsx src/ui/Dashboard.tsx
git commit -m "feat: dark header shell + cream panel wrapper + page head"
```

---

## Task 4: PeriodToggle — chip style

**Files:**
- Modify: `src/ui/components/PeriodToggle.tsx`

- [ ] **Step 1: Replace PeriodToggle.tsx**

```tsx
import { PERIOD_LABELS, type Period } from '../dashboardData';

const BASE_ORDER: Period[] = ['thisMonth', 'next2Weeks', 'nextMonth', 'lastMonth'];

export default function PeriodToggle({
  value, onChange, hasWeeklyData,
}: { value: Period; onChange: (p: Period) => void; hasWeeklyData: boolean }) {
  const order: Period[] = hasWeeklyData ? [...BASE_ORDER, 'lastWeek'] : BASE_ORDER;

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {order.map((p) => {
        const active = p === value;
        return (
          <button
            key={p}
            onClick={() => onChange(p)}
            style={{
              border: active ? 'none' : '1px solid var(--line)',
              background: active ? 'var(--shell-1)' : 'var(--card)',
              color: active ? '#fff' : 'var(--ink)',
              fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif",
              fontSize: 12.5, fontWeight: 600,
              padding: '9px 16px', borderRadius: 999,
              cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'background .15s, color .15s',
            }}
            onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--card-2)'; }}
            onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--card)'; }}
          >
            {PERIOD_LABELS[p]}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/components/PeriodToggle.tsx
git commit -m "feat: reskin period toggle as design-system chips"
```

---

## Task 5: KpiCards — full redesign

**Files:**
- Modify: `src/ui/components/KpiCards.tsx`

- [ ] **Step 1: Replace KpiCards.tsx**

```tsx
import type { YearlyReport } from '../../types';
import type { WeeklyKpi } from '../../metrics/weekly';
import { monthByIndex, pctDelta } from '../../metrics/kpi';

function fmt(n: number | null, suffix = ''): string {
  return n == null ? '–' : `${n.toLocaleString('en-US', { maximumFractionDigits: suffix === '%' ? 1 : 0 })}${suffix}`;
}

function DeltaBlock({ label, value }: { label: string; value: number | null }) {
  const color = value == null
    ? 'var(--muted)'
    : value > 0 ? 'var(--primary)'
    : value < 0 ? 'var(--accent-2)'
    : 'var(--muted)';
  const arrow = value == null ? '' : value > 0 ? '▲ ' : value < 0 ? '▼ ' : '';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.6px', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12.5, fontWeight: 800, color }}>
        {value == null ? '—' : `${arrow}${Math.abs(value).toFixed(1)}%`}
      </span>
    </div>
  );
}

function KpiCard({ label, thaiPill, value, prefix, suffix, glyph, mom, yoy }: {
  label: string; thaiPill: string; value: number | null;
  prefix?: string; suffix?: string; glyph: string;
  mom: number | null; yoy: number | null;
}) {
  return (
    <div style={{
      background: 'var(--card)', borderRadius: 22,
      padding: '22px 24px 20px',
      border: '1px solid var(--line)',
      boxShadow: '0 10px 24px -18px rgba(11,42,38,.3)',
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1.6px' }}>
          {label}
        </span>
        <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 10, fontWeight: 700, color: 'var(--muted)', background: 'var(--card-2)', padding: '4px 9px', borderRadius: 999 }}>
          {thaiPill}
        </span>
      </div>
      <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 50, lineHeight: 1, letterSpacing: '-1.5px', color: 'var(--ink)' }}>
        {prefix && <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--muted)', marginRight: 3, verticalAlign: 6 }}>{prefix}</span>}
        {fmt(value)}
        {suffix && <small style={{ fontSize: 22, fontWeight: 700, color: 'var(--muted)', marginLeft: 2 }}>{suffix}</small>}
      </div>
      <div style={{ display: 'flex', gap: 14, borderTop: '1px dashed var(--line)', paddingTop: 10 }}>
        <DeltaBlock label="MoM" value={mom} />
        <DeltaBlock label="YoY" value={yoy} />
      </div>
      <span style={{
        position: 'absolute', right: 14, bottom: 8,
        fontFamily: "'Cormorant Garamond', serif", fontSize: 100,
        fontWeight: 600, fontStyle: 'italic', lineHeight: 1,
        color: 'rgba(36,29,24,.05)', pointerEvents: 'none', userSelect: 'none',
      }}>{glyph}</span>
    </div>
  );
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

  const occ    = weeklyOverride?.occPct ?? occOverride ?? cur?.occPct ?? null;
  const adr    = weeklyOverride?.adr    ?? cur?.adr    ?? null;
  const revPar = weeklyOverride?.revPar ?? cur?.revPar ?? null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      <KpiCard label="Occupancy" thaiPill="ห้องพักที่ขายได้"  value={occ}    suffix="%" glyph="Occ"
        mom={pctDelta(occ,    prevMonth?.occPct ?? null)} yoy={pctDelta(occ,    prevYear?.occPct ?? null)} />
      <KpiCard label="ADR"       thaiPill="ราคาเฉลี่ย/คืน"   value={adr}    prefix="฿" glyph="ADR"
        mom={pctDelta(adr,    prevMonth?.adr    ?? null)} yoy={pctDelta(adr,    prevYear?.adr    ?? null)} />
      <KpiCard label="RevPAR"    thaiPill="รายได้/ห้องว่าง"  value={revPar} prefix="฿" glyph="RevPAR"
        mom={pctDelta(revPar, prevMonth?.revPar ?? null)} yoy={pctDelta(revPar, prevYear?.revPar ?? null)} />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/KpiCards.tsx
git commit -m "feat: redesign KPI cards with Manrope numbers + glyph watermark"
```

---

## Task 6: TrendChart — colour update + SectionCard wrapper

**Files:**
- Modify: `src/ui/components/TrendChart.tsx`

- [ ] **Step 1: Replace TrendChart.tsx**

```tsx
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { YearlyReport } from '../../types';
import SectionCard, { SectionHead } from './SectionCard';

const MONTH_ABBR = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

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
    <SectionCard>
      <SectionHead
        title="แนวโน้ม"
        italic="รายเดือน"
        meta="สีเข้ม = actual · สีอ่อน = จองล่วงหน้า"
      />
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={rows}>
          <XAxis dataKey="name" fontSize={11} fontFamily="'Manrope', sans-serif" tick={{ fill: 'var(--muted)' }} />
          <YAxis yAxisId="occ" fontSize={11} fontFamily="'Manrope', sans-serif" tick={{ fill: 'var(--muted)' }} unit="%" domain={[0, 100]} width={38} />
          <YAxis yAxisId="adr" orientation="right" fontSize={11} fontFamily="'Manrope', sans-serif" tick={{ fill: 'var(--muted)' }} width={52} />
          <Tooltip />
          <Bar yAxisId="occ" dataKey="occ" name="Occ%">
            {rows.map((r, i) => <Cell key={i} fill={r.isActual ? '#103A34' : '#B6C2C6'} />)}
          </Bar>
          <Line yAxisId="adr" type="monotone" dataKey="adr" name="ADR ฿"
            stroke="#C56A45" strokeWidth={2.2}
            dot={{ fill: '#fff', stroke: '#C56A45', strokeWidth: 2, r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </SectionCard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/components/TrendChart.tsx
git commit -m "feat: update TrendChart colours + SectionCard wrapper"
```

---

## Task 7: ForecastSection — alt card, stat strip, new colours

**Files:**
- Modify: `src/ui/components/ForecastSection.tsx`

- [ ] **Step 1: Replace ForecastSection.tsx**

```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import type { YearlyReport } from '../../types';
import SectionCard, { SectionHead } from './SectionCard';

const MONTH_ABBR = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

function fmt(n: number | null, suffix = '') {
  if (n == null) return '–';
  return n.toLocaleString('en-US', { maximumFractionDigits: suffix === '%' ? 1 : 0 }) + suffix;
}

const FILL: Record<string, string> = { actual: '#103A34', current: '#C56A45', booked: '#B6C2C6' };
const LEGEND: [string, string][] = [['#103A34','Actual'],['#C56A45','เดือนปัจจุบัน'],['#B6C2C6','On-the-books']];

export default function ForecastSection({ yearly, dataAsOf }: { yearly?: YearlyReport; dataAsOf: string }) {
  if (!yearly) return null;

  const currentMonth = Number(dataAsOf.slice(5, 7));
  const rows = yearly.months.map((m) => ({
    name: MONTH_ABBR[m.monthIndex - 1],
    occ: m.occPct ?? 0,
    status: m.monthIndex < currentMonth ? 'actual' : m.monthIndex === currentMonth ? 'current' : 'booked',
  }));

  const totalNights  = yearly.months.reduce((s, m) => s + (m.nightSold ?? 0), 0);
  const totalRooms   = yearly.months.reduce((s, m) => s + (m.availableRooms ?? 0), 0);
  const totalRevenue = yearly.months.reduce((s, m) => s + (m.roomCharges ?? 0), 0);
  const expectedOcc  = totalRooms > 0 ? (totalNights / totalRooms) * 100 : null;
  const expectedADR  = totalNights > 0 ? totalRevenue / totalNights : null;

  const stats = [
    { label: 'Occ% คาด (ทั้งปี)', value: fmt(expectedOcc, '%') },
    { label: 'ADR คาด (ทั้งปี)',   value: '฿' + fmt(expectedADR) },
    { label: 'Revenue คาด (ทั้งปี)', value: '฿' + fmt(totalRevenue > 0 ? totalRevenue : null) },
  ];

  return (
    <SectionCard alt>
      <SectionHead
        title="คาดการณ์"
        italic={` ทั้งปี ${yearly.year}`}
        meta={`actual + on-the-books · จาก eZee · ข้อมูล ณ ${dataAsOf}`}
      />

      {/* Stat strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ background: 'var(--card)', borderRadius: 16, padding: '14px 16px', border: '1px solid var(--line)' }}>
            <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1.4px' }}>{s.label}</div>
            <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 30, lineHeight: 1, letterSpacing: '-1px', color: 'var(--ink)', marginTop: 6 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={rows} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <XAxis dataKey="name" fontSize={11} fontFamily="'Manrope', sans-serif" tick={{ fill: 'var(--muted)' }} />
          <YAxis fontSize={11} fontFamily="'Manrope', sans-serif" tick={{ fill: 'var(--muted)' }} unit="%" domain={[0, 100]} width={36} />
          <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'Occ%']} />
          <Bar dataKey="occ" name="Occ%">
            {rows.map((r, i) => <Cell key={i} fill={FILL[r.status]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
        {LEGEND.map(([col, label]) => (
          <span key={label} style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11.5, color: 'var(--muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: col }} />
            {label}
          </span>
        ))}
      </div>
    </SectionCard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/components/ForecastSection.tsx
git commit -m "feat: reskin ForecastSection with stat strip + alt card + new colours"
```

---

## Task 8: ForwardPace — colour update + SectionCard

**Files:**
- Modify: `src/ui/components/ForwardPace.tsx`

- [ ] **Step 1: Replace ForwardPace.tsx**

```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import type { Snapshot } from '../../types';
import { villaCount } from '../../metrics/capacity';
import { dailyOccupancy } from '../../metrics/pace';
import SectionCard, { SectionHead } from './SectionCard';

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
    <SectionCard>
      <SectionHead
        title="Occupancy "
        italic={`ล่วงหน้า ${daysAhead} วัน`}
        meta={`จาก Arrival List · ${capacity} villa`}
      />
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={daily}>
          <XAxis dataKey="name" fontSize={11} fontFamily="'Manrope', sans-serif" tick={{ fill: 'var(--muted)' }}
            interval={Math.max(0, Math.floor(daily.length / 15))} />
          <YAxis fontSize={11} fontFamily="'Manrope', sans-serif" tick={{ fill: 'var(--muted)' }} unit="%" domain={[0, 100]} />
          <Tooltip />
          <Bar dataKey="occ" name="Occ%">
            {daily.map((d, i) => <Cell key={i} fill={d.occ === 0 ? '#E3E7E9' : '#5481A6'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </SectionCard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/components/ForwardPace.tsx
git commit -m "feat: reskin ForwardPace with new bar colours + SectionCard"
```

---

## Task 9: MixPanels — channel + country reskin

**Files:**
- Modify: `src/ui/components/MixPanels.tsx`

- [ ] **Step 1: Replace MixPanels.tsx**

```tsx
import type { ChannelReport, CountryReport } from '../../types';
import SectionCard, { SectionHead } from './SectionCard';

function barPct(value: number, max: number): string {
  return max > 0 ? `${Math.round((value / max) * 100)}%` : '0%';
}

const CHAN_COLORS = ['#103A34', '#C56A45', '#1E6E62', '#5481A6'];
const CHAN_GRAD_END = ['#1E6E62', '#E2A95B', '#2E8576', '#7AAEC8'];

export default function MixPanels({
  channels, countries,
}: { channels?: ChannelReport; countries?: CountryReport }) {
  const chanRows = (channels?.rows ?? []).filter((r) => (r.roomSold ?? 0) > 0);
  const maxChan = Math.max(1, ...chanRows.map((r) => r.revenue ?? 0));

  const countryRows = (countries?.rows ?? [])
    .filter((r) => r.country !== '-- N/A --')
    .slice(0, 8);
  const maxCountry = Math.max(1, ...countryRows.map((r) => r.revenue ?? 0));
  const totalRev = countryRows.reduce((s, r) => s + (r.revenue ?? 0), 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.05fr', gap: 16 }}>

      {/* Channels */}
      <SectionCard>
        <SectionHead title="สัดส่วน" italic=" ช่องทาง" meta={`${chanRows.length} ช่องทางหลัก`} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {chanRows.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>— ไม่มีข้อมูล</p>
          ) : chanRows.map((r, idx) => {
            const color = CHAN_COLORS[idx % CHAN_COLORS.length];
            const gradEnd = CHAN_GRAD_END[idx % CHAN_GRAD_END.length];
            const initials = r.source.slice(0, 2).toUpperCase();
            return (
              <div key={r.source} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 30, height: 30, borderRadius: 9, background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                      {initials}
                    </span>
                    <span style={{ fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{r.source}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: "'Manrope', sans-serif" }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)' }}>{r.revPct?.toFixed(0) ?? '–'}%</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
                      ADR <b style={{ color: 'var(--ink)', fontWeight: 700 }}>฿{r.adr?.toLocaleString('en-US', { maximumFractionDigits: 0 }) ?? '–'}</b>
                    </span>
                  </div>
                </div>
                <div style={{ height: 10, borderRadius: 6, background: 'var(--card-2)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 6, width: barPct(r.revenue ?? 0, maxChan), background: `linear-gradient(90deg, ${color}, ${gradEnd})` }} />
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Countries */}
      <SectionCard>
        <SectionHead
          title="ตลาดตามสัญชาติ "
          italic="(Top 8)"
          meta="เรียงตาม revenue"
          right={totalRev > 0
            ? <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>
                รวม <b style={{ color: 'var(--ink)', fontWeight: 700 }}>฿{totalRev.toLocaleString('en-US', { maximumFractionDigits: 0 })}</b>
              </span>
            : undefined}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {countryRows.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>— ไม่มีข้อมูล</p>
          ) : countryRows.map((r) => (
            <div key={r.country} style={{ display: 'grid', gridTemplateColumns: '1fr 90px', alignItems: 'center', gap: 12, padding: '5px 0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <span style={{ fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif", fontSize: 13, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.country}</span>
                <div style={{ height: 6, borderRadius: 4, background: 'var(--card-2)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 4, width: barPct(r.revenue ?? 0, maxCountry), background: 'linear-gradient(90deg, #103A34, #1E6E62)' }} />
                </div>
              </div>
              <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 13, color: 'var(--ink)', textAlign: 'right', letterSpacing: '-.3px' }}>
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>฿</span>
                {r.revenue?.toLocaleString('en-US', { maximumFractionDigits: 0 }) ?? '–'}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/components/MixPanels.tsx
git commit -m "feat: reskin MixPanels — dot avatars, gradient bars, country revenue"
```

---

## Task 10: Recommendations — two-column gradient card

**Files:**
- Modify: `src/ui/components/Recommendations.tsx`

- [ ] **Step 1: Replace Recommendations.tsx**

```tsx
import { useState } from 'react';
import type { Snapshot } from '../../types';
import { recommend } from '../../recommendations/rules';
import { buildRecoInputs } from '../buildRecoInputs';
import { aiInsight } from '../../lib/api';

function highlightNums(text: string): React.ReactNode {
  return text.split(/(\d[\d,.%฿]*)/).map((part, i) =>
    /\d/.test(part)
      ? <span key={i} style={{ color: 'var(--gold)', fontWeight: 800 }}>{part}</span>
      : part
  );
}

function highlightNumsAccent(text: string): React.ReactNode {
  return text.split(/(\d[\d,.%฿]*)/).map((part, i) =>
    /\d/.test(part)
      ? <b key={i} style={{ fontWeight: 700, color: 'var(--accent-2)' }}>{part}</b>
      : part
  );
}

export default function Recommendations({
  latest, previous,
}: { latest: Snapshot; previous: Snapshot | null }) {
  const [aiText, setAiText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inputs = buildRecoInputs(latest, previous, undefined);
  const recos = inputs.flatMap((i) => recommend(i));
  const topReco = recos[0] ?? null;

  const currentMonth = new Date().toLocaleString('th-TH', { month: 'long' });

  async function askAi() {
    setBusy(true);
    const context = JSON.stringify({ recoInputs: inputs, rules: recos }, null, 2);
    try { setAiText(await aiInsight(context)); }
    catch { setAiText('เรียก AI ไม่สำเร็จ — ตรวจการตั้งค่า API key'); }
    setBusy(false);
  }

  return (
    <div style={{ borderRadius: 22, overflow: 'hidden', display: 'grid', gridTemplateColumns: '1.4fr 1fr' }}>

      {/* Left: green gradient */}
      <div style={{ background: 'linear-gradient(140deg, #2E8576, #11463E)', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '1.8px', textTransform: 'uppercase', color: 'rgba(255,255,255,.6)' }}>
          คำแนะนำการปรับราคา · {currentMonth}
        </span>

        <div style={{ fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif", fontSize: 19, fontWeight: 800, lineHeight: 1.45, color: '#fff' }}>
          {topReco ? highlightNums(topReco.message) : 'ยังไม่มีสัญญาณที่ต้องดำเนินการ'}
        </div>

        {recos.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {recos.slice(0, 4).map((r, i) => {
              const isWarn = r.level === 'red' || r.level === 'orange';
              return (
                <span key={i} style={{ fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif", fontSize: 12, fontWeight: 600, background: isWarn ? 'rgba(226,169,91,.22)' : 'rgba(255,255,255,.14)', color: isWarn ? 'var(--gold)' : '#fff', padding: '5px 11px', borderRadius: 8 }}>
                  {r.evidence.slice(0, 45)}
                </span>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={askAi} disabled={busy} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 11, padding: '9px 16px', fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif", fontSize: 12, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? .7 : 1 }}>
            {busy ? 'กำลังถาม AI…' : '✨ ถาม AI'}
          </button>
          <button style={{ background: 'rgba(255,255,255,.15)', color: '#fff', border: 'none', borderRadius: 11, padding: '9px 16px', fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif", fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            ดูทั้งหมด
          </button>
        </div>
      </div>

      {/* Right: accent-soft */}
      <div style={{ background: '#F6DCCB', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '1.8px', textTransform: 'uppercase', color: 'rgba(58,30,18,.5)' }}>
          สัญญาณที่ตรวจพบ
        </span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
          {recos.length === 0 ? (
            <p style={{ color: 'rgba(58,30,18,.5)', fontSize: 13 }}>— ยังไม่มีสัญญาณ</p>
          ) : recos.slice(0, 3).map((r, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,.65)', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, fontWeight: 500, color: '#3A1E12', display: 'flex', alignItems: 'flex-start', gap: 9, border: '1px solid rgba(58,30,18,.07)', lineHeight: 1.5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: r.level === 'green' ? 'var(--primary)' : 'var(--accent)', flexShrink: 0, marginTop: 5 }} />
              <span>{highlightNumsAccent(r.message)}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 'auto', background: '#fff', borderRadius: 12, padding: '8px 8px 8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          {aiText ? (
            <span style={{ flex: 1, fontSize: 12, color: '#3A1E12', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{aiText}</span>
          ) : (
            <input placeholder="พิมพ์คำถามถึง Yim AI…" style={{ flex: 1, border: 'none', background: 'transparent', fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif", fontSize: 12.5, color: 'var(--ink)', outline: 'none' }} />
          )}
          <button onClick={askAi} disabled={busy} style={{ background: 'var(--shell-1)', color: '#fff', border: 'none', borderRadius: 9, padding: '7px 12px', fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif", fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', opacity: busy ? .7 : 1 }}>
            ถาม AI
          </button>
        </div>
      </div>

    </div>
  );
}
```

- [ ] **Step 2: Verify build + all tests still pass**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: no errors, 67 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/Recommendations.tsx
git commit -m "feat: reskin Recommendations as two-column gradient card"
```

---

## Task 11: Favicon — branded Y lettermark

**Files:**
- Create: `scripts/gen-favicon.mjs`
- Replace: `public/favicon.ico`, `public/favicon-16x16.png`, `public/favicon-32x32.png`, `public/apple-touch-icon.png`, `public/android-chrome-192x192.png`, `public/android-chrome-512x512.png`
- Modify: `public/site.webmanifest`

- [ ] **Step 1: Install generation dependencies**

```bash
npm install --save-dev sharp png-to-ico
```

Expected: both packages added to `devDependencies` in `package.json`.

- [ ] **Step 2: Create scripts/gen-favicon.mjs**

```js
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { writeFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pub = (f) => resolve(__dirname, '../public', f);

// SVG brandmark: terracotta rounded-rect + white Y in serif
function svg(size) {
  const r = Math.round(size * 0.22);
  const fs = Math.round(size * 0.56);
  const cy = Math.round(size * 0.62);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="#C56A45"/>
  <text x="${size/2}" y="${cy}"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="${fs}" font-weight="700"
    text-anchor="middle" fill="white">Y</text>
</svg>`;
}

const SIZES = [
  { size: 16,  file: 'favicon-16x16.png' },
  { size: 32,  file: 'favicon-32x32.png' },
  { size: 180, file: 'apple-touch-icon.png' },
  { size: 192, file: 'android-chrome-192x192.png' },
  { size: 512, file: 'android-chrome-512x512.png' },
];

for (const { size, file } of SIZES) {
  await sharp(Buffer.from(svg(size))).resize(size, size).png().toFile(pub(file));
  console.log(`✓ ${file}`);
}

// favicon.ico from 16 + 32
const buf16 = await sharp(Buffer.from(svg(16))).resize(16,16).png().toBuffer();
const buf32 = await sharp(Buffer.from(svg(32))).resize(32,32).png().toBuffer();
const ico = await pngToIco([buf16, buf32]);
writeFileSync(pub('favicon.ico'), ico);
console.log('✓ favicon.ico');
```

- [ ] **Step 3: Run the generator**

```bash
node scripts/gen-favicon.mjs
```

Expected output:
```
✓ favicon-16x16.png
✓ favicon-32x32.png
✓ apple-touch-icon.png
✓ android-chrome-192x192.png
✓ android-chrome-512x512.png
✓ favicon.ico
```

- [ ] **Step 4: Update site.webmanifest**

Replace `public/site.webmanifest` content:

```json
{
  "name": "Casa de Yim",
  "short_name": "Casa de Yim",
  "icons": [
    { "src": "/android-chrome-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/android-chrome-512x512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "theme_color": "#103A34",
  "background_color": "#E7DFD2",
  "display": "standalone"
}
```

- [ ] **Step 5: Commit**

```bash
git add scripts/gen-favicon.mjs public/ package.json package-lock.json
git commit -m "feat: branded Y lettermark favicon (terracotta + serif)"
```

---

## Task 12: Build verification + deploy

- [ ] **Step 1: Full build check**

```bash
npm run build 2>&1 | tail -10
```

Expected: `✓ built in` with no errors.

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: 67 tests pass.

- [ ] **Step 3: Push + deploy**

```bash
git push && npx netlify deploy --build --prod 2>&1 | tail -8
```

Expected: `Deploy is live!` with production URL `https://casa-de-yim-dashboard.netlify.app`.

---

## Self-Review

**Spec coverage:**
- ✅ Google Fonts (Cormorant Garamond, Manrope, Noto Sans Thai) — Task 1
- ✅ CSS custom properties (all 13 tokens) — Task 1
- ✅ Tailwind theme extension — Task 1
- ✅ Dark header + cream panel — Task 3
- ✅ Page head with serif h1 + period name — Task 3
- ✅ Period chips reskin — Task 4
- ✅ KPI cards: 50px numbers, glyph watermark, Thai pill, dashed delta row — Task 5
- ✅ SectionCard shared wrapper + SectionHead — Task 2
- ✅ TrendChart colours (shell-1 / #B6C2C6 / accent) — Task 6
- ✅ ForecastSection: alt card, stat strip, new colours — Task 7
- ✅ ForwardPace: #5481A6 / #E3E7E9 — Task 8
- ✅ MixPanels: dot avatars, gradient bars — Task 9
- ✅ Recommendations: two-column gradient, Noto/Manrope only, gold numerals, accent-2 rule bold — Task 10
- ✅ Favicon: Y lettermark, terracotta, all 6 sizes — Task 11
- ✅ AuthGate/LoginPage/UploadPage untouched (out of scope)

**Type consistency:** `SectionCard` and `SectionHead` are defined in Task 2 and imported in Tasks 6–9. Props (`alt?`, `title`, `italic?`, `meta?`, `right?`) are consistent across all usages.
