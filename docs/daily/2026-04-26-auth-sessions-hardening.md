# 2026-04-26 - Auth Sessions Hardening

## Objetivo del ajuste

Pasar de token opaco "solo respuesta" a sesion valida en servidor, para conectar frontend/backend con auth real.

## Entregado

- Persistencia de sesiones:
  - nueva tabla `auth_sessions` en `db:prepare:core`.
  - FK a `auth_users` + indices de busqueda/expiracion.
- Auth backend:
  - `POST /api/auth/login` ahora crea sesion real y guarda `token_hash`.
  - `POST /api/auth/logout` revoca sesion activa.
  - middleware `requireAuth` para validar `Bearer`.
- Seguridad de password:
  - soporte recomendado `scrypt:<N>:<r>:<p>:<saltHex>:<digestHex>`.
  - compatibilidad mantenida con `sha256`/`plain` heredado.
  - `auth:hash-password` ahora genera `scrypt` por defecto.
- Scanner protegido:
  - `GET /dashboard`, `POST /sales`, `POST /payments` requieren sesion.
  - `userId` de payload queda pisado por usuario autenticado.
- Frontend:
  - envia `Authorization: Bearer <token>` en dashboard/sales/payments.
  - logout dispara revocacion de sesion backend.

## Resultado

Login + flujo de caja queda listo para integrar permisos por rol y capa de persistencia mas estricta, manteniendo compatibilidad de hashes antiguos durante transicion.
