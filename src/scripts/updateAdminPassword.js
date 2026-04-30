import { getPool } from '../config/db.js';
import { buildScryptHash } from '../modules/auth/auth.model.js';

async function main() {
  const username = String(process.argv[2] || 'admin').trim();
  const rawPassword = String(process.argv[3] || '').trim();

  if (!username || !rawPassword) {
    console.log('Uso: node src/scripts/updateAdminPassword.js <username> <password>');
    process.exitCode = 1;
    return;
  }

  const pool = getPool();
  if (!pool) {
    console.error('DB no configurada.');
    process.exitCode = 1;
    return;
  }

  const passwordHash = buildScryptHash(rawPassword);
  const [result] = await pool.query(
    `
      UPDATE auth_users
      SET password_hash = ?, is_active = 1
      WHERE username = ?
      LIMIT 1
    `,
    [passwordHash, username]
  );

  const affectedRows = Number(result?.affectedRows || 0);
  if (affectedRows <= 0) {
    console.error(`No se encontro usuario activo para actualizar: ${username}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Password actualizada para usuario ${username}.`);
  await pool.end();
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
