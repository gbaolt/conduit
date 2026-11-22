import type { GuideArticle } from '../guide';

export const membersAndRoles: GuideArticle = {
  slug: 'members-and-roles',
  title: 'Members and roles',
  covers: ['M0.4', 'M0.5', 'M0.6'],
  body: `Every member of a workspace has one role.

- **Owner.** Everything an admin can do, and the only role that can make or change another owner.
- **Admin.** Manages members, invitations, settings, and the AI switch.
- **Member.** Chats, shares files, and uses the AI features.

Under **Settings > Members**, an admin changes a member's role, removes a member from the workspace, or deactivates a member. A deactivated member loses access to the workspace until an admin reactivates them. Their messages stay.

To learn who the admins of your workspace are, ask Ask Conduit "who are the admins?" or look at Settings > Members.`,
};
