import './load-env';
import 'reflect-metadata';
// Vercel's NestJS builder only accepts an entry file that imports @nestjs/core itself.
import '@nestjs/core';

import { createApp } from './create-app';

async function bootstrap() {
  const app = await createApp();

  const port = Number(process.env.PORT ?? 3333);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);
  const publicUrl = process.env.PORTLESS_URL ?? `http://localhost:${port}`;
  console.log(`[server] listening on ${publicUrl} (bind ${host}:${port})`);
}

void bootstrap();
