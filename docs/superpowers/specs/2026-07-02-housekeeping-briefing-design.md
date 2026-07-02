# Housekeeping Briefing (Design Spec)

วันที่: 2026-07-02
สถานะ: รออนุมัติ

## 1. เป้าหมาย

ให้แม่บ้านเห็นรายชื่อแขกที่เข้าพักวันนี้/พรุ่งนี้ (วิลล่า, ชื่อแขก, จำนวนคน, หมายเหตุการมาถึง) ผ่านหน้าจอง่าย ๆ แยกจาก dashboard รายได้ที่ซับซ้อนเกินไปสำหรับสตาฟ โดยไม่ต้อง login ด้วยรหัสผ่านหลัก

ข้อมูลแหล่งเดียวที่มี: Arrival List export จาก eZee (ผ่าน auto-export รายวัน 05:00 น. — ดู `scripts/ezee-export.ts` + crontab) ซึ่งไม่มีเบอร์โทรศัพท์ผู้จอง จึงตัดฟีเจอร์รหัสผ่านประตู (passcode) ออกจากรอบนี้ — จะพิจารณาใหม่ถ้ามี report/ช่องทางอื่นที่มีเบอร์โทร

## 2. การตัดสินใจหลัก

| ประเด็น | ตัดสินใจ |
|--------|---------|
| Passcode อัตโนมัติ | ตัดออก (eZee ไม่มีเบอร์โทรผู้จอง) |
| จำนวนแขก | นับทั้งผู้ใหญ่ + เด็ก (parsePax() คืนค่านี้อยู่แล้วแต่ children ยังไม่ถูกเก็บ) |
| เวลาเข้าพัก | ไม่ parse แบบ regex — โชว์ notes ดิบให้แม่บ้าน/เจ้าของอ่านเอง (รูปแบบใน notes ไม่คงที่) |
| Notes redaction | **ไม่ redact** — ส่ง notes แบบ raw ทั้งหมด แม้มีข้อมูลราคา/การชำระเงินปนอยู่บ้าง เป็นการตัดสินใจที่ตั้งใจ ดู [ADR-0001](../../adr/0001-housekeeper-notes-passthrough-raw.md) |
| สถานะการจอง | แสดงเฉพาะ `resType === "Confirm Booking"` — ไม่โชว์ tentative/cancelled |
| ชื่อวิลล่า | ใช้ค่า room ตามที่มีอยู่ เช่น "A4 - Villa A4" ไม่ต้อง mapping ใหม่ (ดู `CONTEXT.md` เรื่อง Villa) |
| ช่วงวันที่แสดง | วันนี้ + พรุ่งนี้ — คำนวณฝั่ง client (`new Date()`) ไม่ใช่ dataAsOf ฝั่ง server; ถ้าย้าย logic ไป server ในอนาคตต้อง hardcode Asia/Bangkok (UTC+7) ไม่ใช่ timezone ของเซิร์ฟเวอร์ (Netlify Functions รัน UTC) |
| ตำแหน่งในแอป | Tab ใหม่ "แม่บ้าน" — เจ้าของเห็นได้ผ่าน DASHBOARD_PASSWORD (role `owner`) |
| Access สำหรับแม่บ้าน | รหัสผ่านแยกต่างหาก (HOUSEKEEPING_PASSWORD, optional env var) — login แล้วเห็นเฉพาะหน้าแม่บ้าน ไม่มี tab bar |
| Data boundary | Server-side permission filtering — housekeeper role ได้ response ที่ตัดข้อมูลโครงสร้างด้านรายได้ทั้งหมดออก (ไม่ครอบคลุม notes ดิบ ดู ADR-0001) |
| Permission model | Action-based (ดู §5) — ไม่ผูกกับ villa/resource เพราะยังไม่มี per-housekeeper identity |
| รูปแบบข้อความคัดลอก | จัดกลุ่มตามวิลล่า แยกปุ่มคัดลอกต่อวัน (วันนี้/พรุ่งนี้ คนละปุ่ม) |
| Logout | เพิ่มปุ่ม logout ในหน้าแม่บ้าน (เดิมทั้งแอปไม่มี logout เลย) — เกี่ยวข้องเพราะ housekeeper login มักใช้บนอุปกรณ์ร่วม |
| ภาษา | ไทยทั้งหมด (label, ปุ่ม, ข้อความคัดลอก) |
| Phase ถัดไป | Maintenance ticket → Discord/LINE Bot, villa-readiness toggle, scheduled maintenance display — **ไม่ออกแบบ/ไม่สร้างตอนนี้**, เก็บเป็น permission name เผื่ออนาคตเท่านั้น (ดู §5.4) |

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
  notes: string;       // raw, unredacted — see ADR-0001
}

export function arrivalsForDate(
  arrivals: ArrivalsReport | undefined,
  dateISO: string
): HousekeepingArrival[]
```

Filter `arrivals.rows` ที่:
- `row.arrival === dateISO`
- `row.resType === 'Confirm Booking'` (ตัด tentative/cancelled ออก — ถ้า eZee มี string อื่นสำหรับ "confirmed" ในอนาคต จะเป็นบั๊กที่ยังไม่เจอ ไม่ใช่การตั้งใจ handle เผื่อไว้)

Sort ตาม `room`. ไม่ผูกกับ UI, ทดสอบแยกได้เหมือน `metrics/pace.ts`, `metrics/weekly.ts`

## 5. Auth — Roles & Permissions

### 5.1 Permission model

Action-based, server-side policy (ไม่ผูกกับ token) — ดู `CONTEXT.md` เรื่อง Role/Permission:

```ts
type Role = 'owner' | 'housekeeper';
type Permission =
  | 'read:revenue'
  | 'read:arrivals'
  | 'write:snapshot'
  | 'read:snapshot-keys';

const ROLE_PERMISSIONS: Record<Role, Set<Permission>> = {
  owner: new Set(['read:revenue', 'read:arrivals', 'write:snapshot', 'read:snapshot-keys']),
  housekeeper: new Set(['read:arrivals']),
};
```

- Token payload encodes only the **role** string (`"owner"` / `"housekeeper"`), HMAC-signed as today — NOT the resolved permission list. Permissions are looked up server-side from `ROLE_PERMISSIONS` at request time, so granting a role new permissions later needs no re-login or token migration.
- `scripts/ezee-export.ts` (automated cron upload) authenticates with `DASHBOARD_PASSWORD` and gets `owner` role like today — no separate `service` role.
- Existing pre-deploy cookies (legacy payload `"ok"`) become invalid after this ships — accepted, one-time, low-impact (only the owner currently has a session).

### 5.2 Token payload change

`netlify/functions/_auth.ts`:
- `signToken` payload becomes `"owner"` or `"housekeeper"` instead of `"ok"`
- Add `roleFromCookie(req: Request, secret: string): Role | null` — decodes + verifies, returns the role or null
- Add `hasPermission(role: Role | null, perm: Permission): boolean` — looks up `ROLE_PERMISSIONS`

### 5.3 `/api/auth` accepts two passwords

`netlify/functions/auth.ts`:
- Check `DASHBOARD_PASSWORD` (required, existing 500-if-missing behavior unchanged) → role `owner`
- Check `HOUSEKEEPING_PASSWORD` (new, **optional** env var — if unset, this path simply never matches; owner login is unaffected by whether it's configured) → role `housekeeper`
- Sign token for whichever matched, return `{ ok: true, role }` in the JSON body (not just the cookie) so the frontend knows which UI to render immediately after login

### 5.4 `/api/snapshots` permission-gated per method

`netlify/functions/snapshots.ts`:
- `POST` (write) → requires `write:snapshot`. `housekeeper` role → **403 Forbidden**. This is scoped as "housekeeper has no write capability *yet*" (not an unconditional architectural rule) — future maintenance-ticket / readiness-toggle / scheduled-maintenance features get their own narrow permissions (`write:maintenance-ticket`, `write:readiness-status`, `read:scheduled-maintenance`) added to `ROLE_PERMISSIONS` when those specs are built. Not implemented now, not present in code yet — YAGNI.
- `GET` (list all keys, no `key` param) → requires `read:snapshot-keys`. `housekeeper` → **403 Forbidden**.
- `GET ?key=...` (single snapshot) → requires `read:arrivals` at minimum.
  - `owner` role (has `read:revenue`) → full snapshot response, unchanged from today.
  - `housekeeper` role → the `key` param is **ignored**; always resolves and returns the **latest** snapshot, stripped to:
    ```ts
    { dataAsOf: string | null, arrivals: { rows: HousekeepingArrival[] } }
    ```
    No rate, yearly stats, channel/country mix, or monthly data. See ADR-0001 for why `notes` (part of `HousekeepingArrival`) is still raw/unredacted despite this being the "no revenue data" boundary.

### 5.5 Logout

New `POST /api/logout` — responds with `Set-Cookie` clearing the auth cookie (`Max-Age=0`). Add a `clearedCookie()` helper next to `cookieFromToken()` in `_auth.ts`. Housekeeping view gets a logout button that calls this then returns to `LoginPage`.

### 5.6 Frontend routing by role

- `AuthGate.tsx`: on mount, calls new `GET /api/whoami` (decodes cookie, returns `{ role }` or 401) instead of the current `listSnapshotKeys()` probe — the old probe would 403 for a valid housekeeper session, causing a false-negative login loop. On successful login via `LoginPage`, `AuthGate` also receives `role` from `/api/auth`'s response body. `AuthGate` holds `role` in its own state (set at the same moment as auth-success) and passes it to `children` as a render-prop: `<AuthGate>{(role) => <App role={role} />}</AuthGate>`. `AuthGate`'s only job stays "is this session valid" — role-based layout branching happens in `App.tsx`.
- `App.tsx`, given `role`:
  - `owner` → existing header + 3-tab layout (Dashboard / อัปโหลด / new "แม่บ้าน"). `App.tsx` calls `loadSnapshots()` once (as today) and passes `data.latest.arrivals` down to both `Dashboard` and `HousekeepingView` as a prop — no duplicate fetch when switching tabs.
  - `housekeeper` → no header, no tab bar. Renders `HousekeepingView` directly, which does its **own** independent fetch of `GET /api/snapshots` (since there's no `Dashboard` load to piggyback on for this path) and receives the pre-stripped response from §5.4.

## 6. UI — HousekeepingView

ไฟล์ใหม่ `src/ui/components/HousekeepingView.tsx`

โครงสร้าง:
- 2 section: **"วันนี้"** และ **"พรุ่งนี้"** — `todayISO`/`tomorrowISO` คำนวณ client-side จาก `new Date()` (เหมือน `Dashboard.tsx` ปัจจุบัน), ใช้ `arrivalsForDate(arrivals, todayISO/tomorrowISO)`
- แต่ละ section: การ์ดต่อวิลล่า แสดง:
  - ชื่อวิลล่า/ห้อง (room, ตามที่มีอยู่)
  - ชื่อแขก
  - จำนวนคน: "X ผู้ใหญ่ Y เด็ก" (ซ่อนส่วน children ถ้า 0 หรือ null)
  - หมายเหตุ (notes ดิบ, ถ้ามี)
- Empty state ต่อ section: "ไม่มีแขกเข้าพักวันนี้" / "ไม่มีแขกเข้าพักพรุ่งนี้"
- ปุ่ม **"คัดลอกข้อความ"** แยกต่อ section (วันนี้ 1 ปุ่ม, พรุ่งนี้ 1 ปุ่ม) — generate ข้อความ plain text จัดกลุ่มตามวิลล่า เช่น:
  ```
  🏡 A4 - Villa A4
  แขก: Kean Cheng Choo (10 คน)
  หมายเหตุ: Early check in 11pax! Request airport transfer...

  🏡 A3 - Villa A3
  แขก: Zulhud Ibrahim (10 คน)
  ```
  ใช้ `navigator.clipboard.writeText()`:
  - สำเร็จ → ปุ่มเปลี่ยนข้อความเป็น "คัดลอกแล้ว!" ~2 วินาทีแล้วกลับเป็นเดิม
  - ล้มเหลว (throw/reject) → catch แล้วโชว์ "คัดลอกไม่สำเร็จ" ชั่วคราว — แขกยังอ่านข้อความจากหน้าจอได้โดยตรงเพราะแสดงอยู่แล้ว
- ปุ่ม **"ออกจากระบบ"** (logout) มุมบนของหน้า — เรียก `POST /api/logout` แล้วกลับไป `LoginPage`

## 7. Error Handling

- ถ้า `latest.arrivals` ไม่มี (ยังไม่เคย upload) → แสดง empty state เดียวกับไม่มีแขก พร้อมข้อความ "ยังไม่มีข้อมูล"
- ถ้า auto-export ล้มเหลว (ดู `scripts/ezee-export.ts` + crontab รายวัน 05:00 น.) ข้อมูลจะเก่าไปสูงสุด ~1 วัน — ไม่ต้องมี error handling พิเศษเพิ่มเติมในหน้านี้ เพราะ auto-export มี notify + log อยู่แล้ว

## 8. Testing

- `tests/metrics/housekeeping.test.ts` — `arrivalsForDate()`: filter ถูกวัน, filter เฉพาะ Confirm Booking, sort ตาม room, edge case ไม่มี arrivals
- `tests/parser/arrivals.test.ts` — เพิ่ม assertion สำหรับ `children` field
- `tests/functions/auth.test.ts` — ขยายให้ครอบคลุม 2 รหัสผ่าน + role ที่ถูก sign, กรณี HOUSEKEEPING_PASSWORD ไม่ได้ตั้งค่า (owner ยัง login ได้ปกติ)
- `tests/functions/snapshots.test.ts` (ใหม่หรือขยาย) — housekeeper role: POST → 403, GET (list) → 403, GET ?key=... → ได้ latest เสมอ + response ไม่มี field รายได้
- Manual/E2E: login ด้วย HOUSEKEEPING_PASSWORD แล้วเช็ค network response ของ `/api/snapshots` ไม่มี field รายได้เลย (notes ไม่นับ ตาม ADR-0001); logout เคลียร์ cookie จริง

## 9. Out of Scope (รอบนี้)

- Passcode/เบอร์โทรอัตโนมัติ — ไม่มีแหล่งข้อมูล
- Maintenance ticket submission (→ Discord หรือ LINE Bot, ยังไม่ตัดสินใจช่องทาง) — เก็บเป็น permission name เผื่ออนาคต ไม่ implement
- Villa-readiness toggle — เก็บเป็น permission name เผื่ออนาคต ไม่ implement
- Scheduled maintenance display — เก็บเป็น permission name เผื่ออนาคต ไม่ implement
- Per-housekeeper identity/accounts — ใช้รหัสผ่านเดียวร่วมกันไปก่อน; ถ้าต้องรู้ว่าใครส่ง ticket ให้ใช้ free-text name field ตอนนั้น ไม่ต้องสร้างระบบ account
- Mapping ชื่อวิลล่าใหม่ — ใช้ค่าเดิมจาก eZee
