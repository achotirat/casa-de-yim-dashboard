# Casa de Yim Revenue Dashboard

เว็บแอปดูสถานะ Occupancy/ADR/RevPAR ของ Casa de Yim Pool Villa (กระบี่)  
Upload รายงาน eZee รายวัน → dashboard แสดง KPI, booking pace, และคำแนะนำการปรับราคา (กฎ + AI)

## SOP — Export eZee รายวัน

แนะนำดึงทุกวันเวลา 6 โมงเช้า

| # | รายงาน | Date From → To | หมายเหตุ |
|---|--------|----------------|---------|
| 1 | Yearly Statistics | Year = ปีปัจจุบัน (2026) | ทุกวัน |
| 2 | Yearly Statistics | Year = ปีก่อน (2025) | ครั้งเดียว (baseline YoY) |
| 3 | Contribution Analysis | 1/1/ปีปัจจุบัน → วันนี้ | ทุกวัน |
| 3b | Contribution Analysis | เดือนที่ผ่านมา (1–สิ้นเดือน) | ทุกวัน |
| 4 | Country Wise | 1/1/ปีปัจจุบัน → วันนี้ | ทุกวัน |
| 4b | Country Wise | เดือนที่ผ่านมา | ทุกวัน |
| 5 | Arrival List | วันนี้ → +2 เดือน | ทุกวัน |

Export เป็น HTML แล้วอัปโหลดในหน้า "อัปโหลด" ของ dashboard

## การ Deploy บน Netlify

```bash
# 1. สร้างและ link site
npx netlify init

# 2. ตั้ง environment variables
npx netlify env:set DASHBOARD_PASSWORD "<รหัสผ่านที่ต้องการ>"
npx netlify env:set AUTH_SECRET "$(openssl rand -hex 32)"
npx netlify env:set ANTHROPIC_API_KEY "<sk-ant-...>"

# 3. Deploy
npx netlify deploy --build --prod
```

## Environment Variables

| ตัวแปร | คำอธิบาย |
|--------|---------|
| `DASHBOARD_PASSWORD` | รหัสผ่านสำหรับเข้าใช้งาน dashboard |
| `AUTH_SECRET` | Random hex 32 bytes สำหรับ HMAC sign cookie |
| `ANTHROPIC_API_KEY` | API key ของ Anthropic (สำหรับปุ่ม "ถาม AI") |

## Local Development

```bash
# สร้างไฟล์ .env
cp .env.example .env  # แล้วแก้ค่าให้ถูก

# รัน Netlify Dev (จำลอง Functions + Blobs)
npx netlify dev
# เปิด http://localhost:8888
```

## โครงสร้างโมดูล

```
src/
  types.ts          — shared data model (Snapshot, MonthRow, ...)
  parser/           — HTML → typed object (pure functions, TDD)
    num.ts          — parseNum, parsePax
    date.ts         — parseDate (dd/mm/yyyy → ISO)
    rows.ts         — extractRows, plainText (DOMParser)
    detect.ts       — detectReportType, extractDataAsOf
    yearly.ts       — Yearly Statistics parser
    channel.ts      — Contribution Analysis parser
    country.ts      — Country Wise parser
    arrivals.ts     — Arrival List parser
    index.ts        — parseFile dispatcher
  metrics/
    capacity.ts     — villaCount (derive from availableRooms)
    kpi.ts          — monthByIndex, pctDelta
    pace.ts         — comparePace, dailyOccupancy
  recommendations/
    rules.ts        — recommend() → Reco[] (deterministic rules)
  lib/
    api.ts          — fetch wrappers (login, snapshots, AI)
  ui/
    App.tsx         — shell + nav + AuthGate
    AuthGate.tsx    — cookie-based auth check
    LoginPage.tsx   — password form
    UploadPage.tsx  — file upload + buildSnapshot + save
    Dashboard.tsx   — main dashboard view
    buildSnapshot.ts — merge HTML files → Snapshot
    buildRecoInputs.ts — compute RecoInput from snapshot
    components/
      PeriodToggle.tsx — เดือนที่ผ่านมา/สัปดาห์/เดือนหน้า/2สัปดาห์
      KpiCards.tsx    — Occ%/ADR/RevPAR + MoM/YoY delta
      TrendChart.tsx  — แนวโน้มรายเดือน (Recharts)
      ForwardPace.tsx — daily occ ล่วงหน้า 60/14 วัน
      MixPanels.tsx   — channel mix + country mix
      Recommendations.tsx — กฎคำแนะนำ + ปุ่ม "ถาม AI"
netlify/
  functions/
    _auth.ts        — signToken, verifyToken, isAuthed
    auth.ts         — POST /api/auth → signed cookie
    snapshots.ts    — GET/POST /api/snapshots (Netlify Blobs)
    ai-insight.ts   — POST /api/ai-insight → Claude API
```

## Stack

Vite · React · TypeScript · Tailwind CSS · Recharts  
Vitest · @testing-library/react  
Netlify Functions · Netlify Blobs · Anthropic SDK
