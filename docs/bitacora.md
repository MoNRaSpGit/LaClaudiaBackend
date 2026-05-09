# Bitacora Backend

## Referencia operativa: version estable

- Si el usuario dice `volvemos a estable`, la referencia base actual de backend es:
  - `backend origin/main`
  - commit: `9cab40f`
  - mensaje: `auth: endpoint session para keepalive frontend`
- Esta referencia representa la ultima version subida y tomada como estable antes de cambios locales no publicados.

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

## Mini Changelog Tecnico (2026-04-27)

- Stock requests persistentes + ranking acotado (2026-05-05):
  - nuevo soporte backend para pedidos de stock reales entre operario y admin.
  - nuevas tablas:
    - `stock_requests`
    - `stock_request_items`
  - nuevos endpoints:
    - `POST /api/scanner/stock-requests`
    - `GET /api/scanner/stock-requests`
    - `PUT /api/scanner/stock-requests/:id/resolve`
  - criterio actual:
    - `admin` ve todos los pedidos pendientes.
    - `operario` ve solo sus propios pendientes.
    - el cierre de pedido queda permitido para quien lo creo y para `admin`.
  - se agrego endpoint acotado de ranking:
    - `GET /api/scanner/dashboard/ranking`
    - objetivo: exponer `+Vendidos` sin abrir todo `dashboard.read` al operario.
  - permisos nuevos:
    - `scanner.ranking.read`
    - `stock.request.create`
    - `stock.request.read`
    - `stock.request.resolve`
  - validacion tecnica:
    - `npm test -- --run` OK.
    - `npm run db:prepare:core` OK.

- Busqueda por nombre en catalogo scanner (2026-05-02):
  - `GET /api/scanner/products` ahora acepta `q`.
  - filtra por coincidencia parcial en `nombre`.
  - mantiene `limit`.
  - objetivo: soportar pagina admin `Productos` del frontend.

- Telemetria remota de diagnostico scanner (2026-05-01):
  - nueva tabla `scanner_diagnostic_events` para registrar eventos criticos enviados desde frontend.
  - nuevo endpoint `POST /api/scanner/diagnostic-events`:
    - requiere sesion autenticada.
    - disponible para flujo operativo de scanner.
    - guarda:
      - `eventType`
      - `severity`
      - `message`
      - `sourceLabel`
      - `terminalId`
      - `context`
      - snapshot de usuario autenticado
  - nuevo endpoint `GET /api/scanner/diagnostic-events`:
    - pensado para lectura admin desde panel de control.
    - devuelve incidentes recientes ordenados por fecha.
  - objetivo: tener visibilidad remota de errores reales de locales sin depender de inspeccion manual en la PC del cliente.

- Keepalive autenticado de sesion (2026-05-01):
  - nuevo endpoint `GET /api/auth/session` protegido con `requireAuth`.
  - devuelve estado `ok` + usuario autenticado actual.
  - se usa como touch liviano desde frontend para mantener renovacion deslizante de `expires_at` en jornadas largas de caja.
  - objetivo operativo: minimizar expiraciones en medio de trabajo sin depender de logout/login manual.

- Pagos para operario (2026-04-30):
  - `operario` ahora tiene permiso `scanner.payment.create`.
  - los pagos registrados desde UI operativa impactan en `cash_payments` y aparecen en movimientos del dashboard admin.

- Margen diario del panel (2026-04-30):
  - `profitRate` por defecto actualizado de `20%` a `40%`.
  - impacta en `Ganancia diaria` cuando el dashboard no recibe override explicito por query.

- Alta rapida por barcode no encontrado (2026-04-30):
  - agregado `POST /api/scanner/products` para persistir productos creados desde caja.
  - validacion backend de `barcode`, `nombre` y `precio_venta`.
  - proteccion de conflicto si el barcode ya existe.
  - permiso nuevo `scanner.product.create` habilitado para `admin` y `operario`.

- Calidad y auth operativa (2026-04-30):
  - suite base de tests backend agregada con `vitest`.
  - scripts disponibles:
    - `npm test`
    - `npm run test:watch`
  - cobertura inicial incorporada:
    - `src/modules/scanner/scanner.model.test.js`
    - `src/modules/auth/auth.rbac.test.js`
    - `src/modules/auth/auth.model.test.js`
  - estado validado:
    - `3` archivos.
    - `17` tests pasando.
  - bug real corregido durante esta etapa:
    - `initialCash` negativo ya no se normaliza silenciosamente a `0`; ahora se rechaza como payload invalido.
  - auth operativa de caja alineada con frontend:
    - usuario `admin` activo con clave simple `1994`.
    - usuario `nova` activo como `operario` con clave simple `nova123`.
    - objetivo: reducir friccion de ingreso sin volver a un login simulado.

- Auth sesion extendida (2026-04-29):
  - `AUTH_SESSION_HOURS` ampliado (default) para sesiones de larga duracion.
  - agregado `AUTH_SESSION_SLIDING_RENEWAL=true` (default):
    - cada request autenticado renueva `expires_at` de la sesion.
    - objetivo: minimizar cierres por inactividad corta y privilegiar logout manual.
  - nota operativa:
    - sesiones creadas antes del cambio conservan expiracion previa hasta nuevo login.

- Scanner catalogo:
  - nuevo endpoint `PUT /api/scanner/products/:id` para persistir edicion de producto desde scanner.
  - normalizacion y validaciones para update de `nombre`, `precio_venta`, `thumbnail_url`.
- Permisos:
  - nuevo permiso `scanner.product.update` habilitado para `admin` y `operario`.
- Imagen de producto:
  - fix de compatibilidad en guardado: `imagen` ahora se persiste como string (data-url) para tablas con columna texto.

## Ruta Para Nuevo Agente (leer en este orden)

1. `README.md` (scripts, env y endpoints activos).
2. `docs/contracts-auth-sales.md` (contrato vigente).
3. `docs/bitacora.md` (estado y pendientes inmediatos).
4. `docs/saas-rebuild-backend.md` (captura funcional para reconstruccion futura en SaaS).
5. `src/modules/auth/*`, `src/modules/scanner/*`, `src/scripts/*`.

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

## En que quedamos

- hacer text manuales   y ver q errores salen

## Paquete local en validacion - eventos de diagnostico scanner

- Se agrego soporte backend para eventos de diagnostico de scanner.
- Componentes:
  - tabla `scanner_diagnostic_events`
  - `POST /api/scanner/diagnostic-events`
  - `GET /api/scanner/diagnostic-events`
- Criterio operativo actual:
  - el backend guarda eventos de soporte remoto del scanner.
  - la lectura de monitoreo queda restringida a usuario `staff`.
- Estado de pruebas:
  - guardado manual: OK.
  - guardado diferido luego de backend caido: OK, apoyado por cola local de frontend.
  - normalizacion de hora: corregida para respetar configuracion DB actual (`UTC` en driver).

## Observaciones

- La BDD1 solo se uso para clonado inicial de productos.
- El objetivo operativo actual es BDD2.
- Flujo recomendado para entorno local:
  1. generar hash de clave admin con script local.
  2. cargar `AUTH_BOOTSTRAP_ADMIN_*` en `.env`.
  3. ejecutar `npm run db:prepare:all`.
  4. validar login con `POST /api/auth/login`.

## Datos de servicios (infra actual)

### Base de datos MySQL (cloud)

- Plan: `XXS Medium Space`
- Addon ID: `mysql_21b05d3f-23cf-4617-90a9-d942c4eaad75`
- Zona: `FR (Paris, France)` sobre `clever-cloud`
- Tipo: `Dedicated`
- Max connection limit: `15`
- Max db size: `1 GB`
- vCPUs: `1`
- Memoria: `512 MB`
- Backups: `daily`, `7` retenidos
- Metrics: `Yes`
- Logs: `Yes`

### Backend Render (cloud)

- RAM: `512 MB`
- CPU: `0.5`
- Plan pago con soporte para:
  - Zero Downtime
  - SSH Access
  - Scaling
  - One-off jobs
  - Persistent disks

### Nota operativa de capacidad (estimacion inicial)

- Con arquitectura y queries bien optimizadas:
  - `20-60` clientes activos mensuales sin estres.
  - `5-20` clientes concurrentes en hora pico de forma comoda.
- Cuellos de botella esperables en este tier:
  - limite de conexiones MySQL (`15`).
  - CPU/RAM del backend (`0.5 CPU / 512 MB`).

## Redeploy operativo - semanas completas en Meses

- Se fuerza nuevo deploy de backend para publicar el armado semanal completo `lunes -> domingo` en `Meses`.
- Los dias sin movimiento deben salir con `0` en lugar de omitirlos.

## Stock requests - edicion

- Fecha: `2026-05-08`
- Nuevo endpoint: `PUT /api/scanner/stock-requests/:id`.
- Permite editar pedidos pendientes de stock:
  - proveedor.
  - lista de items.
  - cantidades.
- Permisos:
  - `admin` puede editar cualquier pedido pendiente.
  - `operario` solo puede editar pedidos propios pendientes.
- La actualizacion reemplaza los items dentro de una transaccion para evitar estados parciales.
- Validacion:
  - `npm test -- --run`: OK.
