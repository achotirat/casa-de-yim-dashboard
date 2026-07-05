# Villa Readiness, Guest Passcodes & Stayover Detection (Design Spec)

วันที่: 2026-07-05
สถานะ: รออนุมัติ

## 1. เป้าหมาย

ขยาย Housekeeping Briefing (2026-07-02) ด้วยสามความสามารถที่เกี่ยวข้องกัน:

1. **แก้ปัญหาข้อมูลขาด**: วิลล่าที่แขกเช็คเอาท์วันนี้แต่เช็คอินไปแล้วหลายวันก่อน (นอกช่วง export ของ eZee Arrival List) ไม่แสดงในสถานะวิลล่าเลย — ต้องรวมข้อมูลจาก snapshot ก่อนหน้าเข้ามาด้วย
2. **สถานะ "พักต่อ" (Stayover)**: เมื่อรวมข้อมูลได้แล้ว ต้องแสดงวิลล่าที่มีแขกพักต่อ (เช็คอินไปแล้ว ยังไม่เช็คเอาท์วันนี้) แยกจาก "ว่าง"
3. **แม่บ้าน/เจ้าของแก้ไขสถานะได้**: (ก) ทำเครื่องหมายวิลล่าว่า "พร้อมรับแขก" หรือ "ยังไม่พร้อม" (ข) สร้าง/แก้ไขรหัสผ่านประตู 6 หลักต่อการจอง (resNo) เพื่อส่งให้แขก

## 2. บริบทและข้อจำกัดเดิม

จาก `docs/superpowers/specs/2026-07-02-housekeeping-briefing-design.md`:
- eZee Arrival List export ดึงเฉพาะแถวที่ **วันที่เช็คอิน** อยู่ในช่วง วันนี้ → +2 เดือน (`scripts/ezee-export-config.ts`) — แขกที่เช็คอินไปแล้วก่อนช่วงนี้ (แต่ยังพักอยู่หรือเช็คเอาท์วันนี้) จะไม่ปรากฏใน snapshot ของวันนั้นเลย
- ไม่มีเบอร์โทรผู้จองในข้อมูล eZee — ยืนยันแล้วอีกครั้งในรอบนี้ (ค้นหาทุก field แล้วไม่พบ) จึงไม่สามารถสร้างรหัสผ่านจากเบอร์โทรได้ตามที่เคยพิจารณาไว้ในสเปคเดิม
- `docs/adr/0001-housekeeper-notes-passthrough-raw.md`: notes ส่งแบบ raw ไม่ redact — ไม่เกี่ยวข้องโดยตรงกับรอบนี้ แต่เป็นบรรทัดฐานเรื่อง "ข้อมูล operational สำคัญกว่าความสมบูรณ์แบบของการกรอง"

## 3. การตัดสินใจหลัก

| ประเด็น | ตัดสินใจ |
|--------|---------|
| แก้ปัญหา checkout ที่หายไป | **Lookback merge ฝั่ง server** — ไม่ใช่ manual override. อ่าน snapshot ย้อนหลังสูงสุด 14 วัน รวมแถวที่ `departure >= วันนี้` (dedupe ด้วย resNo) เข้ากับ arrivals ของ snapshot ล่าสุด |
| ระยะ lookback | 14 วัน |
| สถานะใหม่ | เพิ่ม `stayover` ใน `VillaStatus` — เช็คอินไปแล้ว (< วันนี้), เช็คเอาท์หลังวันนี้ (> วันนี้), ไม่ arrive/depart วันนี้ |
| รูปแบบรหัสผ่าน | `00` + เลขสุ่ม 4 หลัก (เช่น `004821`) — ให้จำง่าย (ขึ้นต้นเหมือนกันเสมอ), 10,000 combinations |
| ขอบเขตรหัสผ่าน | ผูกกับ **resNo** (การจอง) ไม่ใช่ villa — turnover วันเดียวกันแขกออก/เข้าคนละรหัส, การจองเดียวกันเห็นรหัสเดิมทุกวันที่ดู |
| การเก็บข้อมูล | Netlify Blobs store ใหม่ชื่อ `villa-status`, **1 blob ต่อ 1 resNo** (ไม่แบ่งตามวันที่) — คงอยู่ตลอดช่วงที่ยังอยู่ใน lookback window |
| Permission | permission ใหม่ 1 ตัว `write:villa-status` — มอบให้ทั้ง `owner` และ `housekeeper` |
| API | endpoint ใหม่ `netlify/functions/villa-status.ts` — `GET ?resNos=1,2,3` (batch read), `POST` (partial update ทีละ resNo) |
| Default readiness | `ready: false` (ยังไม่พร้อม) เมื่อยังไม่เคยตั้งค่า |
| Readiness ผูกกับ resNo ไหน (turnover) | แขกที่ **เข้าใหม่** — readiness หมายถึง "วิลล่าพร้อมสำหรับแขกคนใหม่" |
| Readiness ผูกกับ resNo ไหน (departing เดี่ยว) | แขกที่ **ออก** — หมายถึง "ทำความสะอาดหลังเช็คเอาท์เสร็จแล้ว" |
| Controls ต่อสถานะ | vacant: ไม่มี · arriving/turnover: toggle + passcode (ผูกแขกใหม่) · departing เดี่ยว: toggle เท่านั้น (ผูกแขกที่ออก) · stayover: ทั้ง toggle และ passcode |
| Owner เห็น/แก้ไขได้ไหม | ได้ — เจ้าของใช้ tab "แม่บ้าน" เดียวกัน จึงได้ permission เดียวกัน |
| ภาษา | ไทยทั้งหมด ตามแนวทางเดิม |

## 4. Data Model

### 4.1 `VillaStatus` — เพิ่ม stayover kind

แก้ `src/metrics/housekeeping.ts`:

```ts
export type VillaStatus =
  | { kind: 'vacant' }
  | { kind: 'arriving'; arrival: HousekeepingArrival }
  | { kind: 'departing'; departure: HousekeepingDeparture }
  | { kind: 'turnover'; departure: HousekeepingDeparture; arrival: HousekeepingArrival }
  | { kind: 'stayover'; arrival: HousekeepingArrival };
```

`villaStatusesForDate()` ต้องรู้จักแถวที่ arrival < dateISO และ departure > dateISO (สแปนผ่านวันที่ระบุ) แล้วจัดเป็น `stayover` — ใช้ arrival row เดิม (มี resNo, guest, notes) เพราะ `HousekeepingArrival` มี field ครบอยู่แล้ว

**หมายเหตุสำคัญ**: `arrivalsForDate()`/`departuresForDate()` เดิมไม่เปลี่ยนพฤติกรรม (ยัง filter เฉพาะ arrival/departure ตรงกับวันที่ระบุเป๊ะๆ) — stayover detection เป็นฟังก์ชันใหม่ที่ scan ทั้ง arrivals array หาแถวที่ date range ครอบคลุมวันที่ระบุ

### 4.2 Villa-status storage shape

```ts
export interface VillaStatusEntry {
  ready: boolean;
  passcode: string | null;
}
```

Blob key: `villa-status/{resNo}` (Netlify Blobs store name: `villa-status`, แยกจาก store `snapshots` เดิม)

## 5. Server-Side Lookback Merge

### 5.1 ตำแหน่งที่แก้: `netlify/functions/snapshots.ts`

เมื่อ resolve arrivals สำหรับ role ใดก็ตาม (owner ผ่าน `GET ?key=...`, housekeeper ผ่าน stripped latest) — หลังจากได้ snapshot ล่าสุดแล้ว ให้:

1. คำนวณ `dataAsOf` ของ snapshot ล่าสุด (หรือวันนี้ถ้าไม่มี)
2. อ่าน snapshot key ย้อนหลังสูงสุด 14 วันจาก `dataAsOf` (`snapshot/YYYY-MM-DD` แต่ละวัน — ข้ามถ้าไม่มีไฟล์)
3. รวม (merge) แถว arrivals จากทุก snapshot เข้าด้วยกัน โดย **dedupe ด้วย resNo** — ถ้า resNo ซ้ำ ใช้แถวจาก snapshot ที่ใหม่กว่า (ข้อมูลอาจอัปเดต เช่น notes เปลี่ยน)
4. คืนค่าเป็น `arrivals.rows` เดียวที่รวมทุกอย่างแล้ว (ทั้ง owner และ housekeeper role ได้ผลลัพธ์เดียวกันในแง่นี้ — housekeeper ยังโดน `stripForHousekeeper()` ตัด field เดิมอยู่)

### 5.2 Performance

อ่านสูงสุด 14 blobs ต่อ 1 request (Netlify Blobs `consistency: 'strong'` เหมือนเดิม) — ยอมรับได้เพราะ arrivals ถูกเรียกไม่บ่อย (โหลดหน้าเดียวต่อ session, ไม่ polling)

### 5.3 ทำไมไม่ใช้ manual override แทน

พิจารณาแล้วปฏิเสธ: manual text override ต้องให้แม่บ้านพิมพ์ข้อมูลที่ระบบมีอยู่แล้วซ้ำ (ชื่อแขก, วันที่) เพราะ snapshot ก่อนหน้าเก็บข้อมูลนี้ไว้แล้วเป๊ะ — การ merge อัตโนมัติแม่นยำกว่าและไม่ต้องพึ่งความจำของมนุษย์

## 6. Auth — Permission ใหม่

### 6.1 `netlify/functions/_auth.ts`

เพิ่ม permission ใหม่ในชุดที่มีอยู่ (จาก `docs/superpowers/plans/2026-07-02-housekeeping-briefing.md` Task 3):

```ts
export type Permission =
  | 'read:revenue'
  | 'read:arrivals'
  | 'write:snapshot'
  | 'read:snapshot-keys'
  | 'write:villa-status';   // ใหม่

const ROLE_PERMISSIONS: Record<Role, Set<Permission>> = {
  owner: new Set(['read:revenue', 'read:arrivals', 'write:snapshot', 'read:snapshot-keys', 'write:villa-status']),
  housekeeper: new Set(['read:arrivals', 'write:villa-status']),
};
```

ไม่มี `read:villa-status` แยก — endpoint villa-status ใช้ `write:villa-status` ครอบคลุมทั้ง GET/POST เพราะไม่มี role ไหนที่ควรเห็นข้อมูลนี้แบบ read-only เท่านั้น (มีแค่ owner/housekeeper ทั้งคู่ได้ทั้งอ่านเขียน)

## 7. API — `netlify/functions/villa-status.ts`

### 7.1 `GET /api/villa-status?resNos=1,2,3`

- ต้องมี `write:villa-status` permission (ไม่งั้น 403)
- Parse `resNos` query param เป็น array ของ string
- อ่าน blob `villa-status/{resNo}` สำหรับแต่ละ resNo (ไม่มี = ไม่ error, แค่ไม่รวมใน response)
- Response: `{ ok: true, data: Record<string, VillaStatusEntry> }` — key คือ resNo string

### 7.2 `POST /api/villa-status`

- ต้องมี `write:villa-status` permission
- Body: `{ resNo: string; ready?: boolean; passcode?: string | null }`
- Partial update: อ่าน blob เดิม (ถ้ามี), merge field ที่ส่งมาเข้าไป, เขียนกลับ
- ถ้าไม่มี blob เดิม: default `{ ready: false, passcode: null }` แล้ว merge ทับ
- Response: `{ ok: true }`

## 8. UI — `HousekeepingView.tsx`

### 8.1 Passcode generation

```ts
function generatePasscode(): string {
  const digits = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `00${digits}`;
}
```

ปุ่ม "สร้างรหัส" — เรียก `generatePasscode()` แล้ว POST ทันที, แสดงผลลัพธ์ในช่องที่แก้ไขได้ (พิมพ์ทับเองได้เช่นกัน — onBlur หรือปุ่ม "บันทึก" แยก POST เมื่อพิมพ์เอง)

### 8.2 Controls ต่อแถว villa status

| Status kind | Readiness toggle | Passcode | resNo ที่ผูก |
|---|---|---|---|
| `vacant` | ไม่มี | ไม่มี | - |
| `arriving` | มี | มี | arrival.resNo |
| `departing` | มี ("ทำความสะอาดเสร็จแล้ว") | ไม่มี | departure.resNo |
| `turnover` | มี | มี | arrival.resNo (แขกใหม่) |
| `stayover` | มี | มี (view/edit) | arrival.resNo |

**หมายเหตุ**: `HousekeepingArrival`/`HousekeepingDeparture` ต้องมี `resNo` field เพิ่ม (ปัจจุบันไม่มี — ถูกทิ้งตอน map ใน `arrivalsForDate`/`departuresForDate`) เพื่อให้ UI ส่ง resNo ไปกับ POST ได้ นอกจากนี้ `stripForHousekeeper()` ใน `netlify/functions/snapshots.ts` (§5.1) ต้องเพิ่ม `resNo: r.resNo` เข้าไปใน mapping ด้วย — ปัจจุบันไม่ได้ส่งผ่าน field นี้ให้ housekeeper role เลย (เหมือนกรณี `resType` ที่เคยพลาดและแก้ไปแล้วในรอบก่อน — ดู Task 5 ใน `docs/superpowers/plans/2026-07-02-housekeeping-briefing.md`)

### 8.3 Data loading

`HousekeepingView` (หรือ parent) ต้อง:
1. ได้ villa statuses จาก `villaStatusesForDate()` ตามเดิม (ตอนนี้รวม stayover แล้วเพราะ arrivals data ที่ได้จาก server มี merge แล้ว)
2. เก็บ resNo ทั้งหมดที่ต้องแสดง control (จากทุก status ที่ไม่ใช่ vacant)
3. เรียก `GET /api/villa-status?resNos=...` ครั้งเดียวตอน mount (หรือ re-fetch หลัง POST สำเร็จ)
4. Toggle/passcode input เรียก `POST /api/villa-status` แล้ว update local state (optimistic หรือ re-fetch)

### 8.4 Passcode validation (manual entry)

ช่องรหัสผ่านที่พิมพ์เองต้องเป็นตัวเลข 6 หลักเท่านั้น (ไม่บังคับรูปแบบ `00xxxx` เมื่อพิมพ์เอง — อนุญาตให้ตรงกับรหัสที่ตั้งไว้ที่ประตูจริงถ้าแม่บ้านตั้งเองแบบอื่น) validate ด้วย regex `/^\d{6}$/` ฝั่ง client ก่อน POST — ถ้าไม่ผ่านไม่ส่ง request, แสดงข้อความ "รหัสต้องเป็นตัวเลข 6 หลัก" ใต้ช่อง

## 9. Error Handling

- **`GET /api/villa-status` ไม่มี query param `resNos`**: คืนค่า `{ ok: true, data: {} }` (ไม่ error — เหมือนไม่มี resNo ให้ค้นหา)
- **`POST /api/villa-status` ไม่มี `resNo` ใน body**: `400 Bad Request`
- **`POST` ที่มี `passcode` ไม่ตรงรูปแบบ 6 หลัก**: `400 Bad Request` — validate ฝั่ง server ด้วย (ไม่พึ่ง client-side validation อย่างเดียว)
- **Lookback merge อ่าน snapshot ไม่เจอ (blob ไม่มีในบางวัน)**: ข้ามวันนั้นไปเงียบๆ ไม่ error — เป็นเรื่องปกติถ้าบางวันไม่มีการ upload (เช่น auto-export ล้มเหลว)
- **ไม่มี cookie / role ไม่ผ่าน permission**: `401`/`403` ตาม pattern เดิมของ `snapshots.ts`

## 10. Testing

- `tests/metrics/housekeeping.test.ts` — เพิ่ม test สำหรับ `stayover` kind ใน `villaStatusesForDate()` (arrival ก่อนวันที่ระบุ, departure หลังวันที่ระบุ)
- `tests/functions/snapshots.test.ts` — เพิ่ม test สำหรับ lookback merge (mock หลาย snapshot blobs, ยืนยันว่า arrivals ที่ departure วันนี้แต่ arrival วันก่อนถูกรวมเข้ามา, dedupe ด้วย resNo ถูกต้อง)
- `tests/functions/villa-status.test.ts` (ใหม่) — GET batch read, POST partial update, permission check (403 ถ้าไม่มี `write:villa-status` — ปัจจุบันทุก role ที่ login ได้มี permission นี้ จึงเทสต์เคส "ไม่มี cookie เลย" แทน)
- Manual: สร้าง test snapshot ที่มีแขกเช็คอินสัปดาห์ก่อน เช็คเอาท์วันนี้ → ยืนยันว่าวิลล่าแสดงถูกต้องในสถานะวิลล่า, ทดสอบ toggle readiness และสร้าง/แก้ไขรหัสผ่านผ่าน UI จริง

## 11. Out of Scope (รอบนี้)

- Manual villa-status text override — แทนที่ด้วย lookback merge อัตโนมัติทั้งหมด
- การเชื่อมต่อกับ smart lock จริง (auto-program ประตูให้ตรงกับรหัส) — แม่บ้านยังต้องตั้งรหัสที่ประตูเองให้ตรงกับที่ระบบสร้าง
- Passcode expiration/auto-clear หลังเช็คเอาท์ — ไม่ implement การลบอัตโนมัติ, ปล่อยให้ blob เก่าค้างไว้ (จะไม่ถูกอ่านอีกเพราะ resNo นั้นหลุดจาก 14-day lookback ไปเอง)
- Date/timestamp display ข้าง "วันนี้"/"พรุ่งนี้" — เป็น task แยกต่างหาก ไม่ต้องออกแบบเพิ่ม (การเปลี่ยนแปลง UI เล็กน้อย ทำแยกหลังจาก spec นี้)
