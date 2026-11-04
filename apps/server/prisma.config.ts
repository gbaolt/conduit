import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

const root = dirname(fileURLToPath(import.meta.url));

config({ path: resolve(root, '.env') });

export default defineConfig({
  schema: 'database/schema.prisma',
  migrations: {
    path: 'database/migrations',
  },
  // process.env, not env(), so `prisma generate` runs without a database, as on Workers Builds.
  datasource: {
    url: process.env.DATABASE_URL,
    shadowDatabaseUrl: process.env.DATABASE_DIRECT_URL,
  },
});
