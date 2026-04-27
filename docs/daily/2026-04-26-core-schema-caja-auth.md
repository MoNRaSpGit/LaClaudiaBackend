# 2026-04-26 - Core Schema Caja + Auth

## Objetivo del dia

Dejar la BDD preparada de forma estable e idempotente antes de conectar endpoints reales.

## Entregado

- Nuevo script `npm run db:prepare:core`:
  - crea/asegura `auth_users`.
  - crea/asegura `sales_tickets`.
  - crea/asegura `sales_ticket_items`.
  - crea/asegura `cash_payments`.
- Asegura foreign keys e indices para consultas de dashboard/caja.
- Agregado `npm run db:prepare:all` para ejecutar scanner + core en secuencia.
- Variables opcionales para bootstrap admin:
  - `AUTH_BOOTSTRAP_ADMIN_USER`
  - `AUTH_BOOTSTRAP_ADMIN_PASSWORD_HASH`
  - `AUTH_BOOTSTRAP_ADMIN_DISPLAY_NAME`

## Resultado

La base ya queda lista para implementar:

1. login real.
2. confirmacion de venta persistente.
3. registro de pagos persistente.
4. resumen de panel desde DB.

