import { bindings, defineConfig } from 'cf/config';

const secrets = [
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'BETTER_AUTH_TRUSTED_ORIGIN',
  'AUTH_COOKIE_DOMAIN',
  'AUTH_EMAIL_FROM',
  'APP_URL',
  'ARCJET_KEY',
  'ARCJET_ENV',
  'RESEND_API_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
] as const;

// Values come from `.dev.vars` locally and from `cf deploy --secrets-file` in production.
export default defineConfig({
  worker: {
    name: 'conduit-server',
    entrypoint: './dist/src/worker.js',
    compatibilityDate: '2026-10-20',
    compatibilityFlags: ['nodejs_compat'],
    domains: ['api.conduit.giabao.dev'],
    workersDev: true,
    previewUrls: true,
    env: {
      NODE_ENV: bindings.text('production'),
      ...Object.fromEntries(secrets.map((name) => [name, bindings.secret()])),
    },
    observability: { enabled: true },
  },
});
