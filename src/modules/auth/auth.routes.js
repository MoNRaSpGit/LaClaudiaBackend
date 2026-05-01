import { Router } from 'express';
import { loginController, logoutController, sessionController } from './auth.controller.js';
import { requireAuth } from './auth.middleware.js';

const router = Router();

router.post('/auth/login', loginController);
router.post('/auth/logout', requireAuth, logoutController);
router.get('/auth/session', requireAuth, sessionController);

export default router;
