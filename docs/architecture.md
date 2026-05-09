# Arquitectura Backend

## Objetivo

- Este archivo describe la estructura estable del backend.
- Aca viven:
  - el patron del proyecto.
  - las reglas de trabajo del backend.
  - los modulos actuales.
  - los contratos operativos internos.
- No deberia usarse como bitacora de cambios.

## Patron

- Enfoque MVC modular por feature.
- Cada feature vive en `src/modules/<feature>`.
- La regla base es mantener boundaries claros entre HTTP, negocio y persistencia.

## Capas

- `*.routes.js`:
  - define endpoints.
  - aplica middlewares.
  - conecta controladores.
- `*.controller.js`:
  - traduce `req`/`res`.
  - no deberia contener reglas de negocio pesadas.
- `*.service.js`:
  - concentra reglas de negocio.
  - compone repositorios.
  - normaliza contratos de salida.
- `*.repository.js`:
  - concentra queries SQL y transacciones.
  - no deberia mezclar concerns HTTP.
- `*.model.js`:
  - normalizacion.
  - validaciones.
  - utilidades de dominio livianas.

## Reglas de trabajo

- Toda funcionalidad nueva entra en su modulo o feature backend correspondiente.
- Evitar controladores gordos:
  - si una regla crece, se mueve a `service`.
- Evitar queries sueltas fuera de `repository`.
- Mantener permisos centralizados en `src/modules/auth/auth.rbac.js`.
- Mantener timestamps normalizados a ISO UTC en responses.
- Si un cambio altera estructura, criterio o boundaries:
  - actualizar este archivo.
- Si un cambio es una entrega funcional o una mejora validada:
  - registrar el cambio en `docs/bitacora.md`.

## Flujo de cierre recomendado

1. implementar.
2. correr pruebas relevantes.
3. push.
4. validar deploy/publicacion.
5. documentar en el mismo ciclo.

## Estructura actual

- `src/config`:
  - configuracion de entorno, DB y server.
- `src/modules/auth`:
  - login.
  - logout.
  - keepalive de sesion.
  - RBAC.
- `src/modules/health`:
  - salud de API y DB.
- `src/modules/scanner`:
  - catalogo.
  - ventas.
  - pagos.
  - dashboard.
  - SSE.
  - stock requests.
  - diagnostico remoto.
  - resumen mensual.
- `src/scripts`:
  - preparacion idempotente de esquema e indices.
  - tareas operativas de auth.

## Modulos actuales

### `auth`

- Sesion persistida en `auth_sessions`.
- Expiracion base configurable por `AUTH_SESSION_HOURS`.
- Renovacion deslizante configurable por `AUTH_SESSION_SLIDING_RENEWAL`.
- Fuente de verdad de permisos:
  - `src/modules/auth/auth.rbac.js`

### `scanner`

- Lookup y listado de productos.
- Confirmacion de ventas.
- Registro de pagos.
- Dashboard diario.
- Ranking diario.
- Stream SSE para panel.
- Live state de caja.
- Diagnostico remoto.
- Stock requests.
- Resumen mensual de `Meses`.

### `health`

- Endpoint de salud de API.
- Validacion basica de conexion DB.

## Stock requests

- Por ahora vive dentro del modulo `scanner`.
- No se abrio un bounded context aparte todavia.

### Endpoints activos

- `POST /api/scanner/stock-requests`
- `GET /api/scanner/stock-requests`
- `PUT /api/scanner/stock-requests/:id`
- `PUT /api/scanner/stock-requests/:id/resolve`

### Persistencia

- `stock_requests`
- `stock_request_items`

### Regla operativa actual

- `admin` puede ver pedidos pendientes de todos.
- `operario` ve sus propios pedidos pendientes.
- `admin` puede editar pedidos pendientes.
- `operario` puede editar solo pedidos propios pendientes.
- el cierre de pedido queda permitido para `admin` y para el creador del pedido.

## Dashboard y tiempo real

### Dashboard HTTP

- Endpoint: `GET /api/scanner/dashboard`
- Devuelve:
  - metricas.
  - comparacion.
  - movimientos.
  - ranking.

### SSE

- Endpoint: `GET /api/scanner/dashboard/stream`
- Requiere:
  - `Authorization: Bearer <token>`
  - permiso `scanner.dashboard.read`
- Envia:
  - snapshot inicial.
  - updates al registrar ventas o pagos.
- Keepalive:
  - comentario SSE periodico para mantener conexiones vivas.

## Permisos

- Los permisos se resuelven por `requirePermission(...)`.
- No endurecer accesos con roles hardcodeados en rutas si el permiso ya existe.

### Permisos relevantes actuales

- `scanner.product.create`
- `scanner.product.update`
- `scanner.sale.create`
- `scanner.payment.create`
- `scanner.ranking.read`
- `scanner.dashboard.read`
- `scanner.dashboard.update`
- `stock.request.create`
- `stock.request.read`
- `stock.request.update`
- `stock.request.resolve`

## Fuente de verdad de tiempo

- La API responde timestamps normalizados a ISO UTC (`...Z`).
- Config DB en `src/config/db.js` fija:
  - `timezone: 'Z'`
  - `dateStrings`
- El frontend convierte/renderiza en `America/Montevideo`.

## DB y performance

- Config DB en `src/config/db.js` usando pool MySQL.
- Tabla objetivo configurable por `PRODUCTS_TABLE`.

### Scripts operativos

- `npm run db:prepare:scanner`
  - asegura indices de lookup rapido:
    - `idx_scanner_barcode`
    - `idx_scanner_barcode_normalized`
    - `idx_scanner_estado_id`
- `npm run db:prepare:core`
  - asegura esquema base:
    - `auth_users`
    - `sales_tickets`
    - `sales_ticket_items`
    - `cash_payments`
    - `stock_requests`
    - `stock_request_items`
- `npm run auth:cleanup-sessions`
  - purga sesiones expiradas/revocadas.
- `npm run auth:hash-password -- "<clave>"`
  - genera hash compatible con `auth_users.password_hash`.

## Calidad y pruebas

- Suite base con Vitest.
- Cobertura actual concentrada en:
  - RBAC.
  - modelos de auth.
  - modelos de scanner.
- Antes de cerrar cambios sensibles conviene validar:
  - `npm test -- --run`
  - smoke funcional real si toca auth, ventas o pagos.

## Ruta rapida para nuevo agente

1. `README.md`
2. `docs/architecture.md`
3. `docs/contracts-auth-sales.md`
4. `docs/bitacora.md`
5. `src/modules/auth/*`
6. `src/modules/scanner/*`
