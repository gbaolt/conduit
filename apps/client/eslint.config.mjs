import { nextJsConfig } from '@conduit/config/eslint/next-js';

import conduit from './eslint-rules/family-prefix.mjs';

// Each feature lists the features it may import. Adding an edge here is the
// review point for a new cross-feature dependency.
const featureDeps = {
  auth: [],
  onboarding: ['auth'],
  workspace: ['channels'],
  rooms: ['workspace', 'messages'],
  channels: ['rooms'],
  dms: ['rooms'],
  messages: ['rooms', 'channels', 'dms'],
  feed: ['rooms', 'messages'],
  threads: ['rooms', 'messages'],
  directoris: ['workspace', 'channels'],
};

const services = [
  'activity',
  'auth',
  'channels',
  'dms',
  'feed',
  'messages',
  'notifications',
  'rooms',
  'workspaces',
];

const roomKinds = ['channels', 'dms'];

const roomMessage = (layer) =>
  `Room kinds stay independent: put code both kinds need in ${layer}/rooms, and import it from there.`;

const scope = (path) => [path, `${path}/**`];

const orpc = {
  group: ['@/lib/orpc'],
  message: 'Reach the API through a query or hook in services/<domain>/.',
};

const authClient = {
  group: ['@/services/auth/client'],
  message: 'Call auth through a hook in services/auth/hooks.ts.',
};

function featureRules(feature) {
  const allowed = new Set([feature, ...featureDeps[feature]]);
  const blocked = Object.keys(featureDeps).filter((f) => !allowed.has(f));
  const isRoom = feature === 'rooms' || roomKinds.includes(feature);
  const roomBlocked = blocked.filter((f) => isRoom && roomKinds.includes(f));
  const otherBlocked = blocked.filter((f) => !roomBlocked.includes(f));

  return [
    roomBlocked.length > 0 && {
      group: roomBlocked.flatMap((f) => scope(`@/features/${f}`)),
      message: roomMessage('features'),
    },
    otherBlocked.length > 0 && {
      group: otherBlocked.flatMap((f) => scope(`@/features/${f}`)),
      message: `features/${feature} imports only ${[...allowed].join(', ')}. Move code a second feature needs up to components/, hooks/ or lib/, or add the edge to featureDeps in apps/client/eslint.config.mjs.`,
    },
    orpc,
    feature !== 'auth' && authClient,
  ].filter(Boolean);
}

function serviceRules(service) {
  const isRoom = service === 'rooms' || roomKinds.includes(service);
  const roomBlocked = isRoom ? roomKinds.filter((k) => k !== service) : [];

  return [
    {
      group: scope('@/features'),
      message:
        'services/ sits below features/. Move what this needs into services/ or lib/.',
    },
    roomBlocked.length > 0 && {
      group: roomBlocked.flatMap((s) => scope(`@/services/${s}`)),
      message: roomMessage('services'),
    },
  ].filter(Boolean);
}

const searchParams = {
  name: 'next/navigation',
  importNames: ['useSearchParams'],
  message:
    'Read and set search params with nuqs (useQueryState / useQueryStates). See DESIGN.md › Code style.',
};

const restrict = (files, patterns) => ({
  files,
  rules: {
    'no-restricted-imports': ['error', { patterns, paths: [searchParams] }],
  },
});

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextJsConfig,
  restrict(
    ['src/app/**', 'src/components/**', 'src/hooks/**'],
    [orpc, authClient]
  ),
  {
    files: ['src/app/**'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          property: 'fetchQuery',
          message:
            'fetchQuery throws when the API refuses, and a route that throws loses the page. Prefetch with prefetchQuery, or load the data in the browser.',
        },
      ],
    },
  },
  ...Object.keys(featureDeps).map((feature) =>
    restrict([`src/features/${feature}/**`], featureRules(feature))
  ),
  ...services.map((service) =>
    restrict([`src/services/${service}/**`], serviceRules(service))
  ),
  {
    files: ['src/features/**/components/**/*.tsx', 'src/components/**/*.tsx'],
    ignores: ['src/components/editor/**'],
    plugins: { conduit },
    rules: { 'conduit/family-prefix': 'error' },
  },
  {
    files: ['src/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          // A render prop hands the element to a primitive, and a file input has no primitive.
          selector:
            'JSXOpeningElement[name.name=/^(button|input|select|textarea|table|dialog|fieldset|legend|label)$/]:not(JSXAttribute > JSXExpressionContainer > JSXElement > JSXOpeningElement):not(:has(JSXAttribute[name.name="type"][value.value="file"]))',
          message:
            'Just use shadcn: build controls and forms (Field) from @conduit/ui/components/*. When the primitive is missing, add the shadcn component to packages/ui first.',
        },
        {
          selector: 'Literal[value=/\\btext-primary\\b(?!-)/]',
          message:
            'Links and mention pills use text-link (--color-link), not text-primary. See DESIGN.md › Color.',
        },
        {
          selector:
            ':matches(JSXElement, JSXFragment) > JSXExpressionContainer > ConditionalExpression[alternate.type="Literal"][alternate.raw="null"]',
          message:
            'Use `cond && (…)`. Keep the ternary only when cond is a number, with an eslint-disable-next-line. See DESIGN.md › Code style.',
        },
      ],
    },
  },
];
