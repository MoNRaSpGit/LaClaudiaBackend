# 2026-04-26 - Auth + Sales Endpoints v1

## Objetivo del dia

Implementar dos primeras piezas conectables a frontend:

1. login backend.
2. confirmacion de venta persistente.

## Entregado

- Modulo `auth`:
  - `POST /api/auth/login`
  - valida `username/password` contra `auth_users`.
- Modulo `scanner` extendido:
  - `POST /api/scanner/sales`
  - valida payload y persiste venta en transaccion:
    - `sales_tickets`
    - `sales_ticket_items`
- Manejo de conflicto por `externalId` duplicado (`409`).
- Contrato documentado en `docs/contracts-auth-sales.md`.

## Nota tecnica

- Login en v1 usa token opaco no persistido (fase inicial).
- Proxima iteracion: endurecer auth (hash robusto + sesion/token real).

