import { checkDatabaseConnection } from '../../config/db.js';

export async function getHealthSnapshot() {
  const database = await checkDatabaseConnection();

  return {
    ok: Boolean(database.ok),
    message: database.ok ? 'Backend LaClaudia activo' : 'Backend activo con problema de DB',
    database,
    timestamp: new Date().toISOString()
  };
}
