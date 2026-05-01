import { getPool } from '../config/db.js';
import { env } from '../config/env.js';

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

async function foreignKeyExists(pool, tableName, foreignKeyName) {
  const [rows] = await pool.query(
    `
      SELECT COUNT(*) AS count
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND CONSTRAINT_NAME = ?
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    `,
    [tableName, foreignKeyName]
  );

  return Boolean(rows[0]?.count);
}

async function ensureIndex(pool, tableName, indexName, indexSql) {
  const exists = await indexExists(pool, tableName, indexName);
  if (exists) {
    console.log(`[core-schema] ${indexName} ya existe`);
    return;
  }

  await pool.query(indexSql);
  console.log(`[core-schema] ${indexName} creado`);
}

async function ensureForeignKey(pool, tableName, foreignKeyName, fkSql) {
  const exists = await foreignKeyExists(pool, tableName, foreignKeyName);
  if (exists) {
    console.log(`[core-schema] ${foreignKeyName} ya existe`);
    return;
  }

  await pool.query(fkSql);
  console.log(`[core-schema] ${foreignKeyName} creado`);
}

async function ensureTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      username VARCHAR(80) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(120) NULL,
      role ENUM('admin', 'operario') NOT NULL DEFAULT 'operario',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('[core-schema] tabla auth_users lista');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      token_hash CHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      last_seen_at DATETIME NULL,
      revoked_at DATETIME NULL,
      user_agent VARCHAR(255) NULL,
      ip_address VARCHAR(64) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('[core-schema] tabla auth_sessions lista');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sales_tickets (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      external_id VARCHAR(64) NULL,
      user_id BIGINT UNSIGNED NULL,
      total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      items_count INT UNSIGNED NOT NULL DEFAULT 0,
      status ENUM('confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed',
      notes VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('[core-schema] tabla sales_tickets lista');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sales_ticket_items (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      sale_id BIGINT UNSIGNED NOT NULL,
      product_id BIGINT UNSIGNED NULL,
      is_manual TINYINT(1) NOT NULL DEFAULT 0,
      product_name VARCHAR(180) NOT NULL,
      unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
      quantity INT UNSIGNED NOT NULL DEFAULT 1,
      line_total DECIMAL(12,2) NOT NULL DEFAULT 0,
      thumbnail_url TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('[core-schema] tabla sales_ticket_items lista');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cash_payments (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      external_id VARCHAR(64) NULL,
      user_id BIGINT UNSIGNED NULL,
      amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      description VARCHAR(255) NULL,
      status ENUM('confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('[core-schema] tabla cash_payments lista');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS scanner_dashboard_daily (
      business_date DATE NOT NULL,
      initial_cash DECIMAL(12,2) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (business_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('[core-schema] tabla scanner_dashboard_daily lista');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS scanner_diagnostic_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      event_type VARCHAR(80) NOT NULL,
      severity ENUM('info', 'warning', 'error') NOT NULL DEFAULT 'error',
      message VARCHAR(255) NOT NULL,
      user_id BIGINT UNSIGNED NULL,
      username_snapshot VARCHAR(80) NULL,
      role_snapshot VARCHAR(20) NULL,
      source_app VARCHAR(40) NOT NULL DEFAULT 'frontend',
      source_label VARCHAR(120) NULL,
      terminal_id VARCHAR(80) NULL,
      context_json LONGTEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('[core-schema] tabla scanner_diagnostic_events lista');
}

async function ensureConstraintsAndIndexes(pool) {
  await ensureForeignKey(
    pool,
    'auth_sessions',
    'fk_auth_sessions_user_id',
    `
      ALTER TABLE auth_sessions
      ADD CONSTRAINT fk_auth_sessions_user_id
      FOREIGN KEY (user_id)
      REFERENCES auth_users(id)
      ON UPDATE CASCADE
      ON DELETE CASCADE
    `
  );

  await ensureForeignKey(
    pool,
    'sales_tickets',
    'fk_sales_tickets_user_id',
    `
      ALTER TABLE sales_tickets
      ADD CONSTRAINT fk_sales_tickets_user_id
      FOREIGN KEY (user_id)
      REFERENCES auth_users(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL
    `
  );

  await ensureForeignKey(
    pool,
    'sales_ticket_items',
    'fk_sales_ticket_items_sale_id',
    `
      ALTER TABLE sales_ticket_items
      ADD CONSTRAINT fk_sales_ticket_items_sale_id
      FOREIGN KEY (sale_id)
      REFERENCES sales_tickets(id)
      ON UPDATE CASCADE
      ON DELETE CASCADE
    `
  );

  await ensureForeignKey(
    pool,
    'cash_payments',
    'fk_cash_payments_user_id',
    `
      ALTER TABLE cash_payments
      ADD CONSTRAINT fk_cash_payments_user_id
      FOREIGN KEY (user_id)
      REFERENCES auth_users(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL
    `
  );

  await ensureForeignKey(
    pool,
    'scanner_diagnostic_events',
    'fk_scanner_diagnostic_events_user_id',
    `
      ALTER TABLE scanner_diagnostic_events
      ADD CONSTRAINT fk_scanner_diagnostic_events_user_id
      FOREIGN KEY (user_id)
      REFERENCES auth_users(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL
    `
  );

  await ensureIndex(pool, 'auth_users', 'ux_auth_users_username', 'ALTER TABLE auth_users ADD UNIQUE INDEX ux_auth_users_username (username)');
  await ensureIndex(pool, 'auth_users', 'idx_auth_users_role_active', 'ALTER TABLE auth_users ADD INDEX idx_auth_users_role_active (role, is_active)');
  await ensureIndex(pool, 'auth_sessions', 'ux_auth_sessions_token_hash', 'ALTER TABLE auth_sessions ADD UNIQUE INDEX ux_auth_sessions_token_hash (token_hash)');
  await ensureIndex(pool, 'auth_sessions', 'idx_auth_sessions_user_active', 'ALTER TABLE auth_sessions ADD INDEX idx_auth_sessions_user_active (user_id, revoked_at, expires_at)');
  await ensureIndex(pool, 'auth_sessions', 'idx_auth_sessions_expires_at', 'ALTER TABLE auth_sessions ADD INDEX idx_auth_sessions_expires_at (expires_at)');

  await ensureIndex(pool, 'sales_tickets', 'ux_sales_tickets_external_id', 'ALTER TABLE sales_tickets ADD UNIQUE INDEX ux_sales_tickets_external_id (external_id)');
  await ensureIndex(pool, 'sales_tickets', 'idx_sales_tickets_created_at', 'ALTER TABLE sales_tickets ADD INDEX idx_sales_tickets_created_at (created_at)');
  await ensureIndex(pool, 'sales_tickets', 'idx_sales_tickets_user_created', 'ALTER TABLE sales_tickets ADD INDEX idx_sales_tickets_user_created (user_id, created_at)');
  await ensureIndex(pool, 'sales_tickets', 'idx_sales_tickets_status_created', 'ALTER TABLE sales_tickets ADD INDEX idx_sales_tickets_status_created (status, created_at)');

  await ensureIndex(pool, 'sales_ticket_items', 'idx_sales_ticket_items_sale_id', 'ALTER TABLE sales_ticket_items ADD INDEX idx_sales_ticket_items_sale_id (sale_id)');
  await ensureIndex(pool, 'sales_ticket_items', 'idx_sales_ticket_items_product_id', 'ALTER TABLE sales_ticket_items ADD INDEX idx_sales_ticket_items_product_id (product_id)');
  await ensureIndex(pool, 'sales_ticket_items', 'idx_sales_ticket_items_product_name', 'ALTER TABLE sales_ticket_items ADD INDEX idx_sales_ticket_items_product_name (product_name)');

  await ensureIndex(pool, 'cash_payments', 'ux_cash_payments_external_id', 'ALTER TABLE cash_payments ADD UNIQUE INDEX ux_cash_payments_external_id (external_id)');
  await ensureIndex(pool, 'cash_payments', 'idx_cash_payments_created_at', 'ALTER TABLE cash_payments ADD INDEX idx_cash_payments_created_at (created_at)');
  await ensureIndex(pool, 'cash_payments', 'idx_cash_payments_user_created', 'ALTER TABLE cash_payments ADD INDEX idx_cash_payments_user_created (user_id, created_at)');
  await ensureIndex(pool, 'cash_payments', 'idx_cash_payments_status_created', 'ALTER TABLE cash_payments ADD INDEX idx_cash_payments_status_created (status, created_at)');
  await ensureIndex(pool, 'scanner_dashboard_daily', 'idx_scanner_dashboard_daily_updated_at', 'ALTER TABLE scanner_dashboard_daily ADD INDEX idx_scanner_dashboard_daily_updated_at (updated_at)');
  await ensureIndex(pool, 'scanner_diagnostic_events', 'idx_scanner_diagnostic_events_created_at', 'ALTER TABLE scanner_diagnostic_events ADD INDEX idx_scanner_diagnostic_events_created_at (created_at)');
  await ensureIndex(pool, 'scanner_diagnostic_events', 'idx_scanner_diagnostic_events_event_type', 'ALTER TABLE scanner_diagnostic_events ADD INDEX idx_scanner_diagnostic_events_event_type (event_type, created_at)');
  await ensureIndex(pool, 'scanner_diagnostic_events', 'idx_scanner_diagnostic_events_user_created', 'ALTER TABLE scanner_diagnostic_events ADD INDEX idx_scanner_diagnostic_events_user_created (user_id, created_at)');
}

async function ensureBootstrapAdmin(pool) {
  const username = String(env.auth.bootstrapAdminUser || '').trim();
  const passwordHash = String(env.auth.bootstrapAdminPasswordHash || '').trim();
  const displayName = String(env.auth.bootstrapAdminDisplayName || '').trim();

  if (!username || !passwordHash) {
    console.log('[core-schema] bootstrap admin omitido (AUTH_BOOTSTRAP_ADMIN_USER/AUTH_BOOTSTRAP_ADMIN_PASSWORD_HASH vacios)');
    return;
  }

  await pool.query(
    `
      INSERT INTO auth_users (username, password_hash, display_name, role, is_active)
      VALUES (?, ?, ?, 'admin', 1)
      ON DUPLICATE KEY UPDATE
        password_hash = VALUES(password_hash),
        display_name = VALUES(display_name),
        role = 'admin',
        is_active = 1
    `,
    [username, passwordHash, displayName || username]
  );

  console.log('[core-schema] bootstrap admin asegurado');
}

async function main() {
  const pool = getPool();
  if (!pool) {
    throw new Error('DB no configurada. Completa DB_HOST/DB_USER/DB_NAME.');
  }

  await ensureTables(pool);
  await ensureConstraintsAndIndexes(pool);
  await ensureBootstrapAdmin(pool);
  await pool.end();
  console.log('[core-schema] listo');
}

main().catch((error) => {
  console.error(`[core-schema] error: ${error?.message || error}`);
  process.exit(1);
});
