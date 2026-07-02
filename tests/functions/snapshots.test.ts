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
