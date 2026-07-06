import { createHmac, timingSafeEqual } from 'node:crypto';

export type Role = 'owner' | 'housekeeper';

export type Permission =
  | 'read:revenue'
  | 'read:arrivals'
  | 'write:snapshot'
  | 'read:snapshot-keys'
  | 'write:villa-status';

const ROLE_PERMISSIONS: Record<Role, Set<Permission>> = {
  owner: new Set(['read:revenue', 'read:arrivals', 'write:snapshot', 'read:snapshot-keys', 'write:villa-status']),
  housekeeper: new Set(['read:arrivals', 'write:villa-status']),
};

const ROLES: Role[] = ['owner', 'housekeeper'];

function isRole(payload: string): payload is Role {
  return (ROLES as string[]).includes(payload);
}

export function signToken(payload: string, secret: string): string {
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifyToken(token: string | undefined, secret: string): boolean {
  if (!token) return false;
  const idx = token.lastIndexOf('.');
  if (idx < 0) return false;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const COOKIE = 'cdy_auth';

export function cookieFromToken(token: string): string {
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  return `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export function tokenFromCookieHeader(header: string | undefined): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return v.join('=');
  }
  return undefined;
}

export function isAuthed(req: Request, secret: string): boolean {
  return verifyToken(tokenFromCookieHeader(req.headers.get('cookie') || undefined), secret);
}

export function roleFromCookie(req: Request, secret: string): Role | null {
  const token = tokenFromCookieHeader(req.headers.get('cookie') || undefined);
  if (!token || !verifyToken(token, secret)) return null;
  const idx = token.lastIndexOf('.');
  const payload = token.slice(0, idx);
  return isRole(payload) ? payload : null;
}

export function hasPermission(role: Role | null, perm: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].has(perm);
}

export function clearedCookie(): string {
  return `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}
