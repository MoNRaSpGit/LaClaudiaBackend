# LaClaudia Backend

Backend base con Node + Express, listo para Render.

## Scripts

- `npm run dev`: desarrollo con watch.
- `npm start`: produccion.

## Variables de entorno

- `PORT=4000`
- `FRONTEND_URL=http://localhost:5173`

Para varios orígenes permitidos por CORS:

`FRONTEND_URL=https://tu-user.github.io,https://www.tudominio.com`

## Endpoints

- `GET /api`
- `GET /api/health`
- `GET /api/message`
