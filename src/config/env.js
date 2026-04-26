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

export const env = {
  port: Number(process.env.PORT || 4000),
  frontendOrigins: parseOrigins(process.env.FRONTEND_URL),
  productsTable: process.env.PRODUCTS_TABLE || 'clau_prodcutos',
  db: {
    host: process.env.DB_HOST || '',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
    database: process.env.DB_NAME || '',
    ssl: parseBoolean(process.env.DB_SSL, false)
  }
};
