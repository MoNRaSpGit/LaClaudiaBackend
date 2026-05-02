# Dossier Backend Para Reconstruccion SaaS

## Objetivo

Este documento captura el backend actual de Super Nova como referencia de reconstruccion.

La meta es poder rehacer la capa backend dentro de un SaaS nuevo sin tocar el backend estable del cliente.

## Alcance funcional actual

El backend actual resuelve:

1. autenticacion real por usuario/clave
2. sesiones server-side
3. permisos por rol
4. lookup de productos
5. confirmacion de ventas
6. registro de pagos
7. dashboard de caja
8. stream SSE para panel
9. configuracion diaria de caja inicial

## Patron actual

- MVC modular por feature
- carpetas por modulo en `src/modules/<feature>`

Capas:
- `routes`
- `controller`
- `service`
- `repository`
- `model`

## Modulos principales

### Auth

Archivos clave:
- `src/modules/auth/auth.routes.js`
- `src/modules/auth/auth.controller.js`
- `src/modules/auth/auth.service.js`
- `src/modules/auth/auth.repository.js`
- `src/modules/auth/auth.model.js`
- `src/modules/auth/auth.middleware.js`
- `src/modules/auth/auth.rbac.js`

Responsabilidad:
- login
- logout
- parseo `Bearer`
- sesiones persistentes
- RBAC

### Scanner

Archivos clave:
- `src/modules/scanner/scanner.routes.js`
- `src/modules/scanner/scanner.controller.js`
- `src/modules/scanner/scanner.service.js`
- `src/modules/scanner/scanner.repository.js`
- `src/modules/scanner/scanner.model.js`
- `src/modules/scanner/scanner.stream.js`

Responsabilidad:
- catalogo/lookup
- ventas
- pagos
- dashboard
- tiempo real
- caja inicial diaria

## Endpoints vigentes

### Auth

- `POST /api/auth/login`
- `POST /api/auth/logout`

### Scanner / ventas

- `GET /api/scanner/products`
  - soporta `limit` y `q` para busqueda por nombre
- `GET /api/scanner/products/lookup`
- `PUT /api/scanner/products/:id`
- `POST /api/scanner/live-state`
- `POST /api/scanner/sales`

### Panel / caja

- `GET /api/scanner/dashboard`
- `GET /api/scanner/dashboard/stream`
- `PUT /api/scanner/dashboard/initial-cash`
- `POST /api/scanner/payments`

## Roles y permisos actuales

Roles:
- `admin`
- `operario`

Permisos:
- `scanner.products.read`
- `scanner.product.update`
- `scanner.lookup.read`
- `scanner.sale.create`
- `scanner.dashboard.read`
- `scanner.payment.create`
- `scanner.dashboard.update`

Matriz actual:

- `admin`
  - todos los permisos de caja/panel
- `operario`
  - lookup
  - update producto
  - crear venta

## Modelo de datos actual

Tablas core:

### `auth_users`

- usuarios del sistema
- `username`
- `password_hash`
- `display_name`
- `role`
- `is_active`

### `auth_sessions`

- token server-side
- `user_id`
- `token_hash`
- `expires_at`
- `last_seen_at`
- `revoked_at`

### `sales_tickets`

- cabecera de venta
- `external_id`
- `user_id`
- `total_amount`
- `items_count`
- `status`
- `notes`

### `sales_ticket_items`

- detalle por item
- `sale_id`
- `product_id`
- `is_manual`
- `product_name`
- `unit_price`
- `quantity`
- `line_total`
- `thumbnail_url`

### `cash_payments`

- egresos/pagos
- `external_id`
- `user_id`
- `amount`
- `description`
- `status`

### `scanner_dashboard_daily`

- configuracion diaria
- `business_date`
- `initial_cash`

## Reglas de negocio relevantes

### Auth

- login devuelve token opaco
- logout revoca sesion
- sesion puede tener sliding renewal
- compatibilidad de hash:
  - `scrypt`
  - `sha256`
  - `plain`
  - fallback legacy

### Ventas

- minimo 1 item
- nombre requerido
- `precio_venta > 0`
- `quantity >= 1`
- `external_id` unico si se informa

### Pagos

- `amount > 0`
- `description` opcional
- `external_id` unico si se informa

### Dashboard

- corte diario basado en `America/Montevideo`
- `initialCash` persistido por fecha de negocio
- comparacion `today / yesterday / record`

## Tiempo real actual

- stream SSE en `dashboard/stream`
- snapshot inicial al conectar
- notificacion al registrar:
  - venta
  - pago
- `live-state` separado para reflejar carrito del operario

## Scripts importantes

- `npm run db:prepare:core`
- `npm run db:prepare:scanner`
- `npm run auth:hash-password`
- `npm run auth:cleanup-sessions`
- `npm test`

## Tests backend actuales

Suite base con `vitest`.

Cobertura actual:
- `src/modules/scanner/scanner.model.test.js`
- `src/modules/auth/auth.rbac.test.js`
- `src/modules/auth/auth.model.test.js`

Estado validado:
- `17` tests verdes

## Credenciales operativas actuales

- `admin / admin123`
- `nova / nova123`

Estas credenciales sirven para smoke operativo y validacion funcional.

## Smoke real recomendado

1. login `nova`
2. venta real
3. login `admin`
4. pago real
5. lectura de dashboard
6. limpieza de registros smoke si se probo contra produccion

## Lo que conviene generalizar al pasar a SaaS

- tablas con `tenant_id`
- usuarios por comercio
- sucursales/cajas
- configuracion de impresora por tenant/sucursal
- branding por negocio
- dashboard por tenant
- catalogo por tenant

## Riesgos de copiar sin rediseño

- auth demasiado simple para multi-tenant
- tablas sin separacion por comercio
- reglas de caja mezcladas con unica instancia de negocio
- dashboard global en lugar de aislado por tenant

## Orden recomendado para reconstruccion SaaS

1. auth y sesiones
2. RBAC
3. esquema core con tenant
4. productos/lookup
5. ventas
6. pagos
7. dashboard
8. SSE / live-state
9. configuraciones por tenant/sucursal
