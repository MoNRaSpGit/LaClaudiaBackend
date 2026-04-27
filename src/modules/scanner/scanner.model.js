export function normalizeBarcode(rawBarcode) {
  return String(rawBarcode || '').trim();
}

export function normalizeLimit(rawLimit) {
  const parsed = Number(rawLimit);
  if (!Number.isFinite(parsed)) {
    return 5;
  }
  return Math.max(1, Math.min(50, Math.floor(parsed)));
}

export function escapeId(identifier) {
  return `\`${String(identifier).replace(/`/g, '``')}\``;
}

function normalizeOptionalString(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function normalizeOptionalInteger(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function normalizeMoney(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Number(parsed.toFixed(2));
}

function normalizeQuantity(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.max(1, Math.floor(parsed));
}

function parseDateOnly(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function toMySqlDateTimeUtc(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function normalizeFloatRange(rawValue, fallback, min, max) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function normalizeIntegerRange(rawValue, fallback, min, max) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export function normalizeSalePayload(rawPayload) {
  const payload = rawPayload || {};
  const rawItems = Array.isArray(payload.items) ? payload.items : [];

  if (!rawItems.length) {
    const error = new Error('La venta debe incluir al menos un item');
    error.statusCode = 400;
    throw error;
  }

  const items = rawItems.map((item, index) => {
    const productName = String(item?.nombre || '').trim();
    if (!productName) {
      const error = new Error(`Item #${index + 1}: nombre requerido`);
      error.statusCode = 400;
      throw error;
    }

    const unitPrice = normalizeMoney(item?.precio_venta);
    if (unitPrice === null) {
      const error = new Error(`Item #${index + 1}: precio_venta invalido`);
      error.statusCode = 400;
      throw error;
    }

    const quantity = normalizeQuantity(item?.quantity);
    if (quantity === null) {
      const error = new Error(`Item #${index + 1}: quantity invalida`);
      error.statusCode = 400;
      throw error;
    }

    const isManual = Boolean(item?.isManual);
    const productId = isManual ? null : normalizeOptionalInteger(item?.productId);

    return {
      product_id: productId,
      is_manual: isManual ? 1 : 0,
      product_name: productName,
      unit_price: unitPrice,
      quantity,
      line_total: Number((unitPrice * quantity).toFixed(2)),
      thumbnail_url: normalizeOptionalString(item?.thumbnail_url)
    };
  });

  const totalAmount = Number(items.reduce((acc, item) => acc + item.line_total, 0).toFixed(2));

  return {
    external_id: normalizeOptionalString(payload.externalId || payload.id),
    user_id: normalizeOptionalInteger(payload.userId),
    notes: normalizeOptionalString(payload.notes),
    items_count: items.reduce((acc, item) => acc + item.quantity, 0),
    total_amount: totalAmount,
    items
  };
}

export function normalizePaymentPayload(rawPayload) {
  const payload = rawPayload || {};
  const amount = normalizeMoney(payload.amount);

  if (amount === null) {
    const error = new Error('Monto de pago invalido');
    error.statusCode = 400;
    throw error;
  }

  return {
    external_id: normalizeOptionalString(payload.externalId || payload.id),
    user_id: normalizeOptionalInteger(payload.userId),
    amount,
    description: normalizeOptionalString(payload.description)
  };
}

export function normalizeDashboardParams(rawQuery) {
  const query = rawQuery || {};
  const dayStart = parseDateOnly(query.date) || new Date(new Date().setUTCHours(0, 0, 0, 0));
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const yesterdayStart = new Date(dayStart);
  yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
  const yesterdayEnd = new Date(dayStart);

  return {
    dayStart: toMySqlDateTimeUtc(dayStart),
    dayEnd: toMySqlDateTimeUtc(dayEnd),
    yesterdayStart: toMySqlDateTimeUtc(yesterdayStart),
    yesterdayEnd: toMySqlDateTimeUtc(yesterdayEnd),
    dateLabel: dayStart.toISOString().slice(0, 10),
    initialCash: normalizeFloatRange(query.initialCash, 1000, 0, 1000000000),
    profitRate: normalizeFloatRange(query.profitRate, 0.2, 0, 1),
    movementLimit: normalizeIntegerRange(query.movementLimit, 100, 1, 500),
    rankingLimit: normalizeIntegerRange(query.rankingLimit, 20, 1, 100)
  };
}
