import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { roleFromCookie, hasPermission } from './_auth';

function store() {
  return getStore({ name: 'villa-status', consistency: 'strong' });
}

export interface VillaStatusEntry {
  ready: boolean;
  passcode: string | null;
}

const DEFAULT_ENTRY: VillaStatusEntry = { ready: false, passcode: null };
const PASSCODE_RE = /^\d{6}$/;

export default async function handler(req: Request): Promise<Response> {
  const secret = process.env.AUTH_SECRET || '';
  const role = roleFromCookie(req, secret);
  if (!role || !hasPermission(role, 'write:villa-status')) {
    return new Response(JSON.stringify({ ok: false, reason: role ? 'forbidden' : 'unauthorized' }), {
      status: role ? 403 : 401, headers: { 'content-type': 'application/json' },
    });
  }

  const s = store();

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const resNosParam = url.searchParams.get('resNos');
    const resNos = resNosParam ? resNosParam.split(',').filter(Boolean) : [];
    const data: Record<string, VillaStatusEntry> = {};
    for (const resNo of resNos) {
      const entry = await s.get(`villa-status/${resNo}`, { type: 'json' });
      if (entry) data[resNo] = entry as VillaStatusEntry;
    }
    return Response.json({ ok: true, data });
  }

  if (req.method === 'POST') {
    const body = (await req.json()) as { resNo?: string; ready?: boolean; passcode?: string | null };
    if (!body.resNo) return new Response('Bad request', { status: 400 });
    if (body.passcode != null && !PASSCODE_RE.test(body.passcode)) {
      return new Response('Bad request', { status: 400 });
    }
    const existing = (await s.get(`villa-status/${body.resNo}`, { type: 'json' })) as VillaStatusEntry | null;
    const next: VillaStatusEntry = { ...(existing ?? DEFAULT_ENTRY) };
    if (body.ready !== undefined) next.ready = body.ready;
    if (body.passcode !== undefined) next.passcode = body.passcode;
    await s.setJSON(`villa-status/${body.resNo}`, next);
    return Response.json({ ok: true });
  }

  return new Response('Method Not Allowed', { status: 405 });
}

export const config: Config = { path: '/api/villa-status' };
