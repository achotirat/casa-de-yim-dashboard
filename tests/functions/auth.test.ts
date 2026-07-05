import { describe, it, expect } from 'vitest';
import { signToken, verifyToken, roleFromCookie, hasPermission, cookieFromToken } from '../../netlify/functions/_auth';

describe('signed token', () => {
  it('verifies a token it signed', () => {
    const t = signToken('ok', 'secret123');
    expect(verifyToken(t, 'secret123')).toBe(true);
  });
  it('rejects tampered token', () => {
    const t = signToken('ok', 'secret123');
    expect(verifyToken(t + 'x', 'secret123')).toBe(false);
  });
  it('rejects wrong secret', () => {
    const t = signToken('ok', 'secret123');
    expect(verifyToken(t, 'other')).toBe(false);
  });
});

function reqWithCookie(cookie: string): Request {
  return new Request('https://example.com/api/snapshots', { headers: { cookie } });
}

describe('roleFromCookie', () => {
  it('returns the role for a valid owner token', () => {
    const token = signToken('owner', 'secret123');
    const cookie = cookieFromToken(token);
    const req = reqWithCookie(cookie.split(';')[0]);
    expect(roleFromCookie(req, 'secret123')).toBe('owner');
  });

  it('returns the role for a valid housekeeper token', () => {
    const token = signToken('housekeeper', 'secret123');
    const cookie = cookieFromToken(token);
    const req = reqWithCookie(cookie.split(';')[0]);
    expect(roleFromCookie(req, 'secret123')).toBe('housekeeper');
  });

  it('returns null for a tampered token', () => {
    const token = signToken('owner', 'secret123');
    const cookie = cookieFromToken(token + 'x');
    const req = reqWithCookie(cookie.split(';')[0]);
    expect(roleFromCookie(req, 'secret123')).toBeNull();
  });

  it('returns null when no cookie is present', () => {
    const req = new Request('https://example.com/api/snapshots');
    expect(roleFromCookie(req, 'secret123')).toBeNull();
  });

  it('returns null for an unrecognized role payload', () => {
    const token = signToken('not-a-real-role', 'secret123');
    const cookie = cookieFromToken(token);
    const req = reqWithCookie(cookie.split(';')[0]);
    expect(roleFromCookie(req, 'secret123')).toBeNull();
  });
});

describe('hasPermission', () => {
  it('owner has read:revenue', () => {
    expect(hasPermission('owner', 'read:revenue')).toBe(true);
  });
  it('housekeeper does not have read:revenue', () => {
    expect(hasPermission('housekeeper', 'read:revenue')).toBe(false);
  });
  it('housekeeper has read:arrivals', () => {
    expect(hasPermission('housekeeper', 'read:arrivals')).toBe(true);
  });
  it('null role has no permissions', () => {
    expect(hasPermission(null, 'read:arrivals')).toBe(false);
  });
  it('owner has write:villa-status', () => {
    expect(hasPermission('owner', 'write:villa-status')).toBe(true);
  });
  it('housekeeper has write:villa-status', () => {
    expect(hasPermission('housekeeper', 'write:villa-status')).toBe(true);
  });
});
