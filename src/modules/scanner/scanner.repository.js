import { getPool } from '../../config/db.js';
import { env } from '../../config/env.js';
import { escapeId } from './scanner.model.js';

function getDbPoolOrThrow() {
  const pool = getPool();
  if (!pool) {
    const error = new Error('DB no configurada');
    error.statusCode = 500;
    throw error;
  }
  return pool;
}

export async function findProductByBarcode(barcode) {
  const pool = getDbPoolOrThrow();
  const tableName = escapeId(env.productsTable);

  const [rows] = await pool.query(
    `
      SELECT
        id,
        nombre,
        precio_venta,
        stock_actual,
        categoria,
        barcode,
        barcode_normalized,
        tiene_imagen,
        imagen
      FROM ${tableName}
      WHERE barcode_normalized = ? OR barcode = ?
      LIMIT 1
    `,
    [barcode, barcode]
  );

  return rows[0] || null;
}

export async function listProducts({ limit }) {
  const pool = getDbPoolOrThrow();
  const tableName = escapeId(env.productsTable);

  const [rows] = await pool.query(
    `
      SELECT
        id,
        nombre,
        precio_venta,
        stock_actual,
        categoria,
        barcode,
        barcode_normalized,
        tiene_imagen,
        imagen
      FROM ${tableName}
      ORDER BY id ASC
      LIMIT ?
    `,
    [limit]
  );

  return rows;
}
