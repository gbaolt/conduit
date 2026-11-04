declare module 'cloudflare:node' {
  import type { Server } from 'node:http';

  export function httpServerHandler(server: Server): ExportedHandler;
  type ExportedHandler = { fetch(request: Request): Promise<Response> };
}
