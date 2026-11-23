import { DIGEST_AWAY_MS } from '@/notifications/domain/digest';

import type { GuideArticle } from '../guide';

const awayMinutes = DIGEST_AWAY_MS / 60_000;
const away =
  awayMinutes % 60 === 0
    ? `${awayMinutes / 60} hour${awayMinutes === 60 ? '' : 's'}`
    : `${awayMinutes} minutes`;

export const activityAndNotifications: GuideArticle = {
  slug: 'activity-and-notifications',
  title: 'Activity and notifications',
  covers: ['M2.1', 'M2.2', 'M2.3', 'M2.4', 'M2.5', 'M2.6', 'M2.7'],
  body: `**Activity** collects what needs you: mentions of you, replies in threads you take part in, reactions to your messages, and being added to a channel. Switch between **All** and **Unread**, and use **Mark all read** to clear it.

**Notifications for each channel.** From a channel's menu, choose **All new messages**, **Mentions only**, or **Nothing**. **Mute** a channel to silence it.

**Do Not Disturb** pauses notifications on a schedule, such as every night, or as a snooze for a while.

**Browser push notifications** reach you while Conduit is in the background. Turn them on under **Settings > Notifications**.

**Email digest.** When you have been away for ${away} with unread mentions, Conduit emails you a digest of them.`,
};
