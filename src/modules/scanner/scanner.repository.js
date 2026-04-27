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

export async function findProductById(productId) {
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
      WHERE id = ?
      LIMIT 1
    `,
    [productId]
  );

  return rows[0] || null;
}

export async function updateProductById(productId, payload) {
  const pool = getDbPoolOrThrow();
  const tableName = escapeId(env.productsTable);

  const updates = [
    'nombre = ?',
    'precio_venta = ?'
  ];
  const params = [payload.nombre, payload.precio_venta];

  if (payload.imagen !== undefined) {
    updates.push('imagen = ?');
    params.push(payload.imagen);
    updates.push('tiene_imagen = ?');
    params.push(payload.imagen ? 1 : 0);
  }

  params.push(productId);

  const [result] = await pool.query(
    `
      UPDATE ${tableName}
      SET ${updates.join(', ')}
      WHERE id = ?
      LIMIT 1
    `,
    params
  );

  return Number(result?.affectedRows || 0);
}

function buildItemsInsertStatement(items) {
  const placeholders = items.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
  const values = items.flatMap((item) => ([
    item.sale_id,
    item.product_id,
    item.is_manual,
    item.product_name,
    item.unit_price,
    item.quantity,
    item.line_total,
    item.thumbnail_url
  ]));

  return {
    sql: `
      INSERT INTO sales_ticket_items (
        sale_id,
        product_id,
        is_manual,
        product_name,
        unit_price,
        quantity,
        line_total,
        thumbnail_url
      ) VALUES ${placeholders}
    `,
    values
  };
}

export async function createSaleTicket(salePayload) {
  const pool = getDbPoolOrThrow();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [ticketResult] = await connection.query(
      `
        INSERT INTO sales_tickets (
          external_id,
          user_id,
          total_amount,
          items_count,
          status,
          notes
        ) VALUES (?, ?, ?, ?, 'confirmed', ?)
      `,
      [
        salePayload.external_id,
        salePayload.user_id,
        salePayload.total_amount,
        salePayload.items_count,
        salePayload.notes
      ]
    );

    const saleId = Number(ticketResult.insertId);
    const items = salePayload.items.map((item) => ({
      ...item,
      sale_id: saleId
    }));

    if (items.length > 0) {
      const insert = buildItemsInsertStatement(items);
      await connection.query(insert.sql, insert.values);
    }

    await connection.commit();

    return {
      id: saleId,
      external_id: salePayload.external_id,
      total_amount: salePayload.total_amount,
      items_count: salePayload.items_count,
      created_at: new Date().toISOString()
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function createCashPayment(paymentPayload) {
  const pool = getDbPoolOrThrow();
  const [result] = await pool.query(
    `
      INSERT INTO cash_payments (
        external_id,
        user_id,
        amount,
        description,
        status
      ) VALUES (?, ?, ?, ?, 'confirmed')
    `,
    [
      paymentPayload.external_id,
      paymentPayload.user_id,
      paymentPayload.amount,
      paymentPayload.description
    ]
  );

  return {
    id: Number(result.insertId),
    external_id: paymentPayload.external_id,
    amount: paymentPayload.amount,
    description: paymentPayload.description,
    created_at: new Date().toISOString()
  };
}

export async function sumConfirmedSalesBetween(startDate, endDate) {
  const pool = getDbPoolOrThrow();
  const [rows] = await pool.query(
    `
      SELECT COALESCE(SUM(total_amount), 0) AS total
      FROM sales_tickets
      WHERE status = 'confirmed'
        AND created_at >= ?
        AND created_at < ?
    `,
    [startDate, endDate]
  );
  return Number(rows[0]?.total || 0);
}

export async function sumConfirmedPaymentsBetween(startDate, endDate) {
  const pool = getDbPoolOrThrow();
  const [rows] = await pool.query(
    `
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM cash_payments
      WHERE status = 'confirmed'
        AND created_at >= ?
        AND created_at < ?
    `,
    [startDate, endDate]
  );
  return Number(rows[0]?.total || 0);
}

export async function getBestSalesDayTotal() {
  const pool = getDbPoolOrThrow();
  const [rows] = await pool.query(
    `
      SELECT COALESCE(MAX(day_total), 0) AS best_total
      FROM (
        SELECT DATE(created_at) AS day_date, SUM(total_amount) AS day_total
        FROM sales_tickets
        WHERE status = 'confirmed'
        GROUP BY DATE(created_at)
      ) AS grouped_days
    `
  );
  return Number(rows[0]?.best_total || 0);
}

export async function listSalesMovementsBetween(startDate, endDate, limit) {
  const pool = getDbPoolOrThrow();
  const [rows] = await pool.query(
    `
      SELECT
        id,
        total_amount,
        created_at
      FROM sales_tickets
      WHERE status = 'confirmed'
        AND created_at >= ?
        AND created_at < ?
      ORDER BY created_at DESC
      LIMIT ?
    `,
    [startDate, endDate, limit]
  );
  return rows;
}

export async function listSaleItemsBySaleIds(saleIds) {
  if (!Array.isArray(saleIds) || !saleIds.length) {
    return [];
  }

  const pool = getDbPoolOrThrow();
  const placeholders = saleIds.map(() => '?').join(', ');
  const [rows] = await pool.query(
    `
      SELECT
        sale_id,
        id,
        product_name,
        quantity,
        line_total
      FROM sales_ticket_items
      WHERE sale_id IN (${placeholders})
      ORDER BY id ASC
    `,
    saleIds
  );
  return rows;
}

export async function listPaymentMovementsBetween(startDate, endDate, limit) {
  const pool = getDbPoolOrThrow();
  const [rows] = await pool.query(
    `
      SELECT
        id,
        amount,
        description,
        created_at
      FROM cash_payments
      WHERE status = 'confirmed'
        AND created_at >= ?
        AND created_at < ?
      ORDER BY created_at DESC
      LIMIT ?
    `,
    [startDate, endDate, limit]
  );
  return rows;
}

export async function listRankingBetween(startDate, endDate, limit) {
  const pool = getDbPoolOrThrow();
  const [rows] = await pool.query(
    `
      SELECT
        CASE
          WHEN si.product_id IS NULL THEN CONCAT('manual:', si.product_name)
          ELSE CONCAT('product:', si.product_id)
        END AS ranking_key,
        MAX(si.product_name) AS name,
        SUM(si.quantity) AS qty
      FROM sales_ticket_items si
      INNER JOIN sales_tickets st ON st.id = si.sale_id
      WHERE st.status = 'confirmed'
        AND st.created_at >= ?
        AND st.created_at < ?
      GROUP BY ranking_key
      ORDER BY qty DESC
      LIMIT ?
    `,
    [startDate, endDate, limit]
  );
  return rows;
}
