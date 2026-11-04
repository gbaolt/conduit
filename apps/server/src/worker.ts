import 'reflect-metadata';

import { createServer, type RequestListener } from 'node:http';

import { httpServerHandler } from 'cloudflare:node';

import { createApp } from './create-app';

let listener: Promise<RequestListener> | undefined;

// Workers forbid I/O at module scope, so Nest boots on the first request and is reused after.
function getListener() {
  listener ??= createApp().then(async (app) => {
    await app.init();
    return app.getHttpAdapter().getInstance() as RequestListener;
  });
  listener.catch(() => {
    listener = undefined;
  });
  return listener;
}

const server = createServer((req, res) => {
  getListener().then(
    (handle) => handle(req, res),
    (error: unknown) => {
      console.error('[worker] Nest failed to boot', error);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  );
});

export default httpServerHandler(server);
