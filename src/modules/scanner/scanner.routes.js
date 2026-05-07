import { Router } from 'express';
import { requireAuth, requirePermission } from '../auth/auth.middleware.js';
import { PERMISSIONS } from '../auth/auth.rbac.js';
import {
  scannerCreateDiagnosticEventController,
  scannerCreateProductController,
  scannerCreatePaymentController,
  scannerCreateSaleController,
  scannerCreateStockRequestController,
  scannerDashboardController,
  scannerDashboardStreamController,
  scannerListDiagnosticEventsController,
  scannerListController,
  scannerListStockRequestsController,
  scannerMonthlySummaryController,
  scannerUpdateMonthlyWeekOverrideController,
  scannerLookupController,
  scannerResolveStockRequestController,
  scannerTopSellingRankingController,
  scannerUpdateDashboardInitialCashController,
  scannerUpdateProductController,
  scannerUpdateLiveStateController
} from './scanner.controller.js';

const router = Router();

router.get('/products', scannerListController);
router.get('/products/lookup', scannerLookupController);
router.use(requireAuth);
router.post('/products', requirePermission(PERMISSIONS.SCANNER_PRODUCT_CREATE), scannerCreateProductController);
router.put('/products/:id', requirePermission(PERMISSIONS.SCANNER_PRODUCT_UPDATE), scannerUpdateProductController);
router.post('/live-state', requirePermission(PERMISSIONS.SCANNER_SALE_CREATE), scannerUpdateLiveStateController);
router.post('/sales', requirePermission(PERMISSIONS.SCANNER_SALE_CREATE), scannerCreateSaleController);
router.post('/diagnostic-events', requirePermission(PERMISSIONS.SCANNER_SALE_CREATE), scannerCreateDiagnosticEventController);
router.post('/stock-requests', requirePermission(PERMISSIONS.STOCK_REQUEST_CREATE), scannerCreateStockRequestController);
router.get('/stock-requests', requirePermission(PERMISSIONS.STOCK_REQUEST_READ), scannerListStockRequestsController);
router.put('/stock-requests/:id/resolve', requirePermission(PERMISSIONS.STOCK_REQUEST_RESOLVE), scannerResolveStockRequestController);
router.get('/dashboard/ranking', requirePermission(PERMISSIONS.SCANNER_RANKING_READ), scannerTopSellingRankingController);
router.get('/dashboard', requirePermission(PERMISSIONS.SCANNER_DASHBOARD_READ), scannerDashboardController);
router.get('/dashboard/monthly-summary', requirePermission(PERMISSIONS.SCANNER_DASHBOARD_READ), scannerMonthlySummaryController);
router.put('/dashboard/monthly-summary/week', requirePermission(PERMISSIONS.SCANNER_DASHBOARD_UPDATE), scannerUpdateMonthlyWeekOverrideController);
router.get('/dashboard/stream', requirePermission(PERMISSIONS.SCANNER_DASHBOARD_READ), scannerDashboardStreamController);
router.get('/diagnostic-events', requirePermission(PERMISSIONS.SCANNER_DASHBOARD_READ), scannerListDiagnosticEventsController);
router.put('/dashboard/initial-cash', requirePermission(PERMISSIONS.SCANNER_DASHBOARD_UPDATE), scannerUpdateDashboardInitialCashController);
router.post('/payments', requirePermission(PERMISSIONS.SCANNER_PAYMENT_CREATE), scannerCreatePaymentController);

export default router;
