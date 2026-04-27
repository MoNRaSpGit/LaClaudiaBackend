import { Router } from 'express';
import { loginController, logoutController } from './auth.controller.js';
import { requireAuth } from './auth.middleware.js';

const router = Router();

router.post('/auth/login', loginController);
router.post('/auth/logout', requireAuth, logoutController);

export default router;
