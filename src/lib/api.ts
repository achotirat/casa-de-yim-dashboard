import type { Snapshot } from '../types';

export async function login(password: string): Promise<boolean> {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return res.ok;
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
