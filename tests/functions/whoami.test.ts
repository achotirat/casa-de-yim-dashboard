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
