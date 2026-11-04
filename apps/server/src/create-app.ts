import { contract } from '@conduit/contract';
import { NestFactory } from '@nestjs/core';
import { OpenAPIGenerator } from '@orpc/openapi';
import { OpenAPIHandler } from '@orpc/openapi/node';
import { OpenAPIReferenceHandlerPlugin } from '@orpc/openapi/plugins';
import { ZodToJsonSchemaConverter } from '@orpc/zod';
import type { NextFunction, Request, Response } from 'express';

import { getTrustedOrigins } from '@/infrastructure/auth/trusted-origins';

import { AppModule } from './app.module';

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

/** The configured Nest app, before it listens. Shared by the Node server and the Worker. */
export async function createApp() {
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

  return app;
}
