# Arquitectura Backend

## Patron

- Enfoque MVC modular por feature.
- Cada feature vive en `src/modules/<feature>`.

## Capas

- `*.routes.js`: define endpoints y wiring HTTP.
- `*.controller.js`: traduce request/response.
- `*.service.js`: reglas de negocio.
- `*.repository.js`: queries a base de datos.
- `*.model.js`: utilidades de dominio (normalizacion/validaciones simples).

## Modulos actuales

- `health`: salud de API y DB.
- `auth`: login por usuario/clave (fase inicial).
- `scanner`: lookup/listado de productos + confirmacion de venta.
- `scanner.stream`: capa de stream en tiempo real (SSE) para dashboard.
- `scripts`: preparacion idempotente de esquema e indices DB.

## Scanner catalogo (update)

- Endpoint: `PUT /api/scanner/products/:id`.
- Persistencia: `nombre`, `precio_venta` y `imagen`.
- Guard: permiso `scanner.product.update`.

## Tiempo real (SSE)

- Endpoint: `GET /api/scanner/dashboard/stream`.
- Requiere `Authorization: Bearer <token>` y permiso `scanner.dashboard.read`.
- Envia snapshot inicial + updates cuando se registra:
  - `POST /api/scanner/sales`
  - `POST /api/scanner/payments`
- Keepalive: comentario SSE periodico para mantener conexiones vivas.

## Fuente de verdad de tiempo

- La API normaliza timestamps a ISO UTC (`...Z`) antes de responder.
- Config DB (`src/config/db.js`) fija `timezone: 'Z'` y `dateStrings` para evitar reinterpretacion por host/driver.
- El frontend convierte/renderiza en la zona operativa (`America/Montevideo`, `UTC-03:00`).

## DB y performance

- Config DB en `src/config/db.js` usando pool MySQL.
- Tabla objetivo configurable por `PRODUCTS_TABLE`.
- Script `npm run db:prepare:scanner` asegura indices para lookup rapido:
  - `idx_scanner_barcode`
  - `idx_scanner_barcode_normalized`
  - `idx_scanner_estado_id`
- Script `npm run db:prepare:core` asegura esquema base de negocio:
  - `auth_users`
  - `sales_tickets`
  - `sales_ticket_items`
  - `cash_payments`
- Tambien asegura:
  - foreign keys (`sales_tickets.user_id`, `sales_ticket_items.sale_id`, `cash_payments.user_id`)
  - indices para consultas por fecha, estado, usuario y producto.
