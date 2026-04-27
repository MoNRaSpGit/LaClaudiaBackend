# LaClaudia Backend

API Node + Express + MySQL para el flujo de scanner.

## Scripts

- `npm run dev`
- `npm start`
- `npm run db:prepare:scanner`
- `npm run db:prepare:core`
- `npm run db:prepare:all`
- `npm run auth:hash-password -- "<clave>"`
- `npm run auth:cleanup-sessions`

## Arquitectura

- MVC modular por feature en `src/modules`.
- Ver detalle en `docs/architecture.md`.
- Estado de trabajo y avances: `docs/bitacora.md`.

## Para nuevo agente

Leer en orden:
1. `README.md`
2. `docs/contracts-auth-sales.md`
3. `docs/bitacora.md`
4. `src/modules/auth/*`, `src/modules/scanner/*`, `src/scripts/*`

## Endpoints

- `GET /api`
- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/scanner/products?limit=5`
- `GET /api/scanner/products/lookup?barcode=...`
- `GET /api/scanner/dashboard`
- `POST /api/scanner/sales`
- `POST /api/scanner/payments`

Permisos por rol:
- `admin`: acceso total (`dashboard`, `sales`, `payments`).
- `operario`: solo flujo scanner operativo (`sales`), sin panel (`dashboard`) ni pagos manuales.

Contrato de estos endpoints: `docs/contracts-auth-sales.md`

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
- `AUTH_BOOTSTRAP_ADMIN_USER=...` (opcional)
- `AUTH_BOOTSTRAP_ADMIN_PASSWORD_HASH=...` (opcional)
- `AUTH_BOOTSTRAP_ADMIN_DISPLAY_NAME=...` (opcional)
- `AUTH_SESSION_HOURS=12` (opcional)
- `AUTH_SESSION_CLEANUP_RETENTION_DAYS=7` (opcional)
- `AUTH_SESSION_CLEANUP_BATCH_SIZE=500` (opcional)

## Preparacion de BDD (nuevo)

- `npm run db:prepare:core` crea/asegura tablas base para:
  - `auth_users`
  - `sales_tickets`
  - `sales_ticket_items`
  - `cash_payments`
- Tambien asegura:
  - foreign keys entre ventas/items/usuarios
  - indices para consultas rapidas de caja/dashboard
  - admin bootstrap opcional si se define `AUTH_BOOTSTRAP_ADMIN_*`

## Bootstrap admin rapido (login local)

1. Generar hash de clave (por defecto `scrypt`, mas robusto):
   - `npm run auth:hash-password -- "1234"`
   - legacy opcional: `npm run auth:hash-password -- "1234" --sha256`
2. Copiar el resultado (`scrypt:...` recomendado) en `.env`:
   - `AUTH_BOOTSTRAP_ADMIN_USER=admin`
   - `AUTH_BOOTSTRAP_ADMIN_PASSWORD_HASH=scrypt:...`
   - `AUTH_BOOTSTRAP_ADMIN_DISPLAY_NAME=Admin`
3. Preparar esquema:
   - `npm run db:prepare:all`
4. Levantar API:
   - `npm run dev`
5. Probar login:
   - `POST /api/auth/login` con `{"username":"admin","password":"1234"}`

Notas:
- El hash se procesa localmente y no se persiste la clave en texto plano.
- No commitear `.env` ni credenciales reales.
- `dashboard`, `sales` y `payments` requieren `Authorization: Bearer <token>` activo.

## Limpieza de sesiones (cron)

- Dry run:
  - `npm run auth:cleanup-sessions -- --dry-run`
- Ejecucion real:
  - `npm run auth:cleanup-sessions`
- Recomendado en Render: job cada 1h o 1 dia, segun trafico.

## Render

- Build Command: `npm install`
- Start Command: `npm start`
- Root Directory: vacio
