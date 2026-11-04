import { nodeConfig } from '@conduit/config/eslint/node';

const frameworks = {
  group: [
    '@orpc/*',
    'express',
    'better-auth',
    'better-auth/*',
    '@thallesp/*',
    '@generated/*',
    '@prisma/*',
    '@arcjet/*',
  ],
  message:
    'Inner layers stay framework-free. Put this behind a port in domain/ and implement it in infrastructure/.',
};

const outerLayers = (...layers) => ({
  group: layers.map((layer) => `**/${layer}/**`),
  message: `Dependencies point inward: this layer must not import ${layers.join(' or ')}.`,
});

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nodeConfig,
  { ignores: ['generated/**'] },
  {
    files: ['src/**/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { ...frameworks, group: [...frameworks.group, '@nestjs/*'] },
            outerLayers('application', 'infrastructure', 'presentation'),
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/application/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [frameworks, outerLayers('infrastructure', 'presentation')],
        },
      ],
    },
  },
  {
    files: ['src/**/presentation/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@generated/*',
                '@/*/infrastructure/**',
                '@/infrastructure/database/**',
              ],
              message:
                'Controllers call application services. Repositories and Prisma stay in infrastructure/.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/*/infrastructure/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [outerLayers('presentation')] },
      ],
    },
  },
];
