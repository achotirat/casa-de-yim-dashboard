import type { Snapshot } from '../types';
import type { Role } from '../../netlify/functions/_auth';

export type { Role };

export async function login(password: string): Promise<{ ok: boolean; role: Role | null }> {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) return { ok: false, role: null };
  const json = await res.json();
  return { ok: true, role: json.role as Role };
}

export async function logout(): Promise<void> {
  await fetch('/api/logout', { method: 'POST' });
}

export async function whoami(): Promise<Role | null> {
  const res = await fetch('/api/whoami');
  if (!res.ok) return null;
  const json = await res.json();
  return json.role as Role;
}

export async function listSnapshotKeys(): Promise<string[]> {
  const res = await fetch('/api/snapshots');
  if (!res.ok) throw new Error('unauthorized');
  const json = await res.json();
  return json.keys as string[];
}

export async function getSnapshot(key: string): Promise<Snapshot> {
  const res = await fetch(`/api/snapshots?key=${encodeURIComponent(key)}`);
  const json = await res.json();
  return json.data as Snapshot;
}

export async function saveSnapshot(key: string, snapshot: Snapshot): Promise<void> {
  const res = await fetch('/api/snapshots', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key, snapshot }),
  });
  if (!res.ok) throw new Error('save failed');
}

export async function aiInsight(context: string): Promise<string> {
  const res = await fetch('/api/ai-insight', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ context }),
  });
  const json = await res.json();
  return json.text as string;
}
