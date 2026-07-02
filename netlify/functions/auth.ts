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
