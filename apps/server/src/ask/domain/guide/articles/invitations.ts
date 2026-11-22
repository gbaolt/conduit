import type { GuideArticle } from '../guide';

export const invitations: GuideArticle = {
  slug: 'invitations',
  title: 'Inviting people',
  covers: ['M0.1', 'M0.2', 'M0.3', 'M0.9'],
  body: `Only an owner or an admin can invite people.

- **By email.** Under **Settings > Invitations**, invite one or more addresses. Each person gets an email with a link to join.
- **By link.** Under **Settings > Access**, an admin copies a shareable join link. Resetting it stops the old link from working.
- **By email domain.** Also under Settings > Access, an admin lists email domains, such as your company's. Anyone who signs up with an address on a listed domain can join without an invitation.

A pending invitation can be revoked under Settings > Invitations, and its link stops working.`,
};
