import mysql from 'mysql2/promise';
import { env } from './env.js';

function hasDbConfig() {
  return Boolean(env.db.host && env.db.user && env.db.database);
}

let pool = null;

export function getPool() {
  if (!hasDbConfig()) {
    return null;
  }

  if (!pool) {
    pool = mysql.createPool({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
      ssl: env.db.ssl ? { rejectUnauthorized: false } : undefined,
      waitForConnections: true,
      connectionLimit: 10
    });
  }

  return pool;
}

export async function checkDatabaseConnection() {
  const dbPool = getPool();
  if (!dbPool) {
    return {
      configured: false,
      ok: false,
      reason: 'missing_db_env'
    };
  }

  try {
    const connection = await dbPool.getConnection();
    await connection.query('SELECT 1');
    connection.release();
    return {
      configured: true,
      ok: true
    };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      reason: error?.code || error?.message || 'db_connection_error'
    };
  }
}
