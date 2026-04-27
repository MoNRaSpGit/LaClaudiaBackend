import { getPool } from '../../config/db.js';

function getDbPoolOrThrow() {
  const pool = getPool();
  if (!pool) {
    const error = new Error('DB no configurada');
    error.statusCode = 500;
    throw error;
  }
  return pool;
}

export async function findActiveUserByUsername(username) {
  const pool = getDbPoolOrThrow();
  const [rows] = await pool.query(
    `
      SELECT
        id,
        username,
        password_hash,
        display_name,
        role,
        is_active
      FROM auth_users
      WHERE username = ?
        AND is_active = 1
      LIMIT 1
    `,
    [username]
  );

  return rows[0] || null;
}

export async function createAuthSession({
  userId,
  tokenHash,
  expiresAt,
  userAgent,
  ipAddress
}) {
  const pool = getDbPoolOrThrow();
  const [result] = await pool.query(
    `
      INSERT INTO auth_sessions (
        user_id,
        token_hash,
        expires_at,
        user_agent,
        ip_address
      ) VALUES (?, ?, ?, ?, ?)
    `,
    [userId, tokenHash, expiresAt, userAgent || null, ipAddress || null]
  );

  return Number(result.insertId);
}

export async function findActiveSessionByTokenHash(tokenHash) {
  const pool = getDbPoolOrThrow();
  const [rows] = await pool.query(
    `
      SELECT
        s.id AS session_id,
        s.user_id,
        s.expires_at,
        s.revoked_at,
        u.username,
        u.display_name,
        u.role,
        u.is_active
      FROM auth_sessions s
      INNER JOIN auth_users u ON u.id = s.user_id
      WHERE s.token_hash = ?
        AND s.revoked_at IS NULL
        AND s.expires_at > UTC_TIMESTAMP()
        AND u.is_active = 1
      LIMIT 1
    `,
    [tokenHash]
  );

  return rows[0] || null;
}

export async function touchSessionLastSeenById(sessionId) {
  const pool = getDbPoolOrThrow();
  await pool.query(
    `
      UPDATE auth_sessions
      SET last_seen_at = UTC_TIMESTAMP()
      WHERE id = ?
    `,
    [sessionId]
  );
}

export async function revokeSessionByTokenHash(tokenHash) {
  const pool = getDbPoolOrThrow();
  const [result] = await pool.query(
    `
      UPDATE auth_sessions
      SET revoked_at = UTC_TIMESTAMP()
      WHERE token_hash = ?
        AND revoked_at IS NULL
    `,
    [tokenHash]
  );

  return Number(result.affectedRows || 0);
}
