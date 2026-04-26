import express from 'express';
import cors from 'cors';
import healthRoutes from './modules/health/health.routes.js';
import scannerRoutes from './modules/scanner/scanner.routes.js';
import { env } from './config/env.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          callback(null, true);
          return;
        }

        if (env.frontendOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`Origen no permitido por CORS: ${origin}`));
      }
    })
  );

  app.use(express.json());

  app.get('/api', (_req, res) => {
    res.json({
      name: 'LaClaudia API',
      status: 'running',
      architecture: 'mvc-modular'
    });
  });

  app.use('/api', healthRoutes);
  app.use('/api/scanner', scannerRoutes);

  app.use((error, _req, res, _next) => {
    const explicitStatus = Number(error?.statusCode || error?.status || 0);
    const status = explicitStatus > 0 ? explicitStatus : error?.message?.includes('CORS') ? 403 : 500;

    res.status(status).json({
      ok: false,
      message: error?.message || 'Unexpected server error'
    });
  });

  app.use((_req, res) => {
    res.status(404).json({
      ok: false,
      message: 'Route not found'
    });
  });

  return app;
}
