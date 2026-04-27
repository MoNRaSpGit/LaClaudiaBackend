import { getPool } from '../config/db.js';
import { env } from '../config/env.js';

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run')
  };
}

function buildWhereClause() {
  return `
    (
      revoked_at IS NOT NULL
      AND revoked_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)
    )
    OR (
      revoked_at IS NULL
      AND expires_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)
    )
  `;
}

async function countCandidates(pool, retentionDays) {
  const whereClause = buildWhereClause();
  const [rows] = await pool.query(
    `
      SELECT COUNT(*) AS count
      FROM auth_sessions
      WHERE ${whereClause}
    `,
    [retentionDays, retentionDays]
  );
  return Number(rows[0]?.count || 0);
}

async function deleteBatch(pool, retentionDays, batchSize) {
  const whereClause = buildWhereClause();
  const [result] = await pool.query(
    `
      DELETE FROM auth_sessions
      WHERE ${whereClause}
      ORDER BY id ASC
      LIMIT ?
    `,
    [retentionDays, retentionDays, batchSize]
  );

  return Number(result?.affectedRows || 0);
}

async function main() {
  const { dryRun } = parseArgs();
  const pool = getPool();

  if (!pool) {
    throw new Error('DB no configurada. Completa DB_HOST/DB_USER/DB_NAME.');
  }

  const retentionDays = env.auth.sessionCleanupRetentionDays;
  const batchSize = env.auth.sessionCleanupBatchSize;
  const candidates = await countCandidates(pool, retentionDays);

  if (dryRun) {
    console.log(
      `[auth-cleanup] dry-run | candidates=${candidates} | retention_days=${retentionDays} | batch_size=${batchSize}`
    );
    await pool.end();
    return;
  }

  let deletedTotal = 0;
  while (true) {
    const deleted = await deleteBatch(pool, retentionDays, batchSize);
    deletedTotal += deleted;
    if (deleted < batchSize) {
      break;
    }
  }

  console.log(
    `[auth-cleanup] done | deleted=${deletedTotal} | retention_days=${retentionDays} | batch_size=${batchSize}`
  );
  await pool.end();
}

main().catch((error) => {
  console.error(`[auth-cleanup] error: ${error?.message || error}`);
  process.exit(1);
});

