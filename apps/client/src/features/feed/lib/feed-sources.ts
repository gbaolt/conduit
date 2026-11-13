import type { FeedSource } from '@conduit/contract';
import {
  IconAt,
  IconHash,
  IconMessageCircle,
  IconMessages,
  IconMoodSmile,
  type TablerIcon,
} from '@tabler/icons-react';

/** How the filter and a row name each source. */
export const FEED_SOURCE_META: Record<
  FeedSource,
  { label: string; Icon: TablerIcon }
> = {
  dm: { label: 'DMs', Icon: IconMessageCircle },
  mention: { label: 'Mentions', Icon: IconAt },
  thread_reply: { label: 'Threads', Icon: IconMessages },
  reaction: { label: 'Reactions', Icon: IconMoodSmile },
  room_add: { label: 'Added to channels', Icon: IconHash },
};
