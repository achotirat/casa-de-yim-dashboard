import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { isAuthed } from './_auth';

function store() {
  return getStore({ name: 'snapshots', consistency: 'strong' });
}

export default async function handler(req: Request): Promise<Response> {
  const secret = process.env.AUTH_SECRET || '';
  if (!isAuthed(req, secret)) {
    return new Response(JSON.stringify({ ok: false, reason: 'unauthorized' }), {
      status: 401, headers: { 'content-type': 'application/json' },
    });
  }

  const s = store();
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const key = url.searchParams.get('key');
    if (key) {
      const data = await s.get(key, { type: 'json' });
      return Response.json({ ok: true, data });
    }
    const list = await s.list();
    const keys = list.blobs.map((b) => b.key).sort();
    return Response.json({ ok: true, keys });
  }

  if (req.method === 'POST') {
    const body = (await req.json()) as { key: string; snapshot: unknown };
    if (!body.key || !body.snapshot) return new Response('Bad request', { status: 400 });
    await s.setJSON(body.key, body.snapshot);
    return Response.json({ ok: true });
  }

  return new Response('Method Not Allowed', { status: 405 });
}

export const config: Config = { path: '/api/snapshots' };
