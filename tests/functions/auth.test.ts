import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from '../../netlify/functions/_auth';

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
