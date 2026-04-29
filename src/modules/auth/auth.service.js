import { env } from '../../config/env.js';
import {
  createAuthSession,
  extendSessionExpiryById,
  findActiveSessionByTokenHash,
  findActiveUserByUsername,
  revokeSessionByTokenHash,
  touchSessionLastSeenById
} from './auth.repository.js';
import {
  createSessionToken,
  hashSessionToken,
  normalizePassword,
  normalizeUsername,
  verifyPassword
} from './auth.model.js';

function toMySqlDateTimeUtc(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function buildExpiresAt() {
  const expiresAt = new Date(Date.now() + env.auth.sessionDurationHours * 60 * 60 * 1000);
  return {
    dbValue: toMySqlDateTimeUtc(expiresAt),
    apiValue: expiresAt.toISOString()
  };
}

function normalizeAuthHeader(rawHeader) {
  return String(rawHeader || '').trim();
}

function parseBearerToken(rawHeader) {
  const value = normalizeAuthHeader(rawHeader);
  if (!value.toLowerCase().startsWith('bearer ')) {
    return '';
  }
  return value.slice('bearer '.length).trim();
}

export async function loginByCredentials(rawUsername, rawPassword, metadata = {}) {
  const username = normalizeUsername(rawUsername);
  const password = normalizePassword(rawPassword);

  if (!username || !password) {
    const error = new Error('Usuario y clave son requeridos');
    error.statusCode = 400;
    throw error;
  }

  const user = await findActiveUserByUsername(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    const error = new Error('Credenciales invalidas');
    error.statusCode = 401;
    throw error;
  }

  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = buildExpiresAt();
  await createAuthSession({
    userId: Number(user.id),
    tokenHash,
    expiresAt: expiresAt.dbValue,
    userAgent: metadata.userAgent,
    ipAddress: metadata.ipAddress
  });

  return {
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name || user.username,
      role: user.role
    },
    session: {
      token,
      token_type: 'Bearer',
      expires_at: expiresAt.apiValue
    }
  };
}

export async function resolveAuthenticatedSession(authorizationHeader) {
  const token = parseBearerToken(authorizationHeader);
  if (!token) {
    const error = new Error('Sesion requerida');
    error.statusCode = 401;
    throw error;
  }

  const tokenHash = hashSessionToken(token);
  const session = await findActiveSessionByTokenHash(tokenHash);
  if (!session) {
    const error = new Error('Sesion invalida o expirada');
    error.statusCode = 401;
    throw error;
  }

  await touchSessionLastSeenById(Number(session.session_id));
  if (env.auth.sessionSlidingRenewal) {
    const renewedExpiresAt = buildExpiresAt();
    await extendSessionExpiryById(Number(session.session_id), renewedExpiresAt.dbValue);
  }

  return {
    sessionId: Number(session.session_id),
    user: {
      id: Number(session.user_id),
      username: session.username,
      display_name: session.display_name || session.username,
      role: session.role
    }
  };
}

export async function logoutSession(authorizationHeader) {
  const token = parseBearerToken(authorizationHeader);
  if (!token) {
    return { revoked: false };
  }

  const tokenHash = hashSessionToken(token);
  const affected = await revokeSessionByTokenHash(tokenHash);
  return { revoked: affected > 0 };
}
