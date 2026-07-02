import type { Config } from '@netlify/functions';
import { roleFromCookie } from './_auth';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
  const secret = process.env.AUTH_SECRET || '';
  const role = roleFromCookie(req, secret);
  if (!role) {
    return new Response(JSON.stringify({ ok: false }), { status: 401, headers: { 'content-type': 'application/json' } });
  }
  return Response.json({ ok: true, role });
}

export const config: Config = { path: '/api/whoami' };
