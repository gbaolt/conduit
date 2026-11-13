import { z } from 'zod';

/** The four things that put an item in a member's Activity. */
export const ActivityKindSchema = z.enum([
  'mention',
  'thread_reply',
  'reaction',
  'room_add',
]);
export type ActivityKind = z.infer<typeof ActivityKindSchema>;
