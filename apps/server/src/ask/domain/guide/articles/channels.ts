import type { GuideArticle } from '../guide';

export const channels: GuideArticle = {
  slug: 'channels',
  title: 'Channels',
  covers: ['F.6', 'F.8', 'F.9', 'F.10', 'F.11', 'M0.8'],
  body: `A channel is a shared conversation about one topic, team, or project. Every workspace starts with a default channel that every member is in.

- **Public channels** can be found and joined by every member of the workspace.
- **Private channels** 🔒 are open only to the people added to them. They don't show up for anyone else, in browsing or in search.

What you can do with a channel:

- Create one, browse the workspace's channels and join them, rename one, copy its link, leave it, or delete it.
- Archive a channel to keep its history without new messages, and switch a channel between public and private.
- Open its details for the topic, the description, the member list, and its channel managers.

By default any member can create a channel, public or private. An admin can limit who creates channels, and who creates public ones, under **Settings > Permissions**. If you can't create a channel, ask an admin.

The sidebar lists your channels and can be resized by dragging its edge.`,
};
