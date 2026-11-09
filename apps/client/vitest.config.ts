import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  // tsconfig keeps JSX as-is for Next, so tests transform it here.
  oxc: { jsx: { runtime: 'automatic' } },
  test: { include: ['src/**/*.test.{ts,tsx}', 'eslint-rules/**/*.test.mjs'] },
});
