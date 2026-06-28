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

export async function listProducts({ limit, query }) {
  const pool = getDbPoolOrThrow();
  const tableName = escapeId(env.productsTable);
  const normalizedQuery = String(query || '').trim();

  if (normalizedQuery) {
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
        WHERE nombre LIKE ?
        ORDER BY nombre ASC, id ASC
        LIMIT ?
      `,
      [`%${normalizedQuery}%`, limit]
    );

    return rows;
  }

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

export async function createProduct(payload) {
  const pool = getDbPoolOrThrow();
  const tableName = escapeId(env.productsTable);
  const [result] = await pool.query(
    `
      INSERT INTO ${tableName} (
        nombre,
        precio_venta,
        stock_actual,
        categoria,
        barcode,
        barcode_normalized,
        tiene_imagen,
        imagen
      ) VALUES (?, ?, 0, ?, ?, ?, ?, ?)
    `,
    [
      payload.nombre,
      payload.precio_venta,
      payload.categoria,
      payload.barcode,
      payload.barcode_normalized,
      payload.imagen ? 1 : 0,
      payload.imagen
    ]
  );

  return Number(result?.insertId || 0);
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
        customer_id,
        sale_payment_method,
          total_amount,
        items_count,
        status,
        notes
        ) VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?)
      `,
      [
        salePayload.external_id,
        salePayload.user_id,
        salePayload.customer_id,
        salePayload.sale_payment_method,
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
      customer_id: salePayload.customer_id,
      sale_payment_method: salePayload.sale_payment_method,
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
  const dbStartedAt = Date.now();
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
  const dbElapsedMs = Date.now() - dbStartedAt;

  return {
    payment: {
      id: Number(result.insertId),
      external_id: paymentPayload.external_id,
      amount: paymentPayload.amount,
      description: paymentPayload.description,
      created_at: new Date().toISOString()
    },
    meta: {
      dbElapsedMs
    }
  };
}

export async function createCustomerAccountPayment(paymentPayload) {
  const pool = getDbPoolOrThrow();
  const [result] = await pool.query(
    `
      INSERT INTO customer_account_payments (
        external_id,
        customer_id,
        user_id,
        payment_method,
        amount,
        notes,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, 'confirmed')
    `,
    [
      paymentPayload.external_id,
      paymentPayload.customer_id,
      paymentPayload.user_id,
      paymentPayload.payment_method,
      paymentPayload.amount,
      paymentPayload.notes
    ]
  );

  return {
    id: Number(result.insertId),
    external_id: paymentPayload.external_id,
    customer_id: paymentPayload.customer_id,
    user_id: paymentPayload.user_id,
    payment_method: paymentPayload.payment_method,
    amount: paymentPayload.amount,
    notes: paymentPayload.notes,
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

export async function sumConfirmedSalesByPaymentMethodBetween(startDate, endDate) {
  const pool = getDbPoolOrThrow();
  const [rows] = await pool.query(
    `
      SELECT
        sale_payment_method,
        COALESCE(SUM(total_amount), 0) AS total
      FROM sales_tickets
      WHERE status = 'confirmed'
        AND created_at >= ?
        AND created_at < ?
      GROUP BY sale_payment_method
    `,
    [startDate, endDate]
  );

  return rows;
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

export async function sumConfirmedCustomerAccountPaymentsBetween(startDate, endDate) {
  const pool = getDbPoolOrThrow();
  const [rows] = await pool.query(
    `
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM customer_account_payments
      WHERE status = 'confirmed'
        AND created_at >= ?
        AND created_at < ?
    `,
    [startDate, endDate]
  );
  return Number(rows[0]?.total || 0);
}

export async function sumConfirmedCustomerAccountPaymentsByMethodBetween(startDate, endDate) {
  const pool = getDbPoolOrThrow();
  const [rows] = await pool.query(
    `
      SELECT
        payment_method,
        COALESCE(SUM(amount), 0) AS total
      FROM customer_account_payments
      WHERE status = 'confirmed'
        AND created_at >= ?
        AND created_at < ?
      GROUP BY payment_method
    `,
    [startDate, endDate]
  );
  return rows;
}

export async function getTotalOutstandingCustomerDebt() {
  const pool = getDbPoolOrThrow();
  const [rows] = await pool.query(
    `
      SELECT COALESCE(SUM(customer_balance), 0) AS total
      FROM (
        SELECT
          c.id,
          GREATEST(
            COALESCE(sales.total_sales, 0) - COALESCE(payments.total_payments, 0),
            0
          ) AS customer_balance
        FROM customers c
        LEFT JOIN (
          SELECT
            customer_id,
            SUM(total_amount) AS total_sales
          FROM sales_tickets
          WHERE status = 'confirmed'
            AND sale_payment_method = 'cuenta'
          GROUP BY customer_id
        ) sales ON sales.customer_id = c.id
        LEFT JOIN (
          SELECT
            customer_id,
            SUM(amount) AS total_payments
          FROM customer_account_payments
          WHERE status = 'confirmed'
          GROUP BY customer_id
        ) payments ON payments.customer_id = c.id
      ) balances
    `
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
        sale_payment_method,
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

export async function listCustomerAccountPaymentMovementsBetween(startDate, endDate, limit) {
  const pool = getDbPoolOrThrow();
  const [rows] = await pool.query(
    `
      SELECT
        cap.id,
        cap.customer_id,
        cap.payment_method,
        cap.amount,
        cap.notes,
        cap.created_at,
        c.name AS customer_name
      FROM customer_account_payments cap
      INNER JOIN customers c ON c.id = cap.customer_id
      WHERE cap.status = 'confirmed'
        AND cap.created_at >= ?
        AND cap.created_at < ?
      ORDER BY cap.created_at DESC, cap.id DESC
      LIMIT ?
    `,
    [startDate, endDate, limit]
  );
  return rows;
}

export async function listRankingBetween(startDate, endDate, limit) {
  const pool = getDbPoolOrThrow();
  const tableName = escapeId(env.productsTable);
  const [rows] = await pool.query(
    `
      SELECT
        CASE
          WHEN si.product_id IS NULL THEN CONCAT('manual:', si.product_name)
          ELSE CONCAT('product:', si.product_id)
        END AS ranking_key,
        MAX(si.product_name) AS name,
        SUM(si.quantity) AS qty,
        MAX(NULLIF(si.thumbnail_url, '')) AS thumbnail_url,
        MAX(p.imagen) AS imagen
      FROM sales_ticket_items si
      INNER JOIN sales_tickets st ON st.id = si.sale_id
      LEFT JOIN ${tableName} p ON p.id = si.product_id
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

export async function getDashboardInitialCashByDate(dateLabel) {
  const pool = getDbPoolOrThrow();
  const [rows] = await pool.query(
    `
      SELECT initial_cash
      FROM scanner_dashboard_daily
      WHERE business_date = ?
      LIMIT 1
    `,
    [dateLabel]
  );

  return rows[0] ? Number(rows[0].initial_cash || 0) : 0;
}

export async function getDashboardNextDayPreloadByDate(dateLabel) {
  const pool = getDbPoolOrThrow();
  const [rows] = await pool.query(
    `
      SELECT
        target_business_date,
        initial_cash,
        created_by_user_id,
        created_at,
        updated_at
      FROM scanner_dashboard_next_day_preloads
      WHERE target_business_date = ?
      LIMIT 1
    `,
    [dateLabel]
  );

  return rows[0] || null;
}

export async function listDailySalesTotalsBetween(startDate, endDate) {
  const pool = getDbPoolOrThrow();
  const [rows] = await pool.query(
    `
      SELECT
        DATE(CONVERT_TZ(created_at, '+00:00', '-03:00')) AS business_date,
        sale_payment_method,
        COALESCE(SUM(total_amount), 0) AS total
      FROM sales_tickets
      WHERE status = 'confirmed'
        AND created_at >= ?
        AND created_at < ?
      GROUP BY DATE(CONVERT_TZ(created_at, '+00:00', '-03:00')), sale_payment_method
      ORDER BY business_date DESC
    `,
    [startDate, endDate]
  );

  return rows;
}

export async function listDailyPaymentTotalsBetween(startDate, endDate) {
  const pool = getDbPoolOrThrow();
  const [rows] = await pool.query(
    `
      SELECT
        DATE(CONVERT_TZ(created_at, '+00:00', '-03:00')) AS business_date,
        COALESCE(SUM(amount), 0) AS total
      FROM cash_payments
      WHERE status = 'confirmed'
        AND created_at >= ?
        AND created_at < ?
      GROUP BY DATE(CONVERT_TZ(created_at, '+00:00', '-03:00'))
      ORDER BY business_date DESC
    `,
    [startDate, endDate]
  );

  return rows;
}

export async function createCustomer(payload) {
  const pool = getDbPoolOrThrow();
  const [result] = await pool.query(
    `
      INSERT INTO customers (
        name,
        phone,
        notes,
        is_active
      ) VALUES (?, ?, ?, 1)
    `,
    [payload.name, payload.phone, payload.notes]
  );

  return Number(result?.insertId || 0);
}

export async function findCustomerById(customerId) {
  const pool = getDbPoolOrThrow();
  const [rows] = await pool.query(
    `
      SELECT
        id,
        name,
        phone,
        notes,
        is_active,
        created_at,
        updated_at
      FROM customers
      WHERE id = ?
      LIMIT 1
    `,
    [customerId]
  );

  return rows[0] || null;
}

export async function deactivateCustomerById(customerId) {
  const pool = getDbPoolOrThrow();
  const [result] = await pool.query(
    `
      UPDATE customers
      SET is_active = 0,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      LIMIT 1
    `,
    [customerId]
  );

  return Number(result?.affectedRows || 0) > 0;
}

export async function listCustomersWithDebt() {
  const pool = getDbPoolOrThrow();
  const [rows] = await pool.query(
    `
      SELECT
        c.id,
        c.name,
        c.phone,
        c.notes,
        c.is_active,
        c.created_at,
        c.updated_at,
        GREATEST(COALESCE(sales.total_sales, 0) - COALESCE(payments.total_payments, 0), 0) AS debt_total,
        COALESCE(sales.account_sales_count, 0) AS account_sales_count,
        COALESCE(payments.account_payments_total, 0) AS account_payments_total,
        COALESCE(payments.account_payments_count, 0) AS account_payments_count,
        sales.last_account_sale_at,
        payments.last_account_payment_at
      FROM customers c
      LEFT JOIN (
        SELECT
          customer_id,
          SUM(total_amount) AS total_sales,
          COUNT(*) AS account_sales_count,
          MAX(created_at) AS last_account_sale_at
        FROM sales_tickets
        WHERE status = 'confirmed'
          AND sale_payment_method = 'cuenta'
        GROUP BY customer_id
      ) sales ON sales.customer_id = c.id
      LEFT JOIN (
        SELECT
          customer_id,
          SUM(amount) AS total_payments,
          SUM(amount) AS account_payments_total,
          COUNT(*) AS account_payments_count,
          MAX(created_at) AS last_account_payment_at
        FROM customer_account_payments
        WHERE status = 'confirmed'
        GROUP BY customer_id
        ) payments ON payments.customer_id = c.id
        WHERE c.is_active = 1
        ORDER BY c.name ASC, c.id ASC
      `
    );

  return rows;
}

export async function listCustomerAccountSales(customerId, limit = 20) {
  const pool = getDbPoolOrThrow();
  const [rows] = await pool.query(
    `
      SELECT
        id,
        external_id,
        total_amount,
        items_count,
        created_at
      FROM sales_tickets
      WHERE customer_id = ?
        AND status = 'confirmed'
        AND sale_payment_method = 'cuenta'
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `,
    [customerId, limit]
  );

  return rows;
}

export async function listCustomerAccountPayments(customerId, limit = 20) {
  const pool = getDbPoolOrThrow();
  const [rows] = await pool.query(
    `
      SELECT
        id,
        external_id,
        payment_method,
        amount,
        notes,
        created_at
      FROM customer_account_payments
      WHERE customer_id = ?
        AND status = 'confirmed'
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `,
    [customerId, limit]
  );

  return rows;
}

export async function listDashboardInitialCashBetween(startDateLabel, endDateLabelExclusive) {
  const pool = getDbPoolOrThrow();
  const [rows] = await pool.query(
    `
      SELECT
        business_date,
        initial_cash
      FROM scanner_dashboard_daily
      WHERE business_date >= ?
        AND business_date < ?
      ORDER BY business_date DESC
    `,
    [startDateLabel, endDateLabelExclusive]
  );

  return rows;
}

export async function listMonthlyWeekOverridesBetween(startMonthKey, endMonthKeyInclusive) {
  const pool = getDbPoolOrThrow();
  const [rows] = await pool.query(
    `
      SELECT
        month_key,
        week_number,
        sales_total,
        payments_total,
        note,
        updated_at
      FROM scanner_monthly_week_overrides
      WHERE month_key >= ?
        AND month_key <= ?
      ORDER BY month_key DESC, week_number ASC
    `,
    [startMonthKey, endMonthKeyInclusive]
  );

  return rows;
}

export async function upsertMonthlyWeekOverride({ monthKey, weekNumber, salesTotal, paymentsTotal, note }) {
  const pool = getDbPoolOrThrow();
  await pool.query(
    `
      INSERT INTO scanner_monthly_week_overrides (
        month_key,
        week_number,
        sales_total,
        payments_total,
        note
      ) VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        sales_total = VALUES(sales_total),
        payments_total = VALUES(payments_total),
        note = VALUES(note)
    `,
    [monthKey, weekNumber, salesTotal, paymentsTotal, note]
  );

  const [rows] = await pool.query(
    `
      SELECT
        month_key,
        week_number,
        sales_total,
        payments_total,
        note,
        updated_at
      FROM scanner_monthly_week_overrides
      WHERE month_key = ?
        AND week_number = ?
      LIMIT 1
    `,
    [monthKey, weekNumber]
  );

  return rows[0] || null;
}

export async function upsertDashboardInitialCashByDate(dateLabel, initialCash) {
  const pool = getDbPoolOrThrow();
  await pool.query(
    `
      INSERT INTO scanner_dashboard_daily (
        business_date,
        initial_cash
      ) VALUES (?, ?)
      ON DUPLICATE KEY UPDATE
        initial_cash = VALUES(initial_cash)
    `,
    [dateLabel, initialCash]
  );

  return {
    date: dateLabel,
    initial_cash: Number(initialCash || 0)
  };
}

export async function upsertDashboardNextDayPreloadByDate(dateLabel, initialCash, createdByUserId = null) {
  const pool = getDbPoolOrThrow();
  await pool.query(
    `
      INSERT INTO scanner_dashboard_next_day_preloads (
        target_business_date,
        initial_cash,
        created_by_user_id
      ) VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        initial_cash = VALUES(initial_cash),
        created_by_user_id = VALUES(created_by_user_id)
    `,
    [dateLabel, initialCash, createdByUserId]
  );

  const [rows] = await pool.query(
    `
      SELECT
        target_business_date,
        initial_cash,
        created_by_user_id,
        created_at,
        updated_at
      FROM scanner_dashboard_next_day_preloads
      WHERE target_business_date = ?
      LIMIT 1
    `,
    [dateLabel]
  );

  return rows[0] || null;
}

export async function materializeDashboardInitialCashFromPreloadIfNeeded(dateLabel) {
  const pool = getDbPoolOrThrow();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [dailyRows] = await connection.query(
      `
        SELECT
          business_date,
          initial_cash
        FROM scanner_dashboard_daily
        WHERE business_date = ?
        LIMIT 1
        FOR UPDATE
      `,
      [dateLabel]
    );

    if (dailyRows[0]) {
      await connection.commit();
      return {
        date: dateLabel,
        initial_cash: Number(dailyRows[0].initial_cash || 0),
        materialized: false
      };
    }

    const [preloadRows] = await connection.query(
      `
        SELECT
          target_business_date,
          initial_cash
        FROM scanner_dashboard_next_day_preloads
        WHERE target_business_date = ?
        LIMIT 1
        FOR UPDATE
      `,
      [dateLabel]
    );

    const preload = preloadRows[0] || null;
    if (!preload) {
      await connection.commit();
      return {
        date: dateLabel,
        initial_cash: 0,
        materialized: false
      };
    }

    await connection.query(
      `
        INSERT INTO scanner_dashboard_daily (
          business_date,
          initial_cash
        ) VALUES (?, ?)
      `,
      [dateLabel, preload.initial_cash]
    );

    await connection.query(
      `
        DELETE FROM scanner_dashboard_next_day_preloads
        WHERE target_business_date = ?
        LIMIT 1
      `,
      [dateLabel]
    );

    await connection.commit();
    return {
      date: dateLabel,
      initial_cash: Number(preload.initial_cash || 0),
      materialized: true
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function createDashboardInitialCashByDateIfMissing(dateLabel, initialCash) {
  const pool = getDbPoolOrThrow();
  await pool.query(
    `
      INSERT IGNORE INTO scanner_dashboard_daily (
        business_date,
        initial_cash
      ) VALUES (?, ?)
    `,
    [dateLabel, initialCash]
  );

  const [rows] = await pool.query(
    `
      SELECT
        business_date,
        initial_cash
      FROM scanner_dashboard_daily
      WHERE business_date = ?
      LIMIT 1
    `,
    [dateLabel]
  );

  const row = rows[0] || null;
  return {
    created: Boolean(row && Number(row.initial_cash || 0) === Number(initialCash || 0)),
    row
  };
}

export async function createScannerDiagnosticEvent(payload) {
  const pool = getDbPoolOrThrow();
  const [result] = await pool.query(
    `
      INSERT INTO scanner_diagnostic_events (
        event_type,
        severity,
        message,
        user_id,
        username_snapshot,
        role_snapshot,
        source_app,
        source_label,
        terminal_id,
        context_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.event_type,
      payload.severity,
      payload.message,
      payload.user_id,
      payload.username_snapshot,
      payload.role_snapshot,
      payload.source_app,
      payload.source_label,
      payload.terminal_id,
      payload.context_json
    ]
  );

  return Number(result?.insertId || 0);
}

export async function listScannerDiagnosticEvents(limit) {
  const pool = getDbPoolOrThrow();
  const [rows] = await pool.query(
    `
      SELECT
        id,
        event_type,
        severity,
        message,
        user_id,
        username_snapshot,
        role_snapshot,
        source_app,
        source_label,
        terminal_id,
        context_json,
        created_at
      FROM scanner_diagnostic_events
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `,
    [limit]
  );

  return rows;
}

export async function createStockRequest(payload) {
  const pool = getDbPoolOrThrow();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [requestResult] = await connection.query(
      `
        INSERT INTO stock_requests (
          provider_name,
          requested_by_user_id,
          requested_by_label,
          status
        ) VALUES (?, ?, ?, 'pending')
      `,
      [
        payload.provider_name,
        payload.requested_by_user_id,
        payload.requested_by_label
      ]
    );

    const requestId = Number(requestResult?.insertId || 0);
    const itemPlaceholders = payload.items.map(() => '(?, ?, ?)').join(', ');
    const itemValues = payload.items.flatMap((item) => [
      requestId,
      item.product_name,
      item.quantity
    ]);

    await connection.query(
      `
        INSERT INTO stock_request_items (
          request_id,
          product_name,
          quantity
        ) VALUES ${itemPlaceholders}
      `,
      itemValues
    );

    await connection.commit();
    return requestId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateStockRequest(payload) {
  const pool = getDbPoolOrThrow();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      `
        UPDATE stock_requests
        SET provider_name = ?
        WHERE id = ?
          AND status = 'pending'
        LIMIT 1
      `,
      [payload.provider_name, payload.request_id]
    );

    await connection.query(
      `
        DELETE FROM stock_request_items
        WHERE request_id = ?
      `,
      [payload.request_id]
    );

    const itemPlaceholders = payload.items.map(() => '(?, ?, ?)').join(', ');
    const itemValues = payload.items.flatMap((item) => [
      payload.request_id,
      item.product_name,
      item.quantity
    ]);

    await connection.query(
      `
        INSERT INTO stock_request_items (
          request_id,
          product_name,
          quantity
        ) VALUES ${itemPlaceholders}
      `,
      itemValues
    );

    await connection.commit();
    return payload.request_id;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listStockRequests({ requestedByUserId = null, status = 'pending' } = {}) {
  const pool = getDbPoolOrThrow();
  const params = [];
  const where = [];

  if (status) {
    where.push('sr.status = ?');
    params.push(status);
  }

  if (requestedByUserId != null) {
    where.push('sr.requested_by_user_id = ?');
    params.push(requestedByUserId);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `
      SELECT
        sr.id,
        sr.provider_name,
        sr.requested_by_user_id,
        sr.requested_by_label,
        sr.status,
        sr.resolved_by_user_id,
        sr.resolved_at,
        sr.created_at,
        sri.id AS item_id,
        sri.product_name,
        sri.quantity
      FROM stock_requests sr
      LEFT JOIN stock_request_items sri ON sri.request_id = sr.id
      ${whereSql}
      ORDER BY sr.created_at DESC, sri.id ASC
    `,
    params
  );

  return rows;
}

export async function findStockRequestById(requestId) {
  const pool = getDbPoolOrThrow();
  const [rows] = await pool.query(
    `
      SELECT
        id,
        provider_name,
        requested_by_user_id,
        requested_by_label,
        status,
        resolved_by_user_id,
        resolved_at,
        created_at
      FROM stock_requests
      WHERE id = ?
      LIMIT 1
    `,
    [requestId]
  );

  return rows[0] || null;
}

export async function markStockRequestResolved(requestId, resolvedByUserId) {
  const pool = getDbPoolOrThrow();
  const [result] = await pool.query(
    `
      UPDATE stock_requests
      SET
        status = 'resolved',
        resolved_by_user_id = ?,
        resolved_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND status = 'pending'
      LIMIT 1
    `,
    [resolvedByUserId, requestId]
  );

  return Number(result?.affectedRows || 0);
}
