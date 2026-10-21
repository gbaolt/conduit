import './load-env';
import 'reflect-metadata';

import { contract } from '@conduit/contract';
import { NestFactory } from '@nestjs/core';
import { OpenAPIGenerator } from '@orpc/openapi';
import { OpenAPIHandler } from '@orpc/openapi/node';
import { OpenAPIReferenceHandlerPlugin } from '@orpc/openapi/plugins';
import { ZodToJsonSchemaConverter } from '@orpc/zod';
import type { NextFunction, Request, Response } from 'express';

import { AppModule } from './app.module';
import { getTrustedOrigins } from './auth/trusted-origins';

const generator = new OpenAPIGenerator({
  converters: [new ZodToJsonSchemaConverter()],
});

const docsHandler = new OpenAPIHandler(
  {},
  {
    plugins: [
      new OpenAPIReferenceHandlerPlugin({
        spec: () =>
          generator.generate(contract, {
            base: {
              info: {
                title: 'Conduit API',
                version: '0.1.0',
              },
            },
          }),
      }),
    ],
  }
);

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  app.enableCors({
    origin: getTrustedOrigins(),
    credentials: true,
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    void docsHandler
      .handle(req, res, { prefix: '/docs', context: { request: req } })
      .then(({ matched }) => {
        if (!matched) {
          next();
        }
      })
      .catch(next);
  });

  const port = Number(process.env.PORT ?? 3333);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);
  const publicUrl = process.env.PORTLESS_URL ?? `http://localhost:${port}`;
  console.log(`[server] listening on ${publicUrl} (bind ${host}:${port})`);
}

void bootstrap();
