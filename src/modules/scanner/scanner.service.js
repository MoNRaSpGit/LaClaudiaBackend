import {
  createProduct,
  createCashPayment,
  createScannerDiagnosticEvent,
  createSaleTicket,
  createStockRequest,
  findStockRequestById,
  findProductById,
  findProductByBarcode,
  getDashboardInitialCashByDate,
  getBestSalesDayTotal,
  listScannerDiagnosticEvents,
  listStockRequests,
  listPaymentMovementsBetween,
  listProducts,
  listRankingBetween,
  listSaleItemsBySaleIds,
  listSalesMovementsBetween,
  markStockRequestResolved,
  sumConfirmedPaymentsBetween,
  sumConfirmedSalesBetween,
  upsertDashboardInitialCashByDate,
  updateProductById
} from './scanner.repository.js';
import {
  normalizeBarcode,
  normalizeDashboardParams,
  normalizeDashboardInitialCashPayload,
  normalizeLimit,
  normalizeProductSearchQuery,
  normalizePaymentPayload,
  normalizeProductCreatePayload,
  normalizeProductUpdatePayload,
  normalizeSalePayload,
  normalizeStockRequestPayload
} from './scanner.model.js';

function resolveThumbnailUrl(rawImage) {
  if (!rawImage) {
    return null;
  }

  if (typeof rawImage === 'string') {
    const value = rawImage.trim();
    if (!value) {
      return null;
    }
    if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:image')) {
      return value;
    }
    return null;
  }

  if (Buffer.isBuffer(rawImage) && rawImage.length > 0) {
    return `data:image/jpeg;base64,${rawImage.toString('base64')}`;
  }

  return null;
}

function toScannerProduct(product) {
  return {
    id: product.id,
    nombre: product.nombre,
    precio_venta: product.precio_venta,
    stock_actual: product.stock_actual,
    categoria: product.categoria,
    barcode: product.barcode,
    barcode_normalized: product.barcode_normalized,
    tiene_imagen: Boolean(product.tiene_imagen),
    thumbnail_url: resolveThumbnailUrl(product.imagen)
  };
}

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function sanitizeShortText(rawValue, { fallback = '', max = 255 } = {}) {
  const value = String(rawValue || '').trim();
  if (!value) {
    return fallback;
  }
  return value.slice(0, max);
}

function normalizeDiagnosticSeverity(rawSeverity) {
  const normalized = String(rawSeverity || '').trim().toLowerCase();
  if (normalized === 'info' || normalized === 'warning' || normalized === 'error') {
    return normalized;
  }
  return 'error';
}

function normalizeDiagnosticLimit(rawLimit) {
  const parsed = Number.parseInt(String(rawLimit || '20'), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 20;
  }
  return Math.min(parsed, 100);
}

function parseDiagnosticContext(rawContext) {
  if (!rawContext || typeof rawContext !== 'object' || Array.isArray(rawContext)) {
    return null;
  }

  try {
    const serialized = JSON.stringify(rawContext);
    if (!serialized || serialized === '{}') {
      return null;
    }
    return serialized.slice(0, 8000);
  } catch (_error) {
    return null;
  }
}

function decodeImagePayload(rawThumbnailUrl) {
  if (rawThumbnailUrl === undefined) {
    return undefined;
  }

  if (rawThumbnailUrl === null) {
    return null;
  }

  const value = String(rawThumbnailUrl || '').trim();
  if (!value) {
    return null;
  }

  if (value.startsWith('data:image')) {
    // Persist as data URL string to stay compatible with TEXT/VARCHAR columns in catalog table.
    return value;
  }

  return value;
}

function toCanonicalIsoUtc(rawValue) {
  if (!rawValue) {
    return null;
  }

  if (rawValue instanceof Date) {
    return rawValue.toISOString();
  }

  const value = String(rawValue).trim();
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return new Date(value.replace(' ', 'T') + 'Z').toISOString();
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?$/.test(value)) {
    return new Date(value + 'Z').toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

function buildSalesMovementsWithDetails(saleRows, saleItems) {
  const itemsBySale = new Map();

  saleItems.forEach((item) => {
    const saleId = Number(item.sale_id);
    const current = itemsBySale.get(saleId) || [];
    current.push({
      id: item.id,
      name: item.product_name,
      quantity: Number(item.quantity || 0),
      lineTotal: roundMoney(item.line_total)
    });
    itemsBySale.set(saleId, current);
  });

  return saleRows.map((sale) => ({
    id: `sale-${sale.id}`,
    type: 'Venta',
    amount: roundMoney(sale.total_amount),
    createdAt: toCanonicalIsoUtc(sale.created_at),
    detail: {
      kind: 'sale',
      operator: 'Operario',
      createdAt: toCanonicalIsoUtc(sale.created_at),
      items: itemsBySale.get(Number(sale.id)) || []
    }
  }));
}

function buildPaymentMovements(paymentRows) {
  return paymentRows.map((payment) => ({
    id: `payment-${payment.id}`,
    type: 'Pago',
    amount: roundMoney(payment.amount) * -1,
    createdAt: toCanonicalIsoUtc(payment.created_at),
    detail: {
      kind: 'payment',
      description: payment.description ? payment.description : 'Pago registrado sin descripcion.'
    }
  }));
}

function dedupeMovementsById(movements) {
  const seen = new Set();
  const deduped = [];

  movements.forEach((movement) => {
    const key = String(movement?.id || '');
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    deduped.push(movement);
  });

  return deduped;
}

function aggregateRankingRows(rows) {
  const byKey = new Map();

  rows.forEach((item) => {
    const key = String(item?.ranking_key || '').trim();
    if (!key) {
      return;
    }

    const previous = byKey.get(key);
    const qty = Number(item?.qty || 0);
    const name = String(item?.name || '').trim() || key;
    const thumbnailUrlFromTicket = resolveThumbnailUrl(item?.thumbnail_url);
    const thumbnailUrlFromCatalog = resolveThumbnailUrl(item?.imagen);
    const thumbnailUrl = thumbnailUrlFromTicket || thumbnailUrlFromCatalog || null;

    if (!previous) {
      byKey.set(key, {
        key,
        name,
        qty,
        thumbnail_url: thumbnailUrl
      });
      return;
    }

    previous.qty += qty;
    if (!previous.name && name) {
      previous.name = name;
    }
    if (!previous.thumbnail_url && thumbnailUrl) {
      previous.thumbnail_url = thumbnailUrl;
    }
  });

  return Array.from(byKey.values())
    .sort((a, b) => b.qty - a.qty);
}

function toCanonicalStockRequests(rows) {
  const byId = new Map();

  rows.forEach((row) => {
    const requestId = Number(row?.id || 0);
    if (!requestId) {
      return;
    }

    let current = byId.get(requestId);
    if (!current) {
      current = {
        id: `stock-${requestId}`,
        requestId,
        provider: String(row?.provider_name || '').trim(),
        requestedBy: String(row?.requested_by_label || '').trim(),
        requestedByUserId: Number(row?.requested_by_user_id || 0) || null,
        status: String(row?.status || 'pending').trim() || 'pending',
        resolvedByUserId: Number(row?.resolved_by_user_id || 0) || null,
        resolvedAt: toCanonicalIsoUtc(row?.resolved_at),
        createdAt: toCanonicalIsoUtc(row?.created_at),
        items: []
      };
      byId.set(requestId, current);
    }

    const productName = String(row?.product_name || '').trim();
    const quantity = Number(row?.quantity || 0);
    if (productName && quantity > 0) {
      current.items.push({
        name: productName,
        quantity
      });
    }
  });

  return Array.from(byId.values());
}

export async function lookupProductByBarcode(rawBarcode) {
  const barcode = normalizeBarcode(rawBarcode);
  if (!barcode) {
    const error = new Error('Barcode requerido');
    error.statusCode = 400;
    throw error;
  }

  const product = await findProductByBarcode(barcode);
  if (!product) {
    const error = new Error('Producto no encontrado para ese codigo de barras');
    error.statusCode = 404;
    throw error;
  }

  return toScannerProduct(product);
}

export async function getScannerProducts(rawLimit, rawQuery) {
  const limit = normalizeLimit(rawLimit);
  const query = normalizeProductSearchQuery(rawQuery);
  const items = await listProducts({ limit, query });
  return {
    count: items.length,
    items: items.map(toScannerProduct)
  };
}

export async function createScannerProduct(rawPayload) {
  const normalized = normalizeProductCreatePayload(rawPayload);
  const existing = await findProductByBarcode(normalized.barcode_normalized);

  if (existing) {
    const error = new Error('Ya existe un producto para ese barcode');
    error.statusCode = 409;
    throw error;
  }

  const imagen = decodeImagePayload(normalized.thumbnail_url);
  const productId = await createProduct({
    nombre: normalized.nombre,
    precio_venta: normalized.precio_venta,
    categoria: normalized.categoria,
    barcode: normalized.barcode,
    barcode_normalized: normalized.barcode_normalized,
    imagen
  });

  const created = await findProductById(productId);
  return toScannerProduct(created);
}

export async function updateScannerProduct(rawProductId, rawPayload) {
  const normalized = normalizeProductUpdatePayload(rawProductId, rawPayload);
  const existing = await findProductById(normalized.productId);

  if (!existing) {
    const error = new Error('Producto no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const imagen = decodeImagePayload(normalized.thumbnail_url);
  await updateProductById(normalized.productId, {
    nombre: normalized.nombre,
    precio_venta: normalized.precio_venta,
    imagen
  });

  const updated = await findProductById(normalized.productId);
  return toScannerProduct(updated);
}

export async function registerScannerSale(rawPayload) {
  const normalized = normalizeSalePayload(rawPayload);

  try {
    return await createSaleTicket(normalized);
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      const duplicateError = new Error('La venta ya fue registrada (externalId duplicado)');
      duplicateError.statusCode = 409;
      throw duplicateError;
    }
    throw error;
  }
}

export async function registerScannerPayment(rawPayload) {
  const normalized = normalizePaymentPayload(rawPayload);

  try {
    const result = await createCashPayment(normalized);
    const payment = result?.payment || result;
    const dbElapsedMs = Number(result?.meta?.dbElapsedMs || 0);
    return {
      payment,
      meta: {
        dbElapsedMs
      }
    };
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      const duplicateError = new Error('El pago ya fue registrado (externalId duplicado)');
      duplicateError.statusCode = 409;
      throw duplicateError;
    }
    throw error;
  }
}

export async function updateScannerDashboardInitialCash(rawPayload, rawQuery) {
  const normalized = normalizeDashboardInitialCashPayload(rawPayload, rawQuery);
  const updated = await upsertDashboardInitialCashByDate(normalized.dateLabel, normalized.initialCash);

  return {
    date: updated.date,
    initialCash: roundMoney(updated.initial_cash)
  };
}

export async function getScannerDashboard(rawQuery) {
  const params = normalizeDashboardParams(rawQuery);
  const storedInitialCash = params.hasInitialCashOverride
    ? roundMoney(params.initialCash)
    : roundMoney(await getDashboardInitialCashByDate(params.dateLabel));

  const [
    salesToday,
    paymentsToday,
    salesYesterday,
    bestDaySales,
    saleRows,
    paymentRows,
    rankingRows
  ] = await Promise.all([
    sumConfirmedSalesBetween(params.dayStart, params.dayEnd),
    sumConfirmedPaymentsBetween(params.dayStart, params.dayEnd),
    sumConfirmedSalesBetween(params.yesterdayStart, params.yesterdayEnd),
    getBestSalesDayTotal(),
    listSalesMovementsBetween(params.dayStart, params.dayEnd, params.movementLimit),
    listPaymentMovementsBetween(params.dayStart, params.dayEnd, params.movementLimit),
    listRankingBetween(params.dayStart, params.dayEnd, params.rankingLimit)
  ]);

  const saleIds = saleRows.map((item) => Number(item.id));
  const saleItems = await listSaleItemsBySaleIds(saleIds);

  const salesMovements = buildSalesMovementsWithDetails(saleRows, saleItems);
  const paymentMovements = buildPaymentMovements(paymentRows);
  const movements = dedupeMovementsById(
    [...salesMovements, ...paymentMovements]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  );

  const metrics = {
    initialCash: storedInitialCash,
    salesToday: roundMoney(salesToday),
    profitToday: roundMoney(salesToday * params.profitRate),
    currentAmount: roundMoney(storedInitialCash + salesToday - paymentsToday),
    paymentsTotal: roundMoney(paymentsToday),
    profitRate: params.profitRate
  };

  const comparison = {
    today: roundMoney(salesToday),
    yesterday: roundMoney(salesYesterday),
    record: roundMoney(Math.max(bestDaySales, salesToday))
  };

  const ranking = aggregateRankingRows(rankingRows);

  return {
    date: params.dateLabel,
    metrics,
    comparison,
    movements,
    ranking
  };
}

export async function getScannerTopSellingRanking(rawQuery) {
  const params = normalizeDashboardParams(rawQuery);
  const rankingRows = await listRankingBetween(params.dayStart, params.dayEnd, params.rankingLimit);

  return {
    date: params.dateLabel,
    ranking: aggregateRankingRows(rankingRows)
  };
}

export async function createUserStockRequest(rawPayload, authUser = {}) {
  const normalized = normalizeStockRequestPayload(rawPayload, authUser);
  const requestId = await createStockRequest(normalized);
  const rows = await listStockRequests({ status: null });
  const requests = toCanonicalStockRequests(rows);
  const created = requests.find((item) => item.requestId === requestId);

  if (!created) {
    const error = new Error('No se pudo recuperar el pedido creado');
    error.statusCode = 500;
    throw error;
  }

  return created;
}

export async function getUserStockRequests(authUser = {}) {
  const userRole = String(authUser?.role || '').trim().toLowerCase();
  const userId = Number(authUser?.id || 0);

  if (!userId) {
    const error = new Error('usuario autenticado invalido');
    error.statusCode = 401;
    throw error;
  }

  const rows = await listStockRequests({
    requestedByUserId: userRole === 'admin' ? null : userId,
    status: 'pending'
  });

  return toCanonicalStockRequests(rows);
}

export async function resolveUserStockRequest(rawRequestId, authUser = {}) {
  const requestId = Number(rawRequestId);
  const userId = Number(authUser?.id || 0);
  const userRole = String(authUser?.role || '').trim().toLowerCase();

  if (!Number.isInteger(requestId) || requestId <= 0) {
    const error = new Error('requestId invalido');
    error.statusCode = 400;
    throw error;
  }

  if (!userId) {
    const error = new Error('usuario autenticado invalido');
    error.statusCode = 401;
    throw error;
  }

  const request = await findStockRequestById(requestId);
  if (!request) {
    const error = new Error('Pedido de stock no encontrado');
    error.statusCode = 404;
    throw error;
  }

  if (String(request.status || '').trim().toLowerCase() !== 'pending') {
    const error = new Error('El pedido ya fue cerrado');
    error.statusCode = 409;
    throw error;
  }

  if (userRole !== 'admin' && Number(request.requested_by_user_id || 0) !== userId) {
    const error = new Error('No autorizado para cerrar este pedido');
    error.statusCode = 403;
    throw error;
  }

  await markStockRequestResolved(requestId, userId);

  return {
    ok: true,
    requestId
  };
}

export async function registerScannerDiagnosticEvent(rawPayload, authUser = {}) {
  const eventType = sanitizeShortText(rawPayload?.eventType, {
    fallback: 'scanner.unknown',
    max: 80
  });
  const message = sanitizeShortText(rawPayload?.message, {
    fallback: 'Evento diagnostico sin mensaje',
    max: 255
  });
  const severity = normalizeDiagnosticSeverity(rawPayload?.severity);
  const sourceApp = sanitizeShortText(rawPayload?.sourceApp, {
    fallback: 'frontend',
    max: 40
  });
  const sourceLabel = sanitizeShortText(rawPayload?.sourceLabel, {
    fallback: null,
    max: 120
  });
  const terminalId = sanitizeShortText(rawPayload?.terminalId, {
    fallback: null,
    max: 80
  });
  const contextJson = parseDiagnosticContext(rawPayload?.context);
  const userId = Number(authUser?.id || 0) > 0 ? Number(authUser.id) : null;
  const usernameSnapshot = sanitizeShortText(authUser?.username, {
    fallback: null,
    max: 80
  });
  const roleSnapshot = sanitizeShortText(authUser?.role, {
    fallback: null,
    max: 20
  });

  const eventId = await createScannerDiagnosticEvent({
    event_type: eventType,
    severity,
    message,
    user_id: userId,
    username_snapshot: usernameSnapshot,
    role_snapshot: roleSnapshot,
    source_app: sourceApp,
    source_label: sourceLabel,
    terminal_id: terminalId,
    context_json: contextJson
  });

  return {
    id: eventId,
    eventType,
    severity,
    message,
    sourceApp,
    sourceLabel,
    terminalId,
    context: rawPayload?.context && typeof rawPayload.context === 'object' ? rawPayload.context : null,
    createdAt: new Date().toISOString(),
    user: {
      id: userId,
      username: usernameSnapshot,
      role: roleSnapshot
    }
  };
}

export async function getScannerDiagnosticEvents(rawLimit) {
  const limit = normalizeDiagnosticLimit(rawLimit);
  const rows = await listScannerDiagnosticEvents(limit);

  return rows.map((row) => {
    let parsedContext = null;
    if (row?.context_json) {
      try {
        parsedContext = JSON.parse(row.context_json);
      } catch (_error) {
        parsedContext = null;
      }
    }

    return {
      id: Number(row.id || 0),
      eventType: String(row.event_type || '').trim(),
      severity: normalizeDiagnosticSeverity(row.severity),
      message: String(row.message || '').trim(),
      sourceApp: String(row.source_app || '').trim() || 'frontend',
      sourceLabel: String(row.source_label || '').trim() || '',
      terminalId: String(row.terminal_id || '').trim() || '',
      createdAt: toCanonicalIsoUtc(row.created_at),
      context: parsedContext,
      user: {
        id: row.user_id ? Number(row.user_id) : null,
        username: String(row.username_snapshot || '').trim() || '',
        role: String(row.role_snapshot || '').trim() || ''
      }
    };
  });
}
