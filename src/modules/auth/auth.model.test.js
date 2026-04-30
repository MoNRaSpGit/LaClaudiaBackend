import { describe, expect, it } from 'vitest';
import {
  buildScryptHash,
  createSessionToken,
  hashSessionToken,
  normalizePassword,
  normalizeUsername,
  verifyPassword
} from './auth.model.js';

describe('auth.model helpers', () => {
  it('normalizes username and password safely', () => {
    expect(normalizeUsername('  admin  ')).toBe('admin');
    expect(normalizePassword(null)).toBe('');
  });

  it('verifies sha256, plain and scrypt hashes', () => {
    expect(verifyPassword('secret', 'sha256:2bb80d537b1da3e38bd30361aa855686bde0baef7a5f1b0f4d6f8f7f8f8f8f8f')).toBe(false);
    expect(verifyPassword('secret', 'plain:secret')).toBe(true);

    const scryptHash = buildScryptHash('clave-super');
    expect(verifyPassword('clave-super', scryptHash)).toBe(true);
    expect(verifyPassword('otra-clave', scryptHash)).toBe(false);
  });

  it('creates and hashes session tokens deterministically', () => {
    const token = createSessionToken();
    expect(token).toHaveLength(96);

    const digestA = hashSessionToken(token);
    const digestB = hashSessionToken(token);
    expect(digestA).toBe(digestB);
    expect(digestA).toHaveLength(64);
  });
});
