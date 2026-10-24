import { Router } from 'express';
import { s2pingController } from './s2ping.controller.js';

const router = Router();

router.get('/ping', s2pingController);

export default router;
