# Bitacora Backend

## Estado actual (2026-04-26)

Backend estable para lookup y listado inicial de productos, conectado a BDD2 (`bwbxqngh9d4wr6bnopb3`) y tabla `clau_prodcutos`.

## Mini Changelog Tecnico (2026-04-26)

- Auth endurecida:
  - sesiones persistentes en `auth_sessions`.
  - `login/logout` con token `Bearer` server-side.
  - hash de password `scrypt` por defecto (compat legacy `sha256/plain`).
- RBAC aplicado y centralizado:
  - permisos por rol (`admin`, `operario`).
  - mapa en `src/modules/auth/auth.rbac.js`.
- Dashboard/flujo caja consolidado:
  - ventas, pagos, movimientos y ranking desde DB real.
  - dedupe defensivo de movimientos/ranking.
- Mantenimiento operativo:
  - `auth:cleanup-sessions` con `--dry-run`.
- Dashboard en tiempo real:
  - nuevo stream SSE `GET /api/scanner/dashboard/stream`.
  - push automatico a clientes al confirmar ventas/pagos.

## Ruta Para Nuevo Agente (leer en este orden)

1. `README.md` (scripts, env y endpoints activos).
2. `docs/contracts-auth-sales.md` (contrato vigente).
3. `docs/bitacora.md` (estado y pendientes inmediatos).
4. `src/modules/auth/*`, `src/modules/scanner/*`, `src/scripts/*`.

## Lo que ya quedo listo

- API Express en produccion compatible con Render.
- Conexion MySQL por pool (`src/config/db.js`).
- Modulo `scanner`:
  - `GET /api/scanner/products?limit=...`
  - `GET /api/scanner/products/lookup?barcode=...`
- Script de preparacion de DB para rendimiento:
  - `npm run db:prepare:scanner`
  - indices para barcode/barcode normalizado.
- Script de preparacion de esquema core:
  - `npm run db:prepare:core`
  - tablas base de auth/caja/ventas/pagos.
  - indices + foreign keys idempotentes.
- Config base de CORS y health checks.
- Endpoint auth login inicial:
  - `POST /api/auth/login`
- Endpoint auth logout:
  - `POST /api/auth/logout`
- Sesiones server-side persistentes:
  - tabla `auth_sessions` + validacion `Bearer`.
- Permisos por rol aplicados:
  - `admin`: dashboard + pagos + ventas.
  - `operario`: ventas (scanner) sin dashboard/pagos.
- RBAC centralizado:
  - mapa de permisos/roles en `src/modules/auth/auth.rbac.js`.
  - middlewares usan permisos (`requirePermission`) en vez de roles hardcodeados por ruta.
- Limpieza de sesiones:
  - script `npm run auth:cleanup-sessions` para purgar sesiones revocadas/expiradas antiguas.
  - soporte `--dry-run` para validar candidatos antes de borrar.
- Endpoint de venta persistente inicial:
  - `POST /api/scanner/sales`
  - guarda en `sales_tickets` + `sales_ticket_items`.
- Endpoint de pago persistente inicial:
  - `POST /api/scanner/payments`
  - guarda en `cash_payments`.
- Endpoint de resumen para panel:
  - `GET /api/scanner/dashboard`
  - devuelve metricas, comparacion, movimientos y ranking desde DB real.
- Endpoint de stream para panel:
  - `GET /api/scanner/dashboard/stream`
  - envia dashboard en tiempo real via SSE.
- Script utilitario para bootstrap admin:
  - `npm run auth:hash-password -- "<clave>"`
  - genera `scrypt:...` por defecto (compatible con `auth_users.password_hash`).

## En que estamos trabajando

Estamos en etapa de consolidar logica de caja y ventas en frontend, para luego bajar esa logica al backend con endpoints persistentes (ventas, pagos, ranking, comparaciones).

## Contexto rapido para agente (2026-04-26)

- El backend actual ya cubre scanner base de productos (lookup/listado) y salud de API/DB.
- El frontend ya se prolijo y estable para integracion:
  - metricas por dia.
  - ranking expandible real.
  - movimientos expandibles.
  - edicion de item en carrito persistida localmente.
  - validaciones de entrada para evitar requests basura.
- Tests y build del frontend estan en verde despues de limpieza y ajustes.
- Proximo objetivo: mover flujo de caja (ventas/pagos/ranking/comparaciones) a endpoints persistentes sobre BDD2.
- Prioridad de integracion:
  1. `barcode no encontrado` + alta rapida.
  2. confirmar venta (ticket con items).
  3. registrar pago.
  4. resumen panel (metricas, movimientos, ranking).
  5. autenticar login shell frontend (usuario/clave) con endpoint real.

## Nota de integracion frontend->backend

- Frontend ya consume login/sales/payments/dashboard reales.
- Backend expone:
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `POST /api/scanner/sales`
  - `POST /api/scanner/payments`
  - `GET /api/scanner/dashboard`
  - `GET /api/scanner/dashboard/stream`

## Pendientes inmediatos

1. Endpoint para `barcode no encontrado` + alta rapida de producto manual real.
2. Alta/baja de permisos por feature desde config/env si se requiere modo emergencia.
3. Endpoint de alta de usuarios/roles con auditoria minima.

## Observaciones

- La BDD1 solo se uso para clonado inicial de productos.
- El objetivo operativo actual es BDD2.
- Flujo recomendado para entorno local:
  1. generar hash de clave admin con script local.
  2. cargar `AUTH_BOOTSTRAP_ADMIN_*` en `.env`.
  3. ejecutar `npm run db:prepare:all`.
  4. validar login con `POST /api/auth/login`.
