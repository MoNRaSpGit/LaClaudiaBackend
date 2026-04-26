import { Router } from 'express';
import { healthController, messageController } from './health.controller.js';

const router = Router();

router.get('/health', healthController);
router.get('/message', messageController);

export default router;
