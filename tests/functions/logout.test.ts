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
