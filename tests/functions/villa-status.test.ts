import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signToken, cookieFromToken } from '../../netlify/functions/_auth';

const mockGetJSON = vi.fn();
const mockSetJSON = vi.fn();

vi.mock('@netlify/blobs', () => ({
  getStore: () => ({ get: mockGetJSON, setJSON: mockSetJSON }),
}));

import handler from '../../netlify/functions/villa-status';

const SECRET = 'test-secret';
process.env.AUTH_SECRET = SECRET;

function cookieFor(role: 'owner' | 'housekeeper'): string {
  return cookieFromToken(signToken(role, SECRET)).split(';')[0];
}

function req(method: string, url: string, cookie: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { cookie, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  mockGetJSON.mockReset();
  mockSetJSON.mockReset();
});

describe('GET /api/villa-status', () => {
  it('returns entries for the requested resNos', async () => {
    mockGetJSON.mockImplementation((key: string) =>
      key === 'villa-status/1' ? Promise.resolve({ ready: true, passcode: '001234' }) : Promise.resolve(null)
    );
    const res = await handler(req('GET', 'https://x/api/villa-status?resNos=1,2', cookieFor('housekeeper')));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({ '1': { ready: true, passcode: '001234' } });
  });

  it('returns an empty object when resNos is missing', async () => {
    const res = await handler(req('GET', 'https://x/api/villa-status', cookieFor('owner')));
    const json = await res.json();
    expect(json.data).toEqual({});
  });

  it('rejects requests with no valid cookie', async () => {
    const res = await handler(req('GET', 'https://x/api/villa-status?resNos=1', ''));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/villa-status', () => {
  it('creates a new entry with defaults, merging the provided patch', async () => {
    mockGetJSON.mockResolvedValue(null);
    const res = await handler(req('POST', 'https://x/api/villa-status', cookieFor('housekeeper'), { resNo: '3', ready: true }));
    expect(res.status).toBe(200);
    expect(mockSetJSON).toHaveBeenCalledWith('villa-status/3', { ready: true, passcode: null });
  });

  it('partially updates an existing entry without clobbering the other field', async () => {
    mockGetJSON.mockResolvedValue({ ready: false, passcode: '001234' });
    const res = await handler(req('POST', 'https://x/api/villa-status', cookieFor('owner'), { resNo: '3', ready: true }));
    expect(res.status).toBe(200);
    expect(mockSetJSON).toHaveBeenCalledWith('villa-status/3', { ready: true, passcode: '001234' });
  });

  it('rejects a passcode that is not 6 digits', async () => {
    mockGetJSON.mockResolvedValue(null);
    const res = await handler(req('POST', 'https://x/api/villa-status', cookieFor('owner'), { resNo: '3', passcode: '12' }));
    expect(res.status).toBe(400);
    expect(mockSetJSON).not.toHaveBeenCalled();
  });

  it('rejects a body with no resNo', async () => {
    const res = await handler(req('POST', 'https://x/api/villa-status', cookieFor('owner'), { ready: true }));
    expect(res.status).toBe(400);
  });

  it('rejects requests with no valid cookie', async () => {
    const res = await handler(req('POST', 'https://x/api/villa-status', '', { resNo: '3', ready: true }));
    expect(res.status).toBe(401);
  });
});
