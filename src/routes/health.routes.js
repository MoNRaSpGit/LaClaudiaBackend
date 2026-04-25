import { Router } from 'express';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    message: 'Backend LaClaudia activo',
    timestamp: new Date().toISOString()
  });
});

router.get('/message', (_req, res) => {
  res.json({
    title: 'Conexion lista',
    description: 'Frontend y backend conectados correctamente.'
  });
});

export default router;
