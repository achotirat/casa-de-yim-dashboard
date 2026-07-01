# Housekeeping Briefing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give housekeepers a daily, Thai-language view of today's/tomorrow's confirmed arrivals (villa, guest, guest count, raw arrival notes) via a separate login that never receives structured revenue data — while the owner keeps full dashboard access plus the same view as a new tab.

**Architecture:** A server-side `Role`/`Permission` system replaces the current single-password "ok" token: `/api/auth` accepts either `DASHBOARD_PASSWORD` (role `owner`) or an optional `HOUSEKEEPING_PASSWORD` (role `housekeeper`), signs a role-bearing token, and `/api/snapshots` branches its response by role — `housekeeper` always gets the latest snapshot stripped down to `dataAsOf` + arrivals only, `owner` is unchanged. A new pure function `arrivalsForDate()` filters/sorts confirmed arrivals for a given ISO date. A new `HousekeepingView` component (used both as the owner's "แม่บ้าน" tab and as the housekeeper's sole landing page) renders today/tomorrow sections with per-day copy-to-clipboard. `AuthGate` is extended to surface `role` via a render-prop instead of doing a role-blind snapshot probe.

**Tech Stack:** React 18 + TypeScript · Vitest · Netlify Functions (Netlify Blobs for storage) · existing HMAC cookie auth (`node:crypto`)

## Global Constraints

- Language: all new user-facing strings are Thai (`CONTEXT.md` / spec §2 "ภาษา").
- `notes` field is passed through raw/unredacted at every layer — no regex stripping, no redaction (spec §2 "Notes redaction", ADR-0001). Do not add any note-filtering logic.
- Housekeeping briefing only ever shows `resType === 'Confirm Booking'` rows (spec §4) — exact string match, no fuzzy/case-insensitive matching.
- `HOUSEKEEPING_PASSWORD` is an **optional** env var — its absence must never break owner login or return a 500 from `/api/auth` (spec §5.3).
- Permissions are resolved server-side from a `ROLE_PERMISSIONS` map at request time — never encode resolved permissions in the token, only the role string (spec §5.1).
- Today/tomorrow date computation happens **client-side** via `new Date()` — do not add server-side date filtering (spec §2 "ช่วงวันที่แสดง").
- Villa/room label is used as-is from eZee (`row.room`, e.g. `"A4 - Villa A4"`) — no new name mapping (spec §2 "ชื่อวิลล่า").

---

## File Structure

```
New:
  src/metrics/housekeeping.ts             # arrivalsForDate() — pure, testable
  tests/metrics/housekeeping.test.ts
  netlify/functions/logout.ts             # POST /api/logout
  netlify/functions/whoami.ts             # GET /api/whoami
  src/ui/components/HousekeepingView.tsx  # today/tomorrow arrivals UI

Modified:
  src/types.ts                            # ArrivalRow.children
  src/parser/arrivals.ts                  # toArrivalRow() keeps children
  tests/parser/arrivals.test.ts           # + children assertion
  tests/metrics/pace.test.ts              # + children: null in fixture rows
  netlify/functions/_auth.ts              # Role/Permission model, roleFromCookie, hasPermission, clearedCookie
  tests/functions/auth.test.ts            # + role-aware signToken/verifyToken coverage
  netlify/functions/auth.ts               # two-password role resolution
  netlify/functions/snapshots.ts          # permission-gated per method/role
  tests/functions/snapshots.test.ts       # new — role-gating coverage
  src/lib/api.ts                          # login() returns role, + logout(), + whoami()
  src/ui/AuthGate.tsx                     # role render-prop, whoami-based probe
  src/ui/LoginPage.tsx                    # onSuccess receives role
  src/ui/App.tsx                          # role-based layout branch, "แม่บ้าน" tab, owns loadSnapshots()
  src/ui/Dashboard.tsx                    # accepts { data } as a prop instead of self-fetching
```

---

## Task 1: `ArrivalRow.children` — data model + parser

**Files:**
- Modify: `src/types.ts`
- Modify: `src/parser/arrivals.ts`
- Modify: `tests/parser/arrivals.test.ts`
- Modify: `tests/metrics/pace.test.ts` (existing `ArrivalRow` literals need the new required field)

**Interfaces:**
- Produces: `ArrivalRow.children: number | null`, populated by `parsePax(c[8]).children` (the `parsePax` helper in `src/parser/num.ts` already returns `{ adults, children }` — only `adults` is currently kept).

- [ ] **Step 1: Write the failing test**

Add to `tests/parser/arrivals.test.ts`, inside the existing `describe('parseArrivals', ...)` block:

```ts
  it('parses children count alongside adults', () => {
    const r = parseArrivals(html);
    if (!r.ok) throw new Error(r.reason);
    const withChild = r.data.rows.find((x) => x.resNo === '472')!;
    expect(withChild.pax).toBe(2);
    expect(withChild.children).toBe(2);
    const noChild = r.data.rows.find((x) => x.resNo === '301')!;
    expect(noChild.pax).toBe(10);
    expect(noChild.children).toBe(0);
  });
```

(Res. No `472` is `Uray Dita Amalia`, pax cell `"2/2"` in the fixture — 2 adults, 2 children. Res. No `301` is `Kean Cheng Choo`, pax cell `"10/0"` — 10 adults, 0 children.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/parser/arrivals.test.ts -t "parses children count"`
Expected: FAIL — `Property 'children' does not exist on type 'ArrivalRow'` (TypeScript) or `undefined` received where `2`/`0` expected.

- [ ] **Step 3: Add `children` to `ArrivalRow` in `src/types.ts`**

In `src/types.ts`, modify the `ArrivalRow` interface:

```ts
export interface ArrivalRow {
  resNo: string;
  guest: string;
  room: string;
  rate: number | null;
  arrival: string | null;   // ISO date (check-in)
  departure: string | null; // ISO date
  pax: number | null;
  children: number | null;
  resType: string;
  channel: string;          // Company column (e.g. "OTA")
  notes: string;
}
```

- [ ] **Step 4: Update `toArrivalRow()` in `src/parser/arrivals.ts`**

Replace:

```ts
function toArrivalRow(c: string[]): ArrivalRow {
  return {
    resNo: c[0] ?? '',
    guest: c[1] ?? '',
    room: c[3] ?? '',
    rate: parseNum(c[4]),
    arrival: parseDate(c[6]),
    departure: parseDate(c[7]),
    pax: parsePax(c[8]).adults,
    resType: c[13] ?? '',
    channel: c[15] ?? '',
    notes: '',
  };
}
```

with:

```ts
function toArrivalRow(c: string[]): ArrivalRow {
  const { adults, children } = parsePax(c[8]);
  return {
    resNo: c[0] ?? '',
    guest: c[1] ?? '',
    room: c[3] ?? '',
    rate: parseNum(c[4]),
    arrival: parseDate(c[6]),
    departure: parseDate(c[7]),
    pax: adults,
    children,
    resType: c[13] ?? '',
    channel: c[15] ?? '',
    notes: '',
  };
}
```

- [ ] **Step 5: Fix the now-broken `tests/metrics/pace.test.ts` fixture literals**

`ArrivalRow` gained a new required field, so the two inline literals in `tests/metrics/pace.test.ts` (`describe('dailyOccupancy', ...)`) will fail to typecheck. Modify both rows to add `children: null`:

```ts
        { resNo: '1', guest: 'A', room: 'A1', rate: 1, arrival: '2026-06-01', departure: '2026-06-03', pax: 2, children: null, resType: '', channel: '', notes: '' },
        { resNo: '2', guest: 'B', room: 'A2', rate: 1, arrival: '2026-06-02', departure: '2026-06-03', pax: 2, children: null, resType: '', channel: '', notes: '' },
```

- [ ] **Step 6: Run full test suite to verify pass and no regressions**

Run: `npx vitest run`
Expected: All tests PASS (including the new one from Step 1).

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/parser/arrivals.ts tests/parser/arrivals.test.ts tests/metrics/pace.test.ts
git commit -m "feat: parse children count on arrival rows"
```

---

## Task 2: `arrivalsForDate()` — housekeeping metrics module

**Files:**
- Create: `src/metrics/housekeeping.ts`
- Create: `tests/metrics/housekeeping.test.ts`

**Interfaces:**
- Consumes: `ArrivalsReport`, `ArrivalRow` from `src/types.ts` (as extended in Task 1).
- Produces: `HousekeepingArrival` type and `arrivalsForDate(arrivals: ArrivalsReport | undefined, dateISO: string): HousekeepingArrival[]`, used by Task 7 (`HousekeepingView`).

- [ ] **Step 1: Write the failing test**

Create `tests/metrics/housekeeping.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { arrivalsForDate } from '../../src/metrics/housekeeping';
import type { ArrivalsReport } from '../../src/types';

function report(rows: ArrivalsReport['rows']): ArrivalsReport {
  return { periodFrom: '2026-06-01', periodTo: '2026-06-30', rows };
}

describe('arrivalsForDate', () => {
  it('returns only rows arriving on the given date', () => {
    const arrivals = report([
      { resNo: '1', guest: 'A', room: 'A1', rate: 1, arrival: '2026-06-01', departure: '2026-06-03', pax: 2, children: 0, resType: 'Confirm Booking', channel: 'OTA', notes: 'note-a' },
      { resNo: '2', guest: 'B', room: 'A2', rate: 1, arrival: '2026-06-02', departure: '2026-06-04', pax: 3, children: 1, resType: 'Confirm Booking', channel: 'OTA', notes: 'note-b' },
    ]);
    const result = arrivalsForDate(arrivals, '2026-06-01');
    expect(result).toEqual([
      { room: 'A1', guest: 'A', adults: 2, children: 0, arrivalDate: '2026-06-01', notes: 'note-a' },
    ]);
  });

  it('excludes rows that are not Confirm Booking', () => {
    const arrivals = report([
      { resNo: '1', guest: 'A', room: 'A1', rate: 1, arrival: '2026-06-01', departure: '2026-06-03', pax: 2, children: 0, resType: 'Tentative', channel: 'OTA', notes: '' },
      { resNo: '2', guest: 'B', room: 'A2', rate: 1, arrival: '2026-06-01', departure: '2026-06-04', pax: 3, children: 1, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
    ]);
    const result = arrivalsForDate(arrivals, '2026-06-01');
    expect(result).toHaveLength(1);
    expect(result[0].guest).toBe('B');
  });

  it('sorts results by room', () => {
    const arrivals = report([
      { resNo: '1', guest: 'Z', room: 'A4 - Villa A4', rate: 1, arrival: '2026-06-01', departure: '2026-06-03', pax: 2, children: 0, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
      { resNo: '2', guest: 'Y', room: 'A1 - Villa A1', rate: 1, arrival: '2026-06-01', departure: '2026-06-04', pax: 3, children: 1, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
    ]);
    const result = arrivalsForDate(arrivals, '2026-06-01');
    expect(result.map((r) => r.room)).toEqual(['A1 - Villa A1', 'A4 - Villa A4']);
  });

  it('returns an empty array when arrivals is undefined', () => {
    expect(arrivalsForDate(undefined, '2026-06-01')).toEqual([]);
  });

  it('returns an empty array when no rows match the date', () => {
    const arrivals = report([
      { resNo: '1', guest: 'A', room: 'A1', rate: 1, arrival: '2026-06-05', departure: '2026-06-07', pax: 2, children: 0, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
    ]);
    expect(arrivalsForDate(arrivals, '2026-06-01')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/metrics/housekeeping.test.ts`
Expected: FAIL — `Cannot find module '../../src/metrics/housekeeping'`

- [ ] **Step 3: Write the implementation**

Create `src/metrics/housekeeping.ts`:

```ts
import type { ArrivalsReport } from '../types';

export interface HousekeepingArrival {
  room: string;
  guest: string;
  adults: number | null;
  children: number | null;
  arrivalDate: string; // ISO
  notes: string;       // raw, unredacted — see docs/adr/0001-housekeeper-notes-passthrough-raw.md
}

export function arrivalsForDate(
  arrivals: ArrivalsReport | undefined,
  dateISO: string
): HousekeepingArrival[] {
  const rows = arrivals?.rows ?? [];
  return rows
    .filter((r) => r.arrival === dateISO && r.resType === 'Confirm Booking')
    .map((r) => ({
      room: r.room,
      guest: r.guest,
      adults: r.pax,
      children: r.children,
      arrivalDate: r.arrival as string,
      notes: r.notes,
    }))
    .sort((a, b) => a.room.localeCompare(b.room));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/metrics/housekeeping.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/metrics/housekeeping.ts tests/metrics/housekeeping.test.ts
git commit -m "feat: add arrivalsForDate housekeeping metric"
```

---

## Task 3: Role/Permission model in `_auth.ts`

**Files:**
- Modify: `netlify/functions/_auth.ts`
- Modify: `tests/functions/auth.test.ts`

**Interfaces:**
- Produces: `Role` type (`'owner' | 'housekeeper'`), `Permission` type, `ROLE_PERMISSIONS` map, `roleFromCookie(req: Request, secret: string): Role | null`, `hasPermission(role: Role | null, perm: Permission): boolean`, `clearedCookie(): string`. Consumed by Task 4 (`auth.ts`), Task 5 (`snapshots.ts`), Task 6 (`logout.ts`/`whoami.ts`).
- Keeps existing exports (`signToken`, `verifyToken`, `cookieFromToken`, `tokenFromCookieHeader`, `isAuthed`, `COOKIE` constant usage) unchanged in behavior — `isAuthed` still means "any valid token, any role" and stays used by `ai-insight.ts` unmodified.

- [ ] **Step 1: Write the failing test**

Add to `tests/functions/auth.test.ts` (new `describe` blocks, keep the existing `describe('signed token', ...)` block as-is):

```ts
import { roleFromCookie, hasPermission, signToken, cookieFromToken } from '../../netlify/functions/_auth';

function reqWithCookie(cookie: string): Request {
  return new Request('https://example.com/api/snapshots', { headers: { cookie } });
}

describe('roleFromCookie', () => {
  it('returns the role for a valid owner token', () => {
    const token = signToken('owner', 'secret123');
    const cookie = cookieFromToken(token);
    const req = reqWithCookie(cookie.split(';')[0]);
    expect(roleFromCookie(req, 'secret123')).toBe('owner');
  });

  it('returns the role for a valid housekeeper token', () => {
    const token = signToken('housekeeper', 'secret123');
    const cookie = cookieFromToken(token);
    const req = reqWithCookie(cookie.split(';')[0]);
    expect(roleFromCookie(req, 'secret123')).toBe('housekeeper');
  });

  it('returns null for a tampered token', () => {
    const token = signToken('owner', 'secret123');
    const cookie = cookieFromToken(token + 'x');
    const req = reqWithCookie(cookie.split(';')[0]);
    expect(roleFromCookie(req, 'secret123')).toBeNull();
  });

  it('returns null when no cookie is present', () => {
    const req = new Request('https://example.com/api/snapshots');
    expect(roleFromCookie(req, 'secret123')).toBeNull();
  });

  it('returns null for an unrecognized role payload', () => {
    const token = signToken('not-a-real-role', 'secret123');
    const cookie = cookieFromToken(token);
    const req = reqWithCookie(cookie.split(';')[0]);
    expect(roleFromCookie(req, 'secret123')).toBeNull();
  });
});

describe('hasPermission', () => {
  it('owner has read:revenue', () => {
    expect(hasPermission('owner', 'read:revenue')).toBe(true);
  });
  it('housekeeper does not have read:revenue', () => {
    expect(hasPermission('housekeeper', 'read:revenue')).toBe(false);
  });
  it('housekeeper has read:arrivals', () => {
    expect(hasPermission('housekeeper', 'read:arrivals')).toBe(true);
  });
  it('null role has no permissions', () => {
    expect(hasPermission(null, 'read:arrivals')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/functions/auth.test.ts`
Expected: FAIL — `roleFromCookie`/`hasPermission` are not exported from `_auth.ts`

- [ ] **Step 3: Implement the Role/Permission model**

Modify `netlify/functions/_auth.ts` — add after the existing imports, before `signToken`:

```ts
export type Role = 'owner' | 'housekeeper';

export type Permission =
  | 'read:revenue'
  | 'read:arrivals'
  | 'write:snapshot'
  | 'read:snapshot-keys';

const ROLE_PERMISSIONS: Record<Role, Set<Permission>> = {
  owner: new Set(['read:revenue', 'read:arrivals', 'write:snapshot', 'read:snapshot-keys']),
  housekeeper: new Set(['read:arrivals']),
};

const ROLES: Role[] = ['owner', 'housekeeper'];

function isRole(payload: string): payload is Role {
  return (ROLES as string[]).includes(payload);
}
```

Then, after the existing `isAuthed` function at the end of the file, add:

```ts
export function roleFromCookie(req: Request, secret: string): Role | null {
  const token = tokenFromCookieHeader(req.headers.get('cookie') || undefined);
  if (!token || !verifyToken(token, secret)) return null;
  const idx = token.lastIndexOf('.');
  const payload = token.slice(0, idx);
  return isRole(payload) ? payload : null;
}

export function hasPermission(role: Role | null, perm: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].has(perm);
}

export function clearedCookie(): string {
  return `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}
```

Note: `COOKIE` is already defined as a module-level `const COOKIE = 'cdy_auth';` earlier in the file — `clearedCookie()` reuses it, matching the existing `cookieFromToken()` pattern.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/functions/auth.test.ts`
Expected: PASS (all tests, including the pre-existing `describe('signed token', ...)` block)

- [ ] **Step 5: Run full suite to check for regressions**

Run: `npx vitest run`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/_auth.ts tests/functions/auth.test.ts
git commit -m "feat: add role/permission model to auth token layer"
```

---

## Task 4: `/api/auth` accepts two passwords, returns role

**Files:**
- Modify: `netlify/functions/auth.ts`

**Interfaces:**
- Consumes: `signToken`, `cookieFromToken` (unchanged), `Role` type from Task 3.
- Produces: JSON response body now includes `role` — consumed by `src/lib/api.ts` (Task 8) and `AuthGate.tsx` (Task 9).

- [ ] **Step 1: Manually verify current behavior before changing (no test framework covers Netlify Function HTTP handlers directly in this repo — confirmed via `grep -rl "netlify/functions/auth" tests/`)**

Run: `grep -rl "netlify/functions/auth'" /Users/temtem/projects/casa-de-yim-dashboard/tests/ 2>/dev/null || echo "no direct tests found — expected"`
Expected: `no direct tests found — expected` (this file's logic is exercised indirectly via `_auth.ts` unit tests from Task 3; the HTTP handler itself follows the same manual-verification pattern as the pre-existing `auth.ts`)

- [ ] **Step 2: Implement two-password role resolution**

Replace the full contents of `netlify/functions/auth.ts`:

```ts
import type { Config } from '@netlify/functions';
import { signToken, cookieFromToken, type Role } from './_auth';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const secret = process.env.AUTH_SECRET || '';
  const ownerPassword = process.env.DASHBOARD_PASSWORD || '';
  const housekeeperPassword = process.env.HOUSEKEEPING_PASSWORD || '';
  if (!secret || !ownerPassword) return new Response('Server not configured', { status: 500 });

  let body: { password?: string };
  try {
    body = await req.json();
  } catch (_e) {
    return new Response('Bad request', { status: 400 });
  }

  let role: Role | null = null;
  if (body.password && body.password === ownerPassword) {
    role = 'owner';
  } else if (body.password && housekeeperPassword && body.password === housekeeperPassword) {
    role = 'housekeeper';
  }

  if (!role) {
    return new Response(JSON.stringify({ ok: false }), { status: 401, headers: { 'content-type': 'application/json' } });
  }

  const token = signToken(role, secret);
  return new Response(JSON.stringify({ ok: true, role }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'set-cookie': cookieFromToken(token) },
  });
}

export const config: Config = { path: '/api/auth' };
```

- [ ] **Step 3: Run full test suite to check for regressions**

Run: `npx vitest run`
Expected: All PASS (this file has no direct unit tests, but confirm nothing else broke)

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/auth.ts
git commit -m "feat: /api/auth accepts owner and housekeeper passwords"
```

---

## Task 5: `/api/snapshots` permission-gated per method and role

**Files:**
- Create: `tests/functions/snapshots.test.ts`
- Modify: `netlify/functions/snapshots.ts`

**Interfaces:**
- Consumes: `roleFromCookie`, `hasPermission`, `signToken`, `cookieFromToken` from `_auth.ts` (Task 3). `arrivalsForDate` is NOT used here — the endpoint returns the full `arrivals.rows` array (unfiltered by date) for the `housekeeper` role; date filtering happens client-side in `HousekeepingView` (Task 7), matching spec §5.4/§5.6.
- Produces: for `housekeeper` role, `GET ?key=...` (any key, ignored) returns `{ ok: true, data: { dataAsOf: string | null, arrivals: { rows: ArrivalRow[] } } }`. `POST` and `GET` (list) return `403`.

This module currently has no test file — this task creates one and needs a way to construct authenticated `Request` objects and stub `@netlify/blobs`. Check how the existing `getStore`/Netlify Blobs dependency is mocked elsewhere first.

- [ ] **Step 1: Check for an existing Blobs test-mocking pattern**

Run: `grep -rl "@netlify/blobs" /Users/temtem/projects/casa-de-yim-dashboard/tests/ 2>/dev/null || echo "none found"`
Expected: `none found` — no existing pattern, so this task mocks `@netlify/blobs` directly with `vi.mock`.

- [ ] **Step 2: Write the failing tests**

Create `tests/functions/snapshots.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signToken, cookieFromToken } from '../../netlify/functions/_auth';

const mockGetJSON = vi.fn();
const mockSetJSON = vi.fn();
const mockList = vi.fn();

vi.mock('@netlify/blobs', () => ({
  getStore: () => ({
    get: mockGetJSON,
    setJSON: mockSetJSON,
    list: mockList,
  }),
}));

import handler from '../../netlify/functions/snapshots';

const SECRET = 'test-secret';
process.env.AUTH_SECRET = SECRET;

function cookieFor(role: 'owner' | 'housekeeper'): string {
  const token = signToken(role, SECRET);
  return cookieFromToken(token).split(';')[0];
}

function req(method: string, url: string, cookie: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { cookie, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const FULL_SNAPSHOT = {
  uploadedAt: '2026-07-02T05:00:00.000Z',
  dataAsOf: '2026-07-02',
  yearly: { year: 2026, months: [], grandTotal: {} },
  arrivals: { periodFrom: '2026-07-02', periodTo: '2026-09-02', rows: [
    { resNo: '1', guest: 'A', room: 'A1', rate: 9999, arrival: '2026-07-02', departure: '2026-07-04', pax: 2, children: 0, resType: 'Confirm Booking', channel: 'OTA', notes: 'note' },
  ] },
};

beforeEach(() => {
  mockGetJSON.mockReset();
  mockSetJSON.mockReset();
  mockList.mockReset();
});

describe('POST /api/snapshots', () => {
  it('owner can write', async () => {
    const res = await handler(req('POST', 'https://x/api/snapshots', cookieFor('owner'), { key: 'snapshot/2026-07-02', snapshot: FULL_SNAPSHOT }));
    expect(res.status).toBe(200);
    expect(mockSetJSON).toHaveBeenCalled();
  });

  it('housekeeper cannot write', async () => {
    const res = await handler(req('POST', 'https://x/api/snapshots', cookieFor('housekeeper'), { key: 'snapshot/2026-07-02', snapshot: FULL_SNAPSHOT }));
    expect(res.status).toBe(403);
    expect(mockSetJSON).not.toHaveBeenCalled();
  });
});

describe('GET /api/snapshots (list keys)', () => {
  it('owner can list', async () => {
    mockList.mockResolvedValue({ blobs: [{ key: 'snapshot/2026-07-01' }, { key: 'snapshot/2026-07-02' }] });
    const res = await handler(req('GET', 'https://x/api/snapshots', cookieFor('owner')));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.keys).toEqual(['snapshot/2026-07-01', 'snapshot/2026-07-02']);
  });

  it('housekeeper cannot list', async () => {
    const res = await handler(req('GET', 'https://x/api/snapshots', cookieFor('housekeeper')));
    expect(res.status).toBe(403);
  });
});

describe('GET /api/snapshots?key=... (single snapshot)', () => {
  it('owner gets the full snapshot unchanged', async () => {
    mockGetJSON.mockResolvedValue(FULL_SNAPSHOT);
    const res = await handler(req('GET', 'https://x/api/snapshots?key=snapshot/2026-07-02', cookieFor('owner')));
    const json = await res.json();
    expect(json.data.yearly).toBeDefined();
    expect(json.data.arrivals.rows[0].rate).toBe(9999);
  });

  it('housekeeper gets a stripped response regardless of requested key', async () => {
    mockList.mockResolvedValue({ blobs: [{ key: 'snapshot/2026-07-02' }] });
    mockGetJSON.mockResolvedValue(FULL_SNAPSHOT);
    const res = await handler(req('GET', 'https://x/api/snapshots?key=snapshot/some-other-date', cookieFor('housekeeper')));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.yearly).toBeUndefined();
    expect(json.data.dataAsOf).toBe('2026-07-02');
    expect(json.data.arrivals.rows[0].guest).toBe('A');
    expect(json.data.arrivals.rows[0].rate).toBeUndefined();
    // resType MUST survive stripping — arrivalsForDate() (Task 2) filters on it client-side;
    // dropping it would silently make every arrival invisible to housekeepers.
    expect(json.data.arrivals.rows[0].resType).toBe('Confirm Booking');
    // resolved the *latest* snapshot, not the one named in the query string:
    expect(mockGetJSON).toHaveBeenCalledWith('snapshot/2026-07-02', expect.anything());
  });

  it('rejects requests with no valid cookie', async () => {
    const res = await handler(req('GET', 'https://x/api/snapshots?key=snapshot/2026-07-02', ''));
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/functions/snapshots.test.ts`
Expected: FAIL — current `snapshots.ts` has no role gating, so owner/housekeeper both behave identically (housekeeper tests expecting `403` will get `200`; stripped-response tests will get full data). The `401` "no cookie" test should already PASS since `isAuthed`-style gating exists today — that's fine, we're about to replace it.

- [ ] **Step 4: Implement permission-gated snapshots handler**

Replace the full contents of `netlify/functions/snapshots.ts`:

```ts
import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { roleFromCookie, hasPermission } from './_auth';

function store() {
  return getStore({ name: 'snapshots', consistency: 'strong' });
}

interface StrippedArrivalRow {
  room: string;
  guest: string;
  pax: number | null;
  children: number | null;
  arrival: string | null;
  departure: string | null;
  resType: string;
  notes: string;
}

interface StrippedSnapshot {
  dataAsOf: string | null;
  arrivals: { rows: StrippedArrivalRow[] };
}

function stripForHousekeeper(snapshot: any): StrippedSnapshot {
  const rows = (snapshot?.arrivals?.rows ?? []) as any[];
  return {
    dataAsOf: snapshot?.dataAsOf ?? null,
    arrivals: {
      rows: rows.map((r) => ({
        room: r.room,
        guest: r.guest,
        pax: r.pax,
        children: r.children,
        arrival: r.arrival,
        departure: r.departure,
        resType: r.resType,
        notes: r.notes,
      })),
    },
  };
}

export default async function handler(req: Request): Promise<Response> {
  const secret = process.env.AUTH_SECRET || '';
  const role = roleFromCookie(req, secret);
  if (!role) {
    return new Response(JSON.stringify({ ok: false, reason: 'unauthorized' }), {
      status: 401, headers: { 'content-type': 'application/json' },
    });
  }

  const s = store();
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const key = url.searchParams.get('key');

    if (role === 'housekeeper') {
      // key param is ignored — housekeeper always gets the latest snapshot, stripped.
      const list = await s.list();
      const keys = list.blobs.map((b) => b.key).sort();
      const latestKey = keys[keys.length - 1];
      if (!latestKey) return Response.json({ ok: true, data: { dataAsOf: null, arrivals: { rows: [] } } });
      const data = await s.get(latestKey, { type: 'json' });
      return Response.json({ ok: true, data: stripForHousekeeper(data) });
    }

    if (key) {
      if (!hasPermission(role, 'read:arrivals')) {
        return new Response(JSON.stringify({ ok: false, reason: 'forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } });
      }
      const data = await s.get(key, { type: 'json' });
      return Response.json({ ok: true, data });
    }

    if (!hasPermission(role, 'read:snapshot-keys')) {
      return new Response(JSON.stringify({ ok: false, reason: 'forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } });
    }
    const list = await s.list();
    const keys = list.blobs.map((b) => b.key).sort();
    return Response.json({ ok: true, keys });
  }

  if (req.method === 'POST') {
    if (!hasPermission(role, 'write:snapshot')) {
      return new Response(JSON.stringify({ ok: false, reason: 'forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } });
    }
    const body = (await req.json()) as { key: string; snapshot: unknown };
    if (!body.key || !body.snapshot) return new Response('Bad request', { status: 400 });
    await s.setJSON(body.key, body.snapshot);
    return Response.json({ ok: true });
  }

  return new Response('Method Not Allowed', { status: 405 });
}

export const config: Config = { path: '/api/snapshots' };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/functions/snapshots.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 6: Run full suite to check for regressions**

Run: `npx vitest run`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add netlify/functions/snapshots.ts tests/functions/snapshots.test.ts
git commit -m "feat: permission-gate /api/snapshots by role"
```

---

## Task 6: `/api/logout` and `/api/whoami` endpoints

**Files:**
- Create: `netlify/functions/logout.ts`
- Create: `netlify/functions/whoami.ts`
- Create: `tests/functions/logout.test.ts`
- Create: `tests/functions/whoami.test.ts`

**Interfaces:**
- Consumes: `clearedCookie()`, `roleFromCookie()` from `_auth.ts` (Task 3).
- Produces: `POST /api/logout` → `Set-Cookie` clearing header. `GET /api/whoami` → `{ role }` or 401. Consumed by `src/lib/api.ts` (Task 8).

- [ ] **Step 1: Write the failing tests**

Create `tests/functions/logout.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import handler from '../../netlify/functions/logout';

describe('POST /api/logout', () => {
  it('clears the auth cookie', async () => {
    const res = await handler(new Request('https://x/api/logout', { method: 'POST' }));
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('cdy_auth=;');
    expect(setCookie).toContain('Max-Age=0');
  });

  it('rejects non-POST methods', async () => {
    const res = await handler(new Request('https://x/api/logout', { method: 'GET' }));
    expect(res.status).toBe(405);
  });
});
```

Create `tests/functions/whoami.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { signToken, cookieFromToken } from '../../netlify/functions/_auth';
import handler from '../../netlify/functions/whoami';

const SECRET = 'test-secret';
process.env.AUTH_SECRET = SECRET;

describe('GET /api/whoami', () => {
  it('returns the role for a valid owner cookie', async () => {
    const token = signToken('owner', SECRET);
    const cookie = cookieFromToken(token).split(';')[0];
    const res = await handler(new Request('https://x/api/whoami', { headers: { cookie } }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.role).toBe('owner');
  });

  it('returns the role for a valid housekeeper cookie', async () => {
    const token = signToken('housekeeper', SECRET);
    const cookie = cookieFromToken(token).split(';')[0];
    const res = await handler(new Request('https://x/api/whoami', { headers: { cookie } }));
    const json = await res.json();
    expect(json.role).toBe('housekeeper');
  });

  it('returns 401 when there is no valid cookie', async () => {
    const res = await handler(new Request('https://x/api/whoami'));
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/functions/logout.test.ts tests/functions/whoami.test.ts`
Expected: FAIL — `Cannot find module '../../netlify/functions/logout'` / `'.../whoami'`

- [ ] **Step 3: Implement `netlify/functions/logout.ts`**

```ts
import type { Config } from '@netlify/functions';
import { clearedCookie } from './_auth';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'set-cookie': clearedCookie() },
  });
}

export const config: Config = { path: '/api/logout' };
```

- [ ] **Step 4: Implement `netlify/functions/whoami.ts`**

```ts
import type { Config } from '@netlify/functions';
import { roleFromCookie } from './_auth';

export default async function handler(req: Request): Promise<Response> {
  const secret = process.env.AUTH_SECRET || '';
  const role = roleFromCookie(req, secret);
  if (!role) {
    return new Response(JSON.stringify({ ok: false }), { status: 401, headers: { 'content-type': 'application/json' } });
  }
  return Response.json({ ok: true, role });
}

export const config: Config = { path: '/api/whoami' };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/functions/logout.test.ts tests/functions/whoami.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Run full suite to check for regressions**

Run: `npx vitest run`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add netlify/functions/logout.ts netlify/functions/whoami.ts tests/functions/logout.test.ts tests/functions/whoami.test.ts
git commit -m "feat: add /api/logout and /api/whoami endpoints"
```

---

## Task 7: `HousekeepingView` component

**Files:**
- Create: `src/ui/components/HousekeepingView.tsx`

**Interfaces:**
- Consumes: `arrivalsForDate` from `src/metrics/housekeeping.ts` (Task 2), `HousekeepingArrival` type, `SectionCard`/`SectionHead` from `src/ui/components/SectionCard.tsx`.
- Props: `{ arrivals: ArrivalsReport | undefined; onLogout?: () => void }`. `onLogout` is optional — present only when rendered for the standalone `housekeeper` role (Task 9); absent when rendered as the owner's "แม่บ้าน" tab (no logout button needed there, since `App.tsx`'s owner shell has its own session).
- No test file for this task — this is a presentational component; its data logic (`arrivalsForDate`) is already unit-tested in Task 2. Verified via manual browser check in Task 10.

- [ ] **Step 1: Implement `HousekeepingView`**

Create `src/ui/components/HousekeepingView.tsx`:

```tsx
import { useState } from 'react';
import type { ArrivalsReport } from '../../types';
import { arrivalsForDate, type HousekeepingArrival } from '../../metrics/housekeeping';
import SectionCard, { SectionHead } from './SectionCard';

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function guestCountLabel(a: HousekeepingArrival): string {
  const parts: string[] = [];
  if (a.adults != null) parts.push(`${a.adults} ผู้ใหญ่`);
  if (a.children) parts.push(`${a.children} เด็ก`);
  return parts.length > 0 ? parts.join(' ') : '-';
}

function copyText(label: string, rows: HousekeepingArrival[]): string {
  if (rows.length === 0) return `${label} — ไม่มีแขกเข้าพัก`;
  return rows
    .map((r) => {
      const lines = [`🏡 ${r.room}`, `แขก: ${r.guest} (${guestCountLabel(r)})`];
      if (r.notes) lines.push(`หมายเหตุ: ${r.notes}`);
      return lines.join('\n');
    })
    .join('\n\n');
}

function DaySection({ label, rows }: { label: string; rows: HousekeepingArrival[] }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(copyText(label, rows));
      setCopyState('copied');
    } catch (_e) {
      setCopyState('failed');
    }
    setTimeout(() => setCopyState('idle'), 2000);
  }

  const copyLabel = copyState === 'copied' ? 'คัดลอกแล้ว!' : copyState === 'failed' ? 'คัดลอกไม่สำเร็จ' : 'คัดลอกข้อความ';

  return (
    <SectionCard>
      <SectionHead
        title={label}
        right={
          <button
            onClick={onCopy}
            style={{
              background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10,
              padding: '8px 16px', fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {copyLabel}
          </button>
        }
      />
      {rows.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif" }}>
          ไม่มีแขกเข้าพัก{label === 'วันนี้' ? 'วันนี้' : 'พรุ่งนี้'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ padding: '12px 16px', background: 'var(--card-2)', borderRadius: 14 }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 18, color: 'var(--ink)' }}>{r.room}</div>
              <div style={{ fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif", fontSize: 13, color: 'var(--ink)', marginTop: 4 }}>
                แขก: {r.guest} ({guestCountLabel(r)})
              </div>
              {r.notes && (
                <div style={{ fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif", fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  หมายเหตุ: {r.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

export default function HousekeepingView({
  arrivals, onLogout,
}: { arrivals: ArrivalsReport | undefined; onLogout?: () => void }) {
  const today = isoDate(0);
  const tomorrow = isoDate(1);
  const todayRows = arrivalsForDate(arrivals, today);
  const tomorrowRows = arrivalsForDate(arrivals, tomorrow);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {onLogout && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onLogout}
            style={{
              background: 'none', border: '1px solid var(--line)', borderRadius: 10,
              padding: '6px 14px', fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 700,
              color: 'var(--muted)', cursor: 'pointer',
            }}
          >
            ออกจากระบบ
          </button>
        </div>
      )}
      <DaySection label="วันนี้" rows={todayRows} />
      <DaySection label="พรุ่งนี้" rows={tomorrowRows} />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: no errors referencing `HousekeepingView.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/HousekeepingView.tsx
git commit -m "feat: add HousekeepingView component"
```

---

## Task 8: `src/lib/api.ts` — role-aware login, logout, whoami

**Files:**
- Modify: `src/lib/api.ts`

**Interfaces:**
- Produces: `login(password: string): Promise<{ ok: boolean; role: Role | null }>` (signature change — was `Promise<boolean>`), `logout(): Promise<void>`, `whoami(): Promise<Role | null>`. `Role` type imported from `../../netlify/functions/_auth` (already exported there per Task 3) — re-exported or aliased locally since frontend code doesn't otherwise import from `netlify/functions/`.
- Consumed by: `LoginPage.tsx` and `AuthGate.tsx` (Task 9).

Note: `Role` is currently only exported from `netlify/functions/_auth.ts`, a server-only module (uses `node:crypto`). Importing it as a **type-only** import into frontend code is safe (erased at compile time, no runtime Node dependency bundled) — `import type { Role } from '../../netlify/functions/_auth'`.

- [ ] **Step 1: Modify `src/lib/api.ts`**

Replace the `login` function and add `logout`/`whoami`:

```ts
import type { Snapshot } from '../types';
import type { Role } from '../../netlify/functions/_auth';

export type { Role };

export async function login(password: string): Promise<{ ok: boolean; role: Role | null }> {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) return { ok: false, role: null };
  const json = await res.json();
  return { ok: true, role: json.role as Role };
}

export async function logout(): Promise<void> {
  await fetch('/api/logout', { method: 'POST' });
}

export async function whoami(): Promise<Role | null> {
  const res = await fetch('/api/whoami');
  if (!res.ok) return null;
  const json = await res.json();
  return json.role as Role;
}
```

Leave `listSnapshotKeys`, `getSnapshot`, `saveSnapshot`, `aiInsight` unchanged.

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: errors in `LoginPage.tsx` and `AuthGate.tsx` (both still call the old `login()` signature) — **expected at this point**, fixed in Task 9.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: add role-aware login, logout, whoami to api client"
```

---

## Task 9: `AuthGate`, `LoginPage`, `App`, `Dashboard` — role routing

**Files:**
- Modify: `src/ui/AuthGate.tsx`
- Modify: `src/ui/LoginPage.tsx`
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/Dashboard.tsx`

**Interfaces:**
- Consumes: `login`, `logout`, `whoami`, `Role` from `src/lib/api.ts` (Task 8); `HousekeepingView` from Task 7; `loadSnapshots`, `LoadedSnapshots` from `src/ui/dashboardData.ts` (unchanged).
- Produces: `App` now takes no props (role is resolved internally via `AuthGate`'s render-prop) — `AuthGate` renders `children` as a function receiving `role: Role`. `Dashboard` now takes `{ data: LoadedSnapshots }` as a required prop instead of self-fetching via `loadSnapshots()`.

- [ ] **Step 1: Modify `LoginPage.tsx` to pass role through `onSuccess`**

Replace `src/ui/LoginPage.tsx`:

```tsx
import { useState } from 'react';
import { login, type Role } from '../lib/api';

export default function LoginPage({ onSuccess }: { onSuccess: (role: Role) => void }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    const result = await login(pw);
    setBusy(false);
    if (result.ok && result.role) onSuccess(result.role);
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

- [ ] **Step 2: Modify `AuthGate.tsx` to hold and expose role via render-prop**

Replace `src/ui/AuthGate.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { whoami, type Role } from '../lib/api';
import LoginPage from './LoginPage';

export default function AuthGate({ children }: { children: (role: Role) => React.ReactNode }) {
  const [role, setRole] = useState<Role | null | 'checking'>('checking');

  useEffect(() => {
    whoami().then(setRole);
  }, []);

  if (role === 'checking') return <div className="p-8 text-slate-500">กำลังโหลด…</div>;
  if (role === null) return <LoginPage onSuccess={setRole} />;
  return <>{children(role)}</>;
}
```

- [ ] **Step 3: Modify `Dashboard.tsx` to accept already-loaded snapshot data as a prop**

Per spec §5.6, the owner's "แม่บ้าน" tab must reuse the same `loadSnapshots()` call `Dashboard` already makes — not fetch independently. This requires lifting the fetch out of `Dashboard` and into its parent (`OwnerShell`, written in Step 4).

In `src/ui/Dashboard.tsx`, change the function signature and remove its internal fetch. Replace:

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
```

with:

```tsx
import { useState } from 'react';
import PeriodToggle from './components/PeriodToggle';
import KpiCards from './components/KpiCards';
import TrendChart from './components/TrendChart';
import ForwardPace from './components/ForwardPace';
import MixPanels from './components/MixPanels';
import Recommendations from './components/Recommendations';
import ForecastSection from './components/ForecastSection';
import { targetMonthForPeriod, type Period, type LoadedSnapshots } from './dashboardData';
import { villaCount } from '../metrics/capacity';
import { dailyOccupancy } from '../metrics/pace';
import { weeklyKpi, type WeeklyKpi } from '../metrics/weekly';

export default function Dashboard({ data }: { data: LoadedSnapshots }) {
  const [period, setPeriod] = useState<Period>('thisMonth');

  if (!data.latest) return <div className="text-slate-500">ยังไม่มีข้อมูล — ไปที่หน้า "อัปโหลด" ก่อน</div>;
```

Leave the rest of `Dashboard.tsx` (everything after the `if (!data.latest) return ...` line, from `const dataAsOf = ...` through the final closing `}`) completely unchanged — it already reads from the local `data` variable, which now arrives as a prop instead of local state.

- [ ] **Step 4: Rewrite `App.tsx` — owner shell loads data once and shares it across tabs; housekeeper shell fetches independently**

Replace `src/ui/App.tsx`:

```tsx
import { useEffect, useState } from 'react';
import AuthGate from './AuthGate';
import UploadPage from './UploadPage';
import Dashboard from './Dashboard';
import HousekeepingView from './components/HousekeepingView';
import { loadSnapshots, type LoadedSnapshots } from './dashboardData';
import { getSnapshot, logout, type Role } from '../lib/api';
import type { ArrivalsReport } from '../types';

function OwnerShell() {
  const [tab, setTab] = useState<'dashboard' | 'housekeeping' | 'upload'>('dashboard');
  const [data, setData] = useState<LoadedSnapshots | null>(null);

  useEffect(() => {
    loadSnapshots().then(setData);
  }, []);

  const TAB_LABEL: Record<typeof tab, string> = {
    dashboard: 'Dashboard',
    housekeeping: 'แม่บ้าน',
    upload: 'อัปโหลด',
  };

  function refetch() {
    setData(null);
    loadSnapshots().then(setData);
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sand)' }}>
      {/* Dark header bar */}
      <header className="cdy-header" style={{
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
          <span className="cdy-wordmark-sub" style={{ fontFamily: "'Manrope', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)' }}>
            Krabi · Dashboard
          </span>
        </div>
        {/* Tab nav */}
        <nav className="cdy-tab-nav" style={{ display: 'flex', gap: 20, marginLeft: 20 }}>
          {(['dashboard', 'housekeeping', 'upload'] as const).map((t) => (
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
              {TAB_LABEL[t]}
            </button>
          ))}
        </nav>
      </header>

      {/* Content panel */}
      <main className="cdy-main" style={{ padding: 16, maxWidth: 1200, margin: '0 auto' }}>
        <div className="cdy-panel" style={{
          background: 'var(--panel)',
          borderRadius: 28,
          padding: '24px 28px 32px',
          minHeight: 'calc(100vh - 92px)',
        }}>
          {!data && <div className="text-slate-500">กำลังโหลด…</div>}
          {data && tab === 'dashboard' && <Dashboard data={data} />}
          {data && tab === 'housekeeping' && <HousekeepingView arrivals={data.latest?.arrivals} />}
          {tab === 'upload' && <UploadPage onSaved={() => { setTab('dashboard'); refetch(); }} />}
        </div>
      </main>
    </div>
  );
}

function HousekeeperShell() {
  const [arrivals, setArrivals] = useState<ArrivalsReport | undefined>(undefined);

  useEffect(() => {
    // housekeeper role: /api/snapshots ignores the key param and always returns the latest snapshot, pre-stripped (see Task 5)
    getSnapshot('latest').then((data) => setArrivals(data.arrivals));
  }, []);

  async function onLogout() {
    await logout();
    window.location.reload();
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sand)', padding: 16 }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <HousekeepingView arrivals={arrivals} onLogout={onLogout} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthGate>
      {(role: Role) => (role === 'owner' ? <OwnerShell /> : <HousekeeperShell />)}
    </AuthGate>
  );
}
```

Notes on this implementation:
- `OwnerShell` calls `loadSnapshots()` once on mount and passes the same `data` object to both `Dashboard` (Step 3's new prop signature) and `HousekeepingView` — no duplicate fetch when switching between the two tabs, matching spec §5.6.
- `UploadPage`'s `onSaved` callback now also calls `refetch()` so a fresh upload immediately reflects in both tabs without a manual page reload — this preserves existing behavior (switching to the Dashboard tab after upload) while fixing what would otherwise be silently stale data in the now-shared `data` state.
- `HousekeeperShell`'s `getSnapshot('latest')` call passes the literal string `'latest'` as the `key` query param — per Task 5's `snapshots.ts`, the `housekeeper` role branch ignores whatever key is passed and always resolves the actual latest snapshot server-side, so this string is never used for lookup, only sent as a syntactically-valid (non-empty) key value. `getSnapshot`'s return type is `Snapshot` per its existing signature in `api.ts`, but the actual runtime shape for a housekeeper is the stripped `{ dataAsOf, arrivals }` object from Task 5 — `data.arrivals` is present in both cases, so `.arrivals` access is safe; other `Snapshot` fields (`yearly`, `channels`, etc.) will be `undefined` at runtime for this role, matching their already-optional (`?`) typing in `Snapshot`.

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: no errors

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All PASS (existing `Dashboard.tsx` has no direct unit tests today, so no test file needs updating for its prop-signature change — confirm via `grep -rl "from '../Dashboard'\|from './Dashboard'" tests/` returning nothing)

- [ ] **Step 7: Commit**

```bash
git add src/ui/AuthGate.tsx src/ui/LoginPage.tsx src/ui/App.tsx src/ui/Dashboard.tsx
git commit -m "feat: role-based routing — owner tab bar + housekeeper standalone view"
```

---

## Task 10: Manual verification in browser

**Files:** none (verification only)

- [ ] **Step 1: Set required env vars for local dev**

Ensure `.env` has `DASHBOARD_PASSWORD`, `AUTH_SECRET` set (per `AGENTS.md`), and add a test value for the new optional var:

```bash
echo 'HOUSEKEEPING_PASSWORD=test-hk-pw' >> .env
```

- [ ] **Step 2: Start the dev server**

Run: `npx netlify dev`
Expected: server starts on `http://localhost:8888`

- [ ] **Step 3: Verify owner login still works and shows the new tab**

Open `http://localhost:8888`, log in with `DASHBOARD_PASSWORD`. Confirm:
- Tab bar shows Dashboard / แม่บ้าน / อัปโหลด (3 tabs)
- Clicking "แม่บ้าน" shows today/tomorrow sections with any arrivals from the currently uploaded snapshot (if none uploaded yet, both sections show the empty-state message)
- "คัดลอกข้อความ" button copies text and shows "คัดลอกแล้ว!" briefly

- [ ] **Step 4: Verify housekeeper login shows only the briefing**

Log out (if a mechanism exists on the owner side — otherwise open an incognito window), navigate to `http://localhost:8888`, log in with `test-hk-pw`. Confirm:
- No header, no tab bar — only the briefing view with today/tomorrow sections
- "ออกจากระบบ" (logout) button is visible and returns to the login page when clicked
- Open browser DevTools → Network tab → inspect the `/api/snapshots` response body → confirm no `yearly`, `channels`, `countries`, `monthly`, or `rate` fields are present anywhere in the JSON

- [ ] **Step 5: Verify owner login is unaffected if `HOUSEKEEPING_PASSWORD` is unset**

Temporarily comment out `HOUSEKEEPING_PASSWORD` in `.env`, restart `netlify dev`, confirm owner login with `DASHBOARD_PASSWORD` still works. Restore `.env` afterward.

- [ ] **Step 6: Verify production build**

Run: `npm run build`
Expected: exits 0, no TypeScript errors

---

## Self-Review Notes

**Spec coverage check:**
- §2 all decisions → covered across Tasks 1–9 (passcode dropped: no task adds it; guest count: Task 1; notes raw: Task 7 uses `r.notes` unmodified; resType filter: Task 2; villa label as-is: Task 2/7; date client-side: Task 7; tab placement: Task 9; housekeeper access: Tasks 4/9; data boundary: Task 5; permission model: Task 3; copy format: Task 7; logout: Tasks 6/7/9; Thai language: all UI strings in Task 7/9)
- §3 Data Model → Task 1
- §4 Housekeeping Logic → Task 2
- §5.1–5.4 Auth → Tasks 3, 4, 5
- §5.5 Logout → Task 6, wired in Task 9
- §5.6 Frontend routing → Task 9
- §6 UI → Task 7
- §7 Error Handling → covered by existing empty-state patterns in Task 7 (`HousekeepingView`'s per-section "ไม่มีแขกเข้าพัก..." when no arrivals) and Task 9 (`Dashboard.tsx` keeps its pre-existing `!data.latest` check; `OwnerShell` adds a `!data` loading check for the async fetch it now owns)
- §8 Testing → Tasks 1 (parser), 2 (metrics), 3 (auth), 5 (snapshots), 6 (logout/whoami); manual/E2E → Task 10
- §9 Out of scope → correctly no tasks created for these

**Type consistency check:** `HousekeepingArrival` (Task 2) fields (`room`, `guest`, `adults`, `children`, `arrivalDate`, `notes`) match usage in `HousekeepingView` (Task 7: `r.room`, `r.guest`, `r.adults`, `r.children`, `r.notes`). `Role`/`Permission` (Task 3) match usage in Tasks 4, 5, 6, 8, 9 consistently (`'owner' | 'housekeeper'`, permission strings `read:revenue`/`read:arrivals`/`write:snapshot`/`read:snapshot-keys`). `login()` return shape (Task 8: `{ ok, role }`) matches consumption in `LoginPage.tsx` (Task 9: `result.ok`, `result.role`).
