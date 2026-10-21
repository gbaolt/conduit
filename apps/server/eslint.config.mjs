import { nodeConfig } from '@conduit/config/eslint/node';

/** @type {import("eslint").Linter.Config[]} */
export default [...nodeConfig, { ignores: ['generated/**'] }];
