import { Router } from 'express';
import { scannerListController, scannerLookupController } from './scanner.controller.js';

const router = Router();

router.get('/products', scannerListController);
router.get('/products/lookup', scannerLookupController);

export default router;
