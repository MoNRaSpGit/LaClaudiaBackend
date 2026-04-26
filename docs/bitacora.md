# Bitacora Backend

## Estado actual (2026-04-26)

Backend estable para lookup y listado inicial de productos, conectado a BDD2 (`bwbxqngh9d4wr6bnopb3`) y tabla `clau_prodcutos`.

## Lo que ya quedo listo

- API Express en produccion compatible con Render.
- Conexion MySQL por pool (`src/config/db.js`).
- Modulo `scanner`:
  - `GET /api/scanner/products?limit=...`
  - `GET /api/scanner/products/lookup?barcode=...`
- Script de preparacion de DB para rendimiento:
  - `npm run db:prepare:scanner`
  - indices para barcode/barcode normalizado.
- Config base de CORS y health checks.

## En que estamos trabajando

Estamos en etapa de consolidar logica de caja y ventas en frontend, para luego bajar esa logica al backend con endpoints persistentes (ventas, pagos, ranking, comparaciones).

## Pendientes inmediatos

1. Endpoint para `barcode no encontrado` + alta rapida de producto manual real.
2. Endpoint para confirmar venta con detalle de items.
3. Endpoint para registrar pago y afectar caja.
4. Endpoint resumen para Panel Control (metricas, movimientos, ranking).
5. Preparar migraciones/tablas para ventas y pagos.

## Observaciones

- La BDD1 solo se uso para clonado inicial de productos.
- El objetivo operativo actual es BDD2.
