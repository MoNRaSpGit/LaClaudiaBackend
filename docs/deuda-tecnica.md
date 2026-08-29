# Deuda tecnica - backend

## Objetivo

- Lista viva de problemas reales detectados pero **todavia no arreglados**.
- Cada item queda ahi hasta que se arregla; en ese momento se saca de aca y,
  si corresponde, se documenta el cambio en `docs/bitacora.md`.
- No arrancar ninguno de estos en horario operativo sin avisar: varios tocan
  turnos, caja y cuenta corriente, que son criticos para que los operarios
  puedan seguir trabajando sin cortes.
- Origen: auditoria general pedida el 2026-08-01 despues de los fixes de
  turnos colgados, ticket de cuenta corriente y caja por turno.

## Como priorizar

- Alto: puede generar diferencia de plata real (caja, deuda) o dejar a un
  operario bloqueado.
- Medio: inconsistencia real pero de ventana angosta o bajo uso.
- Bajo: feedback enganoso o falta de robustez, sin perdida de datos.

---

## [ALTO] `Date.parse` de timestamps crudos de MySQL sin normalizar a UTC

- Archivo: `src/modules/scanner/scanner.service.js:359` y `:383` (dentro de
  `buildShiftSummary`, en los `forEach` de `cashPaymentRows` y de
  `customerAccountPaymentRows`).
- `row.created_at` viene crudo de MySQL (`dateStrings: true`, sin timezone en
  el string) y se le hace `Date.parse(row.created_at)` directo.
- En cambio `shift.openedAt`/`shift.closedAt` (contra los que se compara en
  `findShiftByTimestamp`) SI pasan por `toCanonicalIsoUtc`, que agrega la `Z`
  antes de parsear.
- Confirmado en vivo en este entorno (`America/Montevideo`, UTC-3):
  `Date.parse('2026-08-01 14:23:45')` da un resultado 3 horas distinto que
  `Date.parse('2026-08-01T14:23:45.000Z')`.
- Riesgo concreto: si el proceso Node de produccion no corre exactamente en
  UTC, un cobro (caja o cuenta corriente) cerca de un cambio de turno puede
  quedar asignado al turno equivocado. Es el mismo sintoma que el bug de
  "sobra/falta plata en el cajon" que ya arreglamos, pero por otra causa.
- Nota: el propio `scanner.service.test.js` tiene comentarios que separan los
  timestamps de prueba por un dia entero "para evitar falsos positivos por el
  offset de zona horaria" - eso hay que sacarlo cuando se arregle de raiz, ya
  que en ese momento el test deberia poder usar timestamps cercanos sin
  problema.
- Fix sugerido: usar `toCanonicalIsoUtc(row.created_at)` en vez de
  `Date.parse(row.created_at)` en ambos `forEach`, igual que ya se hace en
  `toShiftSummaryItem`.

## [ALTO] "Monto actual" del dashboard vs. suma de "monto actual" por turno usan formulas distintas

- Archivo: `src/modules/scanner/scanner.service.js:1292-1297` (`getScannerDashboard`,
  `physicalCashAmount`) vs `:397-403` (`buildShiftSummary`, `cashExpectedTotal`/`cashCurrentTotal`).
- El total del dia usa `storedInitialCash` (un unico valor en
  `scanner_dashboard_daily`, cargado una vez por dia).
- El total por turno usa `shift.openingCash` (`opening_cash` de CADA fila de
  `scanner_shifts`, cargado independientemente al abrir cada turno).
- Riesgo concreto: si se abren dos turnos el mismo dia y el operario carga de
  nuevo el monto fisico contado en el segundo `opening_cash` (en vez de 0 o
  arrastre), el dashboard general y la suma de turnos van a mostrar numeros
  distintos sin ninguna explicacion visible.
- No hay validacion que fuerce que `opening_cash` de un segundo turno del
  mismo dia sea consistente con el criterio usado en el dashboard.

## [ALTO] `deleteScannerCustomer` sin lock de fila - deuda nueva puede quedar invisible

- Archivo: `src/modules/scanner/scanner.service.js:1030-1050` +
  `deactivateCustomerById` en `scanner.repository.js:1200-1214`.
- A diferencia de `createSaleTicket` y `createCustomerAccountPayment` (que
  bloquean la fila del cliente con `FOR UPDATE`), borrar/desactivar un
  cliente NO usa transaccion ni lock.
- Riesgo concreto: admin ve deuda $0 y aprieta "eliminar" justo cuando un
  operario le registra una venta a cuenta nueva a ese mismo cliente. Si el
  chequeo de deuda corrio antes del commit de esa venta, el cliente queda
  `is_active = 0` con deuda real pendiente. Como `listCustomersWithDebt`
  filtra `WHERE is_active = 1`, esa deuda deja de aparecer en cualquier
  reporte - plata perdida de vista, no solo un dato viejo.

## [ALTO] Ventas y pagos no revalidan `is_active` del cliente dentro de la transaccion

- Archivo: `src/modules/scanner/scanner.repository.js:293-296` (`createSaleTicket`)
  y `:686-689` (`createCustomerAccountPayment`).
- Ambos hacen `SELECT id FROM customers WHERE id = ? FOR UPDATE` (bloquean la
  fila) pero no verifican `is_active` ahi mismo; esa validacion ocurre antes,
  en una consulta separada en `scanner.service.js`, fuera de la transaccion.
- Combinado con el punto anterior: si `deactivateCustomerById` corre entre el
  chequeo del service y el `FOR UPDATE` del repository, la venta/pago se
  inserta igual sobre un cliente ya desactivado.

## [MEDIO] `updateStockRequest` no revalida `status = 'pending'` en el reemplazo de items

- Archivo: `src/modules/scanner/scanner.repository.js:1696-1748`.
- El `UPDATE provider_name ... WHERE status = 'pending'` no chequea
  `affectedRows`, y el `DELETE`+`INSERT` de `stock_request_items` que sigue
  se ejecuta siempre, sin condicion de estado.
- Riesgo concreto: operario edita un pedido pendiente mientras el admin lo
  marca resuelto en simultaneo. La edicion se guarda igual sobre un pedido ya
  cerrado, sin ningun error visible - queda una lista de items distinta a la
  que el admin efectivamente resolvio.

## [MEDIO] `GET /products` y `/products/lookup` sin autenticacion

- Archivo: `src/modules/scanner/scanner.routes.js:40-41`, declaradas antes de
  `router.use(requireAuth)`.
- Cualquiera sin sesion puede listar/buscar todo el catalogo (nombre, precio
  de venta, stock actual, imagen) sin login.
- Puede ser intencional (lookup rapido del scanner), pero hay que confirmarlo
  a proposito - no hay rate limiting visible que lo mitigue.

## [MEDIO] Acceso a "Diagnostico" hardcodeado contra un username literal

- Archivo: `src/modules/scanner/scanner.controller.js:449-456`.
- Ademas del RBAC normal de la ruta (`requirePermission`), el controller
  agrega un segundo chequeo `if (currentUsername !== 'staff')`, ignorando el
  sistema de roles/permisos del resto de la app.
- Fragil: si se renombra ese usuario o se necesita dar acceso a otro admin,
  el acceso a monitoreo se rompe o queda mal habilitado sin relacion con el
  RBAC real.

## [BAJO] `markStockRequestResolved` ignora si realmente afecto una fila

- Archivo: `src/modules/scanner/scanner.service.js:1657`.
- Si dos personas con permiso resuelven el mismo pedido casi al mismo tiempo,
  el segundo `UPDATE` afecta 0 filas (protegido bien a nivel DB) pero el
  service responde `{ ok: true }` igual, como si esa accion hubiese cerrado
  el pedido. No corrompe datos, pero el mensaje de exito es enganoso.

## [BAJO] `resetScannerShiftsByDate` borra turnos cerrados con historial, no solo huerfanos

- Archivo: `src/modules/scanner/scanner.repository.js:463-505`.
- El `DELETE FROM scanner_shifts WHERE business_date = ?` no filtra por
  `status`: borra turnos abiertos Y cerrados del dia. Las ventas asociadas a
  turnos cerrados pierden la referencia (`shift_id` queda `NULL` por el
  `ON DELETE SET NULL`), sin distinguir "resetear turnos sin uso" de "borrar
  turnos con historial real". Es irreversible.
