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
const LINK = /https?:\/\/[^\s<>()[\]"'`]+/gi;

/** The http and https links in text order, without trailing punctuation. */
export function* linksIn(body: string): Generator<string, void> {
  for (const [link] of body.matchAll(LINK)) {
    yield link.replace(/[.,;:!?*_~]+$/, '');
  }
}

/** The first http or https link in the text, without trailing punctuation. */
export function firstLink(body: string) {
  return linksIn(body).next().value ?? null;
}

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

/** Markdown reduced to the text a person reads: mentions as `@name`, links as their label, no markers. */
export function plainText(
  markdown: string,
  mentionNames: Record<string, string>
) {
  return markdown
    .replace(/<@([\w-]+)>/g, (_, id: string) => `@${mentionNames[id] ?? id}`)
    .replace(/```[^\n]*\n?/g, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/(\*\*|__|~~|[*_`])/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
