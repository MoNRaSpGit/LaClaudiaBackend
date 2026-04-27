import {
  createCashPayment,
  createSaleTicket,
  findProductByBarcode,
  getBestSalesDayTotal,
  listPaymentMovementsBetween,
  listProducts,
  listRankingBetween,
  listSaleItemsBySaleIds,
  listSalesMovementsBetween,
  sumConfirmedPaymentsBetween,
  sumConfirmedSalesBetween
} from './scanner.repository.js';
import {
  normalizeBarcode,
  normalizeDashboardParams,
  normalizeLimit,
  normalizePaymentPayload,
  normalizeSalePayload
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

    if (!previous) {
      byKey.set(key, {
        key,
        name,
        qty
      });
      return;
    }

    previous.qty += qty;
    if (!previous.name && name) {
      previous.name = name;
    }
  });

  return Array.from(byKey.values())
    .sort((a, b) => b.qty - a.qty);
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

export async function getScannerProducts(rawLimit) {
  const limit = normalizeLimit(rawLimit);
  const items = await listProducts({ limit });
  return {
    count: items.length,
    items: items.map(toScannerProduct)
  };
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
    return await createCashPayment(normalized);
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      const duplicateError = new Error('El pago ya fue registrado (externalId duplicado)');
      duplicateError.statusCode = 409;
      throw duplicateError;
    }
    throw error;
  }
}

export async function getScannerDashboard(rawQuery) {
  const params = normalizeDashboardParams(rawQuery);

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
    initialCash: roundMoney(params.initialCash),
    salesToday: roundMoney(salesToday),
    profitToday: roundMoney(salesToday * params.profitRate),
    currentAmount: roundMoney(params.initialCash + salesToday - paymentsToday),
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
