import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { roleFromCookie, hasPermission } from './_auth';

function store() {
  return getStore({ name: 'snapshots', consistency: 'strong' });
}

interface StrippedArrivalRow {
  room: string;
  guest: string;
  pax: number | null;
  children: number | null;
  arrival: string | null;
  departure: string | null;
  resType: string;
  notes: string;
}

interface StrippedSnapshot {
  dataAsOf: string | null;
  arrivals: { rows: StrippedArrivalRow[] };
}

function stripForHousekeeper(snapshot: any): StrippedSnapshot {
  const rows = (snapshot?.arrivals?.rows ?? []) as any[];
  return {
    dataAsOf: snapshot?.dataAsOf ?? null,
    arrivals: {
      rows: rows.map((r) => ({
        room: r.room,
        guest: r.guest,
        pax: r.pax,
        children: r.children,
        arrival: r.arrival,
        departure: r.departure,
        resType: r.resType,
        notes: r.notes,
      })),
    },
  };
}

export default async function handler(req: Request): Promise<Response> {
  const secret = process.env.AUTH_SECRET || '';
  const role = roleFromCookie(req, secret);
  if (!role) {
    return new Response(JSON.stringify({ ok: false, reason: 'unauthorized' }), {
      status: 401, headers: { 'content-type': 'application/json' },
    });
  }

  const s = store();
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const key = url.searchParams.get('key');

    if (key) {
      if (role === 'housekeeper') {
        // key param is ignored — housekeeper always gets the latest snapshot, stripped.
        const list = await s.list();
        const keys = list.blobs.map((b) => b.key).sort();
        const latestKey = keys[keys.length - 1];
        if (!latestKey) return Response.json({ ok: true, data: { dataAsOf: null, arrivals: { rows: [] } } });
        const data = await s.get(latestKey, { type: 'json' });
        return Response.json({ ok: true, data: stripForHousekeeper(data) });
      }

      if (!hasPermission(role, 'read:arrivals')) {
        return new Response(JSON.stringify({ ok: false, reason: 'forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } });
      }
      const data = await s.get(key, { type: 'json' });
      return Response.json({ ok: true, data });
    }

    if (!hasPermission(role, 'read:snapshot-keys')) {
      return new Response(JSON.stringify({ ok: false, reason: 'forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } });
    }
    const list = await s.list();
    const keys = list.blobs.map((b) => b.key).sort();
    return Response.json({ ok: true, keys });
  }

  if (req.method === 'POST') {
    if (!hasPermission(role, 'write:snapshot')) {
      return new Response(JSON.stringify({ ok: false, reason: 'forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } });
    }
    const body = (await req.json()) as { key: string; snapshot: unknown };
    if (!body.key || !body.snapshot) return new Response('Bad request', { status: 400 });
    await s.setJSON(body.key, body.snapshot);
    return Response.json({ ok: true });
  }

  return new Response('Method Not Allowed', { status: 405 });
}

export const config: Config = { path: '/api/snapshots' };
