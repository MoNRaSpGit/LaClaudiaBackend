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
- `scanner`: busqueda por barcode y listado inicial de productos.

## DB y performance

- Config DB en `src/config/db.js` usando pool MySQL.
- Tabla objetivo configurable por `PRODUCTS_TABLE`.
- Script `npm run db:prepare:scanner` asegura indices para lookup rapido:
  - `idx_scanner_barcode`
  - `idx_scanner_barcode_normalized`
  - `idx_scanner_estado_id`
