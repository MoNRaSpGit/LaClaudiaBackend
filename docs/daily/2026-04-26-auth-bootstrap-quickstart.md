# 2026-04-26 - Auth Bootstrap Quickstart

## Objetivo del ajuste

Reducir friccion para levantar login real local sin cargar claves en texto plano.

## Entregado

- Nuevo script:
  - `npm run auth:hash-password -- "<clave>"`
  - salida: `sha256:<hex>`
- Documentacion actualizada:
  - `README.md` con pasos de bootstrap admin end-to-end.
  - `.env.example` con pista explicita para generar hash.
  - `docs/bitacora.md` con flujo recomendado.

## Resultado

El equipo puede crear/actualizar admin local de forma repetible y segura para pruebas de login, sin exponer password real en el repositorio.
