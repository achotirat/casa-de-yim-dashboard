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
    mockList.mockResolvedValue({ blobs: [{ key: 'snapshot/2026-07-01' }] });
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
    expect(json.data.arrivals.rows[0].resNo).toBe('1');
    // resolved the *latest* snapshot, not the one named in the query string:
    expect(mockGetJSON).toHaveBeenCalledWith('snapshot/2026-07-02', expect.anything());
  });

  it('rejects requests with no valid cookie', async () => {
    const res = await handler(req('GET', 'https://x/api/snapshots?key=snapshot/2026-07-02', ''));
    expect(res.status).toBe(401);
  });
});

describe('lookback merge', () => {
  const LATEST = {
    uploadedAt: '2026-07-05T05:00:00.000Z',
    dataAsOf: '2026-07-05',
    arrivals: { periodFrom: '2026-07-05', periodTo: '2026-09-05', rows: [
      { resNo: '10', guest: 'New', room: 'A1', rate: 1, arrival: '2026-07-05', departure: '2026-07-07', pax: 2, children: 0, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
    ] },
  };
  const OLDER = {
    uploadedAt: '2026-06-28T05:00:00.000Z',
    dataAsOf: '2026-06-28',
    arrivals: { periodFrom: '2026-06-28', periodTo: '2026-08-28', rows: [
      { resNo: '9', guest: 'Departing Today', room: 'A2', rate: 1, arrival: '2026-06-30', departure: '2026-07-05', pax: 2, children: 0, resType: 'Confirm Booking', channel: 'OTA', notes: '' },
    ] },
  };

  function mockGetForKey(key: string, opts: unknown) {
    if (key === 'snapshot/2026-07-05') return Promise.resolve(LATEST);
    if (key === 'snapshot/2026-06-28') return Promise.resolve(OLDER);
    return Promise.resolve(null);
  }

  it('housekeeper sees a checkout whose arrival snapshot fell outside the export window, merged from an older snapshot', async () => {
    mockList.mockResolvedValue({ blobs: [{ key: 'snapshot/2026-06-28' }, { key: 'snapshot/2026-07-05' }] });
    mockGetJSON.mockImplementation(mockGetForKey);
    const res = await handler(req('GET', 'https://x/api/snapshots?key=ignored', cookieFor('housekeeper')));
    const json = await res.json();
    const resNos = json.data.arrivals.rows.map((r: any) => r.resNo).sort();
    expect(resNos).toEqual(['10', '9']);
  });

  it('owner viewing the latest key also gets the merged arrivals', async () => {
    mockList.mockResolvedValue({ blobs: [{ key: 'snapshot/2026-06-28' }, { key: 'snapshot/2026-07-05' }] });
    mockGetJSON.mockImplementation(mockGetForKey);
    const res = await handler(req('GET', 'https://x/api/snapshots?key=snapshot/2026-07-05', cookieFor('owner')));
    const json = await res.json();
    const resNos = json.data.arrivals.rows.map((r: any) => r.resNo).sort();
    expect(resNos).toEqual(['10', '9']);
  });

  it('owner viewing a non-latest key does NOT get merged arrivals (historical view stays exact)', async () => {
    mockList.mockResolvedValue({ blobs: [{ key: 'snapshot/2026-06-28' }, { key: 'snapshot/2026-07-05' }] });
    mockGetJSON.mockImplementation(mockGetForKey);
    const res = await handler(req('GET', 'https://x/api/snapshots?key=snapshot/2026-06-28', cookieFor('owner')));
    const json = await res.json();
    expect(json.data.arrivals.rows.map((r: any) => r.resNo)).toEqual(['9']);
  });

  it('deduplicates by resNo, preferring the newer snapshot row when a resNo appears in both', async () => {
    const olderWithSameResNo = {
      ...OLDER,
      arrivals: { ...OLDER.arrivals, rows: [{ ...OLDER.arrivals.rows[0], resNo: '10', notes: 'stale-note' }] },
    };
    mockList.mockResolvedValue({ blobs: [{ key: 'snapshot/2026-06-28' }, { key: 'snapshot/2026-07-05' }] });
    mockGetJSON.mockImplementation((key: string) =>
      key === 'snapshot/2026-06-28' ? Promise.resolve(olderWithSameResNo) : mockGetForKey(key, undefined)
    );
    const res = await handler(req('GET', 'https://x/api/snapshots?key=ignored', cookieFor('housekeeper')));
    const json = await res.json();
    const row10 = json.data.arrivals.rows.find((r: any) => r.resNo === '10');
    expect(row10.notes).toBe(''); // latest snapshot's version wins, not 'stale-note'
  });

  it('silently skips lookback days with no snapshot blob', async () => {
    mockList.mockResolvedValue({ blobs: [{ key: 'snapshot/2026-07-05' }] }); // only latest exists
    mockGetJSON.mockImplementation((key: string) =>
      key === 'snapshot/2026-07-05' ? Promise.resolve(LATEST) : Promise.resolve(null)
    );
    const res = await handler(req('GET', 'https://x/api/snapshots?key=ignored', cookieFor('housekeeper')));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.arrivals.rows.map((r: any) => r.resNo)).toEqual(['10']);
  });
});
