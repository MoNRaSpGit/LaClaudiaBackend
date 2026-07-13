import { createApp } from './app.js';
import { env } from './config/env.js';
import { ensureCoreSchema } from './scripts/ensureCoreSchema.js';

const app = createApp();

async function start() {
  await ensureCoreSchema();

  app.listen(env.port, () => {
    console.log(`[laclau-backend] running on port ${env.port}`);
    console.log(`[laclau-backend] CORS origins: ${env.frontendOrigins.join(', ')}`);
  });
}

start().catch((error) => {
  console.error(`[laclau-backend] startup error: ${error?.message || error}`);
  process.exit(1);
});
