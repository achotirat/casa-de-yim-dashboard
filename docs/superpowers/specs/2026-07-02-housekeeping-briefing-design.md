# Housekeeping Briefing (Design Spec)

วันที่: 2026-07-02
สถานะ: รออนุมัติ

## 1. เป้าหมาย

ให้แม่บ้านเห็นรายชื่อแขกที่เข้าพักวันนี้/พรุ่งนี้ (วิลล่า, ชื่อแขก, จำนวนคน, หมายเหตุการมาถึง) ผ่านหน้าจอง่าย ๆ แยกจาก dashboard รายได้ที่ซับซ้อนเกินไปสำหรับสตาฟ โดยไม่ต้อง login ด้วยรหัสผ่านหลัก

ข้อมูลแหล่งเดียวที่มี: Arrival List export จาก eZee (ผ่าน auto-export รายวัน 05:00 น. — ดู [[project-ezee-upload-cadence]]) ซึ่งไม่มีเบอร์โทรศัพท์ผู้จอง จึงตัดฟีเจอร์รหัสผ่านประตู (passcode) ออกจากรอบนี้ — จะพิจารณาใหม่ถ้ามี report/ช่องทางอื่นที่มีเบอร์โทร

## 2. การตัดสินใจหลัก

| ประเด็น | ตัดสินใจ |
|--------|---------|
| Passcode อัตโนมัติ | ตัดออก (eZee ไม่มีเบอร์โทรผู้จอง) |
| จำนวนแขก | นับทั้งผู้ใหญ่ + เด็ก (parsePax() คืนค่านี้อยู่แล้วแต่ children ยังไม่ถูกเก็บ) |
| เวลาเข้าพัก | ไม่ parse แบบ regex — โชว์ notes ดิบให้แม่บ้าน/เจ้าของอ่านเอง (รูปแบบใน notes ไม่คงที่) |
| ชื่อวิลล่า | ใช้ค่า room ตามที่มีอยู่ เช่น "A4 - Villa A4" ไม่ต้อง mapping ใหม่ |
| ช่วงวันที่แสดง | วันนี้ + พรุ่งนี้ (real device date, ไม่ใช่ dataAsOf) |
| ตำแหน่งในแอป | Tab ใหม่ "แม่บ้าน" — เจ้าของเห็นได้ผ่าน DASHBOARD_PASSWORD |
| Access สำหรับแม่บ้าน | รหัสผ่านแยกต่างหาก (HOUSEKEEPING_PASSWORD) — login แล้วเห็นเฉพาะหน้าแม่บ้าน ไม่เห็น Dashboard/อัปโหลด |
| Data boundary | Server-side role filtering — housekeeper role ได้ response ที่ตัดข้อมูลรายได้ทั้งหมดออก ไม่ใช่แค่ซ่อนใน UI |
| รูปแบบข้อความคัดลอก | จัดกลุ่มตามวิลล่า (ไม่ใช่ตาราง 1 บรรทัด/แขก) |
| ภาษา | ไทยทั้งหมด (label, ปุ่ม, ข้อความคัดลอก) |
| Phase ถัดไป | LINE Bot push (ไม่ได้สร้างตอนนี้) |

## 3. Data Model

แก้ `ArrivalRow` ใน `src/types.ts` — เพิ่ม `children`:

```ts
export interface ArrivalRow {
  resNo: string;
  guest: string;
  room: string;
  rate: number | null;
  arrival: string | null;
  departure: string | null;
  pax: number | null;       // adults — ชื่อเดิมคงไว้ ไม่ให้ consumer เดิมพัง
  children: number | null;  // ใหม่
  resType: string;
  channel: string;
  notes: string;
}
```

`src/parser/arrivals.ts` — `toArrivalRow()` เก็บ `children` จาก `parsePax(c[8]).children` (ปัจจุบัน parse แล้วแต่ถูกทิ้ง)

## 4. Housekeeping Logic (pure functions, testable)

ไฟล์ใหม่ `src/metrics/housekeeping.ts`:

```ts
export interface HousekeepingArrival {
  room: string;
  guest: string;
  adults: number | null;
  children: number | null;
  arrivalDate: string; // ISO
  notes: string;
}

export function arrivalsForDate(
  arrivals: ArrivalsReport | undefined,
  dateISO: string
): HousekeepingArrival[]
```

Filter `arrivals.rows` ที่ `row.arrival === dateISO`, sort ตาม `room`. ไม่ผูกกับ UI, ทดสอบแยกได้เหมือน `metrics/pace.ts`, `metrics/weekly.ts`

## 5. Auth — Two Roles

### 5.1 Token payload มี role

`netlify/functions/_auth.ts`:
- `signToken` เก็บ payload เป็น `"owner"` หรือ `"housekeeper"` แทน `"ok"` เดิม
- เพิ่ม `roleFromCookie(req: Request, secret: string): 'owner' | 'housekeeper' | null`

### 5.2 `/api/auth` รับได้ 2 รหัสผ่าน

`netlify/functions/auth.ts`:
- เช็ค `DASHBOARD_PASSWORD` → role `owner`
- เช็ค `HOUSEKEEPING_PASSWORD` (env ใหม่) → role `housekeeper`
- Sign token ตาม role ที่ match, คืน `{ ok: true, role }` ใน response body (ไม่ใช่แค่ cookie) เพื่อให้ frontend รู้ว่าจะ render UI แบบไหน

### 5.3 `/api/snapshots` กรองข้อมูลตาม role

`netlify/functions/snapshots.ts`:
- role `owner` → response เดิมทั้งหมด (yearly, channels, countries, arrivals, monthly)
- role `housekeeper` → response ถูกตัดเหลือแค่:
  ```ts
  { dataAsOf: string | null, arrivals: { rows: HousekeepingArrival[] } }
  ```
  ไม่มี rate, yearly stats, channel/country mix — ป้องกันข้อมูลรายได้หลุดไปใน network response แม้แม่บ้านจะเปิด dev tools ดู

### 5.4 Frontend routing ตาม role

`src/ui/App.tsx` / `AuthGate.tsx`:
- เก็บ `role` จาก login response ใน state
- `role === 'owner'` → Tab bar เดิม (Dashboard / อัปโหลด) + tab ใหม่ "แม่บ้าน"
- `role === 'housekeeper'` → ไม่มี tab bar, render เฉพาะ `HousekeepingView` ทันทีหลัง login

## 6. UI — HousekeepingView

ไฟล์ใหม่ `src/ui/components/HousekeepingView.tsx`

โครงสร้าง:
- 2 section: **"วันนี้"** และ **"พรุ่งนี้"** — ใช้ `arrivalsForDate(arrivals, todayISO/tomorrowISO)`
- แต่ละ section: การ์ดต่อวิลล่า แสดง:
  - ชื่อวิลล่า/ห้อง (room, ตามที่มีอยู่)
  - ชื่อแขก
  - จำนวนคน: "X ผู้ใหญ่ Y เด็ก" (ซ่อนส่วน children ถ้า 0 หรือ null)
  - หมายเหตุ (notes ดิบ, ถ้ามี)
- Empty state ต่อ section: "ไม่มีแขกเข้าพักวันนี้" / "ไม่มีแขกเข้าพักพรุ่งนี้"
- ปุ่ม **"คัดลอกข้อความ"** แยกต่อ section (วันนี้ 1 ปุ่ม, พรุ่งนี้ 1 ปุ่ม) — เพื่อให้ส่งข้อความแยกวันได้ตามที่ส่งให้แม่บ้านจริง — generate ข้อความ plain text จัดกลุ่มตามวิลล่า เช่น:
  ```
  🏡 A4 - Villa A4
  แขก: Kean Cheng Choo (10 คน)
  หมายเหตุ: Early check in 11pax! Request airport transfer...

  🏡 A3 - Villa A3
  แขก: Zulhud Ibrahim (10 คน)
  ```
  ใช้ `navigator.clipboard.writeText()`

## 7. Error Handling

- ถ้า `latest.arrivals` ไม่มี (ยังไม่เคย upload) → แสดง empty state เดียวกับไม่มีแขก พร้อมข้อความ "ยังไม่มีข้อมูล"
- ถ้า auto-export ล้มเหลว (ดู [[project-ezee-upload-cadence]]) ข้อมูลจะเก่าไปสูงสุด ~1 วัน — ไม่ต้องมี error handling พิเศษเพิ่มเติมในหน้านี้ เพราะ auto-export มี notify + log อยู่แล้ว

## 8. Testing

- `tests/metrics/housekeeping.test.ts` — `arrivalsForDate()`: filter ถูกวัน, sort ตาม room, edge case ไม่มี arrivals
- `tests/parser/arrivals.test.ts` — เพิ่ม assertion สำหรับ `children` field
- `tests/functions/auth.test.ts` — ขยายให้ครอบคลุม 2 รหัสผ่าน + role ที่ถูก sign
- Manual/E2E: login ด้วย HOUSEKEEPING_PASSWORD แล้วเช็คว่า network response ของ `/api/snapshots` ไม่มี field รายได้เลย

## 9. Out of Scope (รอบนี้)

- Passcode/เบอร์โทรอัตโนมัติ — ไม่มีแหล่งข้อมูล
- LINE Bot push — phase ถัดไป
- Mapping ชื่อวิลล่าใหม่ — ใช้ค่าเดิมจาก eZee
