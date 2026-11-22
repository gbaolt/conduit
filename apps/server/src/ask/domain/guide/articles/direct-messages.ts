import { DM_MEMBERS_MAX } from '@conduit/contract';

import type { GuideArticle } from '../guide';

export const directMessages: GuideArticle = {
  slug: 'direct-messages',
  title: 'Direct messages',
  covers: ['M1.14', 'M1.15', 'M1.16', 'M1.17'],
  body: `A direct message, or DM, is a private conversation outside of channels. Only the people in it can read it.

- **One-on-one DMs** with any member of the workspace.
- **Group DMs** of up to ${DM_MEMBERS_MAX} people, including you.
- A group DM can't grow past ${DM_MEMBERS_MAX}. Adding one more person offers **Turn into a private channel** instead, which keeps the conversation going as a private channel.
- **A DM with yourself** works as a notepad.

Ask Conduit never reads DMs.`,
};
