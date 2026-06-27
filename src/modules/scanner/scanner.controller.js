import {
  createScannerCustomer,
  createScannerProduct,
  createUserStockRequest,
  getScannerCustomerDetail,
  getScannerCustomers,
  getScannerDiagnosticEvents,
  getScannerDashboard,
  getScannerDashboardInitialCash,
  getScannerMonthlySummary,
  getScannerTopSellingRanking,
  getScannerProducts,
  getUserStockRequests,
  lookupProductByBarcode,
  registerScannerCustomerAccountPayment,
  registerScannerDiagnosticEvent,
  registerScannerPayment,
  registerScannerSale,
  resolveUserStockRequest,
  updateUserStockRequest,
  updateScannerMonthlyWeekOverride,
  updateScannerDashboardInitialCash,
  updateScannerProduct
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
    const data = await getScannerProducts(req.query.limit, req.query.q);
    res.json({
      ok: true,
      ...data
    });
  } catch (error) {
    next(error);
  }
}

export async function scannerCreateProductController(req, res, next) {
  try {
    const item = await createScannerProduct(req.body || {});
    res.status(201).json({
      ok: true,
      item
    });
  } catch (error) {
    next(error);
  }
}

export async function scannerUpdateProductController(req, res, next) {
  try {
    const item = await updateScannerProduct(req.params.id, req.body || {});
    res.json({
      ok: true,
      item
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

export async function scannerCreateCustomerController(req, res, next) {
  try {
    const customer = await createScannerCustomer(req.body || {});
    res.status(201).json({
      ok: true,
      customer
    });
  } catch (error) {
    next(error);
  }
}

export async function scannerListCustomersController(_req, res, next) {
  try {
    const customers = await getScannerCustomers();
    res.json({
      ok: true,
      customers
    });
  } catch (error) {
    next(error);
  }
}

export async function scannerCustomerDetailController(req, res, next) {
  try {
    const detail = await getScannerCustomerDetail(req.params.id);
    res.json({
      ok: true,
      ...detail
    });
  } catch (error) {
    next(error);
  }
}

export async function scannerCreateCustomerAccountPaymentController(req, res, next) {
  try {
    const payload = req.body || {};
    const payment = await registerScannerCustomerAccountPayment({
      ...payload,
      customerId: req.params.id,
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

export async function scannerCreatePaymentController(req, res, next) {
  const startedAt = Date.now();
  try {
    const payload = req.body || {};
    const result = await registerScannerPayment({
      ...payload,
      userId: req.auth?.user?.id ?? payload.userId
    });
    const payment = result?.payment || result;
    const dbElapsedMs = Number(result?.meta?.dbElapsedMs || 0);
    const elapsedMs = Date.now() - startedAt;
    const appElapsedMs = Math.max(elapsedMs - dbElapsedMs, 0);
    res.setHeader('X-Server-Time-Ms', String(elapsedMs));
    res.setHeader('X-Server-Db-Time-Ms', String(dbElapsedMs));
    res.status(201).json({
      ok: true,
      payment,
      meta: {
        elapsedMs,
        dbElapsedMs,
        appElapsedMs
      }
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

export async function scannerGetDashboardInitialCashController(req, res, next) {
  try {
    const settings = await getScannerDashboardInitialCash(req.query || {}, req.auth?.user || {});
    res.json({
      ok: true,
      settings
    });
  } catch (error) {
    next(error);
  }
}

export async function scannerTopSellingRankingController(req, res, next) {
  try {
    const ranking = await getScannerTopSellingRanking(req.query || {});
    res.json({
      ok: true,
      ...ranking
    });
  } catch (error) {
    next(error);
  }
}

export async function scannerMonthlySummaryController(req, res, next) {
  try {
    const summary = await getScannerMonthlySummary(req.query || {});
    res.json({
      ok: true,
      ...summary
    });
  } catch (error) {
    next(error);
  }
}

export async function scannerUpdateMonthlyWeekOverrideController(req, res, next) {
  try {
    const override = await updateScannerMonthlyWeekOverride(req.body || {});
    res.json({
      ok: true,
      override
    });
  } catch (error) {
    next(error);
  }
}

export async function scannerCreateStockRequestController(req, res, next) {
  try {
    const request = await createUserStockRequest(req.body || {}, req.auth?.user || {});
    res.status(201).json({
      ok: true,
      request
    });
  } catch (error) {
    next(error);
  }
}

export async function scannerListStockRequestsController(req, res, next) {
  try {
    const requests = await getUserStockRequests(req.auth?.user || {});
    res.json({
      ok: true,
      requests
    });
  } catch (error) {
    next(error);
  }
}

export async function scannerUpdateStockRequestController(req, res, next) {
  try {
    const request = await updateUserStockRequest(req.params.id, req.body || {}, req.auth?.user || {});
    res.json({
      ok: true,
      request
    });
  } catch (error) {
    next(error);
  }
}

export async function scannerResolveStockRequestController(req, res, next) {
  try {
    const result = await resolveUserStockRequest(req.params.id, req.auth?.user || {});
    res.json({
      ok: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

export async function scannerUpdateDashboardInitialCashController(req, res, next) {
  try {
    const settings = await updateScannerDashboardInitialCash({
      ...(req.body || {}),
      authUser: req.auth?.user || {}
    }, req.query || {});
    res.json({
      ok: true,
      settings
    });
    notifyDashboardChanged().catch(() => {});
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

export async function scannerCreateDiagnosticEventController(req, res, next) {
  try {
    const event = await registerScannerDiagnosticEvent(req.body || {}, req.auth?.user || {});
    res.status(202).json({
      ok: true,
      event
    });
  } catch (error) {
    next(error);
  }
}

export async function scannerListDiagnosticEventsController(req, res, next) {
  try {
    const currentUsername = String(req.auth?.user?.username || '').trim().toLowerCase();
    if (currentUsername !== 'staff') {
      const error = new Error('No autorizado para ver monitoreo');
      error.statusCode = 403;
      throw error;
    }

    const events = await getScannerDiagnosticEvents(req.query?.limit);
    res.json({
      ok: true,
      events
    });
  } catch (error) {
    next(error);
  }
}
