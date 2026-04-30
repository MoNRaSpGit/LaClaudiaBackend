import { getPool } from '../config/db.js';

const STORE_TIME_ZONE = 'America/Montevideo';

function getDatePartsInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second)
  };
}

function getTimeZoneOffsetMs(date, timeZone) {
  const parts = getDatePartsInTimeZone(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

function getUtcDateForStoreDateTime(year, month, day, hour = 0, minute = 0, second = 0) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offsetMs = getTimeZoneOffsetMs(utcGuess, STORE_TIME_ZONE);
  const shifted = new Date(utcGuess.getTime() - offsetMs);
  const shiftedOffsetMs = getTimeZoneOffsetMs(shifted, STORE_TIME_ZONE);

  if (shiftedOffsetMs === offsetMs) {
    return shifted;
  }

  return new Date(utcGuess.getTime() - shiftedOffsetMs);
}

function toDateLabelFromParts(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getStoreTodayDateLabel() {
  const parts = getDatePartsInTimeZone(new Date(), STORE_TIME_ZONE);
  return toDateLabelFromParts(parts.year, parts.month, parts.day);
}

function shiftDateLabel(dateLabel, days) {
  const [year, month, day] = dateLabel.split('-').map((value) => Number(value));
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  date.setUTCDate(date.getUTCDate() + days);
  return toDateLabelFromParts(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate()
  );
}

function toMySqlDateTimeUtc(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function getStoreDayRange(dateLabel) {
  const [year, month, day] = dateLabel.split('-').map((value) => Number(value));
  const nextDateLabel = shiftDateLabel(dateLabel, 1);
  const [nextYear, nextMonth, nextDay] = nextDateLabel.split('-').map((value) => Number(value));

  return {
    dayStart: toMySqlDateTimeUtc(getUtcDateForStoreDateTime(year, month, day, 0, 0, 0)),
    dayEnd: toMySqlDateTimeUtc(getUtcDateForStoreDateTime(nextYear, nextMonth, nextDay, 0, 0, 0))
  };
}

async function main() {
  const pool = getPool();
  if (!pool) {
    throw new Error('DB no configurada.');
  }

  const dateLabel = String(process.argv[2] || '').trim() || getStoreTodayDateLabel();
  const { dayStart, dayEnd } = getStoreDayRange(dateLabel);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [salesRows] = await connection.query(
      `
        SELECT id
        FROM sales_tickets
        WHERE created_at >= ?
          AND created_at < ?
      `,
      [dayStart, dayEnd]
    );
    const saleIds = salesRows.map((row) => Number(row.id)).filter(Boolean);

    let deletedItems = 0;
    if (saleIds.length > 0) {
      const placeholders = saleIds.map(() => '?').join(', ');
      const [itemsResult] = await connection.query(
        `
          DELETE FROM sales_ticket_items
          WHERE sale_id IN (${placeholders})
        `,
        saleIds
      );
      deletedItems = Number(itemsResult?.affectedRows || 0);
    }

    const [salesResult] = await connection.query(
      `
        DELETE FROM sales_tickets
        WHERE created_at >= ?
          AND created_at < ?
      `,
      [dayStart, dayEnd]
    );

    const [paymentsResult] = await connection.query(
      `
        DELETE FROM cash_payments
        WHERE created_at >= ?
          AND created_at < ?
      `,
      [dayStart, dayEnd]
    );

    const [dashboardResult] = await connection.query(
      `
        DELETE FROM scanner_dashboard_daily
        WHERE business_date = ?
      `,
      [dateLabel]
    );

    await connection.commit();

    console.log(`Limpieza OK | date=${dateLabel} | sales=${Number(salesResult?.affectedRows || 0)} | sale_items=${deletedItems} | payments=${Number(paymentsResult?.affectedRows || 0)} | dashboard_daily=${Number(dashboardResult?.affectedRows || 0)}`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
