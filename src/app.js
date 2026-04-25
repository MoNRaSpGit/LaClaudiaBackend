import express from 'express';
import cors from 'cors';
import healthRoutes from './routes/health.routes.js';
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
      status: 'running'
    });
  });

  app.use('/api', healthRoutes);

  app.use((_req, res) => {
    res.status(404).json({
      ok: false,
      message: 'Route not found'
    });
  });

  return app;
}
