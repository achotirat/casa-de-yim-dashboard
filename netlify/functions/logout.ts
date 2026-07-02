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
