import { Router } from 'express';
import { requireAuth, requirePermission } from '../auth/auth.middleware.js';
import { PERMISSIONS } from '../auth/auth.rbac.js';
import {
  scannerCreateDiagnosticEventController,
  scannerCreateCustomerAccountPaymentController,
  scannerCreateCustomerController,
  scannerCreateProductController,
  scannerCreatePaymentController,
  scannerCreateSaleController,
  scannerCreateStockRequestController,
  scannerDashboardController,
  scannerGetDashboardInitialCashController,
  scannerGetDashboardInitialCashPreloadController,
  scannerDashboardStreamController,
  scannerCustomerDetailController,
  scannerListDiagnosticEventsController,
  scannerListController,
  scannerListCustomersController,
  scannerListStockRequestsController,
  scannerMonthlySummaryController,
  scannerUpdateMonthlyWeekOverrideController,
  scannerLookupController,
  scannerResolveStockRequestController,
  scannerTopSellingRankingController,
  scannerUpdateDashboardInitialCashController,
  scannerUpdateDashboardInitialCashPreloadController,
  scannerUpdateStockRequestController,
  scannerUpdateProductController,
  scannerUpdateLiveStateController
} from './scanner.controller.js';

const router = Router();

router.get('/products', scannerListController);
router.get('/products/lookup', scannerLookupController);
router.use(requireAuth);
router.get('/customers', requirePermission(PERMISSIONS.CUSTOMER_READ), scannerListCustomersController);
router.get('/customers/:id', requirePermission(PERMISSIONS.CUSTOMER_READ), scannerCustomerDetailController);
router.post('/customers', requirePermission(PERMISSIONS.CUSTOMER_CREATE), scannerCreateCustomerController);
router.post('/customers/:id/payments', requirePermission(PERMISSIONS.CUSTOMER_PAYMENT_CREATE), scannerCreateCustomerAccountPaymentController);
router.post('/products', requirePermission(PERMISSIONS.SCANNER_PRODUCT_CREATE), scannerCreateProductController);
router.put('/products/:id', requirePermission(PERMISSIONS.SCANNER_PRODUCT_UPDATE), scannerUpdateProductController);
router.post('/live-state', requirePermission(PERMISSIONS.SCANNER_SALE_CREATE), scannerUpdateLiveStateController);
router.post('/sales', requirePermission(PERMISSIONS.SCANNER_SALE_CREATE), scannerCreateSaleController);
router.post('/diagnostic-events', requirePermission(PERMISSIONS.SCANNER_SALE_CREATE), scannerCreateDiagnosticEventController);
router.post('/stock-requests', requirePermission(PERMISSIONS.STOCK_REQUEST_CREATE), scannerCreateStockRequestController);
router.get('/stock-requests', requirePermission(PERMISSIONS.STOCK_REQUEST_READ), scannerListStockRequestsController);
router.put('/stock-requests/:id', requirePermission(PERMISSIONS.STOCK_REQUEST_UPDATE), scannerUpdateStockRequestController);
router.put('/stock-requests/:id/resolve', requirePermission(PERMISSIONS.STOCK_REQUEST_RESOLVE), scannerResolveStockRequestController);
router.get('/dashboard/ranking', requirePermission(PERMISSIONS.SCANNER_RANKING_READ), scannerTopSellingRankingController);
router.get('/dashboard', requirePermission(PERMISSIONS.SCANNER_DASHBOARD_READ), scannerDashboardController);
router.get('/dashboard/initial-cash', requirePermission(PERMISSIONS.SCANNER_INITIAL_CASH_READ), scannerGetDashboardInitialCashController);
router.get('/dashboard/initial-cash/preload', requirePermission(PERMISSIONS.SCANNER_INITIAL_CASH_READ), scannerGetDashboardInitialCashPreloadController);
router.get('/dashboard/monthly-summary', requirePermission(PERMISSIONS.SCANNER_DASHBOARD_READ), scannerMonthlySummaryController);
router.put('/dashboard/monthly-summary/week', requirePermission(PERMISSIONS.SCANNER_DASHBOARD_UPDATE), scannerUpdateMonthlyWeekOverrideController);
router.get('/dashboard/stream', requirePermission(PERMISSIONS.SCANNER_DASHBOARD_READ), scannerDashboardStreamController);
router.get('/diagnostic-events', requirePermission(PERMISSIONS.SCANNER_DASHBOARD_READ), scannerListDiagnosticEventsController);
router.put('/dashboard/initial-cash', requirePermission(PERMISSIONS.SCANNER_INITIAL_CASH_UPDATE), scannerUpdateDashboardInitialCashController);
router.put('/dashboard/initial-cash/preload', requirePermission(PERMISSIONS.SCANNER_INITIAL_CASH_UPDATE), scannerUpdateDashboardInitialCashPreloadController);
router.post('/payments', requirePermission(PERMISSIONS.SCANNER_PAYMENT_CREATE), scannerCreatePaymentController);

export default router;
