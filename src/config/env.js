import dotenv from 'dotenv';

dotenv.config();

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return defaultValue;
  }
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parseOrigins(value) {
  const origins = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : ['http://localhost:5173'];
}

function parseInteger(value, fallback, min = 1, max = 24 * 30) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export const env = {
  port: Number(process.env.PORT || 4000),
  frontendOrigins: parseOrigins(process.env.FRONTEND_URL),
  productsTable: process.env.PRODUCTS_TABLE || 'clau_prodcutos',
  auth: {
    bootstrapAdminUser: process.env.AUTH_BOOTSTRAP_ADMIN_USER || '',
    bootstrapAdminPasswordHash: process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD_HASH || '',
    bootstrapAdminDisplayName: process.env.AUTH_BOOTSTRAP_ADMIN_DISPLAY_NAME || '',
    sessionDurationHours: parseInteger(process.env.AUTH_SESSION_HOURS, 12, 1, 24 * 30),
    sessionCleanupRetentionDays: parseInteger(process.env.AUTH_SESSION_CLEANUP_RETENTION_DAYS, 7, 1, 3650),
    sessionCleanupBatchSize: parseInteger(process.env.AUTH_SESSION_CLEANUP_BATCH_SIZE, 500, 10, 5000)
  },
  db: {
    host: process.env.DB_HOST || '',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
    database: process.env.DB_NAME || '',
    ssl: parseBoolean(process.env.DB_SSL, false)
  }
};
