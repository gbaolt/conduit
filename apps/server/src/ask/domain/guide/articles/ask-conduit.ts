import { ASK_ATTACHMENTS_MAX, ASK_QUESTION_MAX } from '@conduit/contract';

import type { GuideArticle } from '../guide';

export const askConduit: GuideArticle = {
  slug: 'ask-conduit',
  title: 'Ask Conduit',
  covers: ['M3.11'],
  body: `Ask Conduit answers questions from what your team wrote and shared, and cites a numbered source for each claim. Click a number to open the message, file, or article it came from. Open it from the sparkle button beside the search bar.

**What it can read.**

- Messages and files in the channels you can open: every public channel, and the private channels you belong to.
- Who is in a channel, its topic and description, and the workspace's members and their roles.
- Your own saved messages and unsent drafts.
- This guide, for questions about how Conduit works.
- Files you attach to the question: up to ${ASK_ATTACHMENTS_MAX} images, PDFs, or text files.

**What it can't read.** DMs, emails, invitations, and workspace settings. Ask an admin about a setting.

When nothing it can read answers the question, it says so instead of guessing. A question holds up to ${ASK_QUESTION_MAX} characters, and a chat keeps its earlier turns, so a follow-up such as "and for last week?" works. Your chats are yours alone. Find them again under **Recent chats**.`,
};
