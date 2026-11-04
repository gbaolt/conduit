// Boots the built server and calls every contract route without a session, so a refactor can diff the results.
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = 3399;
const base = `http://127.0.0.1:${port}`;

const server = spawn(process.execPath, ['dist/src/main.js'], {
  cwd: root,
  env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
  stdio: ['ignore', 'ignore', 'inherit'],
});

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt++) {
    const up = await fetch(`${base}/health`).then(
      (response) => response.ok,
      () => false
    );
    if (up) return;
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error('server did not start');
}

async function call(method, path) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
    },
    body: method === 'GET' ? undefined : '{}',
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, code: body?.code, message: body?.message };
}

try {
  await waitForServer();
  const spec = await (await fetch(`${base}/docs/spec.json`)).json();
  const results = {};
  for (const [template, operations] of Object.entries(spec.paths)) {
    const path = template.replace(/\{[^}]+\}/g, 'probe-id');
    for (const method of Object.keys(operations)) {
      results[`${method.toUpperCase()} ${template}`] = await call(
        method.toUpperCase(),
        path
      );
    }
  }
  results['GET /auth/ok'] = await call('GET', '/auth/ok');
  console.log(JSON.stringify(results, null, 2));
} finally {
  server.kill();
}
