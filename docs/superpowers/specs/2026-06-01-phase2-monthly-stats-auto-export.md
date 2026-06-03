# Casa de Yim Phase 2 — Monthly Statistics + Auto-Export (Design Spec)

วันที่: 2026-06-01  
สถานะ: รออนุมัติ

## 1. เป้าหมาย

- เพิ่ม parser สำหรับ **Monthly Statistics** (รายงานรายวัน) เพื่อให้ "สัปดาห์ที่ผ่านมา" แสดง KPI จริง
- สร้าง **Playwright script** รันบน Mac ทุกวันอาทิตย์ 05:00 น. — login eZee → export 8 reports → upload ไปที่ Netlify dashboard อัตโนมัติ โดยไม่ต้องแตะ dashboard เลย

## 2. การตัดสินใจหลัก

| ประเด็น | ตัดสินใจ |
|--------|---------|
| Run location | Mac เครื่องตัวเอง (Playwright + cron) |
| Schedule | ทุกวันอาทิตย์ 05:00 น. |
| หลัง export | Upload อัตโนมัติไปที่ Netlify API เลย |
| Monthly Stats กี่เดือน | 2 เดือน: เดือนปัจจุบัน + เดือนก่อน (รองรับสัปดาห์ข้ามเดือน) |
| eZee URL | https://live.ipms247.com/login/ |
| eZee auth | Property Code + Username + Password (ไม่มี 2FA) |

## 3. Data Model

เพิ่มใน `src/types.ts`:

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

`Snapshot` เพิ่ม 1 field:
```ts
monthly?: MonthlyReport[];   // สูงสุด 2 เดือน sorted oldest-first
```

Blob key ยังเป็น `snapshot/{dataAsOf}` เหมือนเดิม

## 4. Parser: Monthly Statistics

**Files:**
- Create: `src/parser/monthly.ts`
- Modify: `src/parser/detect.ts` (เพิ่ม 'monthly' ใน ReportType)
- Modify: `src/parser/index.ts` (เพิ่ม case)
- Modify: `src/ui/buildSnapshot.ts` (push เข้า array แทน assign)
- Test: `tests/parser/monthly.test.ts`
- Fixture: `tests/fixtures/monthly.html` (copy จาก /Users/temtem/Downloads/Report (13).html)

**Detection:** body text มี `Monthly Statistics`

**Header parsing:** `"Month May,2026 Show Unposted..."` → month=5, year=2026

**Data row detection:** `cells[0]` match `/^\d{1,2} \w{3}$/` (เช่น "1 Fri", "15 Mon")

**Column order** (เหมือน Yearly Stats):
```
[0] date label  [1] availableRooms  [2] nightSold  [3] complimentary
[4] occ%  [5] adr  [6] revPar  [7] pax  [8] roomCharges  ...
```

**Multi-page:** skip rows ที่ `cells[0]` เป็น header ซ้ำ ("Date") — ใช้ pattern เดิมจาก country parser

**buildSnapshot รองรับ multi-monthly:**
```ts
case 'monthly': {
  const rep = result.data as MonthlyReport;
  const arr = snapshot.monthly ?? [];
  // replace ถ้ามีเดือนเดียวกันอยู่แล้ว, ไม่งั้น push
  const idx = arr.findIndex(m => m.month === rep.month && m.year === rep.year);
  if (idx >= 0) arr[idx] = rep; else arr.push(rep);
  snapshot.monthly = arr.sort((a, b) => a.year*12+a.month - (b.year*12+b.month));
  break;
}
```

**Known values จาก fixture (Report 13 — May 2026):**
- 1 Fri: occ=100%, adr=6784.07, rooms=4
- 4 Mon: occ=0%, adr=0 (ว่าง)
- Multi-page (page 1 of 2)

## 5. Metrics: Weekly KPI

**File:** `src/metrics/weekly.ts`

```ts
export interface WeeklyKpi {
  occPct: number | null;    // mean daily occ%
  adr: number | null;       // totalRevenue / totalNights
  revPar: number | null;    // totalRevenue / totalAvailRoomNights
  revenue: number | null;
  nights: number;
  daysWithData: number;
}

export function weeklyKpi(
  monthly: MonthlyReport[] | undefined,
  asOf: string,
  lookbackDays = 7
): WeeklyKpi | null
```

- Filter DayRows ที่ `date ∈ [addDays(asOf, -lookbackDays), asOf)` (exclusive endpoint)
- คืน null ถ้าไม่มีข้อมูลเลย

## 6. UI Changes

### 6.1 Period Toggle

"สัปดาห์ที่ผ่านมา" กลับมา แต่มีเงื่อนไข:
- ถ้า `snapshot.monthly` มีข้อมูล → แสดง tab
- ถ้าไม่มี → ซ่อน tab (ไม่แสดงเลย)

Tab order: เดือนนี้ · 2 สัปดาห์หน้า · เดือนหน้า · เดือนที่ผ่านมา · สัปดาห์ที่ผ่านมา (conditional)

### 6.2 KpiCards

เมื่อ period === 'lastWeek':
- ดึงจาก `weeklyKpi(snapshot.monthly, dataAsOf)` แทน monthly aggregate
- ForwardPace ซ่อน (ไม่ใช่ forward-looking)

### 6.3 Period type

```ts
export type Period = 'thisMonth' | 'next2Weeks' | 'nextMonth' | 'lastMonth' | 'lastWeek';
```

`lastWeek` แสดงเฉพาะเมื่อ `snapshot.monthly` มีข้อมูล

## 7. Playwright Auto-Export Script

### 7.1 Files

```
scripts/
  ezee-export.ts          # main script
  ezee-export-config.ts   # report list + date range helpers
  setup-cron.sh           # ติดตั้ง cron + สร้าง log dir
```

### 7.2 Environment Variables (เพิ่มใน .env)

```
EZEE_PROPERTY_CODE=xxx
EZEE_USERNAME=xxx
EZEE_PASSWORD=xxx
DASHBOARD_URL=https://casa-de-yim-dashboard.netlify.app
DASHBOARD_PASSWORD=CasaDeYim683279d0!!
```

### 7.3 Reports ที่ export (ตาม SOP)

| # | Report | Date Range | Notes |
|---|--------|-----------|-------|
| 1 | Yearly Statistics | Year = ปีปัจจุบัน | |
| 2 | Contribution Analysis | 1/1/ปี → วันนี้ | YTD |
| 3 | Contribution Analysis | เดือนก่อน (1–สิ้นเดือน) | monthly |
| 4 | Country Wise | 1/1/ปี → วันนี้ | YTD |
| 5 | Country Wise | เดือนก่อน | monthly |
| 6 | Arrival List | วันนี้ → +2 เดือน | |
| 7 | Monthly Statistics | เดือนปัจจุบัน (1–วันนี้) | |
| 8 | Monthly Statistics | เดือนก่อน (1–สิ้นเดือน) | |

### 7.4 Script Flow

```
1. launch Chromium (headless=true, --headed flag สำหรับ debug)
2. navigate live.ipms247.com/login/
3. fill Property Code, Username, Password → submit
4. for each report in config:
   a. navigate to report section
   b. set date range
   c. click Export/Generate HTML
   d. read page HTML content
   e. log success/skip on error (ไม่ abort)
5. POST DASHBOARD_URL/api/auth {password} → cookie
6. parse all HTMLs → merge into Snapshot
7. POST DASHBOARD_URL/api/snapshots {key, snapshot} with cookie
8. macOS notification (success/fail)
9. write log entry to ~/logs/ezee-export.log
```

### 7.5 Run Modes

```bash
npx tsx scripts/ezee-export.ts            # headless (cron)
npx tsx scripts/ezee-export.ts --headed   # headed (debug)
npx tsx scripts/ezee-export.ts --dry-run  # parse only ไม่ upload
```

### 7.6 Error Handling

- Report ไหน fail (timeout/selector ไม่เจอ) → log warning + ข้ามต่อ
- ถ้าทุก report fail → log error + notification แต่ไม่ crash
- ถ้า upload fail → retry 1 ครั้ง แล้ว log error

### 7.7 Dependencies

เพิ่มใน `package.json` devDependencies:
- `playwright` (Chromium bundled)
- `tsx` (already installed via `vitest`)

## 8. Cron Setup

```bash
# scripts/setup-cron.sh
mkdir -p ~/logs
(crontab -l 2>/dev/null; echo "0 5 * * 0 cd /Users/temtem/projects/casa-de-yim-dashboard && npx tsx scripts/ezee-export.ts >> ~/logs/ezee-export.log 2>&1") | crontab -
```

## 9. Testing Strategy

- **Monthly parser:** TDD ด้วย Report (13).html fixture — ยืนยัน "1 Fri" occ=100%, adr=6784.07, multi-page merge
- **Weekly KPI:** unit test กับ mock DayRow[] — ยืนยัน mean occ%, weighted ADR
- **Playwright:** ไม่มี automated test (ขึ้นอยู่กับ eZee UI) — ทดสอบ manual ด้วย `--headed` ครั้งแรก
- **buildSnapshot:** เพิ่ม test ว่า monthly array merge ถูกต้อง (2 files = 2 entries, same month = replace)

## 10. Scope ที่ไม่รวม

- Playwright test automation สำหรับ eZee UI
- Retry logic แบบ exponential backoff
- Email notification (ใช้ macOS notification แทน)
- GitHub Actions / cloud execution
- Competitor analysis (Phase 3)
