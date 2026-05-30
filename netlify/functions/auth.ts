import type { Config } from '@netlify/functions';
import { signToken, cookieFromToken } from './_auth';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const secret = process.env.AUTH_SECRET || '';
  const expected = process.env.DASHBOARD_PASSWORD || '';
  if (!secret || !expected) return new Response('Server not configured', { status: 500 });

  let body: { password?: string };
  try {
    body = await req.json();
  } catch (_e) {
    return new Response('Bad request', { status: 400 });
  }

  if (!body.password || body.password !== expected) {
    return new Response(JSON.stringify({ ok: false }), { status: 401, headers: { 'content-type': 'application/json' } });
  }

  const token = signToken('ok', secret);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'set-cookie': cookieFromToken(token) },
  });
}

export const config: Config = { path: '/api/auth' };
