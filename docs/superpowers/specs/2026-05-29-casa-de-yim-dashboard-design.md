# Casa de Yim — Revenue Dashboard (Design Spec)

วันที่: 2026-05-29
สถานะ: รออนุมัติ (user review)

## 1. เป้าหมาย

Dashboard เว็บแอปสำหรับดูสถานะล่าสุดของ Casa de Yim Pool Villa (บริษัท ยิ้มกระบี่ จำกัด)
โดยอัปโหลดรายงานที่ export จาก eZee เป็นรายสัปดาห์ เพื่อ:

- ดู **%Occupancy, ADR, RevPAR** และตัวชี้วัดอื่น ของเดือน/สัปดาห์ที่ผ่านมา และเดือนหน้า/2 สัปดาห์หน้า
- ติดตาม **booking pace** (ความเร็วในการเติมห้องล่วงหน้า) จากการเก็บประวัติรายสัปดาห์
- แสดง **คำแนะนำการปรับราคา/โปรโมชั่น** จากกฎคำนวณ + สรุปเป็นภาษาโดย AI (Claude)

**Out of scope (Phase 2):** competitor analysis, auto-export จาก eZee, multi-property

## 2. การตัดสินใจหลัก (จาก brainstorming)

| ประเด็น | ตัดสินใจ |
|--------|---------|
| สถาปัตยกรรม | SPA เบา + Netlify Functions + Netlify Blobs (แนวทาง A) |
| การเก็บข้อมูล | เก็บประวัติทุกสัปดาห์ (เพื่อ pace tracking) |
| คำแนะนำราคา | hybrid — กฎคำนวณ (deterministic) + ปุ่ม AI สรุป (Claude) |
| การเข้าถึง | รหัสผ่านเดียว (shared password) |
| Competitor | Phase 2 |
| Auto-export | Phase 2 (v1 อัปโหลดเอง) |
| Layout | แบบ A — หน้าเดียวเลื่อนยาว + toggle ช่วงเวลา |
| Arrival List | ล่วงหน้า 2 เดือน (ไกลกว่านี้ cancel เยอะ) |

## 3. ข้อมูลนำเข้า: รายงาน eZee

ไฟล์ที่ export เป็น HTML (ตาราง) — parser แยกชนิดจากข้อความหัวเรื่อง (`<title>` เป็น "Report" เหมือนกันทุกไฟล์ จึงดูที่หัวตาราง):

| ชนิด | หัวเรื่องที่ตรวจจับ | ข้อมูลที่ใช้ |
|------|-------------------|-----------|
| Yearly | `Yearly Statistics` | รายเดือน: Available Rooms, Night Sold, Occ%, ADR, RevPAR, Pax, Room Charges, Revenue |
| Channel | `Contribution Analysis Report` | ตามช่องทาง: Total Room Sold, Occu%, Pax, Total Revenue, Rev%, ADR |
| Country | `Country Wise Reservation Statistics` | ตามสัญชาติ: Revenue, No of Reservation, No of guests, Nights, Avg/Night |
| Arrivals | `Arrival List` | รายการจองรายตัว: Res.No, Guest, Room, Rate, Arrival, Departure, Pax, Channel, Notes |

### 3.1 คู่มือ Export eZee รายสัปดาห์ (SOP)

ตัวอย่างวันที่ดึง = 29/05/2026 (แนะนำดึงวันเดิมของสัปดาห์ทุกครั้ง เช่นทุกวันศุกร์):

| # | รายงาน | Date From → To | Order By | ความถี่ |
|---|--------|----------------|----------|---------|
| 1 | Yearly Statistics | Year = ปีปัจจุบัน (2026) | — | ทุกสัปดาห์ |
| 2 | Yearly Statistics | Year = ปีก่อน (2025) | — | ครั้งเดียว (baseline YoY/seasonality) |
| 3 | Contribution Analysis | 1/1/ปีปัจจุบัน → วันนี้ | Business Source | ทุกสัปดาห์ |
| 3b | Contribution Analysis | เฉพาะเดือนที่ผ่านมา (1–สิ้นเดือน) | Business Source | ทุกสัปดาห์ |
| 4 | Country Wise | 1/1/ปีปัจจุบัน → วันนี้ | Arrival date | ทุกสัปดาห์ |
| 4b | Country Wise | เฉพาะเดือนที่ผ่านมา | Arrival date | ทุกสัปดาห์ |
| 5 | Arrival List | วันนี้ → +2 เดือน | Room | ทุกสัปดาห์ |

**หลักการ:**
- มุมมองย้อนหลัง (เดือน/สัปดาห์ที่ผ่านมา) → จาก #1, #3/#3b, #4/#4b (actual)
- มุมมองล่วงหน้า (เดือนหน้า/2 สัปดาห์หน้า) → dashboard คำนวณเองจาก Arrival List (#5) + เดือนอนาคตใน Yearly (#1) ที่เป็น on-the-books

### 3.2 ข้อควรระวังของ Parser (→ test cases)

- ตัวเลขมี comma ใน grand total (`"1,430"`, `"6,606,140.86"`) → strip ก่อนแปลง number
- วันที่ `dd/mm/yyyy` → ISO
- อ่านช่วงวันที่จาก header แต่ละรายงาน เก็บใน snapshot
- แถว `-- N/A --` / `N/A` → ข้าม หรือจัดกลุ่ม "ไม่ระบุ"
- Arrival List 1 การจองมีหลายแถว (note ต่อท้าย) → merge เข้าแถวหลัก

## 4. Data model

```ts
Snapshot {
  uploadedAt: string        // ISO datetime ที่อัปโหลด
  dataAsOf: string          // วันที่ดึง (จาก "Printed By: admin on dd/mm/yyyy")
  yearly?: {
    year: number
    months: MonthRow[]      // {month, availableRooms, nightSold, occPct, adr, revPar, pax, roomCharges, revenue}
    grandTotal: MonthRow
  }
  yearlyPrev?: { ... }      // ปีก่อน (baseline) — โหลดครั้งเดียว เก็บแยก
  channels?: { periodFrom, periodTo, scope: 'ytd'|'month', rows: ChannelRow[], total: ChannelRow }
  countries?: { periodFrom, periodTo, scope: 'ytd'|'month', rows: CountryRow[] }
  arrivals?: { periodFrom, periodTo, rows: ArrivalRow[] }
}
```

**การเก็บใน Netlify Blobs:** key = `snapshot/{dataAsOf}` (เช่น `snapshot/2026-05-29`) — อัปโหลดซ้ำวันเดิมทับได้
Baseline ปีก่อน เก็บ key แยก `baseline/{year}` (ไม่เปลี่ยนบ่อย)

## 5. สถาปัตยกรรมและ data flow

```
เบราว์เซอร์ (React/Vite SPA)
  Login → /auth (เช็ครหัส set signed cookie)
  Upload → ลาก eZee HTML → parser (DOMParser, client-side) → Snapshot
  Dashboard → กราฟ + KPI + คำแนะนำ
        │ POST snapshot           │ POST /ai-insight
        ▼                         ▼
  Netlify Function /snapshots   Netlify Function /ai-insight
   save / list / get             เรียก Claude API (key ใน env)
        │
   Netlify Blobs (JSON รายสัปดาห์)
```

### โครงโมดูล (แต่ละชิ้นทดสอบแยกได้)
- `parser/` — HTML string → typed object (pure)
- `metrics/` — รวม snapshot, คำนวณ pace/trend/derived
- `recommendations/` — กฎคำแนะนำราคา (pure)
- `ui/` — หน้าจอ React (layout แบบ A)
- `functions/` — Netlify Functions: `auth`, `snapshots`, `ai-insight`

## 6. หน้าจอ (Layout A — หน้าเดียวเลื่อนยาว)

ลำดับจากบนลงล่าง:
1. **Toggle ช่วงเวลา:** เดือนที่ผ่านมา · สัปดาห์ที่ผ่านมา · เดือนหน้า · 2 สัปดาห์หน้า
2. **KPI cards:** Occupancy %, ADR, RevPAR — พร้อม delta เทียบเดือนก่อน และเทียบปีก่อน (YoY)
3. **กราฟแนวโน้มรายเดือนทั้งปี:** Occ/ADR/RevPAR — สีเข้ม = actual, สีอ่อน = on-the-books (จองล่วงหน้า)
4. **Forward pace:** pickup curve รายเดือนล่วงหน้า + occ รายวัน 60 วันข้างหน้า (จาก Arrival List)
5. **Channel mix** (Airbnb/Booking/…) + **Country mix** (สัญชาติลูกค้า)
6. **Recommendations panel:** การ์ดคำแนะนำ (กฎ) + ปุ่ม "ถาม AI"

## 7. Pace tracking

- **รายเดือนล่วงหน้า:** ทุก snapshot เก็บ on-the-books occ% ของเดือนอนาคต → pickup curve เทียบสัปดาห์ต่อสัปดาห์ ("มิ.ย. 25% → 28.6%, +3.6 จุด")
- **รายวันล่วงหน้า 60 วัน:** จาก Arrival List นับห้องที่ถูกจองต่อคืน → occ% รายวัน
- **ตัวหารความจุห้อง:** derive จาก Available Rooms ใน Yearly Stats + config override จำนวน villa (ดูข้อ 11)

## 8. เครื่องมือแนะนำราคา

### 8.1 กฎคำนวณ (deterministic)
สำหรับแต่ละเดือน/ช่วงล่วงหน้า ใช้สัญญาณ: `occ ปัจจุบัน`, `lead time (วันที่เหลือ)`, `pace (เปลี่ยนจากสัปดาห์ก่อน)`, `occ ปีก่อนเดือนเดียวกัน`

| เงื่อนไข | คำแนะนำ |
|---------|---------|
| เหลือ ≤14 วัน & occ <40% | 🔴 ลดราคาแรง / flash deal OTA |
| เหลือ ≤30 วัน & occ <50% & pace <5 จุด/สัปดาห์ | 🟠 ลด 10–15% / โปรนาทีสุดท้าย |
| occ ต่ำกว่าปีก่อน >15 จุด | 🟠 ตามหลังปีก่อนมาก พิจารณาโปร/โฆษณา |
| occ ≥85% & เหลือ >14 วัน | 🟢 ขึ้นราคาได้ 5–10% |
| occ ใกล้/เกินปีก่อน & pace ดี | 🟢 คงราคา หรือทดลองขึ้น |

ค่า threshold เป็นค่าเริ่มต้น — จูนได้ตอนใช้จริง การ์ดแต่ละใบแสดงตัวเลขที่ใช้ตัดสินด้วย

### 8.2 ปุ่มถาม AI (Claude)
- POST metrics + สัญญาณที่คำนวณแล้ว (ไม่ส่ง raw ทั้งก้อน) → Function `/ai-insight` → Claude API
- คืนย่อหน้าสรุปภาษาไทย: จัดลำดับความสำคัญ, ไอเดียโปร (อิงตลาดหลัก เช่น ฝรั่งเศส/โปแลนด์/สิงคโปร์), เตือน seasonality
- ใช้ prompt caching ลดค่าใช้จ่าย
- guardrail: คำแนะนำประกอบ ไม่ปรับราคาอัตโนมัติ — คนตัดสินใจ

## 9. Auth
- รหัสใน env `DASHBOARD_PASSWORD` (ไม่ฝังในโค้ด)
- Login → `/auth` เช็ครหัส → signed httpOnly cookie อายุ ~30 วัน
- ทุก Function ตรวจ cookie ก่อนทำงาน

## 10. Error handling
- Parser คืน `{ ok, data }` หรือ `{ ok:false, reason }` — ไม่ crash ทั้งหน้า
- ไฟล์ผิดชนิด → เตือนชัด ระบุว่าหาหัวตารางอะไรไม่เจอ
- อัปโหลดไม่ครบ → แสดงเท่าที่มี + บอกว่าขาดอะไร และส่วนไหนจะว่าง
- ตัวเลข parse ไม่ได้ → แสดง "–" ไม่ใช่ 0
- เซฟทับ snapshot วันเดิม → ถามยืนยัน

## 11. ค่า config
- จำนวน villa (default derive จาก Available Rooms; override ได้)
- threshold ของกฎคำแนะนำ
- ปีปัจจุบัน / ปี baseline

## 12. Testing (TDD)
- **Parser** (หัวใจ) → unit test ด้วย 4 ไฟล์จริงเป็น fixtures; ยืนยันค่าที่รู้คำตอบ เช่น พ.ค. Occ=42.20, ADR=7110.78, Grand Total Available=1,430
- **Recommendations** → test ทุกกฎด้วย input สมมติ
- **Metrics/pace** → test เทียบ 2 snapshot
- **Functions** → test auth gate, ai-insight (mock Claude)

## 13. Stack
Vite + React + TypeScript · Recharts · Tailwind · Netlify Functions + Blobs · Vitest · Anthropic SDK (ฝั่ง function)

## 14. แผนเป็นเฟส
- **v1 (สเปคนี้):** upload manual, parser, dashboard layout A, pace, กฎคำแนะนำ + AI, auth, deploy
- **Phase 2:** competitor analysis, auto-export (Playwright/GitHub Actions หรือ eZee API/email), multi-property
