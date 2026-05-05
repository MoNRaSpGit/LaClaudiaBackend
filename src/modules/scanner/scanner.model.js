export function normalizeBarcode(rawBarcode) {
  return String(rawBarcode || '').trim();
}

const STORE_TIME_ZONE = 'America/Montevideo';

export function normalizeLimit(rawLimit) {
  const parsed = Number(rawLimit);
  if (!Number.isFinite(parsed)) {
    return 5;
  }
  return Math.max(1, Math.min(50, Math.floor(parsed)));
}

export function normalizeProductSearchQuery(rawQuery) {
  return String(rawQuery || '').trim().slice(0, 80);
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

function normalizeRequiredInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function normalizeOptionalImageSource(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = String(value || '').trim();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith('data:image') || normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return normalized;
  }

  const error = new Error('thumbnail_url invalida');
  error.statusCode = 400;
  throw error;
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

function parseDateLabel(rawValue) {
  const date = parseDateOnly(rawValue);
  if (!date) {
    return null;
  }

  return toDateLabelFromParts(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate()
  );
}

function getStoreTodayDateLabel() {
  const parts = getDatePartsInTimeZone(new Date(), STORE_TIME_ZONE);
  return toDateLabelFromParts(parts.year, parts.month, parts.day);
}

function shiftDateLabel(dateLabel, days) {
  const parsed = parseDateOnly(dateLabel);
  if (!parsed) {
    return null;
  }

  parsed.setUTCDate(parsed.getUTCDate() + days);
  return toDateLabelFromParts(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth() + 1,
    parsed.getUTCDate()
  );
}

function getStoreDayRangeUtc(dateLabel) {
  const normalizedDateLabel = parseDateLabel(dateLabel);
  if (!normalizedDateLabel) {
    return null;
  }

  const [year, month, day] = normalizedDateLabel.split('-').map((value) => Number(value));
  const nextDateLabel = shiftDateLabel(normalizedDateLabel, 1);
  const [nextYear, nextMonth, nextDay] = nextDateLabel.split('-').map((value) => Number(value));

  return {
    dayStart: getUtcDateForStoreDateTime(year, month, day, 0, 0, 0),
    dayEnd: getUtcDateForStoreDateTime(nextYear, nextMonth, nextDay, 0, 0, 0),
    dateLabel: normalizedDateLabel
  };
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
  const activeDateLabel = parseDateLabel(query.date) || getStoreTodayDateLabel();
  const activeRange = getStoreDayRangeUtc(activeDateLabel);
  const yesterdayRange = getStoreDayRangeUtc(shiftDateLabel(activeDateLabel, -1));
  const hasInitialCashOverride = query.initialCash != null && query.initialCash !== '';

  return {
    dayStart: toMySqlDateTimeUtc(activeRange.dayStart),
    dayEnd: toMySqlDateTimeUtc(activeRange.dayEnd),
    yesterdayStart: toMySqlDateTimeUtc(yesterdayRange.dayStart),
    yesterdayEnd: toMySqlDateTimeUtc(yesterdayRange.dayEnd),
    dateLabel: activeRange.dateLabel,
    initialCash: normalizeFloatRange(query.initialCash, 0, 0, 1000000000),
    hasInitialCashOverride,
    profitRate: normalizeFloatRange(query.profitRate, 0.4, 0, 1),
    movementLimit: normalizeIntegerRange(query.movementLimit, 100, 1, 500),
    rankingLimit: normalizeIntegerRange(query.rankingLimit, 20, 1, 100)
  };
}

export function normalizeDashboardInitialCashPayload(rawPayload, rawQuery) {
  const payload = rawPayload || {};
  const query = rawQuery || {};
  const dateLabel = parseDateLabel(payload.date || query.date) || getStoreTodayDateLabel();
  const parsedInitialCash = Number(payload.initialCash);
  const initialCash = Number.isFinite(parsedInitialCash) && parsedInitialCash >= 0 && parsedInitialCash <= 1000000000
    ? Number(parsedInitialCash.toFixed(2))
    : null;

  if (initialCash === null) {
    const error = new Error('initialCash invalido');
    error.statusCode = 400;
    throw error;
  }

  return {
    dateLabel,
    initialCash
  };
}

export function normalizeProductUpdatePayload(rawProductId, rawPayload) {
  const productId = normalizeRequiredInteger(rawProductId);
  if (productId === null) {
    const error = new Error('productId invalido');
    error.statusCode = 400;
    throw error;
  }

  const payload = rawPayload || {};
  const nombre = String(payload.nombre || '').trim();
  const precioVenta = normalizeMoney(payload.precio_venta);
  const thumbnailUrl = normalizeOptionalImageSource(payload.thumbnail_url);

  if (!nombre) {
    const error = new Error('nombre requerido');
    error.statusCode = 400;
    throw error;
  }

  if (precioVenta === null) {
    const error = new Error('precio_venta invalido');
    error.statusCode = 400;
    throw error;
  }

  return {
    productId,
    nombre,
    precio_venta: precioVenta,
    thumbnail_url: thumbnailUrl
  };
}

export function normalizeProductCreatePayload(rawPayload) {
  const payload = rawPayload || {};
  const barcode = normalizeBarcode(payload.barcode);
  const nombre = String(payload.nombre || '').trim();
  const precioVenta = normalizeMoney(payload.precio_venta);
  const thumbnailUrl = normalizeOptionalImageSource(payload.thumbnail_url);

  if (!barcode) {
    const error = new Error('barcode requerido');
    error.statusCode = 400;
    throw error;
  }

  if (!nombre) {
    const error = new Error('nombre requerido');
    error.statusCode = 400;
    throw error;
  }

  if (precioVenta === null) {
    const error = new Error('precio_venta invalido');
    error.statusCode = 400;
    throw error;
  }

  return {
    barcode,
    barcode_normalized: barcode,
    nombre,
    precio_venta: precioVenta,
    categoria: normalizeOptionalString(payload.categoria) || 'manual',
    thumbnail_url: thumbnailUrl
  };
}

export function normalizeStockRequestPayload(rawPayload, authUser = {}) {
  const payload = rawPayload || {};
  const providerName = String(payload.provider || payload.providerName || '').trim().slice(0, 180);
  const requestedByUserId = normalizeRequiredInteger(authUser?.id);
  const requestedByLabel = String(authUser?.display_name || authUser?.name || authUser?.username || '').trim().slice(0, 120);
  const rawItems = Array.isArray(payload.items) ? payload.items : [];

  if (!providerName) {
    const error = new Error('provider requerido');
    error.statusCode = 400;
    throw error;
  }

  if (requestedByUserId === null || !requestedByLabel) {
    const error = new Error('usuario autenticado invalido');
    error.statusCode = 401;
    throw error;
  }

  if (!rawItems.length) {
    const error = new Error('items requeridos');
    error.statusCode = 400;
    throw error;
  }

  const items = rawItems.map((item, index) => {
    const productName = String(item?.name || item?.productName || '').trim().slice(0, 180);
    const quantity = normalizeQuantity(item?.quantity);

    if (!productName) {
      const error = new Error(`Item #${index + 1}: product_name requerido`);
      error.statusCode = 400;
      throw error;
    }

    if (quantity === null) {
      const error = new Error(`Item #${index + 1}: quantity invalida`);
      error.statusCode = 400;
      throw error;
    }

    return {
      product_name: productName,
      quantity
    };
  });

  return {
    provider_name: providerName,
    requested_by_user_id: requestedByUserId,
    requested_by_label: requestedByLabel,
    items
  };
}
