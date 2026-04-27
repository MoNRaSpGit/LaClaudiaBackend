import { resolveAuthenticatedSession } from './auth.service.js';
import { roleHasPermission } from './auth.rbac.js';

export async function requireAuth(req, _res, next) {
  try {
    const session = await resolveAuthenticatedSession(req.get('authorization'));
    req.auth = session;
    next();
  } catch (error) {
    next(error);
  }
}

export function requirePermission(permission) {
  const normalizedPermission = String(permission || '').trim();

  return function permissionGuard(req, _res, next) {
    const currentRole = String(req.auth?.user?.role || '').trim().toLowerCase();
    if (roleHasPermission(currentRole, normalizedPermission)) {
      next();
      return;
    }

    const error = new Error('No autorizado para esta accion');
    error.statusCode = 403;
    next(error);
  };
}
