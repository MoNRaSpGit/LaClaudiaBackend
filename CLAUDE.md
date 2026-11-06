# Contexto para Claude Code - LaClaudia Backend

Este archivo se carga solo al trabajar en este repo. Es el punto de entrada
para que un chat nuevo recupere el contexto de como se trabaja aca, sin
tener que releer toda la conversacion anterior.

## Leer primero, en este orden

1. `docs/architecture.md` - modulos, modelo de datos, convenciones de capas.
2. `docs/bitacora.md` - historial de entregas, de mas vieja a mas nueva. Las
   entradas mas recientes (abajo del archivo) son las que mas importan.
3. `docs/daily/` - un archivo por entrega grande con el detalle tecnico
   completo (que cambio, por que, que tests corrieron). La bitacora linkea
   al daily correspondiente cuando hace falta mas detalle.
4. `docs/deuda-tecnica.md` - lo que se sabe roto o pendiente y todavia no se
   atendio.

## Que es este proyecto

Backend de LaClaudia: un sistema de punto de venta / scanner / inventario
para un negocio real con cliente final (no es un proyecto de juguete). Hay
un repo hermano `LaClaudiaFront` (en `../LaClaudiaFront`) que es el
frontend React que consume esta API.

## Arquitectura y convenciones de codigo

- Node.js + Express + MySQL (`mysql2`) via pool de conexiones.
- Modular: `src/modules/<nombre>/{routes,controller,service,repository,model}.js`.
- Las migraciones de esquema viven en `src/scripts/ensureCoreSchema.js` y
  corren solas en cada arranque del servidor (`ensureColumn`/`ensureIndex`/
  `ensureForeignKey`, todas chequean `information_schema` antes de alterar:
  son idempotentes, se pueden correr mil veces sin romper nada).
- Diseño de esquema aditivo por regla: una columna nueva tiene que tener un
  default tal que todas las filas EXISTENTES sigan calculando exactamente
  igual que antes del cambio (ej: `points_used DEFAULT 0`, `allows_account_sales
  DEFAULT 1` para no romper clientes ya cargados).
- Columna nullable + indice `UNIQUE` es el patron para campos nuevos
  obligatorios-para-altas-nuevas-pero-no-para-datos-viejos (ej: `cedula`):
  MySQL permite multiples `NULL` en un `UNIQUE INDEX`, asi que los clientes
  viejos sin el dato no rompen el indice ni necesitan backfill.
- RBAC en `src/modules/auth/auth.rbac.js` (`ROLES`, `PERMISSIONS`,
  `ROLE_PERMISSIONS`, `roleHasPermission()`). Antes de agregar un permiso
  nuevo, mirar como estan armados los existentes y elegir el rol minimo
  necesario (default conservador: `admin`-only si hay duda).
- Tests con Vitest: `npm test -- --run`. Correrlos siempre antes de pushear.

## Infraestructura / deploy

- Backend: Render (plan pago), redeploya solo al pushear a `main`.
- Frontend: GitHub Pages, workflow `.github/workflows/deploy-gh-pages.yml`
  en el repo `LaClaudiaFront`, auto-deploya al pushear a `main`.
- Base de datos: MySQL en Clever Cloud (apodada "pay oriol" en su panel).
- Para confirmar que un deploy de backend quedo estable: pollear
  `GET /api/health` un rato despues del push y confirmar
  `database.ok: true` de forma sostenida (las migraciones de
  `ensureCoreSchema` corren en el arranque).

## Disciplina de trabajo esperada

- Antes de cualquier cambio de esquema o de comportamiento de venta/deuda/
  puntos, anotar el commit actual como "punto seguro para volver" (se lo
  comunica al usuario explicitamente, no alcanza con que quede en el log de
  git sin decirlo).
- El usuario valida explicitamente antes de pushear, salvo que ya haya dado
  luz verde para ese cambio puntual en la conversacion actual.
- Despues de cada push, confirmarle al usuario: que se subio, que quedo
  estable en produccion, y cual es el punto de rollback.
- Si una regla de negocio no esta clara (tasas, redondeos, que pasa en un
  caso borde), preguntar antes de implementar - no asumir. Las reglas que
  terminan acordadas con el usuario quedan documentadas en el daily
  correspondiente para poder mostrarselas despues al cliente real.

## Sobre documentacion para el cliente final

El usuario tiene un cliente real que usa el sistema. Cuando pide texto para
mandarle a ese cliente (explicaciones de como usar una funcionalidad,
reglas de puntos, etc.), la preferencia confirmada es: texto plano, en
renglones cortos y numerados, directo en el chat - no un documento
elaborado. Si el texto se va a pegar en WhatsApp, pedirlo o darlo dentro de
un bloque de codigo (tres backticks) para que no se pierda la numeracion al
copiar.
