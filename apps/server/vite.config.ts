import { resolve } from 'node:path';

import { cloudflare } from '@cloudflare/vite-plugin';
import { defineConfig, normalizePath } from 'vite';

// The Worker bundles `nest build` output (SWC emits the decorator metadata Nest needs).
// It swaps the Node Prisma client for the workerd one, which imports its Wasm as a module.
const nodeClient = normalizePath(resolve('dist/generated/prisma'));
const workerClient = normalizePath(resolve('generated/prisma-worker'));

export default defineConfig({
  build: { minify: true },
  plugins: [
    {
      name: 'conduit:prisma-worker-client',
      enforce: 'pre',
      async resolveId(source, importer, options) {
        const resolved = await this.resolve(source, importer, {
          ...options,
          skipSelf: true,
        });
        if (!resolved?.id.startsWith(`${nodeClient}/`)) return null;
        return resolved.id
          .replace(nodeClient, workerClient)
          .replace(/\.js$/, '.ts');
      },
    },
    {
      // import.meta.url is undefined in workerd, so the package's createRequire throws at load.
      // Its two lazy requires become static imports the bundle can carry.
      name: 'conduit:nestjs-better-auth-requires',
      transform(code, id) {
        if (!id.includes('@thallesp/nestjs-better-auth/dist/index.mjs'))
          return null;
        return [
          "import __express from 'express';",
          "import __qs from 'qs';",
          code.replaceAll(
            'createRequire(import.meta.url)',
            '((name) => ({ express: __express, qs: __qs })[name])'
          ),
        ].join('\n');
      },
    },
    cloudflare(),
  ],
});
