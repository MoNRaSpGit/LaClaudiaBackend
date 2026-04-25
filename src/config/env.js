import dotenv from 'dotenv';

dotenv.config();

function parseOrigins(value) {
  const origins = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : ['http://localhost:5173'];
}

export const env = {
  port: Number(process.env.PORT || 4000),
  frontendOrigins: parseOrigins(process.env.FRONTEND_URL)
};
