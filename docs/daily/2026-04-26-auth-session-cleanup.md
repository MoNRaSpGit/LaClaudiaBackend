# 2026-04-26 - Auth Session Cleanup

## Objetivo del ajuste

Agregar mantenimiento operativo para `auth_sessions` y evitar crecimiento infinito de sesiones viejas.

## Entregado

- Nuevo script:
  - `npm run auth:cleanup-sessions`
  - borra en lotes sesiones revocadas/expiradas fuera de retencion.
- Modo seguro:
  - `npm run auth:cleanup-sessions -- --dry-run`
  - reporta candidatos sin borrar.
- Variables nuevas:
  - `AUTH_SESSION_CLEANUP_RETENTION_DAYS` (default `7`)
  - `AUTH_SESSION_CLEANUP_BATCH_SIZE` (default `500`)
- Documentacion actualizada en `README.md` y `docs/bitacora.md`.

## Resultado

La API queda lista para ejecutar limpieza automatica via cron (Render job) con control de retencion y batch size configurable.
