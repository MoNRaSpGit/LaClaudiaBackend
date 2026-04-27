import crypto from 'crypto';

const SCRYPT_KEYLEN = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

export function normalizeUsername(rawValue) {
  return String(rawValue || '').trim();
}

export function normalizePassword(rawValue) {
  return String(rawValue || '');
}

export function verifyPassword(rawPassword, storedHash) {
  const password = normalizePassword(rawPassword);
  const hash = String(storedHash || '').trim();

  if (!hash) {
    return false;
  }

  if (hash.startsWith('sha256:')) {
    const digest = crypto.createHash('sha256').update(password).digest('hex');
    return digest === hash.slice('sha256:'.length);
  }

  if (hash.startsWith('scrypt:')) {
    return verifyScryptPassword(password, hash);
  }

  if (hash.startsWith('plain:')) {
    return password === hash.slice('plain:'.length);
  }

  return password === hash;
}

export function createSessionToken() {
  return crypto.randomBytes(48).toString('hex');
}

export function hashSessionToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken || '')).digest('hex');
}

function verifyScryptPassword(password, hash) {
  const parts = hash.split(':');
  if (parts.length !== 6) {
    return false;
  }

  const [, nRaw, rRaw, pRaw, saltHex, digestHex] = parts;
  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);

  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false;
  }

  if (!saltHex || !digestHex) {
    return false;
  }

  const expectedDigest = Buffer.from(digestHex, 'hex');
  const computedDigest = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expectedDigest.length, {
    N: n,
    r,
    p
  });

  if (expectedDigest.length !== computedDigest.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedDigest, computedDigest);
}

export function buildScryptHash(rawPassword) {
  const password = normalizePassword(rawPassword);
  const salt = crypto.randomBytes(16);
  const digest = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P
  });
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString('hex')}:${digest.toString('hex')}`;
}
