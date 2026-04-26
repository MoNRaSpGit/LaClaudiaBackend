import { getHealthSnapshot } from './health.service.js';

export async function healthController(_req, res, next) {
  try {
    const payload = await getHealthSnapshot();
    res.json(payload);
  } catch (error) {
    next(error);
  }
}

export function messageController(_req, res) {
  res.json({
    title: 'Conexion lista',
    description: 'Frontend y backend conectados correctamente.'
  });
}
