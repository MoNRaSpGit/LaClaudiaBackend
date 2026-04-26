import { getPool } from '../config/db.js';
import { env } from '../config/env.js';

function escapeId(identifier) {
  return `\`${String(identifier).replace(/`/g, '``')}\``;
}

async function columnExists(pool, tableName, columnName) {
  const [rows] = await pool.query(
    `
      SELECT COUNT(*) AS count
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    [tableName, columnName]
  );

  return Boolean(rows[0]?.count);
}

async function indexExists(pool, tableName, indexName) {
  const [rows] = await pool.query(
    `
      SELECT COUNT(*) AS count
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
    `,
    [tableName, indexName]
  );

  return Boolean(rows[0]?.count);
}

async function ensureIndex(pool, tableName, indexName, indexSql) {
  const exists = await indexExists(pool, tableName, indexName);
  if (exists) {
    console.log(`[scanner-indexes] ${indexName} ya existe`);
    return;
  }

  await pool.query(indexSql);
  console.log(`[scanner-indexes] ${indexName} creado`);
}

async function main() {
  const pool = getPool();
  if (!pool) {
    throw new Error('DB no configurada. Completa DB_HOST/DB_USER/DB_NAME.');
  }

  const tableName = env.productsTable;
  const escapedTableName = escapeId(tableName);

  const hasBarcode = await columnExists(pool, tableName, 'barcode');
  const hasBarcodeNormalized = await columnExists(pool, tableName, 'barcode_normalized');
  const hasEstado = await columnExists(pool, tableName, 'estado');

  if (hasBarcode) {
    await ensureIndex(
      pool,
      tableName,
      'idx_scanner_barcode',
      `ALTER TABLE ${escapedTableName} ADD INDEX idx_scanner_barcode (barcode)`
    );
  }

  if (hasBarcodeNormalized) {
    await ensureIndex(
      pool,
      tableName,
      'idx_scanner_barcode_normalized',
      `ALTER TABLE ${escapedTableName} ADD INDEX idx_scanner_barcode_normalized (barcode_normalized)`
    );
  }

  if (hasEstado) {
    await ensureIndex(
      pool,
      tableName,
      'idx_scanner_estado_id',
      `ALTER TABLE ${escapedTableName} ADD INDEX idx_scanner_estado_id (estado, id)`
    );
  }

  console.log('[scanner-indexes] listo');
  await pool.end();
}

main().catch((error) => {
  console.error(`[scanner-indexes] error: ${error?.message || error}`);
  process.exit(1);
});
