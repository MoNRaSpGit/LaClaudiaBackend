import { Router } from 'express';
import { requireAuth, requirePermission } from '../auth/auth.middleware.js';
import { PERMISSIONS } from '../auth/auth.rbac.js';
import {
  scannerCreatePaymentController,
  scannerCreateSaleController,
  scannerDashboardController,
  scannerDashboardStreamController,
  scannerListController,
  scannerLookupController,
  scannerUpdateDashboardInitialCashController,
  scannerUpdateProductController,
  scannerUpdateLiveStateController
} from './scanner.controller.js';

const router = Router();

router.get('/products', scannerListController);
router.get('/products/lookup', scannerLookupController);
router.use(requireAuth);
router.put('/products/:id', requirePermission(PERMISSIONS.SCANNER_PRODUCT_UPDATE), scannerUpdateProductController);
router.post('/live-state', requirePermission(PERMISSIONS.SCANNER_SALE_CREATE), scannerUpdateLiveStateController);
router.post('/sales', requirePermission(PERMISSIONS.SCANNER_SALE_CREATE), scannerCreateSaleController);
router.get('/dashboard', requirePermission(PERMISSIONS.SCANNER_DASHBOARD_READ), scannerDashboardController);
router.get('/dashboard/stream', requirePermission(PERMISSIONS.SCANNER_DASHBOARD_READ), scannerDashboardStreamController);
router.put('/dashboard/initial-cash', requirePermission(PERMISSIONS.SCANNER_DASHBOARD_UPDATE), scannerUpdateDashboardInitialCashController);
router.post('/payments', requirePermission(PERMISSIONS.SCANNER_PAYMENT_CREATE), scannerCreatePaymentController);

export default router;
