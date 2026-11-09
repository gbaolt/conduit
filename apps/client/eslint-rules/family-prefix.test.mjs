import { RuleTester } from 'eslint';
import { afterAll, describe, it } from 'vitest';

import { familyPrefix } from './family-prefix.mjs';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

tester.run('family-prefix', familyPrefix, {
  valid: [
    {
      filename: 'src/features/rooms/components/room-sidebar.tsx',
      code: 'export function RoomGroup() {} export const RoomItem = () => null;',
    },
    {
      filename: 'src/features/workspace/components/workspace-sidebar/index.tsx',
      code: 'export function WorkspaceSidebar() {}',
    },
    {
      filename: 'src/components/icons/github.tsx',
      code: 'export function GitHubIcon() {}',
    },
    {
      filename: 'src/features/messages/components/conversation/new-marker.tsx',
      code: 'export const NEW_MARKER_MS = 1; export function useThing() {}',
    },
  ],
  invalid: [
    {
      filename: 'src/features/messages/components/message/message-row.tsx',
      code: 'export function PendingRow() {}',
      errors: [
        {
          messageId: 'prefix',
          data: { name: 'PendingRow', family: 'Message' },
        },
      ],
    },
    {
      filename: 'src/components/nav-user.tsx',
      code: 'function UserAvatar() {} export { UserAvatar };',
      errors: [{ messageId: 'prefix' }],
    },
  ],
});
