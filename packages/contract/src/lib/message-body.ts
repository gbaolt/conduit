import { z } from 'zod';

export const MESSAGE_BODY_MAX = 4000;

/** Markdown text, at most 4,000 characters, and not blank. */
export const MessageBodySchema = z
  .string()
  .max(MESSAGE_BODY_MAX, `Use ${MESSAGE_BODY_MAX} characters or fewer.`)
  .refine((body) => body.trim().length > 0, 'Write a message.');

export type ParsedMentions = {
  userIds: string[];
  channel: boolean;
  here: boolean;
};

const MENTION = /<@([\w-]+)>/g;

/** Reads `<@userId>`, `<@channel>`, and `<@here>`. Each user id appears once, in order. */
export function parseMentions(body: string): ParsedMentions {
  const userIds = new Set<string>();
  let channel = false;
  let here = false;

  for (const [, target = ''] of body.matchAll(MENTION)) {
    if (target === 'channel') channel = true;
    else if (target === 'here') here = true;
    else userIds.add(target);
  }

  return { userIds: [...userIds], channel, here };
}
