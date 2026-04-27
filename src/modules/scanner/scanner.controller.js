import {
  getScannerDashboard,
  getScannerProducts,
  lookupProductByBarcode,
  registerScannerPayment,
  registerScannerSale
} from './scanner.service.js';
import {
  addDashboardSubscriber,
  notifyLiveScannerChanged,
  notifyDashboardChanged,
  pushLiveScannerSnapshot,
  setLiveScannerState,
  pushDashboardSnapshot
} from './scanner.stream.js';

export async function scannerLookupController(req, res, next) {
  try {
    const product = await lookupProductByBarcode(req.query.barcode);
    res.json({
      ok: true,
      item: product
    });
  } catch (error) {
    next(error);
  }
}

export async function scannerListController(req, res, next) {
  try {
    const data = await getScannerProducts(req.query.limit);
    res.json({
      ok: true,
      ...data
    });
  } catch (error) {
    next(error);
  }
}

export async function scannerCreateSaleController(req, res, next) {
  try {
    const payload = req.body || {};
    const sale = await registerScannerSale({
      ...payload,
      userId: req.auth?.user?.id ?? payload.userId
    });
    res.status(201).json({
      ok: true,
      sale
    });
    notifyDashboardChanged().catch(() => {});
  } catch (error) {
    next(error);
  }
}

export async function scannerCreatePaymentController(req, res, next) {
  try {
    const payload = req.body || {};
    const payment = await registerScannerPayment({
      ...payload,
      userId: req.auth?.user?.id ?? payload.userId
    });
    res.status(201).json({
      ok: true,
      payment
    });
    notifyDashboardChanged().catch(() => {});
  } catch (error) {
    next(error);
  }
}

export async function scannerDashboardController(req, res, next) {
  try {
    const dashboard = await getScannerDashboard(req.query || {});
    res.json({
      ok: true,
      dashboard
    });
  } catch (error) {
    next(error);
  }
}

export async function scannerDashboardStreamController(req, res, next) {
  try {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write(': connected\n\n');

    const subscriber = {
      res,
      query: req.query || {}
    };
    const unsubscribe = addDashboardSubscriber(subscriber);

    req.on('close', () => {
      unsubscribe();
    });

    await pushDashboardSnapshot(subscriber);
    await pushLiveScannerSnapshot(subscriber);
  } catch (error) {
    next(error);
  }
}

export async function scannerUpdateLiveStateController(req, res, next) {
  try {
    await setLiveScannerState(req.body || {}, req.auth?.user || {});
    res.status(202).json({
      ok: true
    });
    notifyLiveScannerChanged().catch(() => {});
  } catch (error) {
    next(error);
  }
}
