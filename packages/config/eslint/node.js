import globals from 'globals';
import { defineConfig } from 'eslint/config';
import { config as baseConfig } from '@conduit/config/eslint/base';

/**
 * ESLint config for Node / NestJS packages (no React / Next).
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const nodeConfig = defineConfig([
  ...baseConfig,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    ignores: ['dist/**', '.turbo/**'],
  },
]);
