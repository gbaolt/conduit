import { MESSAGE_BODY_MAX } from '@conduit/contract';

import type { GuideArticle } from '../guide';

export const messages: GuideArticle = {
  slug: 'messages',
  title: 'Writing and editing messages',
  covers: [
    'M1.1',
    'M1.2',
    'M1.3',
    'M1.4',
    'M1.5',
    'M1.7',
    'M1.8',
    'M1.9',
    'M1.10',
    'M1.11',
    'M1.12',
    'M1.13',
  ],
  body: `Messages reach everyone with the conversation open as soon as you send them. A message holds up to ${MESSAGE_BODY_MAX.toLocaleString('en-US')} characters.

- **Formatting.** The message box takes Markdown shortcuts, such as \`**bold**\`, \`_italic_\`, \`\` \`code\` \`\`, lists, and quotes, and it has a formatting bar.
- **Mentions.** Type \`@\` to mention a person, \`@channel\` to notify everyone in the channel, or \`@here\` for everyone in it who is online.
- **Edit or delete** your own messages from the message's menu.
- **Reactions.** Add an emoji reaction to any message.
- **Pins.** Pin a message to the conversation, so everyone finds it in its pinned list.
- **Save for later.** Save any message to come back to it. Only you see what you saved.
- **Drafts.** What you type and don't send is kept as a draft for that conversation.
- **Link previews** show under a message that holds a link.

You also see unread markers where you stopped reading, who is typing, and whether a person is online or away.`,
};
