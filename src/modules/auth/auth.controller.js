import { loginByCredentials, logoutSession } from './auth.service.js';

export async function loginController(req, res, next) {
  try {
    const payload = req.body || {};
    const data = await loginByCredentials(payload.username, payload.password, {
      userAgent: req.get('user-agent') || '',
      ipAddress: req.ip || req.socket?.remoteAddress || ''
    });
    res.json({
      ok: true,
      ...data
    });
  } catch (error) {
    next(error);
  }
}

export async function logoutController(req, res, next) {
  try {
    const result = await logoutSession(req.get('authorization'));
    res.json({
      ok: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

export async function sessionController(req, res, next) {
  try {
    res.json({
      ok: true,
      user: req.auth?.user || null
    });
  } catch (error) {
    next(error);
  }
}
