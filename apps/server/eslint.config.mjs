import { nodeConfig } from '@conduit/eslint-config/node';

/** @type {import("eslint").Linter.Config[]} */
export default [...nodeConfig, { ignores: ['generated/**'] }];
