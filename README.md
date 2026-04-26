# LaClaudia Backend

API Node + Express + MySQL para el flujo de scanner.

## Scripts

- `npm run dev`
- `npm start`
- `npm run db:prepare:scanner`

## Arquitectura

- MVC modular por feature en `src/modules`.
- Ver detalle en `docs/architecture.md`.
- Estado de trabajo y avances: `docs/bitacora.md`.

## Endpoints

- `GET /api`
- `GET /api/health`
- `GET /api/message`
- `GET /api/scanner/products?limit=5`
- `GET /api/scanner/products/lookup?barcode=...`

## Variables de entorno

- `PORT=4000`
- `FRONTEND_URL=http://localhost:5173,https://monraspgit.github.io`
- `DB_HOST=...`
- `DB_PORT=20996`
- `DB_USER=...`
- `DB_PASSWORD=...`
- `DB_NAME=bwbxqngh9d4wr6bnopb3`
- `DB_SSL=false`
- `PRODUCTS_TABLE=clau_prodcutos`

## Render

- Build Command: `npm install`
- Start Command: `npm start`
- Root Directory: vacio
