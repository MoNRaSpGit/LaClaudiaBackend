# 2026-11-05 - Puntos de fidelidad + separacion cuenta corriente

## Objetivo del dia

Agregar un sistema de puntos de fidelidad (ganar y canjear) que convive con
la cuenta corriente existente, sin romper la reconciliacion de deuda ya
implementada, y separar clientes "solo puntos" de clientes habilitados para
cuenta corriente.

## Reglas de negocio (confirmadas con el cliente via el usuario)

- Identificar cliente es opcional en cualquier medio de pago (antes solo en
  cuenta corriente).
- Se generan puntos al confirmar la venta, incluso si es a cuenta corriente
  (todavia no pagada).
- Tasa de acumulacion: cada `$100` pagados de verdad (neto de puntos usados)
  = `1` punto. Redondeo estandar (`>= 0.5` redondea hacia arriba).
- Tasa de canje: `1` punto = `$1` exacto.
- Se pueden combinar puntos con otro medio de pago por el resto.
- Los puntos nuevos de una venta se calculan solo sobre lo pagado de verdad,
  nunca sobre la parte cubierta con puntos.
- El turno/reporte de caja tiene su propio bucket "Puntos" ademas de
  Efectivo/Tarjeta/Credito.
- Nombre interno: "puntos" (no "creditos", para no pisar "tarjeta de credito").

## Entregado (puntos de fidelidad) - commit `eccf747`

- `ensureCoreSchema.js`: `customers.loyalty_points_balance`,
  `sales_tickets.points_used` / `points_earned`, tabla nueva
  `customer_loyalty_movements` (direction `earn`/`redeem`, `balance_after`).
- `scanner.repository.js`:
  - `createSaleTicket` ahora hace lock de fila del cliente (`FOR UPDATE`),
    valida el saldo de puntos, actualiza balance e inserta en
    `customer_loyalty_movements`.
  - Donde se calculaba deuda/efectivo real (`listCustomerAccountSales`,
    `listAllCustomerAccountSalesForReconciliation`, `listCustomersWithDebt`,
    `listScannerShiftPaymentTotalsByDate`) se resta `points_used` del
    `total_amount`, usualmente via alias SQL para no tocar la logica JS de
    reconciliacion FIFO existente (`total_amount - points_used AS
    total_amount`). **Esto es la parte delicada**: `sales_tickets.total_amount`
    sigue siendo el valor bruto de la venta en todos los demas usos (stock,
    ranking); solo se neteen los puntos en los puntos de agregacion de
    deuda/caja/turno.
- `scanner.model.js`: `normalizeSalePayload` ya no restringe `customerId` a
  pagos `cuenta`; valida `pointsToUse` contra el total.
- `scanner.service.js`: turno con bucket `puntos` en el resumen de pagos;
  bloquea venta a `cuenta` si el cliente no tiene `allows_account_sales`.
- Tests: `scanner.model.test.js` cubre redondeo de puntos, puntos sobre neto
  vs bruto, y las validaciones nuevas.

## Entregado (separar cuenta corriente / puntos + cedula) - commit `0defbdd`

- Nueva columna `customers.allows_account_sales` (`DEFAULT 1`): clientes
  existentes quedan habilitados automaticamente (grandfathering); clientes
  nuevos arrancan en lo que el alta mande explicitamente. Se puede
  habilitar/deshabilitar en cualquier momento, no es fijo al crear.
- Nueva columna `customers.cedula` (`VARCHAR(20) NULL` + indice `UNIQUE`):
  nullable a nivel DB para no tener que backfillear clientes viejos; se
  exige en la capa de validacion (`normalizeCustomerCreatePayload`) solo
  para altas nuevas.
- Permiso nuevo `CUSTOMER_ACCOUNT_FLAG_UPDATE` en `auth.rbac.js`, solo
  `admin` (mismo criterio que `CUSTOMER_DELETE`).
- Ruta nueva: `PATCH /api/scanner/customers/:id/account-flag`.
- `createScannerCustomer` convierte `ER_DUP_ENTRY` (cedula repetida) en un
  409 legible.

## Resultado

- 63 tests de backend pasando.
- Deploy en Render estable despues de las migraciones (polling de
  `/api/health` sin caidas).
- Puntos seguros para volver: backend `eccf747` (antes de separar
  cuenta/puntos y cedula), `9463be5` (antes de puntos de fidelidad).
- Ver tambien el daily equivalente del frontend para la parte de UI
  (checkout con puntos, alta/listado de clientes, buscador de cliente).
